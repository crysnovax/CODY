'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const engine = require('../src/Plugin/ytsaveEngine.js');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-ytsave-'));
const onlyLinux = { skip: process.platform === 'win32' ? 'stub binary is a POSIX shell script' : false };

/** A stand-in for yt-dlp: honours `-o` and writes the file yt-dlp would create. */
function writeStubYtDlp() {
    const binDirectory = path.join(temporaryDirectory, 'bin');
    fs.mkdirSync(binDirectory, { recursive: true });

    const executable = path.join(binDirectory, 'yt-dlp');
    const script = [
        '#!/bin/sh',
        'out=""',
        'prev=""',
        'for a in "$@"; do',
        '  if [ "$prev" = "-o" ]; then out="$a"; fi',
        '  prev="$a"',
        'done',
        '[ -z "$out" ] && exit 3',
        'file=$(printf \'%s\' "$out" | sed \'s/%(title)s/Fake Title/g; s/%(playlist)s/Fake Playlist/g; s/%(playlist_index)s/1/g; s/%(ext)s/mp4/g\')',
        'mkdir -p "$(dirname "$file")"',
        'printf \'fake media payload\' > "$file"',
        'exit 0',
        ''
    ].join('\n');

    // createRuntimePath() only trusts files over ~100 KB, mirroring the size of
    // a real yt-dlp build, so pad the stub out past that threshold.
    fs.writeFileSync(executable, `${script}\n${'#'.repeat(120000)}\n`);
    fs.chmodSync(executable, 0o755);

    return executable;
}

async function withEnvironment(values, run) {
    const previous = {};
    for (const [key, value] of Object.entries(values)) {
        previous[key] = process.env[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }

    try {
        return await run();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

test('ytsave engine exposes the downloader surface the commands rely on', () => {
    assert.equal(typeof engine.downloadVideo, 'function');
    assert.equal(typeof engine.downloadPlaylist, 'function');
    assert.equal(typeof engine.isPlaylistUrl, 'function');
    assert.equal(typeof engine.cleanup, 'function');
    assert.equal(typeof engine.probe, 'function');
});

test('the output directory follows YTDLP_OUTPUT_DIR', async () => {
    await withEnvironment({ YTDLP_OUTPUT_DIR: temporaryDirectory }, () => {
        assert.equal(engine.defaultOutputDir(), temporaryDirectory);
    });
});

test('playlist URLs are distinguished from single-video URLs', () => {
    assert.equal(engine.isPlaylistUrl('https://www.youtube.com/watch?v=abc&list=PL123'), true);
    assert.equal(engine.isPlaylistUrl('https://www.youtube.com/playlist?list=PL123'), true);
    assert.equal(engine.isPlaylistUrl('https://youtu.be/rsF9VaubHWM'), false);
    assert.equal(engine.isPlaylistUrl(''), false);
});

test('a missing yt-dlp surfaces as an actionable error, not a spawn ENOENT', async () => {
    await withEnvironment(
        { YTDLP_SKIP_DOWNLOAD: '1', YTDLP_BINARY: path.join(temporaryDirectory, 'absent', 'yt-dlp') },
        async () => {
            await assert.rejects(
                () => engine.downloadVideo('https://youtu.be/rsF9VaubHWM'),
                /yt-dlp is unavailable/
            );
        }
    );
});

test('downloads resolve the files yt-dlp produced', onlyLinux, async () => {
    const binary = writeStubYtDlp();
    const output = path.join(temporaryDirectory, 'out');

    await withEnvironment({ YTDLP_BINARY: binary, YTDLP_OUTPUT_DIR: output }, async () => {
        // The stub is only reachable because the engine prepends its directory
        // to PATH for ytsave's spawn() call.
        const result = await engine.downloadVideo('https://youtu.be/rsF9VaubHWM', { format: 'mp4' });

        assert.equal(result.files.length, 1);
        assert.equal(result.output, output);
        assert.equal(path.basename(result.files[0]), 'Fake Title.mp4');
        assert.match(fs.readFileSync(result.files[0], 'utf8'), /fake media payload/);

        engine.cleanup(result.files);
        assert.equal(fs.existsSync(result.files[0]), false);
    });
});

test('probe reports the resolved engine paths', onlyLinux, async () => {
    const binary = writeStubYtDlp();

    await withEnvironment({ YTDLP_BINARY: binary }, async () => {
        const status = await engine.probe();
        assert.equal(status.ytDlp, true);
        assert.equal(status.ytDlpPath, binary);
        assert.equal(status.ffmpeg, true, 'ffmpeg-static should provide the merge step');
    });
});
