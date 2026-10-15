const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { spawn } = require('child_process');

const BACKUP_API = 'https://bak.crysnovax.link';
const TIMEOUT = 30000;
const RETRIES = 3;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cleanNumber = value => String(value || '').replace(/[^0-9]/g, '');

function isRetryable(error) {
    const status = error.response?.status;
    const message = String(error.response?.data?.error || error.message || '').toLowerCase();
    return status >= 500 || message.includes('encryption') || message.includes('encryptions failed');
}

async function saveBackup(payload) {
    let lastError;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
            return await axios.post(`${BACKUP_API}/backup/save`, payload, {
                timeout: TIMEOUT,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
        } catch (error) {
            lastError = error;
            if (attempt === RETRIES || !isRetryable(error)) throw error;
            await sleep(attempt * 750);
        }
    }
    throw lastError;
}

function collectBackupData(root) {
    const database = {};
    const databaseDir = path.join(root, 'database');
    if (fs.existsSync(databaseDir)) {
        for (const entry of fs.readdirSync(databaseDir, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            database[entry.name] = fs.readFileSync(path.join(databaseDir, entry.name), 'utf8');
        }
    }
    const envPath = path.join(root, '.env');
    return {
        database,
        env: fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '',
        timestamp: Date.now()
    };
}

function findBootstrap(root) {
    const candidates = [
        process.env.CODY_REDEPLOY_BOOTSTRAP,
        path.resolve(root, '..', 'index.js'),
        path.resolve(root, '..', 'deploy-starter.mjs')
    ].filter(Boolean).map(file => path.resolve(file));
    for (const file of candidates) {
        if (!fs.existsSync(file) || file === path.resolve(root, 'index.js')) continue;
        const source = fs.readFileSync(file, 'utf8');
        // Never launch an arbitrary neighbouring index.js after destructive cleanup.
        if (file.endsWith('deploy-starter.mjs') || /CODY_PAIR|BOT_DIR|CODY\.git|crysnovax\/CODY/.test(source)) {
            return file;
        }
    }
    return null;
}

function writePlan(file, plan) {
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(plan, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
}

function removeBotCheckout(root, bootstrap) {
    const preserved = new Set([path.resolve(bootstrap)]);
    for (const entry of fs.readdirSync(root)) {
        const target = path.resolve(root, entry);
        if (preserved.has(target)) continue;
        fs.rmSync(target, { recursive: true, force: true });
    }
}

const redeployCmd = {
    name: 'redeploy',
    alias: ['reinstall', 'freshdeploy'],
    desc: 'Backup, rebuild, and restore the bot deployment',
    category: 'Owner',
    ownerOnly: true,
    usage: '.redeploy',
    reactions: { start: '♻️', success: '✅', error: '❌' },

    execute: async (sock, m, { reply }) => {
        const root = path.resolve(process.cwd());
        const ownerNumber = cleanNumber(process.env.OWNER_NUMBER);
        const bootstrap = findBootstrap(root);
        if (!ownerNumber) return reply('`❌ OWNER_NUMBER is not configured.`');
        if (!bootstrap) {
            return reply('`❌ Redeploy is unavailable in this layout. The outer pairing-site index.js was not found, so no files were changed.`');
        }

        await sock.sendMessage(m.chat, { react: { text: '♻️', key: m.key } }).catch(() => {});
        const password = `CODY-${crypto.randomBytes(18).toString('base64url')}`;
        const planFile = path.resolve(root, '..', '.cody-redeploy.json');
        const data = collectBackupData(root);

        try {
            const result = await saveBackup({ phone: ownerNumber, password, data });
            if (!result.data || result.data.success === false) {
                throw new Error(result.data?.error || 'Backup service did not confirm the backup');
            }

            writePlan(planFile, {
                version: 1,
                createdAt: Date.now(),
                phone: ownerNumber,
                password,
                botDir: root,
                bootstrap,
                attempts: 0
            });

            await reply(
                '✅ *Backup verified. Redeploy is starting.*\n\n' +
                `📦 Database files: ${Object.keys(data.database).length}\n` +
                `📝 Settings: ${data.env ? 'included' : 'none found'}\n` +
                '🔄 The deployment will rebuild, reconnect, and restore automatically.\n' +
                '_Please do not restart the host during this process._'
            );

            // Give WhatsApp time to receive the status before the socket disappears.
            await sleep(1200);
            removeBotCheckout(root, bootstrap);
            const child = spawn(process.execPath, [bootstrap], {
                cwd: path.dirname(bootstrap),
                detached: true,
                stdio: 'ignore',
                env: { ...process.env, CODY_REDEPLOY_PLAN: planFile }
            });
            child.unref();
            setTimeout(() => process.exit(0), 250);
        } catch (error) {
            try { fs.rmSync(planFile, { force: true }); } catch {}
            console.error('[REDEPLOY]', error);
            await sock.sendMessage(m.chat, {
                text: `❌ *Redeploy cancelled.*\n\nBackup was not confirmed, so no files were deleted.\n${error.response?.data?.error || error.message}`
            }).catch(() => {});
        }
    }
};

module.exports = redeployCmd;
module.exports._test = { collectBackupData, findBootstrap, removeBotCheckout };
