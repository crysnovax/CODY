const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec, execFileSync } = require('child_process');
const executionToggle = require('../../Plugin/executionToggle');

module.exports = {
    name: 'eval',
    alias: ['>'],
    desc: 'Enable or disable the owner-only $ JavaScript trigger',
    category: 'Owner',
    ownerOnly: true,

    execute: async (sock, m, { args, reply, text, prefix, command }) => {
        const invocation = String(command || 'eval').toLowerCase();
        const isRawEval = invocation === 'raw-eval';
        const isRawShell = invocation === 'raw-shell';
        const isRawPython = invocation === 'raw-python';

        if (!isRawEval && !isRawShell && !isRawPython) {
            const state = String(text || '').trim().toLowerCase();
            if (args?.length !== 1 || !['on', 'off'].includes(state)) {
                return reply(`_*Usage:* ${prefix || '.'}eval on|off\n_${prefix || '.'}eval controls the raw $ JavaScript trigger._`);
            }
            const enabled = executionToggle.setEnabled('eval', state === 'on');
            return reply(enabled
                ? '`✓ EVAL ENABLED` — `$ code` will execute JavaScript.'
                : '`✘ EVAL DISABLED` — `$ code` will be ignored.');
        }

        if (!text) return;
        const startTime = Date.now();
        const isShell = isRawShell;
        const MAX_INLINE = 4000;

        const sendAsFile = async (content, timeTaken) => {
            const fileName = `eval_${Date.now()}.json`;
            const filePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(filePath, typeof content === 'string' ? content : util.inspect(content, {depth: 10}), 'utf8');
            await sock.sendMessage(m.chat, { document: fs.readFileSync(filePath), fileName, mimetype: 'application/json' }, { quoted: m });
            try { fs.unlinkSync(filePath); } catch {}
        };

        if (isShell) {
            try {
                const result = execSync(text, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024*1024*20 });
                const timeTaken = Date.now() - startTime;
                const output = result || 'No output';
                if (output.length > MAX_INLINE) return await sendAsFile(output, timeTaken);
                return reply(`*⚉* _(${timeTaken}ms)_\n\`\`\`\n${output}\n\`\`\``);
            } catch (err) {
                const timeTaken = Date.now() - startTime;
                const errOutput = err.stdout || err.stderr || err.message;
                if (errOutput.length > MAX_INLINE) return await sendAsFile(errOutput, timeTaken);
                return reply(`*✘ Shell Error* _(${timeTaken}ms)_\n\`\`\`\n${errOutput}\n\`\`\``);
            }
        }

        if (isRawPython) {
            const bridgeMarker = '__CODY_BRIDGE__';
            const pythonBridge = `
import json
import sys

_BRIDGE_MARKER = ${JSON.stringify(bridgeMarker)}

def _cody_action(action, **payload):
    print(_BRIDGE_MARKER + json.dumps({"action": action, **payload}, ensure_ascii=False), flush=True)

def send_message(chat, text):
    if isinstance(text, dict):
        text = text.get("text", "")
    _cody_action("send_message", chat=str(chat), text=str(text))

def reply(text):
    _cody_action("reply", text=str(text))

chat = ${JSON.stringify(m.chat)}
_user_code = sys.stdin.read()
exec(compile(_user_code, "<cody-python>", "exec"), globals(), globals())
`;

            const dispatchBridgeActions = async output => {
                const visibleOutput = [];
                let actionCount = 0;
                for (const line of String(output || '').split(/\r?\n/)) {
                    if (!line.startsWith(bridgeMarker)) {
                        if (line) visibleOutput.push(line);
                        continue;
                    }
                    try {
                        const action = JSON.parse(line.slice(bridgeMarker.length));
                        if (action.action === 'send_message' && action.chat && typeof action.text === 'string') {
                            await sock.sendMessage(action.chat, { text: action.text }, { quoted: m });
                            actionCount++;
                        } else if (action.action === 'reply' && typeof action.text === 'string') {
                            await reply(action.text);
                            actionCount++;
                        }
                    } catch {}
                }
                return { output: visibleOutput.join('\n'), actionCount };
            };

            try {
                const result = execFileSync('python3', ['-c', pythonBridge], {
                    encoding: 'utf8',
                    input: text,
                    timeout: 30000,
                    maxBuffer: 1024 * 1024 * 20
                });
                const timeTaken = Date.now() - startTime;
                const dispatched = await dispatchBridgeActions(result);
                const output = dispatched.output || (dispatched.actionCount ? '' : 'No output');
                if (output.length > MAX_INLINE) return await sendAsFile(output, timeTaken);
                return reply(`*⚉ Python* _(${timeTaken}ms)_\n\`\`\`\n${output}\n\`\`\``);
            } catch (err) {
                const timeTaken = Date.now() - startTime;
                const dispatched = await dispatchBridgeActions(err.stdout || '');
                const errOutput = err.stderr || dispatched.output || err.message;
                if (errOutput.length > MAX_INLINE) return await sendAsFile(errOutput, timeTaken);
                return reply(`*✘ Python Error* _(${timeTaken}ms)_\n\`\`\`\n${errOutput}\n\`\`\``);
            }
        }

        let consoleOutput = '';
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const capture = (p) => (...a) => { consoleOutput += p + a.map(x => typeof x === 'object' ? util.inspect(x,{depth:5,colors:false}) : String(x)).join(' ') + '\n'; };
        console.log = capture(''); console.error = capture('❌ '); console.warn = capture('⚠️ ');

        // ── track if a send happened ──
        let didSend = false;
        let lastSent = null;
        const originals = {};
        const methodsToTrack = ['sendMessage','sendPlogmeMessage','sendRichAIResponse','sendNewRichMedia','sendAlbumMessage'];
        for (const k of methodsToTrack) {
            if (typeof sock[k] === 'function') {
                originals[k] = sock[k].bind(sock);
                sock[k] = async (...a) => {
                    const r = await originals[k](...a);
                    didSend = true;
                    lastSent = r;
                    return r;
                };
            }
        }

        try {
            const sendImage = (source, caption='') => {
                const content = typeof source === 'string' && source.startsWith('http') ? {url: source} : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { image: content, caption }, { quoted: m });
            };
            const sendVideo = (source, caption='') => {
                const content = typeof source === 'string' && source.startsWith('http') ? {url: source} : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { video: content, caption }, { quoted: m });
            };
            const sendAudio = (source, ptt=false) => {
                const content = typeof source === 'string' && source.startsWith('http') ? {url: source} : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { audio: content, ptt }, { quoted: m });
            };
            const sendFile = (source, filename='file') => {
                const content = typeof source === 'string' && source.startsWith('http') ? {url: source} : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { document: content, fileName: filename }, { quoted: m });
            };
            const shell = (cmd) => new Promise((res,rej) => exec(cmd,{timeout:30000}, (e,out,err) => e ? rej(err||e.message) : res(out)));
            const sleep = (ms) => new Promise(r => setTimeout(r, ms));

            const hasDeclaration = /^\s*(const|let|var|function|class|if|for|while|try|switch)\b/m.test(text);
            const hasReturn = /\breturn\b/.test(text);
            const expressionCompiles = !hasDeclaration && !hasReturn && (()=>{ try{ new Function(`return (async () => (${text}\n))`); return true;}catch{return false;}})();
            let wrappedCode = expressionCompiles ? `(async () => (${text}\n))()` : `(async () => { ${text} })()`;
            let result = await eval(wrappedCode);

            console.log = originalLog; console.error = originalError; console.warn = originalWarn;
            for (const k in originals) sock[k] = originals[k];
            const timeTaken = Date.now() - startTime;

            // ── FIXED LOGIC ──
            // Only suppress if result IS the sent message itself, or undefined after a send
            if (!consoleOutput.trim()) {
                if (didSend && result === undefined) {
                    await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } }).catch(()=>{});
                    return;
                }
                if (didSend && lastSent && result === lastSent) {
                    await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } }).catch(()=>{});
                    return;
                }
            }

            let output = '';
            if (consoleOutput) output += consoleOutput.trimEnd();
            if (result !== undefined) {
                let resultStr;
                if (Buffer.isBuffer(result)) resultStr = `<Buffer ${result.length} bytes>`;
                else if (typeof result === 'function') resultStr = `[Function: ${result.name||'anonymous'}]`;
                else if (typeof result === 'object') resultStr = util.inspect(result, {depth: 10, colors: false, maxArrayLength: 100});
                else resultStr = String(result);
                if (output) output += '\n' + resultStr; else output = resultStr;
            }

            if (output && output.trim() && output.trim() !== 'undefined') {
                if (output.length > MAX_INLINE) return await sendAsFile(output, timeTaken);
                await reply(`*⚉ Result* _(${timeTaken}ms)_\n\`\`\`\n${output}\n\`\`\``);
            } else if (result === undefined && !consoleOutput) {
                await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } }).catch(()=>{});
            }

        } catch (err) {
            console.log = originalLog; console.error = originalError; console.warn = originalWarn;
            for (const k in originals) sock[k] = originals[k];
            const timeTaken = Date.now() - startTime;
            let errMsg = err.message || String(err);
            if (consoleOutput) errMsg = consoleOutput.trimEnd() + '\n' + errMsg;
            if (errMsg.length > MAX_INLINE) return await sendAsFile(errMsg, timeTaken);
            reply(`*✘ Error* _(${timeTaken}ms)_\n\`\`\`\n${errMsg}\n\`\`\``);
        }
    }
};
