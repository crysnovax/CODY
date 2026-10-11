'use strict';
const fs = require('fs');
const path = require('path');
const { read: readMaster, write: writeMaster } = require('./moderationControl');

const DATABASE = path.join(process.cwd(), 'database');
const ROOT_FEATURES = [
  ['antilink', 'antilink.json'], ['antigm', 'antigm.json'], ['antibot', 'antibot.json'],
  ['antiforward', 'antiforward.json'], ['antigroupstatus', 'antigroupstatus.json'],
  ['antiword', 'antiword.json'], ['antitag', 'antitag.json'], ['antispam', 'antispam.json'],
  ['antivv', 'antivv.json'], ['antiimage', 'antiimage.json'], ['antivideo', 'antivideo.json'], ['antiaudio', 'antiaudio.json'],
  ['antivoice', 'antivoice.json'], ['antidoc', 'antidoc.json'], ['antipoll', 'antipoll.json'],
  ['antievent', 'antievent.json'], ['antinewcomer', 'antinewcomer.json'],
  ['antiraid', 'antiraid.json'], ['antilocation', 'antilocation.json'],
  ['anticontact', 'anticontact.json'], ['slowmode', 'slowmode.json'], ['modlog', 'modlog.json'],
  ['nosticker', 'nosticker.json'],
];
function readJson(file) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; } catch { return {}; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function setRootFeature(name, fileName, group, enabled) {
  const file = path.join(DATABASE, fileName);
  const db = readJson(file);
  const cfg = { ...(db[group] || {}), enabled: Boolean(enabled) };
  if (name === 'antinewcomer' && !Number.isFinite(cfg.windowMs)) cfg.windowMs = 600_000;
  if (name === 'antiraid' && !Number.isFinite(cfg.windowMs)) cfg.windowMs = 600_000;
  if (name === 'slowmode' && !Number.isFinite(cfg.intervalMs)) cfg.intervalMs = 10_000;
  if (name === 'modlog' && !Number.isFinite(cfg.retentionDays)) cfg.retentionDays = 30;
  db[group] = cfg;
  writeJson(file, db);
}
function setAllModerationSettings(group, enabled) {
  const value = Boolean(enabled);
  const master = readMaster();
  master[group] = { ...(master[group] || {}), enabled: value };
  writeMaster(master);
  for (const [name, file] of ROOT_FEATURES) setRootFeature(name, file, group, value);
  const bugFile = path.join(DATABASE, 'antibug.json');
  const bugDb = readJson(bugFile);
  bugDb.groups = { ...(bugDb.groups || {}) };
  bugDb.groups[group] = { ...(bugDb.groups[group] || {}), enabled: value };
  writeJson(bugFile, bugDb);
  const promotionFile = path.join(DATABASE, 'promotion_guard.json');
  const promotionDb = readJson(promotionFile);
  promotionDb[group] = { ...(promotionDb[group] || {}), antipromote: value, antidemote: value };
  writeJson(promotionFile, promotionDb);
  return value;
}
function isAdminParticipant(metadata, candidates = []) {
  const values = new Set(candidates.filter(Boolean).map(value => String(value).replace(/:\d+@/, '@').toLowerCase()));
  return (metadata?.participants || []).some(participant => {
    if (!['admin', 'superadmin'].includes(participant?.admin)) return false;
    return [participant.id, participant.jid, participant.lid, participant.phoneNumber]
      .filter(Boolean).some(value => values.has(String(value).replace(/:\d+@/, '@').toLowerCase()) ||
        String(value).split('@')[0] === [...values].find(v => v.split('@')[0] === String(value).split('@')[0]));
  });
}
module.exports = { ROOT_FEATURES, setAllModerationSettings, isAdminParticipant, readJson, writeJson };
