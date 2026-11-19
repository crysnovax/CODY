'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');
const path = require('node:path');

const commandPath = path.resolve(__dirname, '../src/Commands/Downloader/Video.js');
const originalLoad = Module._load;
const calls = { searches: [], downloads: [] };

Module._load = function (request, parent, isMain) {
    if (request === 'yt-search' && parent?.filename === commandPath) {
        return async query => {
            calls.searches.push(query);
            return { videos: [{
                url: 'https://www.youtube.com/watch?v=deploy-cody',
                title: 'How to deploy Cody AI',
                timestamp: '4:20',
                author: { name: 'CODY', url: 'https://youtube.com/@cody' }
            }] };
        };
    }
    if (request === '../../Plugin/socialDl' && parent?.filename === commandPath) {
        return {
            downloadYouTube: async url => {
                calls.downloads.push(url);
                return { buffer: Buffer.from('video-bytes'), mimetype: 'video/mp4' };
            }
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};

let videoCommand;
try {
    delete require.cache[commandPath];
    videoCommand = require(commandPath);
} finally {
    Module._load = originalLoad;
}

test('.video searches a plain-text query and sends the social-dl video buffer', async () => {
    calls.searches.length = 0;
    calls.downloads.length = 0;
    const sent = [];
    const replies = [];
    const message = { chat: 'chat@s.whatsapp.net', key: { id: 'command' } };
    const sock = {
        sendMessage: async (chat, payload, options) => {
            if (payload.react) throw new Error('reaction unavailable');
            sent.push({ chat, payload, options });
        }
    };

    await videoCommand.execute(sock, message, {
        text: 'How to deploy Cody AI',
        args: ['How', 'to', 'deploy', 'Cody', 'AI'],
        reply: async text => replies.push(text)
    });

    assert.deepEqual(calls.searches, ['How to deploy Cody AI']);
    assert.deepEqual(calls.downloads, ['https://www.youtube.com/watch?v=deploy-cody']);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].chat, message.chat);
    assert.deepEqual(sent[0].payload.video, Buffer.from('video-bytes'));
    assert.equal(sent[0].payload.mimetype, 'video/mp4');
    assert.match(sent[0].payload.caption, /@cody/);
    assert.deepEqual(sent[0].options, { quoted: message });
    assert.deepEqual(replies, []);
});
