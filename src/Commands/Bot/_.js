'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = process.cwd();
const MAX_OUTPUT = 3500;

function npmExecutable() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function buildNpmArgs(action, packages = []) {
    const names = packages.filter(Boolean);
    switch (action) {
        case 'install': return ['install', ...names, '--no-audit', '--no-fund'];
        case 'uninstall':
        case 'remove': return ['uninstall', ...names, '--no-audit', '--no-fund'];
        case 'list':
        case 'pkgs': return ['list', '--depth=0'];
        case 'update': return ['update', ...names, '--prefer-online', '--no-audit', '--no-fund'];
        case 'audit': return ['audit', '--omit=dev'];
        case 'fund': return ['fund'];
        default: return null;
    }
}

function runNpm(args, { cwd = ROOT, timeout = 120000 } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(npmExecutable(), args, {
            cwd,
            shell: false,
            env: { ...process.env, npm_config_update_notifier: 'false' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            const error = new Error(`npm command timed out after ${timeout}ms`);
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
        }, timeout);
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('close', code => {
            clearTimeout(timer);
            const result = { code: code ?? 1, stdout, stderr };
            if (result.code === 0) return resolve(result);
            const error = new Error(`npm exited with code ${result.code}`);
            Object.assign(error, result);
            reject(error);
        });
    });
}

function trimOutput(value) {
    const text = String(value || '').trim();
    if (!text) return 'Success (no output)';
    return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…(output truncated)` : text;
}

module.exports = {
    name: 'npm',
    alias: [],
    desc: 'Manage npm packages in the active CODY repository',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '♻️', success: '📦', error: '✘' },
    execute: async (sock, m, { reply, text }) => {
        const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
        if (!tokens.length) {
            return reply(
                '╭─❍ *NPM*\n│\n' +
                '│ .npm list / .pkgs → list installed\n' +
                '│ .npm update → update all packages in place\n' +
                '│ .npm update <pkg> → update specific package\n' +
                '│ .npm install <pkg> → install package\n' +
                '│ .npm uninstall <pkg> → remove package\n' +
                '│ .npm audit → security scan\n' +
                '│ .npm fund → funding links\n' +
                '╰──────────────────'
            );
        }
        const action = tokens.shift().toLowerCase();
        const args = buildNpmArgs(action, tokens);
        if (!args) return reply('Unknown npm command. Use `.npm` for help.');
        if (['install', 'uninstall', 'remove'].includes(action) && !tokens.length) return reply('Missing package name.');

        await sock.sendMessage(m.chat, { react: { text: '♻️', key: m.key } }).catch(() => {});
        await reply(`_*Running in ${path.basename(ROOT)}:*_\n\`${npmExecutable()} ${args.join(' ')}\``);
        try {
            const result = await runNpm(args);
            const output = trimOutput(`${result.stdout}\n${result.stderr}`);
            await reply(`*✓ ${action === 'update' ? 'Updated in place' : 'Completed'}*\n\`\`\`\n${output}\n\`\`\``);
            await sock.sendMessage(m.chat, { react: { text: '📦', key: m.key } }).catch(() => {});
        } catch (error) {
            const output = trimOutput(`${error.stdout || ''}\n${error.stderr || error.message}`);
            await reply(`*✘ npm ${action} failed*\n\`\`\`\n${output}\n\`\`\``);
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } }).catch(() => {});
        }
    },
};

module.exports._test = { ROOT, buildNpmArgs, trimOutput };
