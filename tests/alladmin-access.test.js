'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const access = require('../src/Plugin/allAdminAccess');
const alladmin = require('../src/Commands/Admin/alladmin');

async function withTempStore(run) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-alladmin-'));
    const storePath = path.join(dir, 'database', 'alladmin.json');
    const previous = process.env.CODY_ALLADMIN_DB;
    process.env.CODY_ALLADMIN_DB = storePath;
    try {
        return await run(storePath);
    } finally {
        if (previous === undefined) delete process.env.CODY_ALLADMIN_DB;
        else process.env.CODY_ALLADMIN_DB = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test('alladmin mode persists independently for each WhatsApp group and defaults off', () => {
    return withTempStore(storePath => {
        const first = 'first-group@g.us';
        const second = 'second-group@g.us';
        assert.equal(access.isAllAdminEnabled(first, storePath), false);
        access.setAllAdminEnabled(first, true, storePath);
        assert.equal(access.isAllAdminEnabled(first, storePath), true);
        assert.equal(access.isAllAdminEnabled(second, storePath), false);
        access.setAllAdminEnabled(first, false, storePath);
        assert.equal(access.isAllAdminEnabled(first, storePath), false);
    });
});

test('only a group admin can manage alladmin mode', () => {
    assert.equal(access.canManageAllAdmin({ isGroup: true, isAdmin: true }), true);
    assert.equal(access.canManageAllAdmin({ isGroup: true, isAdmin: false }), false);
    assert.equal(access.canManageAllAdmin({ isGroup: false, isAdmin: true }), false);
});

test('enabled alladmin grants only regular Admin-category commands to admins in that group', () => {
    const base = { groupJid: 'group@g.us', isGroup: true, isAdmin: true, enabled: true };
    assert.equal(access.hasAllAdminAccess({ ...base, command: { category: 'Admin' } }), true);
    assert.equal(access.hasAllAdminAccess({ ...base, command: { category: 'Tools' } }), false);
    assert.equal(access.hasAllAdminAccess({ ...base, isAdmin: false, command: { category: 'Admin' } }), false);
    assert.equal(access.hasAllAdminAccess({ ...base, isGroup: false, command: { category: 'Admin' } }), false);
    assert.equal(access.hasAllAdminAccess({ ...base, enabled: false, command: { category: 'Admin' } }), false);
    for (const flag of ['ownerOnly', 'sudoOnly', 'privilegedOnly']) {
        assert.equal(access.hasAllAdminAccess({ ...base, command: { category: 'Admin', [flag]: true } }), false, flag);
    }
    assert.equal(access.isAllAdminCommandBlocked({ enabled: true, isAdmin: false, command: { category: 'Admin' } }), true);
    assert.equal(access.isAllAdminCommandBlocked({ enabled: true, isAdmin: true, command: { category: 'Admin' } }), false);
    assert.equal(access.isAllAdminCommandBlocked({ enabled: true, isAdmin: false, command: { category: 'Tools' } }), false);
    assert.equal(access.isAllAdminCommandBlocked({ enabled: false, isAdmin: false, command: { category: 'Admin' } }), false);
});

test('.alladmin on/off can only be changed by a WhatsApp group admin', async () => {
    await withTempStore(async storePath => {
        const group = `toggle-${Date.now()}@g.us`;
        const replies = [];
        const reply = async message => replies.push(message);
        const message = { isGroup: true, chat: group };

        await alladmin.execute({}, message, { args: ['on'], isAdmin: false, reply, prefix: '.' });
        assert.equal(access.isAllAdminEnabled(group, storePath), false);
        assert.match(replies.pop(), /Only a WhatsApp admin/);

        await alladmin.execute({}, message, { args: ['on'], isAdmin: true, reply, prefix: '.' });
        assert.equal(access.isAllAdminEnabled(group, storePath), true);
        assert.match(replies.pop(), /now ON/);

        await alladmin.execute({}, message, { args: ['off'], isAdmin: true, reply, prefix: '.' });
        assert.equal(access.isAllAdminEnabled(group, storePath), false);
        assert.match(replies.pop(), /now OFF/);

        await alladmin.execute({}, { isGroup: false, chat: 'private@s.whatsapp.net' }, { args: ['on'], isAdmin: true, reply, prefix: '.' });
        assert.match(replies.pop(), /Only a WhatsApp admin/);
    });
});
