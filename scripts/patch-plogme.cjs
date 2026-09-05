const fs = require('node:fs');
const path = require('node:path');

const target = path.join(__dirname, '..', 'node_modules', 'plogme', 'lib', 'Utils', 'games', 'website-preview.js');
if (!fs.existsSync(target)) process.exit(0);

const source = fs.readFileSync(target, 'utf8');
const broken = 'color:${textMuted]}';
const fixed = 'color:${textMuted}}';

if (source.includes(broken)) {
  fs.writeFileSync(target, source.replaceAll(broken, fixed));
  console.log('[plogme] Applied v1.0.0 website-preview syntax compatibility fix.');
} else if (!source.includes(fixed)) {
  console.warn('[plogme] Compatibility patch did not recognize the installed website-preview source.');
}
