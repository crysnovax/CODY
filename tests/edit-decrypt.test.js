const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { proto } = require('plogme');
const { decryptSecretEdit } = require('../src/Plugin/editDecrypt');

test('decrypts a targeted SecretEncryptedMessage edit and marks it as an edit', async () => {
    const jid = '12345@s.whatsapp.net';
    const messageId = 'EDIT-TARGET-1';
    const secret = Buffer.alloc(32, 7);
    const iv = Buffer.alloc(12, 9);
    const info = Buffer.concat([
        Buffer.from(messageId),
        Buffer.from(jid),
        Buffer.from(jid),
        Buffer.from('Message Edit')
    ]);
    const key = Buffer.from(crypto.hkdfSync('sha256', secret, Buffer.alloc(32), info, 32));
    const plaintext = proto.Message.encode(proto.Message.create({
        protocolMessage: {
            key: { remoteJid: jid, id: messageId },
            editedMessage: { conversation: '.help' },
            type: proto.Message.ProtocolMessage.Type.MESSAGE_EDIT
        }
    })).finish();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const payload = Buffer.concat([ciphertext, cipher.getAuthTag()]);
    const original = {
        key: { remoteJid: jid, id: messageId },
        message: { messageContextInfo: { messageSecret: secret } }
    };
    const incoming = {
        key: { remoteJid: jid, participant: jid, id: 'ENCRYPTED-EDIT' },
        message: {
            secretEncryptedMessage: {
                targetMessageKey: { remoteJid: jid, id: messageId },
                encPayload: payload,
                encIv: iv,
                secretEncType: proto.Message.SecretEncryptedMessage.SecretEncType.MESSAGE_EDIT
            }
        }
    };
    const store = { loadMessage: async () => original };

    const result = await decryptSecretEdit(incoming, store, { user: { id: jid } });

    assert.equal(result, true);
    assert.equal(incoming.isEdit, true);
    assert.equal(incoming.key.id, messageId);
    assert.equal(incoming.message.conversation, '.help');
});

test('does not consume a non-edit SecretEncryptedMessage', async () => {
    const incoming = {
        key: { remoteJid: '12345@s.whatsapp.net', id: 'x' },
        message: {
            secretEncryptedMessage: {
                secretEncType: proto.Message.SecretEncryptedMessage.SecretEncType.POLL_EDIT
            }
        }
    };
    assert.equal(await decryptSecretEdit(incoming, null, {}), false);
});
