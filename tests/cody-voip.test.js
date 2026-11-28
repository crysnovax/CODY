const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const voip = require('../library/voip/cody-voip');

test('CODY VOIP is disabled by default', () => {
    const previous = process.env.CODY_VOIP_ENABLED;
    delete process.env.CODY_VOIP_ENABLED;
    const events = new EventEmitter();
    const cleanup = voip.installCodyVoipLifecycle({ ev: events });
    assert.equal(typeof cleanup, 'function');
    assert.equal(voip.enabled(), false);
    cleanup();
    if (previous === undefined) delete process.env.CODY_VOIP_ENABLED;
    else process.env.CODY_VOIP_ENABLED = previous;
});

test('CODY VOIP refuses to start when runtime assets are missing', async () => {
    const previousEnabled = process.env.CODY_VOIP_ENABLED;
    const previousResources = process.env.PLOGME_VOIP_RESOURCES;
    process.env.CODY_VOIP_ENABLED = 'true';
    process.env.PLOGME_VOIP_RESOURCES = '/tmp/cody-voip-test-assets-does-not-exist';
    const result = await voip.startForSocket({});
    assert.equal(result, null);
    if (previousEnabled === undefined) delete process.env.CODY_VOIP_ENABLED;
    else process.env.CODY_VOIP_ENABLED = previousEnabled;
    if (previousResources === undefined) delete process.env.PLOGME_VOIP_RESOURCES;
    else process.env.PLOGME_VOIP_RESOURCES = previousResources;
});
