const fs = require('fs');
const path = require('path');
const { getVar, setVar } = require('./configManager');
const { cleanNumber, resolveCommandTarget } = require('./identityUtils');
const { createContactCards } = require('./contactCards');

const ENV_PATH = path.join(process.cwd(), '.env');

function storedPhoneNumber(value) {
    const raw = String(value || '').trim();
    if (raw.includes('@') && !/@s\.whatsapp\.net$/i.test(raw)) return '';
    return cleanNumber(raw);
}

function saveList(variable, values) {
    const cleaned = [...new Set(values.map(storedPhoneNumber).filter(Boolean))].join(',');
    setVar(variable, cleaned);
    process.env[variable] = cleaned;

    try {
        if (!fs.existsSync(ENV_PATH)) {
            fs.writeFileSync(ENV_PATH, `${variable}=${cleaned}\n`);
            return;
        }
        const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
        let found = false;
        const updated = lines.map(line => {
            if (line.trim().startsWith(`${variable}=`)) {
                found = true;
                return `${variable}=${cleaned}`;
            }
            return line;
        });
        if (!found) updated.push(`${variable}=${cleaned}`);
        fs.writeFileSync(ENV_PATH, updated.join('\n'));
    } catch (error) {
        console.error(`[${variable}] .env write failed:`, error.message);
    }
}

function getList(variable) {
    return [...new Set(
        [process.env[variable] || '', String(getVar(variable) || '')]
            .join(',').split(',').map(storedPhoneNumber).filter(Boolean)
    )];
}

function getContactListEntries(variable) {
    return [...new Set(
        [process.env[variable] || '', String(getVar(variable) || '')]
            .join(',').split(',').map(value => {
                const raw = value.trim();
                if (/@(?:lid|s\.whatsapp\.net)$/i.test(raw)) return raw;
                const digits = cleanNumber(raw);
                return digits ? `${digits}@s.whatsapp.net` : '';
            }).filter(Boolean)
    )];
}

function createAccessListCommand({ name, aliases, variable, description, accessDescription }) {
    return {
        name,
        alias: aliases,
        desc: description,
        category: 'Owner',
        ownerOnly: true,
        reactions: { start: '🔖', success: '⭐' },
        execute: async (sock, m, { args, reply, store }) => {
            const sub = args[0]?.toLowerCase();
            const list = getList(variable);

            if (!sub || sub === 'list') {
                const entries = getContactListEntries(variable);
                if (!entries.length) return reply(`No ${name} users set.\n\nUse .${name} add <number>, mention a user, or reply to their message.`);
                const displayName = `${name[0].toUpperCase() + name.slice(1)} Users`;
                const { payload, unresolved } = await createContactCards(
                    sock,
                    entries,
                    { displayName, store }
                );
                if (!payload) return reply(`Could not resolve any real phone numbers in the ${name} list.`);
                await sock.sendMessage(m.chat, { contacts: payload }, { quoted: m });
                if (unresolved) return reply(`Sent ${payload.contacts.length} ${name} contact(s); ${unresolved} list entr${unresolved === 1 ? 'y was' : 'ies were'} skipped because a real phone number could not be resolved.`);
                return;
            }

            if (sub === 'add' || sub === 'del' || sub === 'remove') {
                const target = await resolveCommandTarget(sock, m, args.slice(1).join(' '));
                if (!target) return reply(`Reply to a user's message, mention them, or use .${name} ${sub === 'add' ? 'add' : 'del'} <number>.`);
                const number = cleanNumber(target.split('@')[0]);
                if (!number) return reply('Could not resolve a real phone number for that user.');
                const mention = `@${number}`;

                if (sub === 'add') {
                    if (list.includes(number)) return sock.sendMessage(m.chat, { text: `${mention} is already a ${name} user.`, mentions: [target] }, { quoted: m });
                    list.push(number);
                    saveList(variable, list);
                    return sock.sendMessage(m.chat, { text: `${mention} was added to ${name} users.`, mentions: [target] }, { quoted: m });
                }

                const updated = list.filter(item => item !== number);
                if (updated.length === list.length) return sock.sendMessage(m.chat, { text: `${mention} is not a ${name} user.`, mentions: [target] }, { quoted: m });
                saveList(variable, updated);
                return sock.sendMessage(m.chat, { text: `${mention} was removed from ${name} users.`, mentions: [target] }, { quoted: m });
            }

            if (sub === 'clear') {
                saveList(variable, []);
                return reply(`All ${name} users were cleared.`);
            }

            return reply(`*${name[0].toUpperCase() + name.slice(1)} Commands*\n• .${name} list\n• .${name} add <number|@mention|reply>\n• .${name} del <number|@mention|reply>\n• .${name} clear`);
        }
    };
}

module.exports = { createAccessListCommand, getContactListEntries, getList, saveList };
