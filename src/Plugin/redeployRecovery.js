const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BACKUP_API = 'https://bak.crysnovax.link';

function safeDatabaseName(name) {
    return typeof name === 'string' && /^[^/\\]+\.json$/.test(name);
}

async function restorePlan(planFile) {
    const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    if (plan.version !== 1 || !plan.phone || !plan.password || !plan.botDir) {
        throw new Error('Invalid redeploy recovery plan');
    }
    const botDir = path.resolve(plan.botDir);
    const loaded = await axios.post(`${BACKUP_API}/backup/load`, {
        phone: String(plan.phone).replace(/[^0-9]/g, ''),
        password: plan.password
    }, { timeout: 30000 });
    const data = loaded.data?.data;
    if (!data || typeof data !== 'object') throw new Error('Backup returned no data');

    const database = data.database && typeof data.database === 'object' ? data.database : {};
    const databaseDir = path.join(botDir, 'database');
    fs.mkdirSync(databaseDir, { recursive: true });
    let restored = 0;
    for (const [name, contents] of Object.entries(database)) {
        if (!safeDatabaseName(name)) continue;
        const value = typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2);
        fs.writeFileSync(path.join(databaseDir, name), value, 'utf8');
        restored++;
    }
    if (typeof data.env === 'string' && data.env.trim()) {
        fs.writeFileSync(path.join(botDir, '.env'), data.env, 'utf8');
        // index.js has already loaded dotenv by the time this preflight runs.
        // Apply the restored values to this process as well, so every module
        // loaded afterward sees the restored configuration.
        const dotenv = require('dotenv');
        Object.assign(process.env, dotenv.parse(data.env));
    }
    return { restored, env: Boolean(data.env) };
}

async function restorePendingPlan() {
    const planFile = process.env.CODY_REDEPLOY_PLAN;
    if (!planFile) return null;
    const resolvedPlan = path.resolve(planFile);
    if (!fs.existsSync(resolvedPlan)) {
        console.warn('[REDEPLOY RECOVERY] Plan file was not found:', resolvedPlan);
        return null;
    }
    try {
        const result = await restorePlan(resolvedPlan);
        fs.rmSync(resolvedPlan, { force: true });
        console.log(`[REDEPLOY RECOVERY] Restored ${result.restored} database files before bot startup`);
        return result;
    } catch (error) {
        console.error('[REDEPLOY RECOVERY] Restore failed before startup:', error.response?.data?.error || error.message);
        return { error };
    }
}

function jidFor(sock, plan) {
    const connected = sock?.user?.id?.split(':')[0];
    const number = connected || String(plan.phone).replace(/[^0-9]/g, '');
    return number ? `${number}@s.whatsapp.net` : null;
}

async function runRecovery(sock, planFile) {
    let plan;
    try { plan = JSON.parse(fs.readFileSync(planFile, 'utf8')); } catch (error) {
        console.error('[REDEPLOY RECOVERY] Cannot read plan:', error.message);
        return;
    }
    try {
        const result = await restorePlan(planFile);
        fs.rmSync(planFile, { force: true });
        const jid = jidFor(sock, plan);
        if (jid) {
            await sock.sendMessage(jid, {
                text: `✅ *Redeploy completed successfully.*\n\n📂 Restored database files: ${result.restored}\n📝 Settings: ${result.env ? 'restored' : 'none'}\n🔐 Backup password was temporary and has been removed.`
            }).catch(() => {});
        }
        console.log(`[REDEPLOY RECOVERY] Restored ${result.restored} database files`);
    } catch (error) {
        console.error('[REDEPLOY RECOVERY] Restore failed:', error.message);
        const jid = jidFor(sock, plan);
        if (jid) await sock.sendMessage(jid, {
            text: `⚠️ *Redeploy rebuilt, but restore failed.*\n\n${error.response?.data?.error || error.message}\n\nThe recovery plan was kept for another attempt.`
        }).catch(() => {});
    }
}

module.exports = { restorePendingPlan, restorePlan, safeDatabaseName, runRecovery };
