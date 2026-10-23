'use strict';

const http = require('node:http');
const { MultiSessionManager } = require('./manager');

const port = Number(process.env.CODYMINI_PORT || process.env.PORT || 8787);
const token = process.env.CODYMINI_CONTROL_TOKEN || '';
const manager = new MultiSessionManager();

function authorized(req) {
  if (!token) return false;
  return req.headers.authorization === `Bearer ${token}`;
}
function json(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
function route(pathname) {
  const match = pathname.match(/^\/v1\/accounts\/([^/]+)(?:\/(pair|status|stop|restart|unlink))?$/);
  return match ? { id: decodeURIComponent(match[1]), action: match[2] || 'status' } : null;
}

(async () => {
  await manager.init();
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = String(req.url || '/').split('?')[0];
      if (req.method === 'GET' && pathname === '/health') return json(res, 200, { status: 'ok', service: 'codymini', accounts: manager.statuses().length });
      if (!authorized(req)) return json(res, 401, { error: 'Unauthorized' });
      if (req.method === 'GET' && pathname === '/v1/accounts') return json(res, 200, { accounts: manager.statuses() });
      const match = route(pathname);
      if (!match) return json(res, 404, { error: 'Not found' });
      let result;
      if (match.action === 'pair' && req.method === 'POST') result = await manager.pair(match.id, (await body(req)).phone);
      else if (match.action === 'status' && req.method === 'GET') result = manager.status(match.id);
      else if (match.action === 'stop' && req.method === 'POST') result = await manager.stop(match.id);
      else if (match.action === 'restart' && req.method === 'POST') { await manager.stop(match.id); result = await manager.start(match.id); }
      else if (match.action === 'unlink' && req.method === 'POST') result = await manager.unlink(match.id);
      else return json(res, 405, { error: 'Method not allowed' });
      return json(res, 200, result);
    } catch (error) {
      return json(res, 400, { error: error?.message || String(error) });
    }
  });
  server.listen(port, () => console.log(JSON.stringify({ service: 'codymini', port })));
})();
