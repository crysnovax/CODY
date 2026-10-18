const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');

module.exports = {
    name: 'eval',
    alias: ['>'],
    desc: 'Execute JavaScript code or shell commands',
    category: 'Owner',
    ownerOnly: true,

    execute: async (sock, m, { args, reply, text, prefix, command, isOwner, isDual }) => {
        if (!text) return;
        const startTime = Date.now();
        const isShell = command === 'sh';
        const MAX_INLINE = 4000;

        const sendAsFile = async (content, timeTaken) => {
            const fileName = `eval_${Date.now()}.json`;
            const filePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(filePath, typeof content === 'string' ? content : util.inspect(content, {depth: 10}), 'utf8');
            await sock.sendMessage(m.chat, {
                document: fs.readFileSync(filePath),
                fileName,
                mimetype: 'application/json'
            }, { quoted: m });
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

        let consoleOutput = '';
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const capture = (p) => (...a) => { consoleOutput += p + a.map(x => typeof x === 'object' ? util.inspect(x,{depth:5,colors:false}) : String(x)).join(' ') + '\n'; };
        console.log = capture(''); console.error = capture('❌ '); console.warn = capture('⚠️ ');

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
            const timeTaken = Date.now() - startTime;

            // ── THIS IS THE FIX ── detect ANY WhatsApp send response, including rich media
            function isWASendResponse(r) {
                if (!r || typeof r !== 'object') return false;
                // Baileys WAMessage structure
                if (r.key?.id && r.key?.remoteJid) return true;
                if (r.message?.botForwardedMessage) return true;
                if (r.message?.messageContextInfo?.botMetadata) return true;
                if (Array.isArray(r.messageStubParameters) && r.userReceipt !== undefined) return true;
                if (r.message?.reactionMessage) return true;
                return false;
            }

            const isSendResponse = isWASendResponse(result);

            // If it's a successful send and you didn't console.log anything, stay silent
            if (isSendResponse && !consoleOutput.trim()) {
                await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } }).catch(()=>{});
                return; // <-- NO Result message
            }

            let output = '';
            if (consoleOutput) output += consoleOutput.trimEnd();
            if (result !== undefined && !isSendResponse) {
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
            } else if (!isSendResponse) {
                await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } }).catch(()=>{});
            }

        } catch (err) {
            console.log = originalLog; console.error = originalError; console.warn = originalWarn;
            const timeTaken = Date.now() - startTime;
            let errMsg = err.message || String(err);
            if (consoleOutput) errMsg = consoleOutput.trimEnd() + '\n' + errMsg;
            if (errMsg.length > MAX_INLINE) return await sendAsFile(errMsg, timeTaken);
            reply(`*✘ Error* _(${timeTaken}ms)_\n\`\`\`\n${errMsg}\n\`\`\``);
        }
    }
};
