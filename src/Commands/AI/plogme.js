// plogme.js — command interface for the PLOGME internal processing AI.
// Auto-reply works automatically via the hook in ?.js; this command controls
// the toggles (on/off/mode/train/personality/dev/status/memory/facts).
// @crysnovax—FIX08-07-26
const plogme = require('../Core/plogme.js');

module.exports = {
    name: 'plogme',
    alias: ['plg', 'plog'],
    desc: 'PLOGME — internal processing AI: auto-reply chatbot + smart bot control (run/toggle commands, create/edit/delete .js files, fix/test code, reload, dev mode)',
    category: 'AI',
    usage: '.plogme on | off | on all | off all | mode all|tag | train <text> | personality <text> | dev on|off | status | memory | clear | remember <fact> | forget <n> | add command <name>: <code> | delete command <name> | help',

    execute: async (sock, m, { args, reply, prefix }) => {
        const sub = (args[0] || '').toLowerCase();
        const rest = args.slice(1).join(' ').trim();

        const helpText =
            `╭─❍ *PLOGME* 𓉤
│
` +
            `│ 🧠 Internal processing AI — auto-reply chatbot + smart bot control.
` +
            `│ ✨ Just talk to me — I understand context:
` +
            `│   • "run the menu command" / "can you ping?"
` +
            `│   • "create a command called hi that replies hello"
` +
            `│   • "edit the ping command to say pong"
` +
            `│   • "delete the command hello" / "write me a plugin"
` +
            `│   • "set my profile picture to this" (quote image)
` +
            `│   • "kick this user" / "promote this user" / "mute this user 5m"
` +
            `│   • "turn on all the antis" / "set mutesch 5pm to 10am daily"
` +
            `│   • "rename the group" / "change the group pp" (quote image)
` +
            `│   I return .js files, fix and test them myself.
│
` +
            `│ *Chatbot:*
` +
            `│ • .plogme on / off (this chat)
` +
            `│ • .plogme on all / off all (global DM)
` +
            `│ • .plogme mode all | tag
` +
            `│ • .plogme train <text> (global)
` +
            `│ • .plogme personality <text> (global)
` +
            `│ • .plogme status | memory | clear
` +
            `│ • .plogme remember <fact> | forget <n>
│
` +
            `│ *Owner / sudo / dual — bot control:*
` +
            `│ • plogme run <command> — run any command
` +
            `│ • plogme toggle <cmd> on|off — toggle a command
` +
            `│ • plogme toggled — list toggled-off commands
` +
            `│ • plogme fix <code> — fix code with AI
` +
            `│ • plogme test <code|file> — syntax test
` +
            `│ • plogme add command <name>: <code>
` +
            `│ • plogme delete command <name>
` +
            `│ • plogme reload — reload all commands
` +
            `│ • plogme restart — restart the bot
` +
            `│ • .plogme dev on|off (developer mode)
` +
            `│ • Ask: "start a mission to fix X" / "show my missions"
` +
            `│ • Ask: "suggest/install dependency <package>"
` +
            `│ • Ask: "index the project" / "run a health check"
` +
            `│ • Ask: "research <topic> on the web"
` +
            `╰──────────────────`;

        switch (sub) {
            case 'on': {
                if (rest === 'all') {
                    plogme.setGlobalPrivateEnabled(true);
                    return reply('`✓ ENABLED` — auto-replies ON in all DMs (send ' + (prefix || '.') + 'plogme off all to disable)');
                }
                plogme.setEnabled(m.chat, true);
                return reply('`✓ ENABLED` — auto-replies ON in this chat (send ' + (prefix || '.') + 'plogme off to disable)');
            }
            case 'off': {
                if (rest === 'all') {
                    plogme.setGlobalPrivateEnabled(false);
                    return reply('`✘ DISABLED` — no auto-replies in DMs (send ' + (prefix || '.') + 'plogme on all to re-enable)');
                }
                plogme.setEnabled(m.chat, false);
                return reply('`✘ DISABLED` — no auto-replies in this chat (send ' + (prefix || '.') + 'plogme on to re-enable)');
            }
            case 'mode': {
                const mode = (args[1] || '').toLowerCase();
                if (mode === 'all') { plogme.setMode(m.chat, 'all'); return reply('`✐ Mode ALL`'); }
                if (mode === 'tag') { plogme.setMode(m.chat, 'tag'); return reply('`⎔ Mode TAG`'); }
                return reply('_*ⓘ Usage: .plogme mode all | tag*_');
            }
            case 'train': {
                if (!rest) {
                    const cur = plogme.getTraining();
                    return reply(cur ? `⎙ Current training:\n"${cur}"` : '_No global training set. Use .plogme train <text>_');
                }
                plogme.setTraining(rest);
                return reply(`⁠☞⁠ ͡° ͜ʖ ͡°)☞ Global training saved:\n"${rest.slice(0, 150)}${rest.length > 150 ? '...' : ''}"`);
            }
            case 'personality': {
                if (!rest) {
                    const cur = plogme.getPersonality();
                    return reply(cur && cur !== plogme.DEFAULT_PERSONALITY
                        ? `ಥ‿ಥ Current personality:\n"${cur.slice(0, 150)}…"`
                        : '_Default PLOGME personality active. Use .plogme personality <text> to replace._');
                }
                plogme.setPersonality(rest);
                return reply(`⚉ Global personality set:\n"${rest.slice(0, 150)}${rest.length > 150 ? '...' : ''}"`);
            }
            case 'dev': {
                const arg = (args[1] || 'toggle').toLowerCase();
                const next = arg === 'toggle' ? !plogme.isDev() : arg === 'on';
                plogme.setDev(next);
                return reply(`_*🛠️ Developer mode ${next ? 'ON' : 'OFF'}*_`);
            }
            case 'status': {
                return reply(
                    `╭─❍ *PLOGME STATUS*\n│\n` +
                    `│ 🧠 Personality : ${plogme.getPersonality().slice(0, 40)}…\n` +
                    `│ 𓄄 Training     : ${plogme.getTraining() ? '✓ set' : '—'}\n` +
                    `│ 🛠️ Dev mode     : ${plogme.isDev() ? '✓ ON' : 'OFF'}\n` +
                    `│ 📎 Facts        : ${plogme.getFacts().length}\n` +
                    `│ 🧠 This chat    : ${plogme.isEnabled(m.chat) ? '✓ ON' : 'OFF'} (mode: ${plogme.getMode(m.chat)})\n` +
                    `╰──────────────────`
                );
            }
            case 'memory': {
                const mem = plogme.getMemory(m.chat);
                const facts = plogme.getFacts();
                return reply(
                    `_*🧠 PLOGME memory*_\n\n` +
                    (facts.length ? `_Persistent facts:_\n${facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n` : '') +
                    (mem.length ? `_Last ${Math.min(mem.length, 10)} turns in this chat:_\n${mem.slice(-10).map(t => `• ${t.role === 'user' ? '👤' : '🤖'} ${String(t.content).slice(0, 60)}`).join('\n')}` : '_Empty_')
                );
            }
            case 'clear': {
                plogme.clearMemory(m.chat);
                return reply('_*✦ memory wiped*_');
            }
            case 'remember': {
                if (!rest) return reply('_*ⓘ Usage: .plogme remember <fact>*_');
                plogme.addFact(rest);
                return reply('_*📎 Remembered ✓*_');
            }
            case 'forget': {
                const idx = parseInt(args[1] || '0', 10);
                return reply(plogme.removeFact(idx - 1) ? '_*🗑️ Fact forgotten*_' : '_✘ Invalid fact number_');
            }
            case 'help':
                return reply(helpText);
            default: {
                // Control intents the hook understands but that aren't first-class
                // subcommands here ("plogme run ping", "plogme toggle balance off",
                // "plogme fix <code>", ...) are forwarded to the core handler so the
                // ROUTER owns them and the hook never double-runs them.
                // (@crysnovax—FIX12-08-26)
                const restText = args.join(' ').trim();
                if (restText && await plogme.handleControlIntent(sock, m, {
                    reply,
                    sendMessage: async (jid, content, opts) => sock.sendMessage(jid, content, opts)
                }, 'plogme ' + restText)) return;
                // Never dump the menu for a bare name-call / unknown sub — a
                // short nudge keeps "plogme do this" from being answered with
                // a wall of text. (@crysnovax—FIX12-08-26)
                return reply('_*⚉ PLOGME*_ — tell me what to do, e.g. `.plogme run ping`, `.plogme make a pdf of file.md`, `.plogme send file file.md`, or `.plogme help` for the full menu.');
            }
        }
    }
};
