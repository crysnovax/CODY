const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cleanNumber = value => String(value || '').replace(/[^0-9]/g, '');

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

function writeLocalPlan(file, plan) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(plan, null, 2), { mode: 0o600 });
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, file);
    // Verify the cache is readable and complete before deleting anything.
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved.version !== 2 || saved.botDir !== plan.botDir || !saved.data) {
        throw new Error('Local redeploy cache verification failed');
    }
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
    desc: 'Back up locally, rebuild, and restore the bot deployment',
    category: 'Owner',
    ownerOnly: true,
    usage: '.redeploy',
    reactions: { start: '♻️', success: '✅', error: '❌' },

    execute: async (sock, m, { reply }) => {
        const root = path.resolve(process.cwd());
        const ownerNumber = cleanNumber(process.env.OWNER_NUMBER);
        const bootstrap = findBootstrap(root);
        const planFile = path.resolve(root, '..', '.cody-redeploy-local.json');
        if (!ownerNumber) return reply('`❌ OWNER_NUMBER is not configured.`');
        if (!bootstrap) {
            return reply('`❌ Redeploy is unavailable in this layout. The outer pairing-site index.js was not found, so no files were changed.`');
        }

        await sock.sendMessage(m.chat, { react: { text: '♻️', key: m.key } }).catch(() => {});
        const data = collectBackupData(root);
        let cleanupStarted = false;

        try {
            // This cache is local to the deployment filesystem. No remote
            // backup request is made and no remote password is generated.
            writeLocalPlan(planFile, {
                version: 2,
                type: 'local-redeploy',
                createdAt: Date.now(),
                phone: ownerNumber,
                botDir: root,
                bootstrap,
                data
            });

            await reply(
                '✅ *Local recovery cache verified. Redeploy is starting.*\n\n' +
                `📦 Database files: ${Object.keys(data.database).length}\n` +
                `📝 Settings: ${data.env ? 'included' : 'none found'}\n` +
                '💾 Backup location: local deployment storage\n' +
                '🔄 The deployment will rebuild and restore before startup.\n' +
                '_Please do not restart the host during this process._'
            );

            await sleep(1200);
            cleanupStarted = true;
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
            // Before cleanup, remove the incomplete cache. After cleanup, keep
            // it so the rebuilt deployment can retry recovery safely.
            if (!cleanupStarted) {
                try { fs.rmSync(planFile, { force: true }); } catch {}
            }
            console.error('[REDEPLOY]', error);
            await sock.sendMessage(m.chat, {
                text: cleanupStarted
                    ? `⚠️ *Redeploy handoff failed.*\n\nThe local recovery cache was preserved at the deployment parent for retry.\n${error.message}`
                    : `❌ *Redeploy cancelled.*\n\nNo files were deleted because the local recovery cache was not verified.\n${error.message}`
            }).catch(() => {});
        }
    }
};

module.exports = redeployCmd;
module.exports._test = { collectBackupData, findBootstrap, removeBotCheckout, writeLocalPlan };
