const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const command = require('../src/Commands/Tools/voipready');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const runCommand = async () => {
    const replies = [];
    await command.execute({}, { chat: 'owner@s.whatsapp.net' }, {
        reply: async text => replies.push(String(text))
    });
    return replies[0];
};

test('voipready is owner-only and reports the runtime files CODY needs', async () => {
    assert.equal(command.name, 'voipready');
    assert.deepEqual(command.alias, ['voipupgradeeval']);
    assert.equal(command.ownerOnly, true);

    const previous = process.env.PLOGME_VOIP_RESOURCES;
    const resourcesPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-voip-resources-'));
    process.env.PLOGME_VOIP_RESOURCES = resourcesPath;
    try {
        const output = await runCommand();
        assert.match(output, new RegExp(resourcesPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(output, /whatsapp\.wasm: MISSING/);
        assert.match(output, /worker-modules\.js: MISSING/);
        assert.match(output, /Runtime files are required/);
        assert.match(output, /pending incoming call: none/);
    } finally {
        if (previous === undefined) delete process.env.PLOGME_VOIP_RESOURCES;
        else process.env.PLOGME_VOIP_RESOURCES = previous;
        fs.rmSync(resourcesPath, { recursive: true, force: true });
    }
});

test('voipready returns four syntactically valid eval snippets without auto-answering', async () => {
    const output = await runCommand();
    const snippets = [...output.matchAll(/```js\n([\s\S]*?)\n```/g)].map(match => match[1]);

    assert.equal(snippets.length, 4);
    for (const snippet of snippets) {
        assert.doesNotThrow(() => new AsyncFunction('sock', snippet));
    }

    assert.match(snippets[0], /new plogme\.VoipClient\(\{ sock, resourcesPath \}\)/);
    assert.match(snippets[0], /new plogme\.ActiveCall\('__cody_api_check__', \{\}, 0\)/);
    assert.match(snippets[0], /await import\('@roamhq\/wrtc'\)/);
    assert.match(snippets[0], /__codyPendingVoipCall/);
    assert.match(snippets[0], /testsrc2=size=640x480:rate=12/);
    assert.doesNotMatch(snippets[0], /answerIncomingCall/);
    assert.match(snippets[1], /answerIncomingCall\(incoming\.callId\)/);
    assert.match(snippets[2], /requestVideoUpgrade\(globalThis\.__codyNv12TestPattern\(\)\)/);
    assert.match(snippets[3], /disconnect\(\)/);
    assert.match(output, /does not answer calls automatically/);
    assert.match(output, /not your camera/);
});
