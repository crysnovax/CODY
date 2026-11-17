/**
 * ping.js — CODY AI Ping Command
 * Shows bot response latency
 */

module.exports = {
    name: 'ping',
    alias: ['pong', 'latency'],
    desc: 'Check bot response time',
    category: 'Bot',
    reactions: { start: '🏷️', success: '📡' },
    execute: async (_sock, m, { reply }) => {
        // Avoid a two-step "Pinging..." + edit flow. Some direct chats arrive
        // with LID JIDs, and a failed/delayed edit leaves the placeholder up.
        // Estimate command latency from WhatsApp's inbound message timestamp
        // and send the final response once.
        const timestamp = Number(m?.messageTimestamp);
        const receivedAt = timestamp > 1e12
            ? timestamp
            : timestamp > 0 ? timestamp * 1000 : Date.now();
        const latency = Math.max(0, Date.now() - receivedAt);
        await reply(`\`\`\`ⓘ Pong! ${latency}ms\`\`\``);
    }
};
