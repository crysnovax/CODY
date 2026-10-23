'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

class MultiSessionManager {
  constructor({ root = process.env.CODYMINI_ACCOUNTS_ROOT || path.join(process.cwd(), 'multi-session', 'accounts'), source = process.cwd() } = {}) {
    this.root = path.resolve(root);
    this.source = path.resolve(source);
    this.sessions = new Map();
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) await this.#load(entry.name);
    }
  }

  accountPath(id) { return path.join(this.root, this.safeId(id)); }
  safeId(id) {
    const value = String(id || '');
    if (!/^[a-zA-Z0-9:_-]{2,160}$/.test(value)) throw new Error('Invalid account id');
    return value;
  }
  appPath(id) { return path.join(this.accountPath(id), 'app'); }
  metaPath(id) { return path.join(this.accountPath(id), 'account.json'); }

  async #load(id) {
    try {
      const raw = await fs.readFile(this.metaPath(id), 'utf8');
      const meta = JSON.parse(raw);
      if (meta.status === 'unlinked') return;
      this.sessions.set(id, { id, phone: meta.phone || null, status: 'stopped', process: null, code: null, meta });
      if (meta.registered) await this.start(id);
    } catch (error) {
      console.error(`[CODYMINI] Could not load account ${id}:`, error.message);
    }
  }

  async #writeMeta(id, patch) {
    const account = this.sessions.get(id);
    account.meta = { ...(account.meta || {}), ...patch, updatedAt: Date.now() };
    await fs.mkdir(this.accountPath(id), { recursive: true, mode: 0o700 });
    const temp = `${this.metaPath(id)}.tmp-${process.pid}`;
    await fs.writeFile(temp, `${JSON.stringify(account.meta, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, this.metaPath(id));
  }

  async #copySource(id) {
    const destination = this.appPath(id);
    let exists = true;
    try { await fs.access(path.join(destination, 'package.json')); } catch { exists = false; }
    await fs.cp(this.source, destination, {
      recursive: true,
      filter: source => {
        const relative = path.relative(this.source, source);
        if (!relative) return true;
        const excluded = ['.git', 'node_modules', 'sessions', 'profile', 'multi-session', 'runtime-accounts', '.env'];
        if (exists) excluded.push('database');
        return !relative.split(path.sep).some(part => excluded.includes(part));
      },
    });
    await fs.mkdir(path.join(destination, 'sessions'), { recursive: true, mode: 0o700 });
    await fs.mkdir(path.join(destination, 'multi-session'), { recursive: true, mode: 0o700 });
    await fs.copyFile(path.join(this.source, 'multi-session', 'pair-runner.js'), path.join(destination, 'multi-session', 'pair-runner.js'));
    await fs.mkdir(path.join(destination, 'database'), { recursive: true, mode: 0o700 });
    if (!exists) await fs.writeFile(path.join(destination, 'database', 'runtime-config.json'), '{}\n', { flag: 'a' });
    return destination;
  }

  #panelPort(id) {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return String(12000 + (hash % 20000));
  }

  async pair(id, phone) {
    id = this.safeId(id);
    phone = String(phone || '').replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(phone)) throw new Error('Phone number must be 8-15 digits in international format');
    let account = this.sessions.get(id);
    if (!account) {
      account = { id, phone, status: 'created', process: null, code: null, meta: { id, phone, registered: false } };
      this.sessions.set(id, account);
    }
    if (account.status === 'online') return this.status(id);
    if (account.process && account.status === 'pairing') return this.status(id);
    await this.stop(id, { keepFiles: true });
    const app = await this.#copySource(id);
    account.phone = phone;
    account.code = null;
    account.status = 'pairing';
    await this.#writeMeta(id, { phone, registered: false, status: 'pairing' });
    const child = spawn(process.execPath, [path.join(app, 'multi-session', 'pair-runner.js')], {
      cwd: app,
      env: {
        ...process.env,
        SESSION_PATH: path.join(app, 'sessions'),
        PAIRING_PHONE: phone,
        SESSION_ID: '',
        PANEL_API_PORT: this.#panelPort(id),
        CODYMINI_ACCOUNT_ID: id,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    account.process = child;
    child.stdout.on('data', data => {
      const text = data.toString();
      process.stdout.write(`[${id}] ${text}`);
      const match = text.match(/CODYMINI_PAIRING_CODE:([A-Z0-9-]+)/);
      if (match) account.code = match[1];
      if (text.includes('CODYMINI_PAIRING_CONNECTED')) account.status = 'online';
    });
    child.stderr.on('data', data => process.stderr.write(`[${id}] ${data}`));
    child.once('exit', async (code) => {
      account.process = null;
      if (code === 0 && account.status === 'online') {
        await this.#writeMeta(id, { registered: true, status: 'online' });
        await this.start(id);
      } else if (account.status === 'pairing') {
        account.status = 'disconnected';
        await this.#writeMeta(id, { status: 'disconnected' });
      }
    });
    await wait(1200);
    return this.status(id);
  }

  async start(id) {
    id = this.safeId(id);
    const account = this.sessions.get(id);
    if (!account) throw new Error('Account not found');
    if (account.process) return this.status(id);
    const app = await this.#copySource(id);
    account.status = 'starting';
    const child = spawn(process.execPath, [path.join(app, 'index.js')], {
      cwd: app,
      env: {
        ...process.env,
        SESSION_PATH: path.join(app, 'sessions'),
        SESSION_ID: '',
        OWNER_NUMBER: account.phone || '',
        PANEL_API_PORT: this.#panelPort(id),
        CODYMINI_ACCOUNT_ID: id,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    account.process = child;
    account.status = 'online';
    child.stdout.on('data', data => process.stdout.write(`[${id}] ${data}`));
    child.stderr.on('data', data => process.stderr.write(`[${id}] ${data}`));
    child.once('exit', async () => {
      account.process = null;
      if (account.status !== 'stopped') {
        account.status = 'disconnected';
        await this.#writeMeta(id, { status: 'disconnected' });
      }
    });
    await this.#writeMeta(id, { registered: true, status: 'online' });
    return this.status(id);
  }

  async stop(id, { keepFiles = true } = {}) {
    id = this.safeId(id);
    const account = this.sessions.get(id);
    if (account?.process) {
      account.status = 'stopped';
      account.process.kill('SIGTERM');
      await wait(250);
      if (!account.process.killed) account.process.kill('SIGKILL');
      account.process = null;
    }
    if (!keepFiles) await fs.rm(this.accountPath(id), { recursive: true, force: true });
    return this.status(id);
  }

  async unlink(id) {
    id = this.safeId(id);
    await this.stop(id, { keepFiles: false });
    this.sessions.delete(id);
    return { accountId: id, status: 'unlinked' };
  }

  status(id) {
    id = this.safeId(id);
    const account = this.sessions.get(id);
    return account ? { accountId: id, status: account.status, pairingCode: account.code || null, phone: account.phone || null } : { accountId: id, status: 'stopped', pairingCode: null };
  }
  statuses() { return [...this.sessions.keys()].map(id => this.status(id)); }
}

module.exports = { MultiSessionManager };
