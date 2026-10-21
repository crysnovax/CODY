'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const catalog = require('../src/Commands/Business WhatsApp/catalog.js');

test('catalog sends image-backed horizontal carousel cards with supported buttons', async () => {
    const calls = [];
    const sock = {
        sendPlogmeMessage: async (...args) => {
            calls.push(args);
            return { key: { id: 'catalog-1' } };
        },
        sendMessage: async (...args) => {
            calls.push(args);
            return { key: { id: 'catalog-1' } };
        }
    };
    const message = { chat: 'chat@s.whatsapp.net', key: { id: 'quoted' } };
    const product = {
        id: 'product-1',
        name: 'Coffee',
        description: 'Fresh coffee',
        price: 5000,
        currency: 'NGN',
        imageUrls: { original: 'https://cdn.example/coffee.jpg' }
    };

    await catalog.sendCatalog(sock, message, [product], null, 'CATALOG', 10, { ownerPhone: '2348012345678' });
    assert.equal(calls.length, 1);
    const payload = calls[0][1];
    assert.deepEqual(payload, { products: [{
        title: 'Coffee',
        brand: 'CRYSNOVA AI',
        price: 'NGN 5',
        url: 'https://wa.me/p/product-1/2348012345678',
        image: 'https://cdn.example/coffee.jpg'
    }] });
    assert.equal(calls[0][2], undefined);
    assert.deepEqual(calls[0][3], { renderRichResponse: true });
});

test('catalog here retries a phone lookup with its mapped LID', async () => {
    const catalogCalls = [];
    const sent = [];
    const sock = {
        user: { id: '2348000000000@s.whatsapp.net' },
        signalRepository: {
            lidMapping: {
                getLIDForPN: async jid => jid === '2348077134210@s.whatsapp.net' ? '1234567890@lid' : undefined
            }
        },
        getCatalog: async ({ jid }) => {
            catalogCalls.push(jid);
            return jid.endsWith('@lid')
                ? { products: [{ id: 'lid-product', name: 'Mapped item', imageUrls: { original: 'https://cdn.example/item.jpg' } }] }
                : { products: [] };
        },
        sendPlogmeMessage: async (...args) => {
            sent.push(args);
            return { key: { id: `catalog-${sent.length}` } };
        },
        sendMessage: async (...args) => {
            sent.push(args);
            return { key: { id: `catalog-${sent.length}` } };
        }
    };
    const replies = [];
    await catalog.execute(sock, { chat: '2348099999999@s.whatsapp.net', key: { id: 'command' } }, {
        args: ['here', '2348077134210'],
        reply: async text => replies.push(text)
    });

    assert.deepEqual(catalogCalls, [
        '2348077134210@s.whatsapp.net',
        '1234567890@lid'
    ]);
    assert.equal(replies.length, 0);
    assert.equal(sent.some(([, payload]) => payload?.products?.[0]?.title === 'Mapped item'), true);
});
