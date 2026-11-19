const { normalizeJid, resolveCommandTarget } = require('../../Plugin/identityUtils');

const PROTECTED_CONTACTS = new Set([
    '2348077134210@s.whatsapp.net',
    '120495928283239@lid',
]);
const PROTECTED_GROUPS = new Set([
    '120363425067362165@g.us',
    '120363396903069780@g.us',
    '120363426760068896@g.us',
]);
const inFlight = new Set();
const recentReports = new Map();
const REPORT_COOLDOWN_MS = 30 * 60 * 1000;

async function identityVariants(sock, jid) {
    const variants = new Set([normalizeJid(jid)]);
    const mapper = sock?.signalRepository?.lidMapping;
    try {
        if (jid?.endsWith('@lid') && mapper?.getPNForLID) variants.add(normalizeJid(await mapper.getPNForLID(jid)));
        if (jid?.endsWith('@s.whatsapp.net') && mapper?.getLIDForPN) variants.add(normalizeJid(await mapper.getLIDForPN(jid)));
    } catch {}
    variants.delete('');
    return variants;
}

async function isProtectedContact(sock, jid) {
    const variants = await identityVariants(sock, jid);
    return [...variants].some(value => PROTECTED_CONTACTS.has(value));
}

function quotedEvidence(m) {
    const context = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo || {};
    const source = m.quoted?.key?.id ? m.quoted.key : {
        id: context.stanzaId,
        remoteJid: context.remoteJid || m.chat,
        participant: context.participant,
        participantAlt: context.participantAlt,
    };
    if (!source?.id) return [];

    const remoteJid = normalizeJid(source.remoteJid || m.chat);
    if (!remoteJid || remoteJid !== normalizeJid(m.chat)) return [];
    return [{
        id: String(source.id),
        remoteJid,
        fromMe: Boolean(source.fromMe),
        ...(source.participant ? { participant: normalizeJid(source.participant) } : {}),
        ...(source.participantAlt ? { participantAlt: normalizeJid(source.participantAlt) } : {}),
    }];
}

async function evidenceMatchesContact(sock, m, target, evidence) {
    if (!evidence.length || evidence[0].fromMe) return false;
    const author = evidence[0].participant || evidence[0].participantAlt || m.quoted?.sender;
    if (m.isGroup) {
        if (!author) return false;
        const [authorVariants, targetVariants] = await Promise.all([
            identityVariants(sock, author),
            identityVariants(sock, target),
        ]);
        return [...authorVariants].some(jid => targetVariants.has(jid));
    }
    const [chatVariants, targetVariants] = await Promise.all([
        identityVariants(sock, m.chat),
        identityVariants(sock, target),
    ]);
    return [...chatVariants].some(jid => targetVariants.has(jid));
}

module.exports = {
    name: 'report',
    alias: ['reportwa'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Report a contact or explicitly confirmed group',
    execute: async (sock, m, { args, reply, prefix }) => {
        const mode = args[0]?.toLowerCase();
        if (!['contact', 'group'].includes(mode)) {
            return reply('Usage:\n.report contact @user CONFIRM (blocks contact)\n.report group CONFIRM (leaves group)\nReply to the offending message. WhatsApp decides any account restriction.');
        }

        const evidence = quotedEvidence(m);
        if (!evidence.length) return reply('Reply to an offending message so WhatsApp receives report evidence.');

        let target;
        if (mode === 'group') {
            if (!m.isGroup || !m.chat?.endsWith('@g.us')) return reply('Group reports can only run inside the target group.');
            if (args[1] !== 'CONFIRM') return reply(`This reports and leaves the group. Run \`${prefix}report group CONFIRM\` exactly to continue.`);
            target = m.chat;
            if (PROTECTED_GROUPS.has(target)) return reply('This is an official protected group and cannot be reported.');
            if (typeof sock.reportGroup !== 'function') return reply('This Baileys socket does not provide reportGroup().');
        } else {
            if (!args.includes('CONFIRM')) return reply('Contact reports also block the target. Add CONFIRM exactly to continue.');
            target = await resolveCommandTarget(sock, m, args.slice(1).filter(arg => arg !== 'CONFIRM').join(' '));
            if (!target) return reply('Reply to or mention the contact you want to report.');
            if (await isProtectedContact(sock, target)) return reply('This is the official protected account and cannot be reported.');
            const self = await identityVariants(sock, sock.user?.id || '');
            const targetVariants = await identityVariants(sock, target);
            if ([...targetVariants].some(jid => self.has(jid))) return reply('The bot cannot report itself.');
            if (!await evidenceMatchesContact(sock, m, target, evidence)) {
                return reply('The replied evidence must be an incoming message from the contact being reported.');
            }
            if (typeof sock.reportContact !== 'function') return reply('This Baileys socket does not provide reportContact().');
        }

        const requestKey = `${mode}:${target}`;
        const lastReport = recentReports.get(requestKey) || 0;
        const cooldownRemaining = REPORT_COOLDOWN_MS - (Date.now() - lastReport);
        if (cooldownRemaining > 0) return reply(`That target was recently reported. Wait ${Math.ceil(cooldownRemaining / 60000)} minute(s) before trying again.`);
        if (inFlight.has(requestKey)) return reply('That report is already being processed.');
        inFlight.add(requestKey);
        try {
            if (mode === 'group') {
                await sock.reportGroup(target, evidence);
                recentReports.set(requestKey, Date.now());
                return reply('Group reported successfully. WhatsApp has also removed the bot from that group. WhatsApp decides any resulting restrictions.');
            }
            await sock.reportContact(target, evidence);
            recentReports.set(requestKey, Date.now());
            return sock.sendMessage(m.chat, {
                text: `Contact @${target.split('@')[0]} reported and blocked successfully. WhatsApp decides any resulting restrictions.`,
                mentions: [target],
            }, { quoted: m });
        } catch (error) {
            console.error('[REPORT ERROR]', error?.stack || error);
            return reply(`Report failed: ${error?.message || 'unknown WhatsApp error'}`);
        } finally {
            inFlight.delete(requestKey);
        }
    },
    PROTECTED_CONTACTS,
    PROTECTED_GROUPS,
    REPORT_COOLDOWN_MS,
    evidenceMatchesContact,
    identityVariants,
    isProtectedContact,
    quotedEvidence,
};
