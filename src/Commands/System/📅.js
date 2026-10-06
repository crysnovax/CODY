const fs = require('fs');
const path = require('path');
const { requestPollApproval } = require('../../Plugin/pollApproval');

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

const CLEANUP_EXCLUSIONS = new Set(['.git', '.update_backup', '.update_temp']);

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
        if (CLEANUP_EXCLUSIONS.has(relative) || PROTECTED_PATHS.some(p => relative.startsWith(p))) continue;
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

async function runUpdate(sock, m) {
    const axios = require('axios');
    const AdmZip = require('adm-zip');
    const msg = await sock.sendMessage(m.chat, { text: bar(0) });
    const key = msg.key;
    const edit = async p => sock.sendMessage(m.chat, { text: bar(p), edit: key });

    try {
        safeFs.remove(CONFIG.backupDir);
        safeFs.mkdir(CONFIG.backupDir);
        for (const file of PROTECTED_PATHS) {
            if (fs.existsSync(file)) safeFs.copy(file, path.join(CONFIG.backupDir, file));
        }
        await edit(10);

        const zipUrl = `https://github.com/${CONFIG.repo}/archive/refs/heads/${CONFIG.branch}.zip`;
        const zipRes = await axios.get(zipUrl, { responseType: 'arraybuffer', timeout: CONFIG.requestTimeout });
        safeFs.remove(CONFIG.tempDir);
        safeFs.mkdir(CONFIG.tempDir);
        fs.writeFileSync(path.join(CONFIG.tempDir, 'update.zip'), zipRes.data);
        await edit(30);

        const zip = new AdmZip(path.join(CONFIG.tempDir, 'update.zip'));
        zip.extractAllTo(CONFIG.tempDir, true);
        await edit(50);

        const extractedFolder = path.join(CONFIG.tempDir, `${CONFIG.repo.split('/')[1]}-${CONFIG.branch}`);
        safeFs.copy(extractedFolder, './');
        await edit(75);

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

        try { require('../../Plugin/uptime').markUpdateRestart(); } catch (e) {}
        setTimeout(() => process.exit(0), 1000);
    } catch (err) {
        console.error('[UPDATE ERROR]', err);
        await sock.sendMessage(m.chat, { text: `${bar(0)}\nUpdate failed: ${err.message}`, edit: key });
        for (const file of PROTECTED_PATHS) {
            const bp = path.join(CONFIG.backupDir, file);
            if (fs.existsSync(bp)) safeFs.copy(bp, file);
        }
    }
}

module.exports = {
    name: 'update',
    alias: ['upgrade', 'upd'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Apply the latest CODY update after Continue/Cancel poll approval',
    usage: '.update',

    execute: async (sock, m, { reply, isOwner, isDual }) => {
        if (!isOwner && !isDual) return reply('Only the bot owner or an authorized dual user can request an update.');
        const chatId = m?.chat || m?.key?.remoteJid;
        if (!chatId) return reply('Could not identify the approval chat. No update was started.');

        const isGroup = String(chatId).endsWith('@g.us');
        const identities = [m?.sender, m?.key?.participant, m?.key?.participantAlt, m?.key?.remoteJidAlt,
            !isGroup ? m?.key?.remoteJid : null]
            .filter(Boolean);
        const allowedVoters = isGroup ? [] : identities;
        if (!isGroup && !allowedVoters.length) return reply('Could not verify the owner identity for a private approval poll. No update was started.');

        if (isGroup) {
            const metadata = await sock.groupMetadata(chatId).catch(() => null);
            if (!metadata) return reply('Could not read group admins. No update was started.');
            const botIds = new Set([sock.user?.id, sock.user?.lid, sock.user?.jid]
                .filter(Boolean).map(value => String(value).replace(/:\d+@/, '@').toLowerCase()));
            const humanAdmins = (metadata.participants || []).filter(participant =>
                (participant.admin === 'admin' || participant.admin === 'superadmin')
                && ![participant.id, participant.jid, participant.lid].filter(Boolean)
                    .some(value => botIds.has(String(value).replace(/:\d+@/, '@').toLowerCase())));
            if (!humanAdmins.length) return reply('No human group admins are available to approve this update. Run .update in your private chat instead.');
        }

        const warning = '⚠️ *CODY UPDATE:* Continue will download the latest `crysnovax/CODY` `main` source, overwrite matching application files, remove files missing from that repository (except protected data and `.git`), then restart the bot. No update work begins unless approval passes. The poll expires in 2 minutes.';
        await reply(isGroup
            ? `${warning}\n\nA strict majority of current human group admins must vote *Continue*. Any admin may vote *Cancel*.`
            : `${warning}\n\nThis private poll accepts only the authorized command caller’s vote.`);

        try {
            await requestPollApproval(sock, {
                chatId,
                title: 'Apply latest CODY main update and restart?',
                actionLabel: 'CODY update from main and restart',
                timeoutMs: 2 * 60 * 1000,
                allowedVoters,
                onApproved: async () => runUpdate(sock, { ...m, chat: chatId }),
            });
            return reply('_Update approval poll started. Vote Continue to proceed or Cancel to abort._');
        } catch (error) {
            console.error('[UPDATE POLL]', error?.stack || error);
            return reply(`Could not start the update approval poll; no files were changed. ${error.message}`);
        }
    },
};

module.exports.runUpdate = runUpdate;
