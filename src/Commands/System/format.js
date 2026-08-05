const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

const CONFIG = {
    repo: 'crysnovax/CRYSNOVA_AI',
    branch: 'main',
    tempDir: './.format_temp',
    backupDir: './.format_backup',
    requestTimeout: 60000
};

// Only these two items are preserved (never overwritten)
const PRESERVE = ['sessions', '.env'];

// Safe file operations
const safeFs = {
    mkdir: dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); },
    remove: p => {
        if (!fs.existsSync(p)) return;
        const stat = fs.statSync(p);
        stat.isDirectory() ? fs.rmSync(p, { recursive: true, force: true }) : fs.unlinkSync(p);
    },
    copy: (src, dest) => {
        if (!fs.existsSync(src)) return;
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            safeFs.mkdir(dest);
            for (const item of fs.readdirSync(src)) {
                const srcPath = path.join(src, item);
                const destPath = path.join(dest, item);
                if (PRESERVE.includes(item)) continue; // never overwrite preserved items
                safeFs.copy(srcPath, destPath);
            }
        } else {
            const destDir = path.dirname(dest);
            safeFs.mkdir(destDir);
            fs.copyFileSync(src, dest);
        }
    }
};

// Overwrite existing files with repo contents (no deletion)
function overwriteWithRepo(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) return;
    for (const item of fs.readdirSync(srcDir)) {
        const srcPath = path.join(srcDir, item);
        const destPath = path.join(destDir, item);
        if (PRESERVE.includes(item)) continue;
        if (fs.statSync(srcPath).isDirectory()) {
            safeFs.mkdir(destPath);
            overwriteWithRepo(srcPath, destPath);
        } else {
            safeFs.mkdir(path.dirname(destPath));
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

module.exports = {
    name: 'format',
    alias: ['flash', 'cleaninstall', 'factoryreset'],
    desc: 'Override bot files with latest from GitHub (preserves only sessions & .env)',
    category: 'Owner',
    owner: true,
    usage: `.format confirm`,

    execute: async (sock, m, { args, reply }) => {
        const confirmWord = args[0]?.toLowerCase();

        if (confirmWord !== 'confirm') {
            return reply(
                `⟁⃝⚠︎ *OVERRIDE OPERATION*\n\n` +
                `This will OVERWRITE all bot files with the latest from:\n` +
                `https://github.com/${CONFIG.repo}\n\n` +
                `Only these are PRESERVED:\n` +
                `• \`sessions/\` folder (auth)\n` +
                `• \`.env\` file\n\n` +
                `To proceed, type: *.format confirm*`
            );
        }

        await reply(`${prefix}𖣘 *FORMAT INITIATED*\n\n_Preserving sessions/ and env..._`);

        try {
            // 1. Backup preserved items
            safeFs.remove(CONFIG.backupDir);
            safeFs.mkdir(CONFIG.backupDir);
            for (const item of PRESERVE) {
                if (fs.existsSync(item)) {
                    safeFs.copy(item, path.join(CONFIG.backupDir, item));
                }
            }
            await reply('`✓ Backup created.`');

            // 2. Download latest repository
            const zipUrl = `https://github.com/${CONFIG.repo}/archive/refs/heads/${CONFIG.branch}.zip`;
            const zipRes = await axios.get(zipUrl, { responseType: 'arraybuffer', timeout: CONFIG.requestTimeout });

            safeFs.remove(CONFIG.tempDir);
            safeFs.mkdir(CONFIG.tempDir);
            const zipPath = path.join(CONFIG.tempDir, 'update.zip');
            fs.writeFileSync(zipPath, zipRes.data);
            await reply('`✓ Repository downloaded.`');

            // 3. Extract
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(CONFIG.tempDir, true);
            await reply('`✓ Files extracted.`');

            // 4. Overwrite current directory with repo contents (no wipe)
            const extractedFolder = path.join(CONFIG.tempDir, `${CONFIG.repo.split('/')[1]}-${CONFIG.branch}`);
            overwriteWithRepo(extractedFolder, './');
            await reply('`✓ Files overwritten from repository.`');

            // 5. Restore preserved items
            for (const item of PRESERVE) {
                const backupPath = path.join(CONFIG.backupDir, item);
                if (fs.existsSync(backupPath)) {
                    safeFs.remove(item);
                    safeFs.copy(backupPath, item);
                }
            }
            await reply('`✓ Sessions and .env restored.`');

            // 6. Cleanup temp folders
            safeFs.remove(CONFIG.tempDir);
            safeFs.remove(CONFIG.backupDir);

            await reply(
                `ಠ_ಠ *FORMAT COMPLETE*\n\n` +
                `Bot files have been replaced with the latest from GitHub.\n` +
                `Sessions and .env preserved.\n\n` +
                `_Restarting in 3 seconds..._`
            );

            setTimeout(() => process.exit(0), 3000);

        } catch (err) {
            console.error('[FORMAT ERROR]', err);
            try {
                for (const item of PRESERVE) {
                    const backupPath = path.join(CONFIG.backupDir, item);
                    if (fs.existsSync(backupPath)) {
                        safeFs.remove(item);
                        safeFs.copy(backupPath, item);
                    }
                }
            } catch (e) {}
            reply(`${prefix}✘ *FORMAT FAILED*\n${errmessage}\n\nBackup restored.`);
        }
    }
};
