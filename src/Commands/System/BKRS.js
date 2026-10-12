const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { formatBotDateTime } = require('../../Utils/timezone');

const BACKUP_API = 'https://bak.crysnovax.link';
const backupSession = new Map();
const restoreSession = new Map();

// Helper: Send premium table
async function sendTable(sock, chat, header, title, rows, footer) {
    await sock.sendMessage(chat, {
        headerText: header,
        contentText: '---',
        title: title,
        table: rows,
        footerText: footer
    });
}

// ==================== BACKUP ====================
const backupCmd = {
    name: 'backup',
    alias: ['savebackup', 'cloudbackup'],
    desc: 'Backup your database and settings to the cloud',
    category: 'Owner',
    ownerOnly: true,
    usage: '.backup start | number= | code= | push',
    reactions: { start: '💾', success: '🥀', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const userId = m.sender;
        const fullText = args.join(' ').trim();
        
        if (!backupSession.has(userId)) {
            backupSession.set(userId, { phone: '', password: '' });
        }
        const session = backupSession.get(userId);

        // START
        if (fullText === 'start' || fullText === '') {
            backupSession.set(userId, { phone: '', password: '' });
            return sendTable(sock, m.chat,
                `## 💾 Cloud Backup`,
                '📋 Step-by-Step',
                [
                    ['📱 Step 1', `${prefix}backup number=2348077528901`],
                    ['🔐 Step 2', `${prefix}backup code=<password>`],
                    ['🚀 Step 3', `${prefix}backup push`]
                ],
                '💡 Your data is encrypted before upload'
            );
        }

        // NUMBER
        if (fullText.startsWith('number=')) {
            const phone = fullText.split('=')[1].replace(/[^0-9]/g, '');
            if (phone.length < 7) return reply('`✘ Invalid phone number`');
            
            try {
                const res = await axios.post(`${BACKUP_API}/backup/exists`, { phone });
                session.phone = phone;
                backupSession.set(userId, session);
                
                if (res.data.exists) {
                    const date = formatBotDateTime(res.data.timestamp);
                    return sendTable(sock, m.chat,
                        `## ⚠️ Existing Backup Found`,
                        '📱 Phone Registered',
                        [
                            ['📱 Phone', phone],
                            ['📅 Created', date],
                            ['📏 Size', res.data.sizeFormatted || 'N/A'],
                            ['🔐 Next', `${prefix}backup code=<password>`]
                        ],
                        '⚠️ This will overwrite the existing backup'
                    );
                }
                return sendTable(sock, m.chat,
                    `## 📱 Phone Set`,
                    '✅ Ready',
                    [
                        ['📱 Phone', phone],
                        ['🔐 Next', `${prefix}backup code=<password>`]
                    ],
                    '💡 Set a password to encrypt your backup'
                );
            } catch (err) {
                return reply(`\`❌ ${err.message}\``);
            }
        }

        // CODE
        if (fullText.startsWith('code=')) {
            const password = fullText.split('=').slice(1).join('=');
            if (password.length < 3) return reply('`✘ Password must be at least 3 characters`');
            session.password = password;
            backupSession.set(userId, session);
            return sendTable(sock, m.chat,
                `## 🔐 Password Set`,
                '✅ Ready to Upload',
                [
                    ['📱 Phone', session.phone],
                    ['🔐 Password', '••••••••'],
                    ['🚀 Next', `${prefix}backup push`]
                ],
                '💡 Your data will be encrypted with this password'
            );
        }

        // PUSH
        if (fullText === 'push') {
            if (!session.phone) return reply('`✘ Set phone first: .backup number=234xxx`');
            if (!session.password) return reply('`✘ Set password first: .backup code=<password>`');

            await sock.sendMessage(m.chat, { react: { text: '💾', key: m.key } });

            const progressMsg = await sock.sendMessage(m.chat, {
                text: `💾 *Uploading Backup...*\n\n▰▱▱▱▱▱▱▱▱▱ 0%\n\n📂 Reading files...`
            });

            try {
                const updateProgress = async (pct, phase) => {
                    const filled = Math.round(pct / 10);
                    const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
                    await sock.sendMessage(m.chat, {
                        text: `💾 *Uploading Backup...*\n\n${bar} ${pct}%\n\n📂 ${phase}`,
                        edit: progressMsg.key
                    });
                };

                await updateProgress(10, 'Reading database...');

                const dbDir = path.join(process.cwd(), 'database');
                const dbFiles = {};
                if (fs.existsSync(dbDir)) {
                    const files = fs.readdirSync(dbDir);
                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            const content = fs.readFileSync(path.join(dbDir, file), 'utf8');
                            try { dbFiles[file] = JSON.parse(content); } catch (e) { dbFiles[file] = content; }
                        }
                    }
                }

                await updateProgress(40, 'Reading .env...');
                let envContent = '';
                const envPath = path.join(process.cwd(), '.env');
                if (fs.existsSync(envPath)) envContent = fs.readFileSync(envPath, 'utf8');

                await updateProgress(60, 'Encrypting...');
                const backupData = { database: dbFiles, env: envContent, timestamp: Date.now() };

                await updateProgress(80, 'Uploading...');
                const saveRes = await axios.post(`${BACKUP_API}/backup/save`, {
                    phone: session.phone,
                    password: session.password,
                    data: backupData
                }, { timeout: 30000 });

                await updateProgress(100, 'Done!');

                await sock.sendMessage(m.chat, { delete: progressMsg.key });

                await sendTable(sock, m.chat,
                    `## ✅ Backup Saved!`,
                    '💾 Cloud Storage',
                    [
                        ['📱 Phone', session.phone],
                        ['📂 Database Files', Object.keys(dbFiles).length],
                        ['📝 .env File', envContent ? '✅ Backed up' : '❌ Not found'],
                        ['📏 Size', saveRes.data.sizeFormatted || (saveRes.data.size / 1024).toFixed(1) + ' KB'],
                        ['🔐 Status', 'Encrypted & Secure']
                    ],
                    '💡 Use .restore on any new deployment to recover!'
                );

                await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

            } catch (err) {
                console.error('[BACKUP]', err.message);
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                await sock.sendMessage(m.chat, {
                    text: `❌ *Failed*\n\n${err.response?.data?.error || err.message}`,
                    edit: progressMsg.key
                });
            }

            backupSession.delete(userId);
            return;
        }

        return sendTable(sock, m.chat,
            `## 💾 Backup Commands`,
            '📋 Usage',
            [
                ['Start', `${prefix}backup start`],
                ['Set Number', `${prefix}backup number=234xxx`],
                ['Set Password', `${prefix}backup code=pass`],
                ['Upload', `${prefix}backup push`]
            ],
            '💡 Follow the steps in order'
        );
    }
};

// ==================== RESTORE ====================
const restoreCmd = {
    name: 'restore',
    alias: ['loadbackup', 'cloudrestore'],
    desc: 'Restore your database and settings from cloud backup',
    category: 'Owner',
    ownerOnly: true,
    usage: '.restore start | number= | code= | push',
    reactions: { start: '📥', success: '✅', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const userId = m.sender;
        const fullText = args.join(' ').trim();
        
        if (!restoreSession.has(userId)) {
            restoreSession.set(userId, { phone: '', password: '' });
        }
        const session = restoreSession.get(userId);

        // START
        if (fullText === 'start' || fullText === '') {
            restoreSession.set(userId, { phone: '', password: '' });
            return sendTable(sock, m.chat,
                `## 📥 Cloud Restore`,
                '📋 Step-by-Step',
                [
                    ['📱 Step 1', `${prefix}restore number=2348077528901`],
                    ['🔐 Step 2', `${prefix}restore code=<password>`],
                    ['🚀 Step 3', `${prefix}restore push`]
                ],
                '💡 Restore your data to any new deployment'
            );
        }

        // NUMBER
        if (fullText.startsWith('number=')) {
            const phone = fullText.split('=')[1].replace(/[^0-9]/g, '');
            if (phone.length < 7) return reply('`✘ Invalid phone`');
            
            try {
                const res = await axios.post(`${BACKUP_API}/backup/exists`, { phone });
                
                if (!res.data.exists) {
                    restoreSession.delete(userId);
                    return sendTable(sock, m.chat,
                        `## ❌ Not Found`,
                        '🔍 Search Result',
                        [
                            ['📱 Phone', phone],
                            ['📊 Status', 'No backup found']
                        ],
                        '💡 Use .backup to create one first'
                    );
                }

                session.phone = phone;
                const date = formatBotDateTime(res.data.timestamp);
                restoreSession.set(userId, session);
                
                return sendTable(sock, m.chat,
                    `## ✅ Backup Found`,
                    '📱 Phone Verified',
                    [
                        ['📱 Phone', phone],
                        ['📅 Date', date],
                        ['📏 Size', res.data.sizeFormatted || 'N/A'],
                        ['🔐 Next', `${prefix}restore code=<password>`]
                    ],
                    '💡 Enter your backup password to continue'
                );
            } catch (err) {
                return reply(`\`❌ ${err.message}\``);
            }
        }

        // CODE
        if (fullText.startsWith('code=')) {
            const password = fullText.split('=').slice(1).join('=');
            if (!password) return reply('`✘ Enter password`');
            session.password = password;
            restoreSession.set(userId, session);
            return sendTable(sock, m.chat,
                `## 🔐 Password Set`,
                '⚠️ Ready to Restore',
                [
                    ['📱 Phone', session.phone],
                    ['🔐 Password', '••••••••'],
                    ['🚀 Next', `${prefix}restore push`],
                    ['⚠️ Warning', 'This overwrites current files!']
                ],
                '💡 Make sure you want to replace all current data'
            );
        }

        // PUSH
        if (fullText === 'push') {
            if (!session.phone) return reply('`✘ .restore number=234xxx first`');
            if (!session.password) return reply('`✘ .restore code=password first`');

            await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });

            const progressMsg = await sock.sendMessage(m.chat, {
                text: `📥 *Restoring Backup...*\n\n▰▱▱▱▱▱▱▱▱▱ 0%\n\n🔓 Decrypting...`
            });

            try {
                const updateProgress = async (pct, phase) => {
                    const filled = Math.round(pct / 10);
                    const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
                    await sock.sendMessage(m.chat, {
                        text: `📥 *Restoring Backup...*\n\n${bar} ${pct}%\n\n🔓 ${phase}`,
                        edit: progressMsg.key
                    });
                };

                await updateProgress(20, 'Downloading...');

                const loadRes = await axios.post(`${BACKUP_API}/backup/load`, {
                    phone: session.phone,
                    password: session.password
                }, { timeout: 30000 });

                if (!loadRes.data.data) throw new Error('No data received');

                const backupData = loadRes.data.data;

                await updateProgress(50, 'Restoring database...');

                let dbCount = 0;
                if (backupData.database) {
                    const dbDir = path.join(process.cwd(), 'database');
                    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
                    
                    for (const [filename, content] of Object.entries(backupData.database)) {
                        const filePath = path.join(dbDir, filename);
                        const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
                        fs.writeFileSync(filePath, data, 'utf8');
                        dbCount++;
                    }
                }

                await updateProgress(75, 'Restoring .env...');

                if (backupData.env) {
                    fs.writeFileSync(path.join(process.cwd(), '.env'), backupData.env, 'utf8');
                }

                await updateProgress(100, 'Done! Restarting...');

                await sock.sendMessage(m.chat, { delete: progressMsg.key });

                await sendTable(sock, m.chat,
                    `## ✅ Restore Complete!`,
                    '📥 Data Recovered',
                    [
                        ['📱 Phone', session.phone],
                        ['📂 Database Files', dbCount],
                        ['📝 .env File', backupData.env ? '✅ Restored' : '⚠️ Not in backup'],
                        ['🔄 Action', 'Rebooting bot...']
                    ],
                    '💡 Bot will restart in 3 seconds'
                );

                await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

                setTimeout(() => process.exit(0), 3000);

            } catch (err) {
                console.error('[RESTORE]', err.message);
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                
                const msg = err.response?.status === 400 ? '🔐 Wrong password!' : err.message;
                await sock.sendMessage(m.chat, { text: `❌ *Failed*\n\n${msg}`, edit: progressMsg.key });
            }

            restoreSession.delete(userId);
            return;
        }

        return sendTable(sock, m.chat,
            `## 📥 Restore Commands`,
            '📋 Usage',
            [
                ['Start', `${prefix}restore start`],
                ['Set Number', `${prefix}restore number=234xxx`],
                ['Set Password', `${prefix}restore code=pass`],
                ['Download', `${prefix}restore push`]
            ],
            '💡 Follow the steps in order'
        );
    }
};

// ==================== EXPORT ====================
module.exports = [backupCmd, restoreCmd];
