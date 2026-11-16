const fetch = require('node-fetch');

module.exports = {
    name: 'tempemail',
    alias: ['tmpmail', 'tempmail', 'tempm'],
    category: 'Tools',
    desc: 'Create temporary email and receive OTP/messages',
    usage: '.tempemail | .tempemail check | .tempemail read <id>',
    reactions: { start: '📧', success: '🥏', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        try {
            const action = args[0];
            if (!global.mailtm) global.mailtm = {};

            // ── CREATE EMAIL ──────────────────────────────────────
            if (!action || action === 'create') {
                const d = await fetch('https://api.mail.tm/domains');
                const domainData = await d.json();
                const domain = domainData['hydra:member'][0].domain;
                const user = Math.random().toString(36).slice(2, 10);
                const email = `${user}@${domain}`;
                const password = 'pass123456';

                await fetch('https://api.mail.tm/accounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: email, password })
                });

                const tokenReq = await fetch('https://api.mail.tm/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: email, password })
                });

                const tokenData = await tokenReq.json();
                global.mailtm[m.sender] = { email, token: tokenData.token };

                await sock.sendMessage(m.chat, { react: { text: '📧', key: m.key } });

                await sock.sendRichAIResponse(m.chat, { table: {
                    title: '📋 Your Email',
                    headers: ['Field', 'Value'],
                    rows: [
                        ['📧 Email', email],
                        ['🔑 Password', password],
                        ['📝 Commands', `${prefix}tempemail check`],
                        ['📖 Read', `${prefix}tempemail read <id>`]
                    ],
                    headerText: `## 📧 Temp Email Created`,
                    footerText: '💡 Use this for OTP / verification',
                } }, m);

                return;
            }

            // ── CHECK INBOX ──────────────────────────────────────
            if (action === 'check') {
                const data = global.mailtm[m.sender];
                if (!data) return reply('`✘ Create email first: .tempemail`');

                const res = await fetch('https://api.mail.tm/messages', {
                    headers: { Authorization: `Bearer ${data.token}` }
                });

                const inbox = await res.json();

                if (!inbox['hydra:member'].length) {
                    await sock.sendMessage(m.chat, { react: { text: '📭', key: m.key } });
                    return reply('`📭 Inbox empty`');
                }

                const tableData = [['#', '📧 Subject', '👤 From']];
                
                inbox['hydra:member'].slice(0, 10).forEach((mail, i) => {
                    const subject = (mail.subject || 'No subject').slice(0, 30);
                    const from = (mail.from?.address || 'Unknown').slice(0, 25);
                    tableData.push([`${i + 1}`, subject, from]);
                });

                await sock.sendRichAIResponse(m.chat, { table: {
                    title: `📋 ${inbox['hydra:member'].length} Messages`,
                    headers: tableData[0],
                    rows: tableData.slice(1),
                    headerText: `## 📬 Inbox`,
                    footerText: `💡 Use ${prefix}tempemail read <number> to view`,
                } }, m);

                return;
            }

            // ── READ MESSAGE ─────────────────────────────────────
            if (action === 'read') {
                const id = args[1];
                if (!id) return reply('`✘ Provide message number: .tempemail read 1`');

                const data = global.mailtm[m.sender];
                if (!data) return reply('`✘ Create email first: .tempemail`');

                // Get inbox to map number to ID
                const inboxRes = await fetch('https://api.mail.tm/messages', {
                    headers: { Authorization: `Bearer ${data.token}` }
                });
                const inbox = await inboxRes.json();
                
                const num = parseInt(id);
                if (!num || num < 1 || num > inbox['hydra:member'].length) {
                    return reply(`\`✘ Invalid number. Inbox has ${inbox['hydra:member'].length} messages\``);
                }

                const mailId = inbox['hydra:member'][num - 1].id;
                const res = await fetch(`https://api.mail.tm/messages/${mailId}`, {
                    headers: { Authorization: `Bearer ${data.token}` }
                });
                const mail = await res.json();

                await sock.sendRichAIResponse(m.chat, { table: {
                    title: '📋 Details',
                    headers: ['Field', 'Value'],
                    rows: [
                        ['👤 From', mail.from?.address || 'Unknown'],
                        ['📧 Subject', mail.subject || 'No subject'],
                        ['📝 Body', (mail.text || mail.html || 'No content').replace(/<[^>]*>/g, '').slice(0, 500)]
                    ],
                    headerText: `## 📧 Message ${id}`,
                    footerText: '💡 Temp email • Auto-destroys after inactivity',
                } }, m);

                return;
            }

            // ── HELP ─────────────────────────────────────────────
            return reply(
                `╭─❍ *TEMP EMAIL*\n│\n` +
                `│ ⚉ *Commands:*\n` +
                `│ • ${prefix}tempemail → Create\n` +
                `│ • ${prefix}tempemail check → Inbox\n` +
                `│ • ${prefix}tempemail read <id> → View\n` +
                `╰──────────────────`
            );

        } catch (e) {
            console.error('[TEMPMAIL ERROR]', e);
            await sock.sendMessage(m.chat, { react: { text: '🙊', key: m.key } });
            reply('`✘ Temp mail error`');
        }
    }
};
