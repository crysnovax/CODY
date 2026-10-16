// ── labels.js ───────────────────────────────────────────────────
const config = require('../../../settings/config');
const fs = require('fs');
const path = require('path');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';
const STORE_PATH = path.join(__dirname, '../../../data/labels.json');

// WhatsApp's app-state sync collection categories — used to force a resync
const WA_PATCH_NAMES = ['critical_block', 'critical_unblock_low', 'regular_high', 'regular_low', 'regular'];

const getPhone = (jid) => jid?.split('@')[0]?.split(':')[0] || '';

// ── Local store ────────────────────────────────────────────────────
const loadStore = () => {
    try {
        if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    } catch {}
    return { definitions: {}, chatLabels: {}, messageLabels: {} };
};

const saveStore = (data) => {
    try {
        fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
        fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch {}
};

// ── Persistent listener (attached once per socket) ──────────────────
const attachListeners = (sock) => {
    if (sock.__labelsListenerAttached) return;

    sock.ev.on('labels.edit', (label) => {
        const store = loadStore();
        if (label.deleted) {
            delete store.definitions[label.id];
        } else {
            store.definitions[label.id] = {
                id: label.id,
                name: label.name,
                color: label.color,
                predefinedId: label.predefinedId
            };
        }
        saveStore(store);
    });

    sock.ev.on('labels.association', ({ type, association }) => {
        const store = loadStore();
        const isMessage = association.messageId !== undefined;
        const bucket = isMessage ? store.messageLabels : store.chatLabels;
        const key = isMessage ? `${association.chatId}:${association.messageId}` : association.chatId;

        if (!bucket[key]) bucket[key] = [];
        if (type === 'add') {
            if (!bucket[key].includes(association.labelId)) bucket[key].push(association.labelId);
        } else {
            bucket[key] = bucket[key].filter(id => id !== association.labelId);
        }
        saveStore(store);
    });

    sock.__labelsListenerAttached = true;
};

// ── Force a full app-state snapshot resync ──────────────────────────
// Resets stored sync versions for the 5 collections so WA returns a full
// snapshot (return_snapshot=true) instead of "nothing new since last time".
const performFullSync = async (sock) => {
    const resetMap = {};
    for (const name of WA_PATCH_NAMES) resetMap[name] = null;
    await sock.authState.keys.set({ 'app-state-sync-version': resetMap });

    sock.ev.buffer?.();
    await sock.resyncAppState(WA_PATCH_NAMES, true);
    sock.ev.flush?.();

    // Give event listeners time to persist incoming labels.edit / labels.association
    await new Promise(r => setTimeout(r, 4000));
};

// Format a single label entry
const formatLabel = (label) =>
`亗 - *Name* ⇆ ${label.name || 'Unnamed'}
 ☯︎ - *Color* ⇆ ${label.color ?? 'N/A'}${label.predefinedId ? `\n⭐ - *Type* ⇆ Predefined (${label.predefinedId})` : ''}
 ⓘ - *ID* ⇆ ${label.id}`;

const USAGE = `\`\`\`🏷️ LABELS\`\`\`

ⓘ  *.labels* — show this guide
❒ • *.labels list* — list all labels/lists (auto-syncs if empty)
❒ • *.labels sync* — force a fresh resync from WhatsApp
❒ • *.labels add [jid] [labelId]* — add label to chat
❒ • *.labels remove [jid] [labelId]* — remove label from chat
❒ • *.labels msg [jid] [msgId] [labelId]* — label a message
❒ • *.labels unmsg [jid] [msgId] [labelId]* — unlabel a message`;

module.exports = {
    name: 'labels',
    alias: ['label'],
    desc: 'Manage WhatsApp Business labels / Lists',
    category: 'Business',
    usage: '.labels [list|sync|add|remove|msg|unmsg]',

    execute: async (sock, m, { args, reply }) => {
        attachListeners(sock);

        const action = args[0]?.toLowerCase();
        if (!action) return reply(USAGE);

        try {
            await sock.sendMessage(m.chat, { react: { text: '🏷️', key: m.key } });

            switch (action) {

                // ── list ───────────────────────────────────────────
                case 'list': {
                    let store = loadStore();
                    let all = Object.values(store.definitions);

                    // Auto-sync if nothing cached yet
                    if (all.length === 0) {
                        await reply(`\`\`\`🏷️ LABELS\`\`\`\n\n_No cached labels — syncing from WhatsApp..._`);

                        try {
                            await performFullSync(sock);
                        } catch (e) {
                            return reply(`${prefix}✘ Sync failed: ${e?.message || e}`);
                        }

                        store = loadStore();
                        all = Object.values(store.definitions);
                    }

                    if (all.length === 0) {
                        return reply(
                            `\`\`\`🏷️ LABELS\`\`\`\n\n` +
                            `_No labels/lists found on this account._`
                        );
                    }

                    const lines = all.map(formatLabel).join('\n\n');
                    return await sock.sendMessage(m.chat, {
                        text: `\`\`\`🏷️ LABELS\`\`\`\n\n${lines}`,
                        footer: `⚉ ${BOT_NAME} • ${all.length} label${all.length > 1 ? 's' : ''}`
                    }, { quoted: m });
                }

                // ── sync ───────────────────────────────────────────
                case 'sync': {
                    await reply(`\`\`\`🏷️ LABELS\`\`\`\n\n_Resetting app-state version & requesting full snapshot..._`);

                    try {
                        await performFullSync(sock);
                    } catch (e) {
                        return reply(`${prefix}✘ Sync failed: ${e?.message || e}`);
                    }

                    const store = loadStore();
                    const all = Object.values(store.definitions);

                    if (all.length === 0) {
                        return reply(
                            `\`\`\`🏷️ LABELS\`\`\`\n\n` +
                            `❒ - *Result* ⇆ Still empty\n\n` +
                            `_Full snapshot resync completed but returned no label data._`
                        );
                    }

                    const lines = all.map(formatLabel).join('\n\n');
                    return await sock.sendMessage(m.chat, {
                        text: `\`\`\`🏷️ LABELS\`\`\`\n\n❒ - *Sync* ⇆ ✆ ${all.length} found\n\n${lines}`,
                        footer: `⚉ ${BOT_NAME} Business`
                    }, { quoted: m });
                }

                // ── add ────────────────────────────────────────────
                case 'add': {
                    const targetJid = args[1] || m.chat;
                    const labelId = args[2];
                    if (!labelId) return reply('✘ Usage: *.labels add [jid] [labelId]*');

                    await sock.addChatLabel(targetJid, labelId);

                    return await sock.sendMessage(m.chat, {
                        text: `\`\`\`🏷️ LABELS\`\`\`\n\n❒ - *Action* ⇆ Add\nⓘ - *Label* ⇆ ${labelId}\n✆ - *Chat* ⇆ ${getPhone(targetJid)}\n✆ - *Status* ⇆ Applied`,
                        footer: `⚉ ${BOT_NAME} Business`
                    }, { quoted: m });
                }

                // ── remove ─────────────────────────────────────────
                case 'remove': {
                    const targetJid = args[1] || m.chat;
                    const labelId = args[2];
                    if (!labelId) return reply('✘ Usage: *.labels remove [jid] [labelId]*');

                    await sock.removeChatLabel(targetJid, labelId);

                    return await sock.sendMessage(m.chat, {
                        text: `\`\`\`🏷️ LABELS\`\`\`\n\n❒ - *Action* ⇆ Remove\nⓘ - *Label* ⇆ ${labelId}\n✆ - *Chat* ⇆ ${getPhone(targetJid)}\n� - *Status* ⇆ Removed`,
                        footer: `⚉ ${BOT_NAME} Business`
                    }, { quoted: m });
                }

                // ── msg ────────────────────────────────────────────
                case 'msg':
                case 'message': {
                    const targetJid = args[1] || m.chat;
                    const msgId = args[2];
                    const labelId = args[3];
                    if (!msgId || !labelId) return reply('✘ Usage: *.labels msg [jid] [msgId] [labelId]*');

                    await sock.addMessageLabel(targetJid, msgId, labelId);

                    return await sock.sendMessage(m.chat, {
                        text: `\`\`\`🏷️ LABELS\`\`\`\n\n❒ - *Action* ⇆ Label Message\nⓘ - *Label* ⇆ ${labelId}\n✆ - *Msg ID* ⇆ ${msgId}\n✆ - *Status* ⇆ Applied`,
                        footer: `⚉ ${BOT_NAME} Business`
                    }, { quoted: m });
                }

                // ── unmsg ──────────────────────────────────────────
                case 'unmsg':
                case 'unmessage': {
                    const targetJid = args[1] || m.chat;
                    const msgId = args[2];
                    const labelId = args[3];
                    if (!msgId || !labelId) return reply('✘ Usage: *.labels unmsg [jid] [msgId] [labelId]*');

                    await sock.removeMessageLabel(targetJid, msgId, labelId);

                    return await sock.sendMessage(m.chat, {
                        text: `\`\`\`🏷️ LABELS\`\`\`\n\n❒ - *Action* ⇆ Unlabel Message\nⓘ - *Label* ⇆ ${labelId}\n✆ - *Msg ID* ⇆ ${msgId}\n🗑️ - *Status* ⇆ Removed`,
                        footer: `⚉ ${BOT_NAME} Business`
                    }, { quoted: m });
                }

                default:
                    return reply(USAGE);
            }

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (err) {
            console.error('[LABELS]', err.message);
            reply(`${prefix}✘ ${err?.message || err}`);
        }
    }
};
