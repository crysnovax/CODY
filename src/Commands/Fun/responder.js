const { formatBotTime, getBotTimezone } = require('../../Utils/timezone');

module.exports = {
 name: 'Crysnova!',
 alias: ['crys', 'crysnova!', 'crys!'],
 desc: 'Fun CRYSNOVA signature reaction + message',
 category: 'fun',

 execute: async (sock, m, { reply }) => {
 try {
 // Random reaction from your set
 const reactions = ['🙌', '😎', '☠️', '🤖', '⚉'];
 const randomReact = reactions[Math.floor(Math.random() * reactions.length)];

 // Send reaction
 await sock.sendMessage(m.chat, { 
 react: { text: randomReact, key: m.key } 
 });

 // Random cool reply sentences
 const replies = [
  "CRYSN⚉VA activated — let's break the matrix 🔥",
  "You called? The legend has arrived ☠️",
  "Crysnova online — what's the mission today? 🤖",
  "Feel the vibe... CRYSN⚉VA in the building 😎",
  "Power level? Over 9000 ⚉",
  "CRYSNOVA reporting — ready to dominate 🙌",
  "They not like us... but CRYSN⚉VA is different ☠️",
  "Just dropped in — let's make noise 🔥",
  "CRYSN⚉VA AI — smarter than your ex 🤖",
  "Locked in. What's good? 😎",
  
  // ✨ Extra 20
  "CRYSN⚉VA mode: unstoppable ⚡",
  "Incoming vibes... CRYSN⚉VA style 😎",
  "Engage thrusters! CRYSN⚉VA taking off 🚀",
  "CRYSN⚉VA sees all, knows all ⚉",
  "Legendary entrance? That's CRYSN⚉VA ☠️",
  "All systems nominal — CRYSN⚉VA online 🙌",
  "Stay frosty, it's CRYSN⚉VA time ❄️",
  "CRYSN⚉VA detected your message 👀",
  "Mission? Dominate. Style? CRYSN⚉VA 😎",
  "Scanning vibes... 100% CRYSN⚉VA approved ⚉",
  "They can’t handle CRYSN⚉VA energy 🔥",
  "Breaking barriers, CRYSN⚉VA style ☠️",
  "Hello humans, CRYSN⚉VA reporting 🤖",
  "Power surge detected — CRYSN⚉VA ⚡",
  "Your AI overlord CRYSN⚉VA says hi ☠️",
  "Vibes calibrated. CRYSN⚉VA in control 😎",
  "Time check: CRYSN⚉VA never late ⏰",
  "All eyes on CRYSN⚉VA ⚉",
  "Crysnova alert: chaos incoming 🔥",
  "You summoned? CRYSN⚉VA at your service 🙌"
];
 const randomReply = replies[Math.floor(Math.random() * replies.length)];

 // Display the bot's configured local time.
 const now = new Date();
 const timeStr = formatBotTime(now, 'en-US', {
 hour: 'numeric',
 minute: '2-digit',
 second: '2-digit',
 hour12: true
 }).toLowerCase();

 // Final message
 const finalMsg = `${randomReply}\n\n𓄄 \`\`\`${timeStr} ${getBotTimezone()}\`\`\``;

 await reply(finalMsg);

 } catch (err) {
 console.error('[CRYSNOVA FUN ERROR]', err);
 await reply('⚠️ Crysnova glitched — try again 😅');
 }
 }
};
