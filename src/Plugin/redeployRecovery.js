const fs = require('fs');
const path = require('path');

function safeDatabaseName(name) {
    return typeof name === 'string' && /^[^/\\]+\.json$/.test(name);
}

function verifyFile(file, expected) {
    return fs.existsSync(file) && fs.readFileSync(file, 'utf8') === expected;
}

function restorePlan(planFile) {
    const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    if (plan.version !== 2 || plan.type !== 'local-redeploy' || !plan.botDir || !plan.data) {
        throw new Error('Invalid local redeploy recovery cache');
    }
    const botDir = path.resolve(plan.botDir);
    const data = plan.data;
    const database = data.database && typeof data.database === 'object' ? data.database : {};
    const databaseDir = path.join(botDir, 'database');
    fs.mkdirSync(databaseDir, { recursive: true });
    let restored = 0;

    for (const [name, contents] of Object.entries(database)) {
        if (!safeDatabaseName(name)) throw new Error(`Unsafe database filename in recovery cache: ${name}`);
        const value = typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2);
        const filePath = path.join(databaseDir, name);
        fs.writeFileSync(filePath, value, 'utf8');
        if (!verifyFile(filePath, value)) throw new Error(`Verification failed for database/${name}`);
        restored++;
    }

    let env = false;
    if (typeof data.env === 'string' && data.env.trim()) {
        const envPath = path.join(botDir, '.env');
        fs.writeFileSync(envPath, data.env, 'utf8');
        if (!verifyFile(envPath, data.env)) throw new Error('Verification failed for .env');
        // index.js has already loaded dotenv by the time this preflight runs.
        // Apply restored values so modules loaded afterward see the cache.
        const dotenv = require('dotenv');
        Object.assign(process.env, dotenv.parse(data.env));
        env = true;
    }

    return { restored, env };
}

async function restorePendingPlan() {
    const planFile = process.env.CODY_REDEPLOY_PLAN;
    if (!planFile) return null;
    const resolvedPlan = path.resolve(planFile);
    if (!fs.existsSync(resolvedPlan)) {
        console.warn('[REDEPLOY RECOVERY] Local cache was not found:', resolvedPlan);
        return null;
    }
    try {
        const result = restorePlan(resolvedPlan);
        // The cache is deleted only after every restored file passed verification.
        fs.rmSync(resolvedPlan, { force: true });
        console.log(`[REDEPLOY RECOVERY] Restored ${result.restored} database files from local cache before startup`);
        return result;
    } catch (error) {
        console.error('[REDEPLOY RECOVERY] Local restore failed; cache preserved:', error.message);
        return { error };
    }
}

module.exports = { restorePendingPlan, restorePlan, safeDatabaseName, verifyFile };
