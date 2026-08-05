module.exports = {
    name: 'sms24msg',
    alias: ['24msg', 'smsget', 'readsms'],
    desc: 'Get SMS messages for SMS24 virtual number',
    category: 'Tools',

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            if (!args.length) {
                return reply(`${prefix}📩 Usage:
sms24msg <number>

Example:
.sms24msg +12017367277

☬ Get numbers from .sms24numbers`);
            }

            const number = args[0].trim();

            await sock.sendPresenceUpdate('composing', m.chat);

            const apiUrl = `https://apis.prexzyvilla.site/vnum/sms24-messages?number=${encodeURIComponent(number)}`;

            const res = await fetch(apiUrl, { timeout: 15000 });
            
            if (!res.ok) {
                return reply(`${prefix}_*⚉ API Error ${resstatus}*_\n☬ Failed to fetch messages`);
            }

            const json = await res.json();

            // SMS24 uses 'messages' array with 'from' and 'content' fields
            const messages = json.messages || [];

            if (!messages.length) {
                return reply(`_*亗 No messages for ${number}*_\n☬ Number may be inactive or no recent SMS`);
            }

            const displayMsgs = messages.slice(0, 8);
            let msgList = displayMsgs.map((msg, i) => {
                const from = msg.from || 'Unknown';
                const text = msg.content || msg.text || msg.message || msg.body || 'No content'; // 'content' is the correct field
                const time = msg.time || msg.date || msg.timestamp || 'Recent';
                
                // Extract verification codes if present
                const codeMatch = text.match(/\b\d{4,6}\b/);
                const code = codeMatch ? codeMatch[0] : '';
                
                return `*${i + 1}. 📨 From:* ${from}
📝 ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}
${code ? `🔐 *Code: ${code}*\n` : ''}⏰ ${time}\n`;
            }).join('\n');

            const message = `*⚉ SMS24 MESSAGES ⚉*
☬ Number: ${number}
📨 Total: ${messages.length} | Showing: ${displayMsgs.length}

${msgList}

☬ Refresh: .sms24msg ${number}`;

            await reply(message);

        } catch (err) {
            console.error('[SMS24MSG ERROR]', err);
            reply('_*✘ Failed to get messages*_');
        }
    }
};
