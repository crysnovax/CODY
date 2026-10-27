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

function escapeDrawtext(value) {
    return value.replace(/([\\':])/g, '\\$1');
}

async function processDramaBoxPersonalVideo(media) {
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

    try {
        await writeFile(inputPath, media.buffer, { mode: 0o600 });
        const metadata = await probeVideo(inputPath, executable);
        const filters = await availableFilters(executable);
        const fadeStart = Math.max(0, metadata.duration);
        const outputDuration = metadata.duration + FADE_SECONDS;
        const cropWidth = Math.max(2, Math.floor(metadata.width * 0.985 / 2) * 2);
        const cropHeight = Math.max(2, Math.floor(metadata.height * 0.985 / 2) * 2);
        const pitchRate = Math.round(metadata.sampleRate * PITCH_RATIO);
        const atempo = (1 / PITCH_RATIO).toFixed(6);
        const videoFilters = [
            `crop=${cropWidth}:${cropHeight}:(iw-ow)/2:(ih-oh)/2`,
            `scale=${metadata.width}:${metadata.height}:flags=lanczos`,
            'eq=contrast=1.01:saturation=1.03:brightness=0.005'
        ];
        if (filters.has('tpad')) {
            videoFilters.push(`tpad=stop_mode=clone:stop_duration=${FADE_SECONDS}`);
            if (filters.has('fade')) videoFilters.push(`fade=t=out:st=${fadeStart.toFixed(3)}:d=${FADE_SECONDS}`);
        }
        if (filters.has('format')) videoFilters.push('format=yuv420p');

        const args = [
            '-hide_banner', '-y', '-i', inputPath
        ];
        if (filters.has('drawtext')) {
            const watermark = escapeDrawtext('@gitplog');
            videoFilters.push(`drawtext=text='${watermark}':fontcolor=white@0.42:fontsize=${Math.max(16, Math.round(metadata.height * 0.028))}:x=w-tw-${Math.max(18, Math.round(metadata.width * 0.035))}:y=h-th-${Math.max(18, Math.round(metadata.height * 0.035))}`);
            args.push('-map', '0:v:0', '-vf', videoFilters.join(','));
        } else if (filters.has('overlay')) {
            await createWatermarkPng(watermarkPath, Math.max(160, Math.round(metadata.width * 0.2)), Math.max(48, Math.round(metadata.height * 0.06)));
            args.push('-loop', '1', '-i', watermarkPath, '-filter_complex', `[0:v]${videoFilters.join(',')}[base];[1:v]format=rgba[wm];[base][wm]overlay=x=W-w-${Math.max(18, Math.round(metadata.width * 0.035))}:y=H-h-${Math.max(18, Math.round(metadata.height * 0.035))}:eof_action=repeat:shortest=1[vout]`, '-map', '[vout]');
        } else {
            throw new Error('FFMPEG_MISSING_WATERMARK_FILTER');
        }
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart');
        if (metadata.hasAudio) {
            args.push(
                '-map', '0:a:0?',
                '-af', `asetrate=${pitchRate},aresample=${metadata.sampleRate},atempo=${atempo},apad=pad_dur=${FADE_SECONDS},atrim=duration=${outputDuration.toFixed(3)},afade=t=out:st=${fadeStart.toFixed(3)}:d=${FADE_SECONDS}`,
                '-c:a', 'aac', '-b:a', '192k'
            );
        }
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
            rm(watermarkPath, { force: true }).catch(() => {})
        ]);
    }
}

module.exports = { processDramaBoxPersonalVideo };
