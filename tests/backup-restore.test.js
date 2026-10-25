const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const axiosMock = { post: async () => { throw new Error('axios.post mock not configured'); } };
const commandPath = path.resolve(__dirname, '../src/Commands/System/BKRS.js');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'axios') return axiosMock;
    if (request === '../../Utils/timezone' && parent?.filename === commandPath) {
        return { formatBotDateTime: value => new Date(Number(value)).toISOString() };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const [backup, restore] = require(commandPath);
const helpers = require(commandPath).helpers;
Module._load = originalLoad;

function makeSocket() {
    const sent = [];
    return {
        sent,
        async sendMessage(chat, payload) {
            sent.push({ chat, payload });
            return { key: { id: `mock-${sent.length}` } };
        }
    };
}

function makeMessage(sender) {
    return { sender, chat: `${sender}@s.whatsapp.net`, key: { id: 'command' } };
}

async function withTempRoot(fn) {
    const originalCwd = process.cwd();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-backup-test-'));
    try {
        process.chdir(root);
        return await fn(root);
    } finally {
        process.chdir(originalCwd);
        fs.rmSync(root, { recursive: true, force: true });
    }
}

async function withBackupEnvironment(fn) {
    const names = ['BACKUP_API_URL', 'BACKUP_API_TOKEN'];
    const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
    process.env.BACKUP_API_URL = 'https://bk.crysnovax.com';
    process.env.BACKUP_API_TOKEN = 'test-api-token-'.padEnd(64, 'a');
    try {
        return await fn();
    } finally {
        for (const name of names) {
            if (before[name] === undefined) delete process.env[name];
            else process.env[name] = before[name];
        }
    }
}

function writeFixture(root) {
    fs.mkdirSync(path.join(root, 'database', 'nested'), { recursive: true });
    fs.mkdirSync(path.join(root, 'database', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, 'database', 'nested', 'user-config.json'), JSON.stringify({
        bot: { prefix: '!', name: 'CODY test' },
        sessionId: 'must-not-be-backed-up',
        apiKey: 'must-not-be-backed-up'
    }));
    fs.writeFileSync(path.join(root, 'database', 'sessions', 'creds.json'), '{"noiseKey":"must-not-be-backed-up"}');
    fs.writeFileSync(path.join(root, 'database', 'runtime-config.json'), JSON.stringify({ PREFIX: '!' }));
    fs.writeFileSync(path.join(root, '.env'), [
        'BOT_NAME=CODY',
        'PREFIX=.',
        'SESSION_ID=must-not-be-backed-up',
        'SESSION_NAME=sessions',
        'OPENAI_API_KEY=must-not-be-backed-up',
        'BACKUP_API_TOKEN=must-not-be-backed-up',
        ''
    ].join('\n'));
}

function setAxiosPost(handler) {
    const previous = axiosMock.post;
    axiosMock.post = handler;
    return () => { axiosMock.post = previous; };
}

const context = { prefix: '.', reply: async () => {} };

test('backup selects a phone and appends a version through BAKNEW with session files and secrets excluded', async () => {
    await withBackupEnvironment(async () => withTempRoot(async root => {
        writeFixture(root);
        const requests = [];
        const restoreAxios = setAxiosPost(async (url, payload, options) => {
            requests.push({ url, payload, options });
            if (url.endsWith('/backup/history')) return { data: { ok: true, history: [] } };
            if (url.endsWith('/backup/save')) return { data: {
                ok: true,
                backupId: '0000000000000-test-id',
                timestamp: Date.now(),
                sizeFormatted: '1.0 KB',
                encrypted: true
            } };
            throw new Error(`Unexpected URL: ${url}`);
        });
        try {
            const sock = makeSocket();
            const message = makeMessage(`backup-owner-${Date.now()}`);
            await backup.execute(sock, message, { ...context, args: ['+234 807 752 8901'] });
            await backup.execute(sock, message, { ...context, args: ['save'] });

            assert.deepEqual(requests.map(request => request.url), [
                'https://bk.crysnovax.com/backup/history',
                'https://bk.crysnovax.com/backup/save'
            ]);
            assert.equal(requests[0].options.headers.Authorization, `Bearer ${process.env.BACKUP_API_TOKEN}`);
            const payload = requests[1].payload;
            assert.equal(payload.phone, '2348077528901');
            assert.equal(Object.hasOwn(payload, 'password'), false);
            assert.equal(payload.data.database['nested/user-config.json'], JSON.stringify({ bot: { prefix: '!', name: 'CODY test' } }));
            assert.equal(payload.data.database['runtime-config.json'], JSON.stringify({ PREFIX: '!' }));
            assert.equal(payload.data.database['sessions/creds.json'], undefined);
            assert.equal(payload.data.env, 'BOT_NAME=CODY\nPREFIX=.');
            assert.doesNotMatch(JSON.stringify(payload.data), /must-not-be-backed-up|SESSION_ID|OPENAI_API_KEY|apiKey/);
            assert.ok(sock.sent.some(({ payload: sent }) => sent.headerText === '## ✅ Backup Version Saved'));
        } finally {
            restoreAxios();
        }
    }));
});

test('restore lists versions and loads the requested older version without restoring secrets or sessions', async () => {
    await withBackupEnvironment(async () => withTempRoot(async root => {
        fs.mkdirSync(path.join(root, 'database'), { recursive: true });
        fs.writeFileSync(path.join(root, '.env'), 'SESSION_ID=current-live-session\nOPENAI_API_KEY=current-live-key\nBOT_NAME=old-name\n');
        const firstVersion = { backupId: 'version-newest', timestamp: Date.now(), sizeFormatted: '2 KB' };
        const secondVersion = { backupId: 'version-older', timestamp: Date.now() - 1000, sizeFormatted: '1 KB' };
        const requests = [];
        const restoreAxios = setAxiosPost(async (url, payload, options) => {
            requests.push({ url, payload, options });
            if (url.endsWith('/backup/history')) return { data: { history: [firstVersion, secondVersion] } };
            if (url.endsWith('/restore/load')) return { data: {
                backupId: secondVersion.backupId,
                timestamp: secondVersion.timestamp,
                data: {
                    database: {
                        'nested/user-config.json': JSON.stringify({ bot: { prefix: '!', name: 'restored' }, sessionId: 'evil-session' }),
                        'sessions/creds.json': 'evil-session-creds'
                    },
                    env: 'BOT_NAME=restored\nSESSION_ID=evil-session\nOPENAI_API_KEY=evil-key\n'
                }
            } };
            throw new Error(`Unexpected URL: ${url}`);
        });
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = () => ({ unref() {} });
        try {
            const sock = makeSocket();
            const message = makeMessage(`restore-owner-${Date.now()}`);
            await restore.execute(sock, message, { ...context, args: ['2348077528901'] });
            await restore.execute(sock, message, { ...context, args: ['load', '2'] });

            assert.deepEqual(requests.map(request => request.url), [
                'https://bk.crysnovax.com/backup/history',
                'https://bk.crysnovax.com/restore/load'
            ]);
            assert.equal(requests[1].payload.backupId, 'version-older');
            assert.equal(Object.hasOwn(requests[1].payload, 'password'), false);
            assert.equal(fs.readFileSync(path.join(root, 'database', 'nested', 'user-config.json'), 'utf8'), JSON.stringify({ bot: { prefix: '!', name: 'restored' } }));
            assert.equal(fs.existsSync(path.join(root, 'database', 'sessions', 'creds.json')), false);
            const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
            assert.match(env, /SESSION_ID=current-live-session/);
            assert.match(env, /OPENAI_API_KEY=current-live-key/);
            assert.match(env, /BOT_NAME=restored/);
            assert.doesNotMatch(env, /evil-session|evil-key/);
            assert.ok(sock.sent.some(({ payload: sent }) => sent.headerText === '## ✅ Restore Complete'));
        } finally {
            restoreAxios();
            global.setTimeout = originalSetTimeout;
        }
    }));
});

test('restore defaults to newest version and rejects unsafe filenames and excluded session paths', async () => {
    await withBackupEnvironment(async () => withTempRoot(async root => {
        const history = [
            { backupId: 'newest-version', timestamp: Date.now() },
            { backupId: 'older-version', timestamp: Date.now() - 1000 }
        ];
        const requests = [];
        const restoreAxios = setAxiosPost(async (url, payload) => {
            requests.push({ url, payload });
            if (url.endsWith('/backup/history')) return { data: { history } };
            if (url.endsWith('/restore/load')) return { data: { data: { database: {} }, backupId: payload.backupId, timestamp: Date.now() } };
            throw new Error(`Unexpected URL: ${url}`);
        });
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = () => ({ unref() {} });
        try {
            const message = makeMessage(`restore-latest-${Date.now()}`);
            await restore.execute(makeSocket(), message, { ...context, args: ['2348077528901'] });
            await restore.execute(makeSocket(), message, { ...context, args: ['load'] });
            assert.equal(requests[1].payload.backupId, 'newest-version');
        } finally {
            restoreAxios();
            global.setTimeout = originalSetTimeout;
        }

        assert.equal(helpers.isSafeDatabaseFilename('../outside.json'), false);
        assert.equal(helpers.isSafeDatabaseFilename('sessions/creds.json'), false);
        assert.equal(helpers.sanitizeEnvironment('SESSION_ID=x\nPREFIX=!'), 'PREFIX=!');
    }));
});

test('backup configuration requires only a valid API token; encryption password is not required', () => {
    const beforeToken = process.env.BACKUP_API_TOKEN;
    const beforePassword = process.env.BACKUP_ENCRYPTION_PASSWORD;
    try {
        process.env.BACKUP_API_TOKEN = 'short';
        delete process.env.BACKUP_ENCRYPTION_PASSWORD;
        assert.throws(() => helpers.getBackupConfig(), /BACKUP_API_TOKEN/);
        process.env.BACKUP_API_TOKEN = 'valid-api-token-'.padEnd(64, 'b');
        process.env.BACKUP_ENCRYPTION_PASSWORD = 'unused-old-setting';
        assert.deepEqual(helpers.getBackupConfig(), {
            baseUrl: 'https://bk.crysnovax.com',
            token: process.env.BACKUP_API_TOKEN
        });
    } finally {
        if (beforeToken === undefined) delete process.env.BACKUP_API_TOKEN;
        else process.env.BACKUP_API_TOKEN = beforeToken;
        if (beforePassword === undefined) delete process.env.BACKUP_ENCRYPTION_PASSWORD;
        else process.env.BACKUP_ENCRYPTION_PASSWORD = beforePassword;
    }
});
