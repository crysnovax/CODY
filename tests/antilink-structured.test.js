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
            product: {
                title: 'Limited offer',
                url: 'https://shop.example.net/item/42',
                productImage: { url: 'https://mmg.whatsapp.net/catalog/product-image' }
            }
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
    assert.ok(!combined.includes('mmg.whatsapp.net'));
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

test('ignores Baileys media transport URLs for images, videos, GIFs, live photos and wrapped media', () => {
    const mediaOnly = {
        imageMessage: {
            url: 'https://mmg.whatsapp.net/image/transport',
            staticUrl: 'https://mmg.whatsapp.net/image/static',
            directPath: '/v/t62/image/path',
            qrUrl: 'https://qr.example.org/from-image',
            accessibilityLabel: 'https://alt.example.org/image'
        },
        instantImageMessage: {
            url: 'https://mmg.whatsapp.net/instant-image/transport',
            staticUrl: 'https://mmg.whatsapp.net/instant-image/static'
        },
        videoMessage: {
            url: 'https://mmg.whatsapp.net/video/transport',
            staticUrl: 'https://mmg.whatsapp.net/video/static',
            metadataUrl: 'https://mmg.whatsapp.net/video/metadata',
            dashManifestUrl: 'https://mmg.whatsapp.net/video/manifest',
            gifPlayback: true,
            motionPhotoPresentationOffsetMs: 12
        },
        ptvMessage: {
            url: 'https://mmg.whatsapp.net/live-photo/transport',
            metadataUrl: 'https://mmg.whatsapp.net/live-photo/metadata'
        },
        eventCoverImage: {
            message: { imageMessage: { url: 'https://mmg.whatsapp.net/event-cover/transport' } }
        },
        contextInfo: {
            externalAdReply: {
                thumbnailUrl: 'https://mmg.whatsapp.net/ad/thumbnail',
                mediaUrl: 'https://mmg.whatsapp.net/ad/media',
                originalImageUrl: 'https://mmg.whatsapp.net/ad/original',
                adPreviewUrl: 'https://mmg.whatsapp.net/ad/preview'
            }
        }
    };
    assert.deepEqual(getMessageText(mediaOnly), []);

    const texts = getMessageText({
        ...mediaOnly,
        imageMessage: { ...mediaOnly.imageMessage, caption: 'Caption has https://shared.example.org/page' },
        contextInfo: {
            externalAdReply: {
                ...mediaOnly.contextInfo.externalAdReply,
                sourceUrl: 'https://advert.example.com/offer'
            }
        }
    });
    const combined = texts.join(' ');
    assert.ok(combined.includes('shared.example.org/page'));
    assert.ok(combined.includes('advert.example.com/offer'));
    assert.ok(!combined.includes('mmg.whatsapp.net'));
});

test('ignores unrelated arbitrary string metadata without a link', () => {
    assert.deepEqual(getMessageText({
        productMessage: { retailerId: 'sku12345', currencyCode: 'USD' },
        pollCreationMessage: { options: [{ optionName: 'Yes' }, { optionName: 'No' }] }
    }), []);
});
