const test = require('node:test');
const assert = require('node:assert/strict');
const { getMessageText, hasLink, extractUrls, shouldScanSerializedText, getEditedImageCaptionText, getViewOnceText } = require('../src/Commands/Admin/antilink');

test('checks normal text plus poll/product links, but ignores other rich payloads', () => {
    const payload = {
        conversation: 'Plain text: https://plain.example.org/page',
        extendedTextMessage: { text: 'Edited text: https://edited.example.org/page' },
        pollCreationMessage: {
            options: [{ optionName: 'Join https://chat.whatsapp.com/AbCdEf123456' }]
        },
        productMessage: {
            product: {
                title: 'Limited offer',
                url: 'https://shop.example.net/item/42',
                productImage: { url: 'https://mmg.whatsapp.net/catalog/product-image' }
            }
        },
        eventMessage: { eventName: 'Community meetup', description: 'https://events.example.org/invite' },
        richResponseMessage: {
            table: { rows: [{ cells: ['https://tables.example.com/access'] }] },
            cards: [{ buttons: [{ text: 'Open', url: 'https://buttons.example.org/card' }] }]
        }
    };

    const texts = getMessageText(payload);
    const combined = texts.join(' ');
    assert.ok(hasLink(combined));
    for (const url of [
        'plain.example.org/page',
        'edited.example.org/page',
        'chat.whatsapp.com/AbCdEf123456',
        'shop.example.net/item/42'
    ]) {
        assert.ok(texts.some(text => text.includes(url)), `expected to find ${url}`);
    }
    for (const ignoredUrl of [
        'events.example.org/invite',
        'tables.example.com/access',
        'buttons.example.org/card',
        'mmg.whatsapp.net'
    ]) {
        assert.ok(!combined.includes(ignoredUrl), `did not expect to scan ${ignoredUrl}`);
    }
    assert.ok(extractUrls(combined).some(url => url.includes('chat.whatsapp.com/AbCdEf123456')));
});

test('does not scan native-flow response JSON or unsupported rich messages', () => {
    const buttonParamsJson = JSON.stringify({ url: 'https://native.example.org/join' }).replaceAll('/', '\/');
    const texts = getMessageText({
        interactiveResponseMessage: { nativeFlowResponseMessage: { buttonParamsJson } },
        eventMessage: { description: 'https://events.example.org/invite' },
        richResponseMessage: { table: { cells: ['https://tables.example.com/access'] } }
    });
    assert.deepEqual(texts, []);
});

test('scans WhatsApp interactive message body links and native-flow CTA URLs', () => {
    const payload = {
        interactiveMessage: {
            body: {
                text: '👑 Owner: *The owner himself*\n📞 wa.me/2347066248340\n✈️ t.me/Lord_CeAser_Himself'
            },
            footer: { text: 'Community information' },
            nativeFlowMessage: {
                buttons: [{
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📢 View Channel',
                        url: 'https://whatsapp.com/channel/0029VbDJkwbB4hdbezuO9s2X',
                        merchant_url: 'https://whatsapp.com/channel/0029VbDJkwbB4hdbezuO9s2X'
                    })
                }]
            }
        }
    };
    const texts = getMessageText(payload);
    const combined = texts.join(' ');
    assert.ok(texts.some(text => text.includes('wa.me/2347066248340')));
    assert.ok(texts.some(text => text.includes('t.me/Lord_CeAser_Himself')));
    assert.ok(texts.some(text => text.includes('whatsapp.com/channel/0029VbDJkwbB4hdbezuO9s2X')));
    assert.ok(hasLink(combined));
    assert.ok(extractUrls(combined).some(url => url.includes('whatsapp.com/channel/0029VbDJkwbB4hdbezuO9s2X')));
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

test('only permits serialized-text scanning for plain text, poll and product message types', () => {
    for (const type of ['imageMessage', 'videoMessage', 'instantImageMessage', 'ptvMessage', 'stickerMessage']) {
        assert.equal(shouldScanSerializedText(type), false, `${type} must not scan m.text or m.body`);
    }
    for (const type of ['conversation', 'extendedTextMessage', 'pollCreationMessageV3', 'productMessage']) {
        assert.equal(shouldScanSerializedText(type), true, `${type} should remain eligible for link checks`);
    }
});

test('checks image captions only on edit events and never scans adjacent media fields', () => {
    const editedImage = {
        raw: {
            protocolMessage: {
                editedMessage: {
                    imageMessage: {
                        caption: 'Edited caption: https://chat.whatsapp.com/EditedImageInvite',
                        url: 'https://mmg.whatsapp.net/image/transport'
                    }
                }
            }
        },
        contextInfo: {
            quotedMessage: { imageMessage: { caption: 'https://quoted.example.org/not-the-edit' } }
        }
    };
    assert.deepEqual(getEditedImageCaptionText(editedImage), []);
    const editedCaptions = getEditedImageCaptionText(editedImage, true);
    assert.ok(editedCaptions.some(text => text.includes('chat.whatsapp.com/EditedImageInvite')));
    assert.ok(!editedCaptions.some(text => text.includes('mmg.whatsapp.net')));
    assert.ok(!editedCaptions.some(text => text.includes('quoted.example.org')));

    const nonImageMediaEdit = getEditedImageCaptionText({
        videoMessage: { caption: 'https://video.example.org/not-scanned' },
        stickerMessage: { caption: 'https://sticker.example.org/not-scanned' },
        productMessage: { product: { productImage: { caption: 'https://product-image.example.org/not-scanned' } } }
    }, true);
    assert.deepEqual(nonImageMediaEdit, []);
});

test('scans link text/captions in view-once messages but ignores ordinary media and quoted view-once content', () => {
    const viewOnce = {
        ephemeralMessage: {
            message: {
                viewOnceMessageV2: {
                    message: {
                        imageMessage: {
                            caption: 'Private link https://chat.whatsapp.com/ViewOnceInvite',
                            url: 'https://mmg.whatsapp.net/image/transport'
                        }
                    }
                }
            }
        }
    };
    const viewOnceText = getViewOnceText(viewOnce);
    assert.ok(viewOnceText.some(text => text.includes('chat.whatsapp.com/ViewOnceInvite')));
    assert.ok(!viewOnceText.some(text => text.includes('mmg.whatsapp.net')));
    assert.deepEqual(getViewOnceText({ imageMessage: { caption: 'https://normal.example.org/not-view-once' } }), []);
    assert.deepEqual(getViewOnceText({
        conversation: 'Reply',
        contextInfo: { quotedMessage: viewOnce }
    }), []);
    assert.deepEqual(getViewOnceText({
        viewOnceMessageV2: { message: { extendedTextMessage: { text: 'https://private.example.org/text' } } }
    }), ['https://private.example.org/text']);
});

test('ignores Baileys media payloads for images, videos, GIFs, live photos, stickers and wrapped media', () => {
    const mediaOnly = {
        imageMessage: { url: 'https://mmg.whatsapp.net/image/transport', caption: 'https://image-caption.example.org' },
        instantImageMessage: { url: 'https://mmg.whatsapp.net/instant-image/transport' },
        videoMessage: {
            url: 'https://mmg.whatsapp.net/video/transport',
            metadataUrl: 'https://mmg.whatsapp.net/video/metadata',
            dashManifestUrl: 'https://mmg.whatsapp.net/video/manifest',
            gifPlayback: true,
            motionPhotoPresentationOffsetMs: 12
        },
        ptvMessage: { url: 'https://mmg.whatsapp.net/live-photo/transport' },
        stickerMessage: { url: 'https://mmg.whatsapp.net/sticker/transport' },
        eventCoverImage: { message: { imageMessage: { url: 'https://mmg.whatsapp.net/event-cover/transport' } } },
        pollCreationOptionImageMessage: { message: { imageMessage: { url: 'https://mmg.whatsapp.net/poll-image/transport' } } }
    };
    assert.deepEqual(getMessageText(mediaOnly), []);
});

test('ignores unrelated arbitrary string metadata without a link', () => {
    assert.deepEqual(getMessageText({
        productMessage: { retailerId: 'sku12345', currencyCode: 'USD' },
        pollCreationMessage: { options: [{ optionName: 'Yes' }, { optionName: 'No' }] }
    }), []);
});
