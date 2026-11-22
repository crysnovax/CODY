const fs = require('node:fs');
const path = require('node:path');

const getPaths = () => {
    const resourcesPath = path.resolve(process.env.PLOGME_VOIP_RESOURCES || 'call-resources');
    const wasmPath = path.join(resourcesPath, 'assets', 'wasm', 'whatsapp.wasm');
    const workerPath = path.join(resourcesPath, 'assets', 'wasm', 'worker-modules.js');
    return { resourcesPath, wasmPath, workerPath };
};
const moduleIsInstalled = (name) => {
    try { require.resolve(name); return true; }
    catch { return false; }
};

const buildSetupEval = (resourcesPath) => `if (!globalThis.__codyVoipClient) {
  if (typeof sock === 'undefined' || !sock?.authState?.creds?.me || !sock?.ws) {
    throw new Error('CODY eval did not expose its connected Baileys socket as sock.');
  }
  const fs = await import('node:fs');
  const path = await import('node:path');
  const resourcesPath = ${JSON.stringify(resourcesPath)};
  for (const file of ['assets/wasm/whatsapp.wasm', 'assets/wasm/worker-modules.js']) {
    if (!fs.existsSync(path.join(resourcesPath, file))) {
      throw new Error('Missing VoIP runtime file: ' + path.join(resourcesPath, file));
    }
  }
  try {
    await import('@roamhq/wrtc');
  } catch (error) {
    throw new Error('VoIP native WebRTC dependency is missing. Install it in CODY with npm install @roamhq/wrtc@^0.10.0, then restart CODY. ' + error.message);
  }
  const plogme = await import('plogme');
  const callApiProbe = typeof plogme.ActiveCall === 'function' ? new plogme.ActiveCall('__cody_api_check__', {}, 0) : null;
  if (typeof plogme.VoipClient !== 'function' || typeof callApiProbe?.requestVideoUpgrade !== 'function') {
    throw new Error('Installed plogme does not expose ActiveCall.requestVideoUpgrade(). Install the feature build with npm install github:crysnovax/baileys#b535e24, then restart CODY before using this command.');
  }
  const voice = new plogme.VoipClient({ sock, resourcesPath });
  voice.on('incomingCall', info => {
    globalThis.__codyPendingVoipCall = info;
    console.log('[CODY VoIP] Incoming call captured:', info.callId, info.peerJid, 'video=' + info.isVideo);
  });
  voice.on('videoError', details => console.error('[CODY VoIP] Video error:', details.error?.message || details));
  globalThis.__codyVoipClient = voice;
  await voice.connect();
  console.log('CODY VoIP listener attached. It will not answer calls automatically.');
} else {
  console.log('CODY VoIP listener is already attached.');
}

// Generates a test pattern, not a camera capture. The generator is stopped when
// the video feeder is stopped, including when the call ends.
globalThis.__codyNv12TestPattern ??= async function* () {
  const { spawn } = await import('node:child_process');
  const ffmpegModule = await import('ffmpeg-static').catch(() => null);
  const ffmpegPath = process.env.PLOGME_FFMPEG_PATH || ffmpegModule?.default || 'ffmpeg';
  const width = 640;
  const height = 480;
  const fps = 12;
  const frameBytes = width * height * 3 / 2;
  const child = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-re',
    '-f', 'lavfi', '-i', 'testsrc2=size=640x480:rate=12',
    '-vf', 'format=nv12', '-pix_fmt', 'nv12', '-f', 'rawvideo', 'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'inherit'] });
  let pending = Buffer.alloc(0);
  try {
    for await (const chunk of child.stdout) {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      while (pending.length >= frameBytes) {
        const data = pending.subarray(0, frameBytes);
        pending = pending.subarray(frameBytes);
        yield { data, width, height, fps };
      }
    }
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
};

console.log('Ready. Wait for an incoming audio call, then paste the answer snippet.');`;

const ANSWER_EVAL = `const voice = globalThis.__codyVoipClient;
const incoming = globalThis.__codyPendingVoipCall;
if (!voice) throw new Error('Run the setup snippet first.');
if (!incoming) throw new Error('No incoming call is pending. Run .voipready again after a call arrives.');
if (incoming.isVideo) throw new Error('This snippet is for an incoming audio call.');
const call = await voice.answerIncomingCall(incoming.callId);
globalThis.__codyActiveVoipCall = call;
globalThis.__codyPendingVoipCall = null;
call.on('ended', reason => {
  if (globalThis.__codyActiveVoipCall === call) globalThis.__codyActiveVoipCall = null;
  console.log('[CODY VoIP] Call ended:', reason);
});
console.log('Answered incoming audio call:', { callId: call.callId, state: call.state });`;

const UPGRADE_EVAL = `const call = globalThis.__codyActiveVoipCall;
if (!call) throw new Error('No call was answered by the CODY VoIP listener.');
if (call.state !== 6) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Timed out waiting for the call to connect.')), 60000);
    const onConnected = () => finish();
    const onEnded = reason => finish(new Error('Call ended before connecting: ' + reason));
    function finish(error) {
      clearTimeout(timer);
      call.off('connected', onConnected);
      call.off('ended', onEnded);
      error ? reject(error) : resolve();
    }
    call.once('connected', onConnected);
    call.once('ended', onEnded);
  });
}
const result = await call.requestVideoUpgrade(globalThis.__codyNv12TestPattern());
console.log('Mid-call video upgrade result:', result);`;

const CLEANUP_EVAL = `const voice = globalThis.__codyVoipClient;
if (voice) await voice.disconnect();
globalThis.__codyVoipClient = null;
globalThis.__codyPendingVoipCall = null;
globalThis.__codyActiveVoipCall = null;
globalThis.__codyNv12TestPattern = null;
console.log('CODY VoIP helper disconnected; the existing CODY socket remains connected.');`;

module.exports = {
    name: 'voipready',
    alias: ['voipupgradeeval'],
    desc: 'Show VoIP readiness and print owner-only paste-ready eval snippets',
    category: 'Tools',
    ownerOnly: true,
    usage: `${global.prefix || '.'}voipready`,
    execute: async (sock, m, { reply }) => {
        const { resourcesPath, wasmPath, workerPath } = getPaths();
        const incoming = globalThis.__codyPendingVoipCall;
        const activeCall = globalThis.__codyActiveVoipCall;
        const packageJsonPath = path.resolve(__dirname, '../../../package.json');
        let plogmeRange = 'not declared';
        try {
            plogmeRange = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).dependencies?.plogme || plogmeRange;
        } catch { }
        const status = [
            '*CODY VoIP eval readiness*',
            `plogme dependency: ${plogmeRange}`,
            `resourcesPath: ${resourcesPath}`,
            `whatsapp.wasm: ${fs.existsSync(wasmPath) ? 'found' : 'MISSING'}`,
            `worker-modules.js: ${fs.existsSync(workerPath) ? 'found' : 'MISSING'}`,
            `@roamhq/wrtc: ${moduleIsInstalled('@roamhq/wrtc') ? 'found' : 'MISSING'}`,
            `FFmpeg source: ffmpeg-static with PATH fallback`,
            `VoIP listener: ${globalThis.__codyVoipClient ? 'attached' : 'not attached'}`,
            `pending incoming call: ${incoming ? `${incoming.callId} (${incoming.isVideo ? 'video' : 'audio'})` : 'none'}`,
            `active VoIP call: ${activeCall ? `${activeCall.callId} (state ${activeCall.state})` : 'none'}`,
        ];
        if (!fs.existsSync(wasmPath) || !fs.existsSync(workerPath)) {
            status.push('', '*Runtime files are required:* obtain the WhatsApp Web VoIP files using the repository `fetch-wasm-resources.mjs` script from a machine with WhatsApp Web open in Chrome, then place them under the `resourcesPath` above. Keep them private and do not expose Chrome remote debugging beyond localhost.');
        }
        if (!moduleIsInstalled('@roamhq/wrtc')) {
            status.push('', '*Native WebRTC dependency is missing:* install dependencies from the updated CODY `package.json` with `npm install`, then restart CODY.');
        }
        status.push(
            '', '*1. Setup once — paste into eval:*', '```js', buildSetupEval(resourcesPath), '```',
            '', '*2. After an incoming audio call appears — paste into eval to answer it:*', '```js', ANSWER_EVAL, '```',
            '', '*3. Once connected — paste into eval to request video using an FFmpeg test pattern:*', '```js', UPGRADE_EVAL, '```',
            '', '*4. Cleanup — paste into eval when finished:*', '```js', CLEANUP_EVAL, '```',
            '', '_The video source above is a generated color test pattern, not your camera. Setup only listens; it does not answer calls automatically._'
        );
        return reply(status.join('\n'));
    }
};
