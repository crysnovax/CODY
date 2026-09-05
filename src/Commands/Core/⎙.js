/**
 * ╔══════════════════════════════════════╗
 * ║   .repo — C2582 Creator Panel         ║
 * ║   Powered by CRYSNOVA AI             ║
 * ╚══════════════════════════════════════╝
 */

module.exports = {
    name: 'repo',
    alias: ['source', 'cody'],
    desc: 'Show CODY/CRYSNOVA creator panel & repositories',
    category: 'Info',
    reactions: { start: '💠', success: '📑' },
    
    execute: async (sock, m, { reply }) => {
        const REPO_IMG = 'https://cdn.crysnovax.link/files/1778706048639-829fb448-0553-4aed-99fd-a190721dee05.jpeg';

        const caption = 
            `*✦ C O D Y  —  C R E A T O R  P A N E L*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            
            `*𓂀  A B O U T ⓘ*\n` +
            `│ ◈ Creator  : crysnovax\n` +
            `│ ◈ Role     : AI Developer\n` +
            `│ ◈ Version  : CODY V2\n` +
            `│ ◈ Status   : Active\n` +
            `│ ◈ Engine   : Multi-Core AI�\n` +
            `│ ◈ BAILEYS  : plogme\n\n` +
            
            `*𓂀  R E P O S I T O R I E S 🜲*\n` +
            `│ ◈ CRYSN⚉VA_AI\n` +
            `│   └─ github.com/crysnovax/CRYSNOVA_AI\n` +
            `│\n` +
            `│ ◈ C⚇DY (New)\n` +
            `│   └─ github.com/crysnovax/CODY\n\n` +
            
            `*𓂀  C O N N E C T �*\n` +
            `│ ◈ Channel1  : sl.crysnovax.link/CRYSNOVA\n` +
            `│ ◈ Channel2  : sl.crysnovax.link/CODY\n` +
            `│ ◈ Support  : sl.crysnovax.link/WHATSAPP\n` +
            `│ ◈ Contact  : wa.me/message/636PEVHM5BZUM1\n\n` +
            
            `*𓂀  S O C I A L ♧*\n` +
            `│ ◈ YouTube  : @crysnovax\n` +
            `│ ◈ TikTok   : @crysnovax\n\n`+
            
            `*𓂀  W E B ☁︎*\n` +
            `│ ◈ crysnovax.link\n` +
            `│ ◈ sl.crysnovax.link/designs\n\n` +
            
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `_𓄄  C⚇DY V2  |  crysnovax  |  ${new Date().toLocaleDateString()}_`;

        try {
            await sock.sendMessage(m.key.remoteJid, {
                image: { url: REPO_IMG },
                caption
            }, { quoted: m });
        } catch (e) {
            console.log('[Repo command error]', e.message);
            await reply(caption);
        }
    }
};
