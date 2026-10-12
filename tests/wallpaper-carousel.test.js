'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');
const wallpaper = require('../src/Commands/Search/WP.js');

test('wallpaper search uses Wallhaven data paths as direct image URLs', async () => {
    const originalGet = axios.get;
    const requests = [];
    axios.get = async (url, options) => {
        requests.push({ url, options });
        return {
            status: 200,
            data: {
                data: [{
                    id: 'zxqkdy',
                    path: 'https://w.wallhaven.cc/full/zx/wallhaven-zxqkdy.jpg',
                    url: 'https://wallhaven.cc/w/zxqkdy'
                }]
            }
        };
    };
    try {
        const result = await wallpaper.searchWallpapers('nature');
        assert.equal(result.source, 'Wallhaven');
        assert.equal(result.results[0].proxy, 'https://w.wallhaven.cc/full/zx/wallhaven-zxqkdy.jpg');
        assert.equal(requests[0].url, 'https://wallhaven.cc/api/v1/search');
        assert.deepEqual(requests[0].options.params, {
            q: 'nature', sorting: 'relevance', order: 'desc', page: 1
        });
    } finally {
        axios.get = originalGet;
    }
});

test('wallpaper album items keep the original URL as the full-resolution asset', () => {
    const items = wallpaper.buildAlbumItems([
        { proxy: 'https://cdn.example/a.jpg', buffer: Buffer.from('image'), mimetype: 'image/jpeg' }
    ]);
    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'image');
    assert.equal(items[0].image.url, 'https://cdn.example/a.jpg');
    assert.equal(items[0].image.sourceUrl, 'https://cdn.example/a.jpg');
    assert.equal(items[0].image.imageHighResUrl, 'https://cdn.example/a.jpg');
});

test('wallpaper sends all resolved images as one Baileys album', async () => {
    const calls = [];
    const images = Array.from({ length: 10 }, (_, index) => ({
        proxy: `https://cdn.example/${index}.jpg`,
        buffer: Buffer.from(`image-${index}`),
        mimetype: 'image/jpeg'
    }));
    const sent = await wallpaper.sendWallpaperAlbum({
        sendAlbumMessage: async (...args) => {
            calls.push(args);
            return { key: { id: 'album-1' } };
        }
    }, 'chat@s.whatsapp.net', images, 'nature', 'Test provider', { key: { id: 'quoted' } });
    assert.equal(sent.key.id, 'album-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1].length, 10);
    assert.equal(calls[0][1][9].image.imageHighResUrl, 'https://cdn.example/9.jpg');
    assert.equal(calls[0][2].quoted.key.id, 'quoted');
});
