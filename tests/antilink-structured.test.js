const test = require('node:test');
const assert = require('node:assert/strict');
const { getMessageText, hasLink, extractUrls } = require('../src/Commands/Admin/antilink');

test('finds URLs in nested poll, event, product, and rich/table payloads', () => {
    const payload = {
        pollCreationMessage: {
            options: [{ optionName: 'Join https://chat.whatsapp.com/AbCdEf123456' }]
        },
        eventMessage: {
            eventName: 'Community meetup',
            description: 'Details: https://events.example.org/invite'
        },
        productMessage: {
            product: { title: 'Limited offer', productUrl: 'https://shop.example.net/item/42' }
        },
        richResponseMessage: {
            table: { rows: [{ cells: ['Open https://tables.example.com/access'] }] },
            cards: [{ buttons: [{ text: 'Open', url: 'https://buttons.example.org/card' }] }]
        }
    };

    const texts = getMessageText(payload);
    const combined = texts.join(' ');
    assert.ok(hasLink(combined));
    for (const url of [
        'chat.whatsapp.com/AbCdEf123456',
        'events.example.org/invite',
        'shop.example.net/item/42',
        'tables.example.com/access',
        'buttons.example.org/card'
    ]) {
        assert.ok(texts.some(text => text.includes(url)), `expected to find ${url}`);
    }
    assert.ok(extractUrls(combined).some(url => url.includes('chat.whatsapp.com/AbCdEf123456')));
});

test('parses escaped URLs in known rich/native-flow JSON fields', () => {
    const buttonParamsJson = JSON.stringify({ url: 'https://native.example.org/join' }).replaceAll('/', '\\/');
    const texts = getMessageText({
        interactiveResponseMessage: {
            nativeFlowResponseMessage: { buttonParamsJson }
        }
    });
    assert.ok(texts.some(text => text.includes('native.example.org/join')));
});

test('continues to ignore URLs found only inside a quoted message', () => {
    const texts = getMessageText({
        conversation: 'This is a reply, not a link',
        contextInfo: {
            quotedMessage: { conversation: 'https://quoted.example.org/should-not-trigger' }
        }
    });
    assert.deepEqual(texts, ['This is a reply, not a link']);
});

test('ignores media transport URLs but still scans visible media captions and ad targets', () => {
    const texts = getMessageText({
        imageMessage: {
            url: 'https://mmg.whatsapp.net/image/transport',
            directPath: 'https://cdn.example.net/media/transport',
            caption: 'Caption has https://shared.example.org/page'
        },
        contextInfo: {
            externalAdReply: {
                thumbnailUrl: 'https://mmg.whatsapp.net/ad/thumbnail',
                sourceUrl: 'https://advert.example.com/offer'
            }
        }
    });
    const combined = texts.join(' ');
    assert.ok(combined.includes('shared.example.org/page'));
    assert.ok(combined.includes('advert.example.com/offer'));
    assert.ok(!combined.includes('mmg.whatsapp.net'));
    assert.ok(!combined.includes('cdn.example.net/media/transport'));
});

test('ignores unrelated arbitrary string metadata without a link', () => {
    assert.deepEqual(getMessageText({
        productMessage: { retailerId: 'sku12345', currencyCode: 'USD' },
        pollCreationMessage: { options: [{ optionName: 'Yes' }, { optionName: 'No' }] }
    }), []);
});
