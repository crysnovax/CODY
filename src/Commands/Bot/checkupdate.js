const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

const CONFIG = {
    repo: 'crysnovax/CRYSNOVA_AI',
    branch: 'main',
    requestTimeout: 30000
};

// Protected paths that should NOT be shown as "new/changed"
const PROTECTED_PATHS = [
    '.env',
    '.env.example',
    'database',
    'database/',
    'settings',
    'settings/',
    'sessions',
    'sessions/',
    'node_modules',
    'node_modules/',
    'src/database/',
    '.git',
    '.git/',
    '.update_check',
    '.update_check/',
    '.update_temp',
    '.update_temp/',
    '.update_backup',
    '.update_backup/',
    '.wrangler',
    '.wrangler/',
    'auth_info_baileys',
    'creds.json',
    'package-lock.json'
];

function isProtected(filePath) {
    return PROTECTED_PATHS.some(p => {
        return filePath === p || filePath.startsWith(p);
    });
}

async function newUpdate(sock, m, { reply }) {
    const progressMsg = await sock.sendMessage(m.chat, {
        text: `🔍 *Checking for Updates...*\n\n▰▱▱▱▱▱▱▱▱▱ 0%\n\n📡 Connecting to GitHub...`
    });

    const updateProgress = async (percent, phase) => {
        const filled = Math.round(percent / 10);
        const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
        await sock.sendMessage(m.chat, {
            text: `🔍 *Checking for Updates...*\n\n${bar} ${percent}%\n\n📡 ${phase}`,
            edit: progressMsg.key
        });
    };

    try {
        await updateProgress(15, 'Downloading repository...');

        const zipUrl = `https://github.com/${CONFIG.repo}/archive/refs/heads/${CONFIG.branch}.zip`;
        const zipRes = await axios.get(zipUrl, { 
            responseType: 'arraybuffer', 
            timeout: CONFIG.requestTimeout,
            headers: { 'User-Agent': 'CRYSNOVA-Update-Checker' }
        });

        // Extract to temp folder
        const tempDir = './.update_check';
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        fs.mkdirSync(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, 'update.zip');
        fs.writeFileSync(zipPath, zipRes.data);

        await updateProgress(40, 'Extracting files...');

        const zip = new AdmZip(zipPath);
        zip.extractAllTo(tempDir, true);

        const extractedFolder = path.join(tempDir, `${CONFIG.repo.split('/')[1]}-${CONFIG.branch}`);

        await updateProgress(60, 'Comparing files...');

        // Get all files from repo
        function getAllFiles(dir, base = '') {
            let files = [];
            if (!fs.existsSync(dir)) return files;
            for (const f of fs.readdirSync(dir)) {
                const fullPath = path.join(dir, f);
                const relPath = path.join(base, f).replace(/\\/g, '/');
                
                // Skip protected paths
                if (isProtected(relPath)) continue;
                
                if (fs.statSync(fullPath).isDirectory()) {
                    files = files.concat(getAllFiles(fullPath, relPath));
                } else {
                    files.push(relPath);
                }
            }
            return files;
        }

        const repoFiles = getAllFiles(extractedFolder);
        const localFiles = getAllFiles('./');

        await updateProgress(80, 'Finding changes...');

        // Find new or changed files
        const newFiles = [];
        const changedFiles = [];
        const deletedFiles = [];

        for (const f of repoFiles) {
            const localPath = path.join('.', f);
            if (!fs.existsSync(localPath)) {
                newFiles.push(f);
            } else {
                try {
                    const repoData = fs.readFileSync(path.join(extractedFolder, f));
                    const localData = fs.readFileSync(localPath);
                    if (!repoData.equals(localData)) {
                        changedFiles.push(f);
                    }
                } catch (e) {
                    changedFiles.push(f);
                }
            }
        }

        // Find files that exist locally but not in repo (deleted in update)
        for (const f of localFiles) {
            const repoPath = path.join(extractedFolder, f);
            if (!fs.existsSync(repoPath) && !isProtected(f)) {
                deletedFiles.push(f);
            }
        }

        await updateProgress(100, 'Done!');

        // Build response
        let response = '';

        if (newFiles.length === 0 && changedFiles.length === 0 && deletedFiles.length === 0) {
            response = '`⟁⃝⎔UP YO DATE!℘`';
        } else {
            response = `📢 *Update Available!*\n\n`;
            
            if (newFiles.length > 0) {
                response += `ⓘ *New Files (${newFiles.length}):*\n`;
                for (const f of newFiles.slice(0, 15)) {
                    response += `  • ${f}\n`;
                }
                if (newFiles.length > 15) response += `  • _...and ${newFiles.length - 15} more_\n`;
                response += '\n';
            }

            if (changedFiles.length > 0) {
                response += `✐ *Changed Files (${changedFiles.length}):*\n`;
                for (const f of changedFiles.slice(0, 15)) {
                    response += `  • ${f}\n`;
                }
                if (changedFiles.length > 15) response += `  • _...and ${changedFiles.length - 15} more_\n`;
                response += '\n';
            }

            if (deletedFiles.length > 0) {
                response += `彡 *Removed in Update (${deletedFiles.length}):*\n`;
                for (const f of deletedFiles.slice(0, 10)) {
                    response += `  • ${f}\n`;
                }
                if (deletedFiles.length > 10) response += `  • _...and ${deletedFiles.length - 10} more_\n`;
                response += '\n';
            }

            response += `🏗️ *Run .update to apply changes*`;
        }

        await sock.sendMessage(m.chat, {
            text: response,
            edit: progressMsg.key
        });

        // Cleanup
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

    } catch (err) {
        console.error('[CHECKUP ERROR]', err);
        await sock.sendMessage(m.chat, {
            text: '🏗️ *Failed to check for updates*\n\n' + (err.message || 'Try again later.'),
            edit: progressMsg.key
        });
        
        // Cleanup on error too
        const tempDir = './.update_check';
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

module.exports = {
    name: 'checkup',
    alias: ['newupd', 'checkupdate'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Check for new updates without applying (skips personal data)',
    usage: `.checkup`,
    reactions: { start: '🔍', success: '💾', error: '🏗️' },
    execute: newUpdate
};
