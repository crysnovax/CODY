'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeJid, resolvePhoneJid, isPhoneJid } = require('../../Plugin/identityUtils');

const CONFIG_FILE = path.join(process.cwd(), 'database', 'antibug.json');
const WARN_FILE = path.join(process.cwd(), 'database', 'antibug_warns.json');
const ACTIONS = new Set(['warn', 'delete', 'kick', 'tkick']);
const BOT_MARKERS = [
  '$repeat(',
  'nativeflowmessage.buttons',
  'blokswidget',
  'messageparamsjson'
];

function readJson(file) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; } catch { return {}; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}
function normalize(value) {
  return normalizeJid(String(value || '')).toLowerCase();
}

// Structural detection avoids matching ordinary words such as “bug”. It
// looks for oversized interactive fields, repeat-expansion markers, excessive
// control characters, and abnormally large message envelopes.
function inspectBugPayload(value, state = { score: 0, reasons: [], bytes: 0 }, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return state;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (typeof child === 'string') {
      state.bytes += Buffer.byteLength(child, 'utf8');
      const normalized = child.toLowerCase();
      if (normalized.includes('$repeat(')) {
        state.score += 5; state.reasons.push('repeat-expansion marker');
      }
      if (child.length > 16000) {
        state.score += 5; state.reasons.push(`oversized ${key}`);
      }
      if ((lower.includes('button') || lower.includes('widget') || lower.includes('paramsjson')) && child.length > 1000) {
        state.score += 3; state.reasons.push(`oversized interactive ${key}`);
      }
      const controls = (child.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || []).length;
      if (controls > 32) {
        state.score += 4; state.reasons.push('excessive control characters');
      }
    } else if (typeof child === 'number') {
      if ((lower === 'nonjidmentions' || lower === 'nonjidmentioncount') && child > 50) {
        state.score += 4; state.reasons.push('excessive non-JID mentions');
      }
      if ((lower === 'expiration_time' || lower === 'expirationtime') && child < 0) {
        state.score += 2; state.reasons.push('invalid expiration value');
      }
    } else if (child && typeof child === 'object') {
      if (lower === 'buttons' && !Array.isArray(child)) {
        state.score += 4; state.reasons.push('malformed buttons field');
      }
      inspectBugPayload(child, state, seen);
    }
  }
  if (state.bytes > 100000) state.score += 5;
  return state;
}
function detectBug(value) {
  const result = inspectBugPayload(value);
  const flat = (() => { try { return JSON.stringify(value).toLowerCase(); } catch { return ''; } })();
  const markerHits = BOT_MARKERS.filter(marker => flat.includes(marker)).length;
  result.score += markerHits * 2;
  result.reasons = [...new Set(result.reasons)];
  return result.score >= 5 ? result : null;
}
function getRawPayload(m, mek) {
  return mek?.__rawMessage || mek?.message || m?.message || m?.msg || {};
}
function ensureConfig(db, chat) {
  if (!db.groups) db.groups = {};
  if (!db.groups[chat]) db.groups[chat] = { enabled: false, action: 'delete' };
  const config = db.groups[chat];
  if (typeof config.enabled !== 'boolean') config.enabled = false;
  if (!ACTIONS.has(config.action)) config.action = 'delete';
  return config;
}
function dmConfig(db) {
  if (!db.dm || typeof db.dm !== 'object') db.dm = { enabled: true, action: 'delete' };
  if (typeof db.dm.enabled !== 'boolean') db.dm.enabled = true;
  if (!ACTIONS.has(db.dm.action)) db.dm.action = 'delete';
  return db.dm;
}
function getConfig(db, chat) {
  if (chat.endsWith('@g.us')) return ensureConfig(db, chat);
  return dmConfig(db);
}
function isAdminRecord(record) {
  return record?.admin === 'admin' || record?.admin === 'superadmin';
}
async function resolveSender(sock, m, mek, metadata) {
  const candidates = [m?.key?.participantAlt, mek?.key?.participantAlt, m?.sender, m?.key?.participant].filter(Boolean);
  const record = metadata?.participants?.find(participant =>
    [participant.id, participant.jid, participant.lid, participant.phoneNumber].filter(Boolean)
      .map(normalize).some(id => candidates.some(candidate => id === normalize(candidate)))
  );
  const jid = await resolvePhoneJid(sock, candidates).catch(() => null)
    || [record?.id, record?.jid, record?.lid, record?.phoneNumber].find(isPhoneJid)
    || candidates.find(candidate => String(candidate).includes('@'));
  return { jid, record, candidates };
}
async function tryRevoke(sock, chat, key) {
  if (!key?.id || typeof sock.sendMessage !== 'function') return false;
  try {
    await sock.sendMessage(chat, { delete: key });
    return true;
  } catch {
    return false;
  }
}
async function safeNotice(sock, chat, text, quoted, mentions = []) {
  try { return await sock.sendMessage(chat, { text, mentions }, { quoted }); } catch { return null; }
}
async function localFallback(sock, chat, notice) {
  // WhatsApp does not let a non-admin revoke somebody else’s message. The
  // safest fallback is to remove the bot’s own warning/notice and stay quiet;
  // never attempt an unbounded delete-history loop.
  if (notice?.key) await tryRevoke(sock, chat, notice.key);
}

const plugin = {
  name: 'antibug',
  alias: ['anti-bug', 'bugguard', 'abug'],
  desc: 'Detect oversized or malformed interactive bug payloads',
  category: 'Admin',
  reactions: { start: '🛡️', success: '✅' },
  execute: async (sock, m, { args, reply, isOwner, isSudo, isDual, isAdmin, prefix }) => {
    const db = readJson(CONFIG_FILE);
    const target = m.chat.endsWith('@g.us') ? `group ${m.chat}` : 'all DMs';
    const allowed = m.chat.endsWith('@g.us') ? (isOwner || isSudo || isDual || isAdmin) : (isOwner || isSudo || isDual);
    if (!allowed) return reply('AntiBug settings can only be changed by the owner, sudo, dual user, or a group admin.');
    const option = String(args[0] || 'status').toLowerCase();
    const config = getConfig(db, m.chat);
    if (option === 'on' || option === 'off') {
      config.enabled = option === 'on';
      writeJson(CONFIG_FILE, db);
      return reply(`AntiBug ${config.enabled ? 'enabled' : 'disabled'} for ${target}.`);
    }
    if (ACTIONS.has(option)) {
      config.action = option;
      if (option === 'tkick' && args[1]) config.tkickDuration = String(args[1]);
      writeJson(CONFIG_FILE, db);
      return reply(`AntiBug action for ${target}: ${option.toUpperCase()}${config.tkickDuration ? ` (${config.tkickDuration})` : ''}.`);
    }
    if (option === 'dm' && ['on', 'off'].includes(String(args[1] || '').toLowerCase())) {
      const dm = dmConfig(db);
      dm.enabled = String(args[1]).toLowerCase() === 'on';
      writeJson(CONFIG_FILE, db);
      return reply(`AntiBug ${dm.enabled ? 'enabled' : 'disabled'} for all DMs.`);
    }
    if (option === 'status') {
      const dm = dmConfig(db);
      return reply(`*AntiBug Status*\n\n• Current ${target}: ${config.enabled ? 'ON' : 'OFF'}\n• Current action: ${config.action.toUpperCase()}\n• All DMs: ${dm.enabled ? 'ON' : 'OFF'}\n• DM action: ${dm.action.toUpperCase()}\n\nCommands:\n• ${prefix}antibug on | off\n• ${prefix}antibug warn | delete | kick | tkick 5m\n• ${prefix}antibug dm on | off`);
    }
    return reply(`Usage: ${prefix}antibug on | off | warn | delete | kick | tkick 5m | dm on | dm off`);
  },
  handleAntiBug: async (sock, m, mek) => {
    try {
      if (!m || m.key?.fromMe || !m.chat) return false;
      const payload = getRawPayload(m, mek);
      const finding = detectBug(payload);
      if (!finding) return false;
      const db = readJson(CONFIG_FILE);
      const config = getConfig(db, m.chat);
      if (!config.enabled) return false;
      let metadata = null;
      if (m.chat.endsWith('@g.us')) {
        metadata = await sock.groupMetadata(m.chat).catch(() => null);
        if (!metadata?.participants) return false;
      }
      const sender = await resolveSender(sock, m, mek, metadata);
      if (sender.record && isAdminRecord(sender.record)) return false;
      const botRecord = metadata?.participants?.find(participant =>
        [participant.id, participant.jid, participant.lid].filter(Boolean).map(normalize)
          .some(id => [sock.user?.id, sock.user?.lid].filter(Boolean).map(normalize).includes(id))
      );
      const botAdmin = !metadata || isAdminRecord(botRecord);
      const key = mek?.key || m.key;
      const deleted = botAdmin ? await tryRevoke(sock, m.chat, key) : false;
      const action = ACTIONS.has(config.action) ? config.action : 'delete';
      const mentionJid = sender.jid && isPhoneJid(sender.jid) ? sender.jid : null;
      const label = deleted ? 'Bug payload removed.' : 'Bug payload detected.';
      let notice = null;
      if (action !== 'delete' || !deleted) {
        notice = await safeNotice(sock, m.chat, mentionJid ? `@${mentionJid.split('@')[0]} ${label} AntiBug is active.` : `${label} AntiBug is active.`, mek, mentionJid ? [mentionJid] : []);
      }
      if (action === 'kick' || action === 'tkick') {
        if (metadata && botAdmin && sender.jid) {
          if (action === 'kick') await sock.groupParticipantsUpdate(m.chat, [sender.jid], 'remove').catch(() => {});
          else {
            const { parseTime, tkick } = require('./tkick');
            await tkick(sock, m.chat, sender.jid, parseTime(config.tkickDuration || '5m') || 300000, 'AntiBug').catch(() => {});
          }
        }
      } else if (action === 'warn') {
        const warnings = readJson(WARN_FILE);
        const warningKey = `${m.chat}:${normalize(sender.jid || m.sender)}`;
        const count = (warnings[warningKey]?.count || 0) + 1;
        if (count >= 3 && metadata && botAdmin && sender.jid) {
          delete warnings[warningKey];
          await sock.groupParticipantsUpdate(m.chat, [sender.jid], 'remove').catch(() => {});
        } else warnings[warningKey] = { count, at: Date.now() };
        writeJson(WARN_FILE, warnings);
      }
      if (!deleted && notice) await localFallback(sock, m.chat, notice);
      console.warn(`[ANTIBUG] ${m.chat} score=${finding.score} reasons=${finding.reasons.join(', ')}`);
      return true;
    } catch (error) {
      console.error('[ANTIBUG ERROR]', error?.message || error);
      return false;
    }
  }
};

plugin.detectBug = detectBug;
plugin.inspectBugPayload = inspectBugPayload;
module.exports = plugin;
