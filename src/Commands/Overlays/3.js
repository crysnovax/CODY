const { applyEffect } = require("../Core/,,.js");

module.exports = {
    name: "kiss",
    category: "media",
    desc: "Apply kiss effect to an image or a user's profile picture",
    usage: ".kiss [@user] or reply to an image/user",

    execute: async (sock, m, { args, reply , prefix}) => {
        let targetBuffer = null;

        // 1) Check if replying to an image message
        if (m.quoted && m.quoted.mtype?.includes("image")) {
            targetBuffer = await m.quoted.download();
        }
        // 2) Check if a user is mentioned or quoted contact
        else {
            let targetJid = null;
            // Mentioned user
            if (m.mentionedJid && m.mentionedJid.length > 0) {
                targetJid = m.mentionedJid[0];
            }
            // Quoted message sender (if quoting a user's text message)
            else if (m.quoted && m.quoted.sender) {
                targetJid = m.quoted.sender;
            }
            // Try to parse a number from args (e.g., .kiss 234XXXXXXXXXX)
            else if (args[0]) {
                const number = args[0].replace(/[^0-9]/g, '');
                if (number.length >= 10) {
                    targetJid = `${number}@s.whatsapp.net`;
                }
            }

            if (targetJid) {
                try {
                    const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
                    const response = await fetch(ppUrl);
                    targetBuffer = Buffer.from(await response.arrayBuffer());
                } catch (err) {
                    return reply(`${prefix}❔ Could not fetch profile picture for @${targetJidsplit('@')[0]}. They may have no profile picture or privacy settings.`);
                }
            }
        }

        if (!targetBuffer) {
            return reply("`⟁⃝⚠︎ Mention/quote someone`");
        }

        try {
            const result = await applyEffect(targetBuffer, "kiss");
            await sock.sendMessage(m.chat, {
                image: result,
                mimetype: "image/png",
                caption: "💋 KISS 💋"
            }, { quoted: m });
        } catch (err) {
            console.error("[KISS ERROR]", err);
            reply("_*ಠ_ಠ Failed to apply kiss effect.*_");
        }
    }
};
