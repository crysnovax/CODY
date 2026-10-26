'use strict';

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { mkdir, rm, stat } = require('node:fs/promises');
const { createReadStream } = require('node:fs');

const PORT = Number(process.env.DRAMABOX_WORKER_PORT || process.env.PORT || 8787);
const HOST = process.env.DRAMABOX_WORKER_HOST || '127.0.0.1';
const TOKEN = String(process.env.DRAMABOX_WORKER_TOKEN || '').trim();
const MAX_BODY_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 120 * 1024 * 1024;
const QUALITY = new Set(['best', '720p', '480p']);

function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
    res.end(payload);
}

function authorized(req) {
    if (!TOKEN) return false;
    return req.headers.authorization === `Bearer ${TOKEN}`;
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('REQUEST_TOO_LARGE'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch { reject(new Error('INVALID_JSON')); }
        });
        req.on('error', reject);
    });
}

function validShareUrl(value) {
    try {
        const parsed = new URL(String(value));
        return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === 'sharet.dramabox.com' && parsed.pathname === '/play';
    } catch {
        return false;
    }
}

async function download(body, res) {
    if (!validShareUrl(body.url)) return sendJson(res, 400, { error: 'Only https://sharet.dramabox.com/play links are accepted.' });
    const quality = QUALITY.has(body.quality) ? body.quality : 'best';
    const lan = typeof body.lan === 'string' && /^[A-Za-z-]{2,12}$/.test(body.lan) ? body.lan : 'en';
    const socialDl = await import('social-dl');
    if (typeof socialDl.dramafrenSave !== 'function') throw new Error('Installed social-dl lacks DramaBox share-link support.');

    const tempDir = path.join(os.tmpdir(), 'cody-dramabox-worker');
    const output = path.join(tempDir, `${randomUUID()}.mp4`);
    await mkdir(tempDir, { recursive: true });
    try {
        await socialDl.dramafrenSave(body.url, output, quality, { lan });
        const info = await stat(output);
        if (!info.isFile() || info.size === 0 || info.size > MAX_OUTPUT_BYTES) throw new Error('Worker output is empty or too large.');
        const title = String(body.title || 'DramaBox video').replace(/[\r\n]+/g, ' ').slice(0, 180);
        res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Content-Length': info.size,
            'Content-Disposition': 'inline; filename="dramabox.mp4"',
            'X-DramaBox-Title': title,
            'Cache-Control': 'no-store'
        });
        await new Promise((resolve, reject) => {
            const stream = createReadStream(output);
            stream.on('error', reject);
            stream.on('end', resolve);
            stream.pipe(res);
        });
    } finally {
        await rm(output, { force: true }).catch(() => {});
    }
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return sendJson(res, 200, { ok: true, service: 'dramabox-worker' });
    if (req.method !== 'POST' || req.url !== '/v1/dramabox') return sendJson(res, 404, { error: 'Not found' });
    if (!authorized(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    try {
        await download(await readJson(req), res);
    } catch (error) {
        if (!res.headersSent) sendJson(res, 502, { error: error.message || 'DramaBox worker failed' });
        else res.destroy(error);
    }
});

if (!TOKEN) {
    console.error('DRAMABOX_WORKER_TOKEN is required; refusing to start without authentication.');
    process.exit(1);
}

server.listen(PORT, HOST, () => console.log(`DramaBox worker listening on http://${HOST}:${PORT}`));
