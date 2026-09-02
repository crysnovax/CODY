'use strict';

const os = require('node:os');

function health() {
    return {
        status: 'ok',
        service: 'cody-api',
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: os.platform()
    };
}

module.exports = (req, res) => {
    const method = req.method || 'GET';
    const pathname = String(req.url || '/').split('?')[0];

    if (method !== 'GET' && method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET, HEAD');
        return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    if (pathname === '/' || pathname === '/health' || pathname === '/api/health') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(health()));
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Not found' }));
};

module.exports.health = health;
