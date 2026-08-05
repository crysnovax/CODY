// crysMsg.js
const { getCommand } = require('./crysCmd');
const { getVar }     = require('./configManager');
const chalk = require('chalk');
const fs    = require('fs');
const path  = require('path');

const ENV_PATH  = path.join(process.cwd(), '.env');
const cooldowns = new Map();

const normalizeJid = (jid = '') => jid.replace(/:\d+@/, '@');

// Map-safe contact lookup
const extractPhoneNumber = (jid, store = null) => {
    if (!jid) return null;

    if (jid.endsWith('@s.whatsapp.net')) {
        return jid.split('@')[0].replace(/[^0-9]/g, '');
    }

    if (jid.endsWith('@lid') && store?.contacts) {
        const contacts = store.contacts;

        const getContact = (key) =>
            contacts instanceof Map ? contacts.get(key) : contacts[key];

        const contact = getContact(jid);
        if (contact?.phoneNumber) {
            return contact.phoneNumber.replace(/[^0-9]/g, '');
        }

        const allContacts = contacts instanceof Map
            ? [...contacts.values()]
            : Object.values(contacts);

        const found = allContacts.find(c => c.lid === jid || c.id === jid);
        if (found?.phoneNumber) {
            return found.phoneNumber.replace(/[^0-9]/g, '');
        }
    }

    return jid.split('@')[0].replace(/[^0-9]/g, '');
};

const getAltJid = (m) => {
    if (m.key?.remoteJidAlt)   return m.key.remoteJidAlt;
    if (m.key?.participantAlt) return m.key.participantAlt;

    if (m.message?.extendedTextMessage?.contextInfo?.participant) {
        const ctx = m.message.extendedTextMessage.contextInfo;
        if (ctx.participant !== m.key.participant) return ctx.participant;
    }

    return null;
};

const getSudoList = () => {
    try {
        let fromFile = '';
        if (fs.existsSync(ENV_PATH)) {
            const data  = fs.readFileSync(ENV_PATH, 'utf8');
            const match = data.match(/SUDO_NUMBERS=(.*)/);
            if (match) fromFile = match[1];
        }
        const fromRuntime = String(getVar('SUDO_NUMBERS') || '');

        const list = [fromFile, fromRuntime]
            .filter(Boolean)
            .join(',')
            .split(',')
            .map(n => n.replace(/[^0-9]/g, '').trim())
            .filter(Boolean);

        return [...new Set(list)];
    } catch (e) {
        console.error('[SUDO] Read error:', e.message);
        return [];
    }
};

const isSudoUser = (sender, store = null) => {
    if (!sender) return false;
    const sudoList = getSudoList();
    if (!sudoList.length) return false;

    const identifiers = new Set();
    const primaryNum  = extractPhoneNumber(sender, store);
    if (primaryNum) identifiers.add(primaryNum);

    return sudoList.some(sudoNum => {
        if (identifiers.has(sudoNum)) return true;
        for (const id of identifiers) {
            if (id.endsWith(sudoNum) || sudoNum.endsWith(id) ||
                id.includes(sudoNum) || sudoNum.includes(id)) return true;
        }
        return false;
    });
};

const getDualList = () => {
    try {
        let fromFile = '';
        if (fs.existsSync(ENV_PATH)) {
            const data  = fs.readFileSync(ENV_PATH, 'utf8');
            const match = data.match(/DUAL_NUMBERS=(.*)/);
            if (match) fromFile = match[1];
        }
        const fromRuntime = String(getVar('DUAL_NUMBERS') || '');

        const list = [fromFile, fromRuntime]
            .filter(Boolean)
            .join(',')
            .split(',')
            .map(n => n.replace(/[^0-9]/g, '').trim())
            .filter(Boolean);

        return [...new Set(list)];
    } catch (e) {
        console.error('[DUAL] Read error:', e.message);
        return [];
    }
};

const isDualUser = (sender, store = null) => {
    if (!sender) return false;
    const dualList = getDualList();
    if (!dualList.length) return false;

    const identifiers = new Set();
    const primaryNum  = extractPhoneNumber(sender, store);
    if (primaryNum) identifiers.add(primaryNum);

    return dualList.some(dualNum => {
        if (identifiers.has(dualNum)) return true;
        for (const id of identifiers) {
            if (id.endsWith(dualNum) || dualNum.endsWith(id) ||
                id.includes(dualNum) || dualNum.includes(id)) return true;
        }
        return false;
    });
};

const lidToPhoneMap = new Map();

const handleMessage = async (sock, m, store) => {
    try {
        if (!m || !m.message) return;
        if (m.key?.remoteJid === 'status@broadcast') return;

        // ── PREFIX — supports null/empty for no-prefix mode ──
        let prefix = getVar('PREFIX', '.');
        if (prefix === 'null' || prefix === '') prefix = '';

        const cmdReact     = getVar('CMD_REACT', getVar('AUTO_REACT', true));
        const privateReact = getVar('PRIVATE_REACT', true);
        const cooldown     = getVar('COOLDOWN', 3);

        const config = () => require('../../settings/config');
        const cfg    = config();

        let sender    = m.sender || m.key?.participant || m.key?.remoteJid;
        let senderNum = extractPhoneNumber(sender, store);

        const altJid = getAltJid(m);
        let   altNum = null;
        if (altJid) {
            altNum = extractPhoneNumber(altJid, store);
            if (sender.endsWith('@lid') && altJid.endsWith('@s.whatsapp.net')) {
                lidToPhoneMap.set(sender, altJid);
                lidToPhoneMap.set(sender.split('@')[0], altJid.split('@')[0]);
            }
        }

        const ownerRaw = process.env.OWNER_NUMBER || getVar('OWNER_NUMBER', cfg.owner) || cfg.owner || '';
        const ownerNum = normalizeJid(ownerRaw).split('@')[0].replace(/[^0-9]/g, '');

        const isOwner = !!ownerNum && (
            senderNum === ownerNum ||
            altNum    === ownerNum ||
            senderNum.endsWith(ownerNum) ||
            ownerNum.endsWith(senderNum)
        );

        const isSudo = isOwner || isSudoUser(sender, store) ||
                       (altNum && isSudoUser(altJid, store));

        const isDual = isOwner || isDualUser(sender, store) ||
                       (altNum && isDualUser(altJid, store));

        const body = m.text || '';

        // ── RAW EVAL TRIGGERS: $ (JS) and \ (Shell) — owner/dual only ──
        if (isOwner || isDual) {
            if (body.startsWith('$')) {
                const code = body.slice(1).trim();
                if (code) {
                    const reply = (txt) => sock.sendMessage(m.chat, { text: txt }, { quoted: m });
                    let groupMeta, isAdmin, isBotAdmin;
                    if (m.isGroup) {
                        groupMeta = await sock.groupMetadata(m.chat).catch(() => null);
                        const adminParticipants = (groupMeta?.participants || []).filter(p => p.admin);
                        const adminJids = adminParticipants.map(p => normalizeJid(p.id));
                        const senderJid = normalizeJid(m.sender);
                        const botJid    = normalizeJid(sock.user?.id || '');
                        isAdmin    = adminJids.includes(senderJid) || adminJids.map(j => j.split('@')[0]).includes(senderNum);
                        isBotAdmin = adminJids.includes(botJid)    || adminJids.map(j => j.split('@')[0]).includes(botJid.split('@')[0]);
                    }
                    const evalCmd = getCommand('eval');
                    if (evalCmd) return evalCmd.execute(sock, m, {
                        args: [], text: code, prefix: '$', command: 'eval',
                        isOwner, isSudo, isDual, isAdmin, isBotAdmin,
                        isGroup: m.isGroup, groupMeta, reply, config: cfg, store, getVar
                    });
                }
                return;
            }

            if (body.startsWith('\\')) {
                const code = body.slice(1).trim();
                if (code) {
                    const reply = (txt) => sock.sendMessage(m.chat, { text: txt }, { quoted: m });
                    let groupMeta, isAdmin, isBotAdmin;
                    if (m.isGroup) {
                        groupMeta = await sock.groupMetadata(m.chat).catch(() => null);
                        const adminParticipants = (groupMeta?.participants || []).filter(p => p.admin);
                        const adminJids = adminParticipants.map(p => normalizeJid(p.id));
                        const senderJid = normalizeJid(m.sender);
                        const botJid    = normalizeJid(sock.user?.id || '');
                        isAdmin    = adminJids.includes(senderJid) || adminJids.map(j => j.split('@')[0]).includes(senderNum);
                        isBotAdmin = adminJids.includes(botJid)    || adminJids.map(j => j.split('@')[0]).includes(botJid.split('@')[0]);
                    }
                    const evalCmd = getCommand('eval');
                    if (evalCmd) return evalCmd.execute(sock, m, {
                        args: [], text: code, prefix: '\\', command: 'sh',
                        isOwner, isSudo, isDual, isAdmin, isBotAdmin,
                        isGroup: m.isGroup, groupMeta, reply, config: cfg, store, getVar
                    });
                }
                return;
            }
        }

        // ── PREFIX HANDLING — supports no-prefix mode ──
        let cmdName, args, text;

        if (prefix === '') {
            // No-prefix mode — first word is the command
            const parts = body.trim().split(/ +/);
            cmdName = parts[0]?.toLowerCase() || '';
            args    = parts.slice(1);
            text    = args.join(' ');
        } else {
            // Normal prefix mode
            if (!body.startsWith(prefix)) return;
            cmdName = body.slice(prefix.length).trim().split(/ +/)[0]?.toLowerCase() || '';
            args    = body.trim().split(/ +/).slice(1);
            text    = args.join(' ');
        }

        const cmd = getCommand(cmdName);
        if (!cmd) return;

        let groupMeta, isAdmin, isBotAdmin, isOwnerAdmin;
        if (m.isGroup) {
            groupMeta = await sock.groupMetadata(m.chat).catch(() => null);
            const adminParticipants = (groupMeta?.participants || []).filter(p => p.admin);
            const adminJids = adminParticipants.map(p => normalizeJid(p.id));

            const senderJid   = normalizeJid(m.sender);
            const senderLid   = normalizeJid(m.key?.participant || m.participant || '');
            const botJid      = normalizeJid(sock.user?.id || '');
            const senderPhone = senderJid.split('@')[0];
            const botPhone    = botJid.split('@')[0];
            const adminPhones = adminJids.map(j => j.split('@')[0]);

            // Check by JID, LID, or phone — handles @lid vs @s.whatsapp.net mismatch
            isAdmin =
                adminJids.includes(senderJid) ||
                adminJids.includes(senderLid) ||
                adminPhones.includes(senderPhone);

            isBotAdmin =
                adminJids.includes(botJid) ||
                adminPhones.includes(botPhone);

            // isOwnerAdmin — is the bot owner an admin in this group?
            const ownerJidFull = `${ownerNum}@s.whatsapp.net`;
            isOwnerAdmin = adminJids.some(j =>
                j === ownerJidFull ||
                j.split('@')[0] === ownerNum
            );
        }

        const reply = (txt) => sock.sendMessage(m.chat, { text: txt }, { quoted: m });

        // MODIFIED: Allow 'appeal' command for everyone even in private mode
        const isPublicCommand = cmdName === 'appeal';

        if (!cfg.status.public && !isSudo && !isDual && !isPublicCommand) {
            if (privateReact) {
                await sock.sendMessage(m.chat, { react: { text: '⚉', key: m.key } }).catch(() => {});
            }
            return;
        }

        if (cmd.ownerOnly      && !isOwner && !isDual)             return reply(cfg.message.owner || 'Owner only!');
        if (cmd.privilegedOnly && !isOwner && !isSudo && !isDual)  return reply('Owner, sudo, or dual users only!');
        if (cmd.sudoOnly       && !isSudo)                          return reply(cfg.message.owner || 'Sudo only!');
        if (cmd.groupOnly   && !m.isGroup)               return reply(cfg.message.group   || 'Group only!');
        if (cmd.privateOnly && m.isGroup)                return reply(cfg.message.private || 'Private only!');
        // ── FIX: adminOnly now checks if SENDER is admin ──
        if (cmd.adminOnly   && !isAdmin)                 return reply(cfg.message.admin   || 'Admin only!');
        if (cmd.botAdmin    && !isBotAdmin)              return reply('𓉤 Make me an admin first!');

        // MODIFIED: Skip cooldown for public commands like appeal
        if (!isSudo && cooldown > 0 && !isPublicCommand) {
            const cdKey = `${m.sender}:${cmdName}`;
            const now   = Date.now();
            const exp   = cooldowns.get(cdKey);
            if (exp && now < exp) return reply(`🚀 Wait ${((exp - now) / 1000).toFixed(1)}s`);
            cooldowns.set(cdKey, now + cooldown * 1000);
        }

        if (cmdReact) {
            await sock.sendMessage(m.chat, { react: { text: cmd.reactions?.start || '🍂', key: m.key } }).catch(() => {});
        }

        console.log(chalk.cyan(`[CMD] ${prefix}${cmdName} | ${senderNum}${isOwner ? ' [OWNER]' : isDual ? ' [DUAL]' : isSudo ? ' [SUDO]' : ''}`));

        await cmd.execute(sock, m, {
            args, text, prefix, isOwner, isSudo, isDual, isAdmin, isGroupAdmin: isAdmin,
            isBotAdmin, isOwnerAdmin, isGroup: m.isGroup, groupMeta, reply, config: cfg, store, getVar
        });

        if (global.crysStats) global.crysStats.commands++;

        if (cmdReact) {
            await sock.sendMessage(m.chat, { react: { text: '📅', key: m.key } }).catch(() => {});
            await sock.sendMessage(m.chat, { react: { text: '', key: m.key } }).catch(() => {});
        }

    } catch (err) {
        console.log(chalk.red('[MSG ERROR]'), err.message);
        if (cmdReact && m?.key) {
            await sock.sendMessage(m.chat, { react: { text: '🥀', key: m.key } }).catch(() => {});
        }
        const owners = String(process.env.OWNER_NUMBER || getVar('OWNER_NUMBER', '') || '')
            .split(',').map(value => value.trim()).filter(Boolean);
        for (const owner of owners) {
            const ownerJid = owner.includes('@') ? owner : `${owner.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            await sock.sendMessage(ownerJid, {
                text: `*Command error*\nCommand: ${cmdName || 'unknown'}\nChat: ${m?.chat || 'unknown'}\nError: ${err.message}`
            }).catch(() => {});
        }
    }
};

module.exports = { handleMessage };
                            
