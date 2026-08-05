const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

const CONFIG = {
    repo: 'crysnovax/CODY',
    branch: 'main',
    backupDir: './.update_backup',
    tempDir: './.update_temp',
    requestTimeout: 30000
};

const PROTECTED_PATHS = [
    'sessions',
    'database',
    'node_modules',
    '.env',
    'auth_info_baileys',
    'creds.json'
];

const safeFs = {
    mkdir: dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); },
    remove: p => { if (!fs.existsSync(p)) return; const stat = fs.statSync(p); stat.isDirectory() ? fs.rmSync(p, { recursive: true, force: true }) : fs.unlinkSync(p); },
    copy: (src, dest) => {
        if (!fs.existsSync(src)) return;
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            for (const item of fs.readdirSync(src)) {
                const srcPath = path.join(src, item);
                const destPath = path.join(dest, item);
                if (PROTECTED_PATHS.some(p => srcPath.includes(p))) continue;
                safeFs.copy(srcPath, destPath);
            }
        } else {
            fs.copyFileSync(src, dest);
        }
    }
};

function cleanupUntracked(folder, repoFilesSet) {
    for (const item of fs.readdirSync(folder)) {
        const fullPath = path.join(folder, item);
        const relative = path.relative('.', fullPath).replace(/\\/g, '/');
        if (PROTECTED_PATHS.some(p => relative.startsWith(p))) continue;
        if (!repoFilesSet.has(relative)) {
            safeFs.remove(fullPath);
        } else if (fs.statSync(fullPath).isDirectory()) {
            cleanupUntracked(fullPath, repoFilesSet);
        }
    }
}

function bar(percent) {
    const total = 10;
    const filled = Math.round((percent / 100) * total);
    return '▰'.repeat(filled) + '▱'.repeat(total - filled) + ` ${percent}%`;
}

module.exports = {
    name: 'update',
    alias: ['upgrade', 'upd'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Premium auto-updater with live progress bar',
    usage: `.update`,

    execute: async (sock, m, { reply }) => {
        // Send initial message
        const msg = await sock.sendMessage(m.chat, { text: bar(0) });
        const key = msg.key;

        const edit = async (p) => {
            await sock.sendMessage(m.chat, { text: bar(p), edit: key });
        };

        try {
            // Backup
            safeFs.remove(CONFIG.backupDir);
            safeFs.mkdir(CONFIG.backupDir);
            for (const file of PROTECTED_PATHS) {
                if (fs.existsSync(file)) safeFs.copy(file, path.join(CONFIG.backupDir, file));
            }
            await edit(10);

            // Download
            const zipUrl = `https://github.com/${CONFIG.repo}/archive/refs/heads/${CONFIG.branch}.zip`;
            const zipRes = await axios.get(zipUrl, { responseType: 'arraybuffer', timeout: CONFIG.requestTimeout });
            safeFs.remove(CONFIG.tempDir);
            safeFs.mkdir(CONFIG.tempDir);
            fs.writeFileSync(path.join(CONFIG.tempDir, 'update.zip'), zipRes.data);
            await edit(30);

            // Extract
            const zip = new AdmZip(path.join(CONFIG.tempDir, 'update.zip'));
            zip.extractAllTo(CONFIG.tempDir, true);
            await edit(50);

            // Copy
            const extractedFolder = path.join(CONFIG.tempDir, `${CONFIG.repo.split('/')[1]}-${CONFIG.branch}`);
            safeFs.copy(extractedFolder, './');
            await edit(75);

            // Cleanup
            const repoFiles = new Set();
            function scanRepo(dir, base = '') {
                for (const f of fs.readdirSync(dir)) {
                    const fp = path.join(dir, f);
                    const rp = path.join(base, f).replace(/\\/g, '/');
                    repoFiles.add(rp);
                    if (fs.statSync(fp).isDirectory()) scanRepo(fp, rp);
                }
            }
            scanRepo(extractedFolder);
            cleanupUntracked('.', repoFiles);
            safeFs.remove(CONFIG.tempDir);
            await edit(100);

            // Restart
            setTimeout(() => process.exit(0), 1000);

        } catch (err) {
            console.error('[UPDATE ERROR]', err);
            await sock.sendMessage(m.chat, { text: bar(0), edit: key });
            for (const file of PROTECTED_PATHS) {
                const bp = path.join(CONFIG.backupDir, file);
                if (fs.existsSync(bp)) safeFs.copy(bp, file);
            }
        }
    }
};
