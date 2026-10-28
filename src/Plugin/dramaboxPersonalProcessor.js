'use strict';

const path = require('node:path');
const { existsSync } = require('node:fs');
const { mkdir, readFile, rm, stat, writeFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

const TEMP_DIR = path.join(process.cwd(), 'cache', 'temp', 'dramabox-personal');
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const PROCESS_TIMEOUT_MS = 180_000;
const FADE_SECONDS = 0.2;
const PITCH_RATIO = 1.007;
const ENDING_SECONDS = 3.5;
const FLOWER_SECONDS = 2;
const DURATION_RATIO = 1.01;

function getFfmpegPath() {
    return ffmpegPath && existsSync(ffmpegPath) ? ffmpegPath : 'ffmpeg';
}

function runProcess(command, args, { timeout = PROCESS_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error('VIDEO_PROCESSING_TIMEOUT'));
        }, timeout);

        child.stdout.on('data', chunk => { stdout += chunk.toString(); });
        child.stderr.on('data', chunk => { stderr += chunk.toString(); });
        child.once('error', error => {
            clearTimeout(timer);
            reject(error);
        });
        child.once('close', code => {
            clearTimeout(timer);
            if (code === 0) return resolve({ stdout, stderr });
            const detail = stderr.split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 500);
            const error = new Error(`VIDEO_PROCESSING_FAILED${detail ? `: ${detail}` : ''}`);
            error.stderr = stderr;
            reject(error);
        });
    });
}

async function probeVideo(inputPath, executable) {
    let result;
    try {
        result = await runProcess(executable, ['-hide_banner', '-i', inputPath]);
    } catch (error) {
        // ffmpeg exits non-zero when used only for probing, but still prints metadata.
        if (!error.message.startsWith('VIDEO_PROCESSING_FAILED')) throw error;
        result = { stderr: error.stderr || '' };
    }

    const metadata = result.stderr || '';
    const durationMatch = metadata.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
    const videoLine = metadata.split(/\r?\n/).find(line => /\bVideo:\s*/i.test(line)) || '';
    const videoMatch = videoLine.match(/\b(\d{2,5})x(\d{2,5})(?=\s|,|\[|$)/)
        || metadata.match(/\bVideo:[\s\S]{0,300}?\b(\d{2,5})x(\d{2,5})(?=\s|,|\[|$)/i);
    const audioLine = metadata.split(/\r?\n/).find(line => /\bAudio:\s*/i.test(line)) || '';
    const audioMatch = audioLine.match(/\b(\d{4,6})\s*Hz\b/i)
        || metadata.match(/\bAudio:[\s\S]{0,200}?\b(\d{4,6})\s*Hz\b/i);
    if (!durationMatch || !videoMatch) {
        throw new Error('INVALID_VIDEO_METADATA: FFmpeg could not read duration or video dimensions');
    }

    const duration = Number(durationMatch[1]) * 3600
        + Number(durationMatch[2]) * 60
        + Number(durationMatch[3]);
    const width = Number(videoMatch[1]);
    const height = Number(videoMatch[2]);
    const sampleRate = Number(audioMatch?.[1] || 44100);
    if (!duration || !width || !height) throw new Error('INVALID_VIDEO_METADATA: invalid duration or video dimensions');
    return { duration, width, height, sampleRate, hasAudio: Boolean(audioMatch) };
}

async function availableFilters(executable) {
    const result = await runProcess(executable, ['-hide_banner', '-filters']);
    const filters = new Set();
    for (const line of `${result.stdout}\n${result.stderr}`.split(/\r?\n/)) {
        const match = line.trim().match(/^[A-Z.]{3,4}\s+([a-z0-9_]+)/i);
        if (match) filters.add(match[1].toLowerCase());
    }
    return filters;
}

async function createWatermarkPng(file, width, height) {
    let createCanvas;
    try {
        ({ createCanvas } = require('canvas'));
    } catch {
        throw new Error('WATERMARK_RENDERER_UNAVAILABLE');
    }
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    const fontSize = Math.max(16, Math.round(height * 0.45));
    context.font = `600 ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = 'rgba(0, 0, 0, 0.35)';
    context.shadowBlur = Math.max(2, Math.round(fontSize * 0.12));
    context.fillStyle = 'rgba(255, 255, 255, 0.42)';
    context.fillText('@gitplog', width / 2, height / 2);
    await writeFile(file, canvas.toBuffer('image/png'), { mode: 0o600 });
}

async function createFloralLightPng(file, width, height) {
    let createCanvas;
    try {
        ({ createCanvas } = require('canvas'));
    } catch {
        throw new Error('FLOWER_OVERLAY_RENDERER_UNAVAILABLE');
    }
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    const flowers = [
        [width * 0.16, height * 0.2, Math.max(18, width * 0.055)],
        [width * 0.84, height * 0.24, Math.max(20, width * 0.065)],
        [width * 0.22, height * 0.78, Math.max(16, width * 0.045)],
        [width * 0.78, height * 0.76, Math.max(18, width * 0.05)]
    ];
    for (const [cx, cy, radius] of flowers) {
        const glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 4);
        glow.addColorStop(0, 'rgba(255, 238, 174, 0.34)');
        glow.addColorStop(0.35, 'rgba(255, 205, 105, 0.16)');
        glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(cx, cy, radius * 4, 0, Math.PI * 2);
        context.fill();
        for (let petal = 0; petal < 6; petal += 1) {
            const angle = petal * Math.PI / 3;
            context.save();
            context.translate(cx + Math.cos(angle) * radius * 0.72, cy + Math.sin(angle) * radius * 0.72);
            context.rotate(angle);
            context.fillStyle = 'rgba(255, 225, 145, 0.24)';
            context.beginPath();
            context.ellipse(0, 0, radius * 0.42, radius * 0.9, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
        context.fillStyle = 'rgba(255, 248, 207, 0.5)';
        context.beginPath();
        context.arc(cx, cy, radius * 0.28, 0, Math.PI * 2);
        context.fill();
    }
    await writeFile(file, canvas.toBuffer('image/png'), { mode: 0o600 });
}

async function createClimaxWav(file, seconds = ENDING_SECONDS, sampleRate = 44100) {
    const sampleCount = Math.ceil(seconds * sampleRate);
    const data = Buffer.alloc(sampleCount * 2);
    for (let index = 0; index < sampleCount; index += 1) {
        const time = index / sampleRate;
        const progress = time / seconds;
        const envelope = Math.min(1, time * 5) * Math.min(1, (seconds - time) * 5);
        const sweep = Math.sin(2 * Math.PI * (210 * time + 150 * time * time));
        const chimeA = Math.sin(2 * Math.PI * 523.25 * time) * Math.exp(-Math.max(0, time - 1.5) * 2.2);
        const chimeB = Math.sin(2 * Math.PI * 783.99 * time) * Math.exp(-Math.max(0, time - 2.35) * 2.8);
        const shimmer = Math.sin(2 * Math.PI * (1046.5 + 70 * progress) * time) * 0.18;
        const sample = Math.max(-1, Math.min(1, (sweep * 0.16 + chimeA * 0.12 + chimeB * 0.1 + shimmer) * envelope));
        data.writeInt16LE(Math.round(sample * 32767), index * 2);
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
    header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(data.length, 40);
    await writeFile(file, Buffer.concat([header, data]), { mode: 0o600 });
}

function escapeDrawtext(value) {
    return value.replace(/([\\':])/g, '\\$1');
}

async function processDramaBoxPersonalVideo(media, { watermark = true } = {}) {
    if (!media?.buffer || !Buffer.isBuffer(media.buffer)) throw new Error('VIDEO_BUFFER_REQUIRED');
    if (media.mediaType === 'audio' || !/^video\//i.test(media.mimetype || 'video/mp4')) {
        throw new Error('VIDEO_REQUIRED');
    }
    if (media.buffer.length > MAX_INPUT_BYTES) throw new Error('VIDEO_TOO_LARGE_TO_PROCESS');
    const executable = getFfmpegPath();

    await mkdir(TEMP_DIR, { recursive: true });
    const base = `dramabox-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const inputPath = path.join(TEMP_DIR, `${base}-input.mp4`);
    const outputPath = path.join(TEMP_DIR, `${base}-output.mp4`);
    const watermarkPath = path.join(TEMP_DIR, `${base}-watermark.png`);
    const floralPath = path.join(TEMP_DIR, `${base}-floral.png`);
    const climaxPath = path.join(TEMP_DIR, `${base}-climax.wav`);

    try {
        await writeFile(inputPath, media.buffer, { mode: 0o600 });
        const metadata = await probeVideo(inputPath, executable);
        const filters = await availableFilters(executable);
        if (!filters.has('tpad')) throw new Error('FFMPEG_MISSING_TPAD_FILTER');
        if (!filters.has('overlay') || !filters.has('format')) throw new Error('FFMPEG_MISSING_OVERLAY_FILTER');
        const contentDuration = metadata.duration * DURATION_RATIO;
        const outputDuration = contentDuration + ENDING_SECONDS;
        const flowerStart = contentDuration + ENDING_SECONDS - FLOWER_SECONDS;
        const cropWidth = Math.max(2, Math.floor(metadata.width * 0.985 / 2) * 2);
        const cropHeight = Math.max(2, Math.floor(metadata.height * 0.985 / 2) * 2);
        const pitchRate = Math.round(metadata.sampleRate * PITCH_RATIO);
        const atempo = (1 / (PITCH_RATIO * DURATION_RATIO)).toFixed(6);
        await createFloralLightPng(floralPath, metadata.width, metadata.height);
        await createClimaxWav(climaxPath, ENDING_SECONDS, metadata.sampleRate);
        const videoFilters = [
            `crop=${cropWidth}:${cropHeight}:(iw-ow)/2:(ih-oh)/2`,
            `scale=${metadata.width}:${metadata.height}:flags=lanczos`,
            'eq=contrast=1.01:saturation=1.03:brightness=0.005',
            `setpts=${DURATION_RATIO}*PTS`,
            `tpad=stop_mode=clone:stop_duration=${ENDING_SECONDS}`
        ];
        videoFilters.push('format=yuv420p');

        const args = [
            '-hide_banner', '-y', '-i', inputPath
        ];
        let nextInput = 1;
        let watermarkInput;
        if (watermark && filters.has('drawtext')) {
            const watermark = escapeDrawtext('@gitplog');
            videoFilters.push(`drawtext=text='${watermark}':fontcolor=white@0.42:fontsize=${Math.max(16, Math.round(metadata.height * 0.028))}:x=w-tw-${Math.max(18, Math.round(metadata.width * 0.035))}:y=h-th-${Math.max(18, Math.round(metadata.height * 0.035))}`);
        } else if (watermark && filters.has('overlay')) {
            await createWatermarkPng(watermarkPath, Math.max(160, Math.round(metadata.width * 0.2)), Math.max(48, Math.round(metadata.height * 0.06)));
            watermarkInput = nextInput;
            nextInput += 1;
            args.push('-loop', '1', '-i', watermarkPath);
        }
        const floralInput = nextInput;
        nextInput += 1;
        const climaxInput = nextInput;
        args.push('-loop', '1', '-i', floralPath, '-i', climaxPath);
        const graph = [`[0:v]${videoFilters.join(',')}[base]`];
        let markedVideo = 'base';
        if (watermarkInput !== undefined) {
            graph.push(`[${watermarkInput}:v]format=rgba[wm]`);
            graph.push(`[base][wm]overlay=x=W-w-${Math.max(18, Math.round(metadata.width * 0.035))}:y=H-h-${Math.max(18, Math.round(metadata.height * 0.035))}:eof_action=repeat:shortest=1[marked]`);
            markedVideo = 'marked';
        }
        graph.push(`[${floralInput}:v]format=rgba[floral]`);
        graph.push(`[${markedVideo}][floral]overlay=x=0:y=0:enable=gte(t\\,${flowerStart.toFixed(3)}):eof_action=repeat:shortest=1[vout]`);
        if (metadata.hasAudio) {
            const delay = Math.round(contentDuration * 1000);
            graph.push(`[0:a]asetrate=${pitchRate},aresample=${metadata.sampleRate},atempo=${atempo},apad=pad_dur=${ENDING_SECONDS},atrim=duration=${outputDuration.toFixed(3)}[originalAudio]`);
            graph.push(`[${climaxInput}:a]adelay=${delay}|${delay},volume=0.65[climaxAudio]`);
            graph.push(`[originalAudio][climaxAudio]amix=inputs=2:duration=longest:dropout_transition=0,atrim=duration=${outputDuration.toFixed(3)}[aout]`);
        } else {
            const delay = Math.round(contentDuration * 1000);
            graph.push(`[${climaxInput}:a]adelay=${delay}|${delay},atrim=duration=${outputDuration.toFixed(3)}[aout]`);
        }
        args.push('-filter_complex', graph.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart');
        args.push('-t', outputDuration.toFixed(3), '-metadata', 'comment=Processed for personal use', outputPath);

        await runProcess(executable, args);
        const outputInfo = await stat(outputPath);
        if (!outputInfo.isFile() || outputInfo.size === 0) throw new Error('EMPTY_PROCESSED_VIDEO');
        const buffer = await readFile(outputPath);
        return {
            ...media,
            buffer,
            mimetype: 'video/mp4',
            extension: 'mp4',
            mediaType: 'video'
        };
    } finally {
        await Promise.all([
            rm(inputPath, { force: true }).catch(() => {}),
            rm(outputPath, { force: true }).catch(() => {}),
            rm(watermarkPath, { force: true }).catch(() => {}),
            rm(floralPath, { force: true }).catch(() => {}),
            rm(climaxPath, { force: true }).catch(() => {})
        ]);
    }
}

module.exports = { processDramaBoxPersonalVideo };
