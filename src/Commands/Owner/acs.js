const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'database', 'autocommentstatus.json');
const STICKER_PATH = path.join(process.cwd(), 'database', 'autocommentstatus-sticker.webp');
const DEFAULT_CONFIG = { enabled: true, mode: 'text', text: '💚' };

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
        }
    } catch (error) {
        console.error('[ACS CONFIG]', error.message);
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    const temporaryPath = `${CONFIG_PATH}.tmp-${process.pid}`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, CONFIG_PATH);
}

function hasStickerMessage(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (value.stickerMessage) return true;
    for (const [key, child] of Object.entries(value)) {
        if (['message', 'ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage'].includes(key)
            && child && typeof child === 'object' && hasStickerMessage(child.message || child, seen)) {
            return true;
        }
    }
    return false;
}

module.exports = {
    name: 'acs',
    alias: ['autocommentstatus'],
    desc: 'Automatically comment on personal statuses using text or a saved sticker',
    category: 'Owner',
    ownerOnly: true,
    usage: '.acs on/off | .acs text <text> | reply to a sticker with .acs sticker | .acs status',

    execute: async (sock, m, { args = [], reply }) => {
        const action = String(args[0] || '').toLowerCase();
        const value = args.slice(1).join(' ').trim();
        const config = loadConfig();

        if (action === 'on') {
            const ready = config.mode === 'sticker'
                ? fs.existsSync(STICKER_PATH)
                : Boolean(String(config.text || '').trim());
            if (!ready) {
                return reply('Set a comment first: `.acs text <text>` or reply to a sticker with `.acs sticker`.');
            }
            config.enabled = true;
            saveConfig(config);
            return reply(`✓ Auto Comment Status is ON (${config.mode}).`);
        }

        if (action === 'off') {
            config.enabled = false;
            saveConfig(config);
            return reply('Auto Comment Status is OFF.');
        }

        if (action === 'text') {
            if (!value) return reply('Usage: `.acs text <comment text>`');
            config.mode = 'text';
            config.text = value;
            saveConfig(config);
            return reply(config.enabled
                ? 'Text comment saved. Auto-comment is ON.'
                : 'Text comment saved. Run `.acs on` to enable auto comments.');
        }

        if (action === 'sticker') {
            const quoted = m?.quoted;
            const quotedMessage = quoted?.message || quoted?.fakeObj?.message || quoted;
            const stickerType = quoted?.mtype === 'stickerMessage'
                || quoted?.type === 'stickerMessage'
                || hasStickerMessage(quotedMessage);
            if (!quoted || !stickerType) {
                return reply('Reply to a sticker with `.acs sticker` to save it as the automatic status comment.');
            }
            if (typeof quoted.download !== 'function') {
                return reply('I could not download that sticker. Please reply to the sticker message itself.');
            }
            const buffer = await quoted.download();
            if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
                return reply('The sticker download was empty; no template was saved.');
            }
            if (buffer.length > 2 * 1024 * 1024) {
                return reply('That sticker is too large for an automatic comment template (maximum 2 MiB).');
            }
            fs.mkdirSync(path.dirname(STICKER_PATH), { recursive: true });
            const temporaryPath = `${STICKER_PATH}.tmp-${process.pid}`;
            fs.writeFileSync(temporaryPath, buffer);
            fs.renameSync(temporaryPath, STICKER_PATH);
            config.mode = 'sticker';
            config.text = '';
            saveConfig(config);
            return reply(config.enabled
                ? 'Sticker comment saved. Auto-comment is ON.'
                : 'Sticker comment saved. Run `.acs on` to enable auto comments.');
        }

        if (action === 'clear') {
            config.enabled = false;
            config.text = '';
            config.mode = 'text';
            saveConfig(config);
            try { fs.unlinkSync(STICKER_PATH); } catch {}
            return reply('Auto-comment text and sticker template cleared; ACS is OFF.');
        }

        if (action === 'status') {
            const payload = config.mode === 'sticker'
                ? (fs.existsSync(STICKER_PATH) ? 'sticker saved' : 'no sticker saved')
                : (config.text ? `“${config.text.slice(0, 120)}${config.text.length > 120 ? '…' : ''}”` : 'no text set');
            return reply(`*Auto Comment Status*\nEnabled: *${config.enabled ? 'ON' : 'OFF'}*\nMode: *${config.mode}*\nComment: ${payload}`);
        }

        return reply(
            '*AUTO COMMENT STATUS (ACS)*\n\n' +
            'By default, ACS is ON and comments 💚 on new personal statuses.\n' +
            '`.acs text <text>` — set a text comment\n' +
            'Reply to a sticker with `.acs sticker` — save it as the comment\n' +
            '`.acs on` / `.acs off` — enable or disable\n' +
            '`.acs status` — show current settings\n' +
            '`.acs clear` — clear the saved comment and turn ACS off'
        );
    }
};
