const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'node_modules', 'plogme');

const patches = [
  {
    id: 'website-preview-template-literal',
    file: 'lib/Utils/games/website-preview.js',
    from: 'color:${textMuted]}',
    to: 'color:${textMuted}}',
    all: true
  },
  {
    id: 'send-carousel-user-jid',
    file: 'lib/Socket/messages-send.js',
    from: '                logger,\n                userJid,\n                upload: waUploadToServer,',
    to: '                logger,\n                userJid: authState.creds.me?.id,\n                upload: waUploadToServer,'
  },
  {
    id: 'auto-heal-send',
    file: 'lib/Socket/messages-send.js',
    from: 'await originalSend(jid, restContent, options)',
    to: 'await socket.sendMessage(jid, restContent, options)'
  },
  {
    id: 'social-entity-duplicate-platform',
    file: 'lib/Utils/rich-message-utils.js',
    from: "                                platform: String(platform || 'GENERIC').toUpperCase(),\n                                entity_picture_url: imageUrl,\n                                entity_url: profileUrl,\n                                entity_type: resolvedType,\n                                platform: normalizedPlatform,",
    to: '                                entity_picture_url: imageUrl,\n                                entity_url: profileUrl,\n                                entity_type: resolvedType,\n                                platform: normalizedPlatform,'
  },
  {
    id: 'rich-response-code-language',
    file: 'lib/Utils/rich-message-utils.js',
    from: "            language ||= 'javascript';\n            submessages.push({\n                messageType: RichSubMessageType.CODE,\n                codeMetadata: {\n                    codeLanguage: language,\n                    codeBlocks: tokenizeCode(code, language)",
    to: "            const codeLanguage = language || 'javascript';\n            submessages.push({\n                messageType: RichSubMessageType.CODE,\n                codeMetadata: {\n                    codeLanguage,\n                    codeBlocks: tokenizeCode(code, codeLanguage)"
  }
];

function occurrences(source, needle) {
  return source.split(needle).length - 1;
}

function apply() {
  const applied = [];
  const unknown = [];

  for (const patch of patches) {
    const target = path.join(root, patch.file);
    if (!fs.existsSync(target)) continue;

    const source = fs.readFileSync(target, 'utf8');
    const found = occurrences(source, patch.from);

    if (found === 0) {
      if (!source.includes(patch.to)) unknown.push(patch.id);
      continue;
    }
    if (!patch.all && found > 1) {
      unknown.push(patch.id);
      continue;
    }

    fs.writeFileSync(target, patch.all ? source.replaceAll(patch.from, patch.to) : source.replace(patch.from, patch.to));
    applied.push(patch.id);
  }

  return { applied, unknown };
}

module.exports = { patches, apply };

if (require.main === module) {
  if (!fs.existsSync(root)) process.exit(0);
  const { applied, unknown } = apply();
  if (applied.length) console.log(`[plogme] Applied compatibility fixes: ${applied.join(', ')}.`);
  if (unknown.length) console.warn(`[plogme] Patch did not recognize the installed source for: ${unknown.join(', ')}.`);
}
