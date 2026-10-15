const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const [backup] = require('../src/Commands/System/BKRS');

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

test('backup retries a transient all-encryptions failure and uploads lossless file text', async () => {
    const originalPost = axios.post;
    const requests = [];
    let saveAttempts = 0;

    axios.post = async (url, payload) => {
        requests.push({ url, payload });
        if (url.endsWith('/backup/exists')) return { data: { exists: false } };
        saveAttempts++;
        if (saveAttempts === 1) {
            const error = new Error('All encryptions failed');
            error.response = { status: 500, data: { error: 'All encryptions failed' } };
            throw error;
        }
        return { data: { size: 123, sizeFormatted: '123 B' } };
    };

    try {
        const sock = makeSocket();
        const message = makeMessage(`backup-test-${Date.now()}`);
        const replies = [];
        const context = {
            prefix: '.',
            reply: async text => replies.push(text)
        };

        await backup.execute(sock, message, { ...context, args: ['number=2348077528901'] });
        await backup.execute(sock, message, { ...context, args: ['code=unit-test-password'] });
        await backup.execute(sock, message, { ...context, args: ['push'] });

        const saveRequests = requests.filter(request => request.url.endsWith('/backup/save'));
        assert.equal(saveAttempts, 2);
        assert.equal(saveRequests.length, 2);
        assert.equal(saveRequests[1].payload.password, 'unit-test-password');
        assert.equal(typeof saveRequests[1].payload.data.database['antidelete.json'], 'string');
        assert.equal(replies.length, 0);
        assert.ok(sock.sent.some(({ payload }) => payload.headerText === '## ✅ Backup Saved!'));
    } finally {
        axios.post = originalPost;
    }
});
