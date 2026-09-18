const util = require('util');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

module.exports = {
    name: 'eval',
    alias: ['#', '>'],
    desc: 'Execute JavaScript code or shell commands',
    category: 'Owner',
    ownerOnly: true,

    execute: async (sock, m, { args, reply, text, prefix, command, isOwner, isDual }) => {
        if (!text) return;

        const startTime = Date.now();
        const isShell = command === 'sh';

        // ── Shell execution mode ──
        if (isShell) {
            try {
                const result = execSync(text, {
                    encoding: 'utf8',
                    timeout: 30000,
                    maxBuffer: 1024 * 1024 * 5
                });
                const timeTaken = Date.now() - startTime;
                const output = (result || 'No output').slice(0, 4000);
                return reply(`*�* _(${timeTaken}ms)_\n\`\`\`\n${output}\n\`\`\``);
            } catch (err) {
                const timeTaken = Date.now() - startTime;
                const errOutput = (err.stdout || err.stderr || err.message).slice(0, 4000);
                return reply(`*✘ Shell Error* _(${timeTaken}ms)_\n\`\`\`\n${errOutput}\n\`\`\``);
            }
        }

        // ── JavaScript execution mode ──
        let consoleOutput = '';
        const originalLog   = console.log;
        const originalError = console.error;
        const originalWarn  = console.warn;

        const capture = (prefix) => (...args) => {
            consoleOutput += prefix + args.map(a =>
                typeof a === 'object' ? util.inspect(a, { depth: 3, colors: false }) : String(a)
            ).join(' ') + '\n';
        };

        console.log   = capture('');
        console.error = capture('❌ ');
        console.warn  = capture('⚠️ ');

        try {
            // Helper to send media from eval
            const sendImage = (source, caption = '') => {
                const content = typeof source === 'string' && source.startsWith('http')
                    ? { url: source }
                    : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { image: content, caption }, { quoted: m });
            };

            const sendVideo = (source, caption = '') => {
                const content = typeof source === 'string' && source.startsWith('http')
                    ? { url: source }
                    : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { video: content, caption }, { quoted: m });
            };

            const sendAudio = (source, ptt = false) => {
                const content = typeof source === 'string' && source.startsWith('http')
                    ? { url: source }
                    : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { audio: content, ptt }, { quoted: m });
            };

            const sendFile = (source, filename = 'file') => {
                const content = typeof source === 'string' && source.startsWith('http')
                    ? { url: source }
                    : Buffer.isBuffer(source) ? source : fs.readFileSync(source);
                return sock.sendMessage(m.chat, { document: content, fileName: filename }, { quoted: m });
            };

            const shell = (cmd) => new Promise((resolve, reject) => {
                exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
                    if (err) reject(stderr || err.message);
                    else resolve(stdout);
                });
            });

            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // Prefer expression mode whenever the complete input compiles as an
            // async expression. This keeps multiline object diagnostics and
            // `await sock.sendMessage(...)` useful through the raw `$` path.
            // Declarations, explicit returns, and control-flow remain block mode.
            const hasDeclaration = /^\s*(const|let|var|function|class|if|for|while|try|switch)\b/m.test(text);
            const hasReturn = /\breturn\b/.test(text);
            const expressionCompiles = !hasDeclaration && !hasReturn && (() => {
                try {
                    new Function(`return (async () => (${text}\n))`);
                    return true;
                } catch {
                    return false;
                }
            })();

            let wrappedCode;
            if (expressionCompiles) {
                wrappedCode = `(async () => (${text}\n))()`;
            } else {
                wrappedCode = `(async () => { ${text} })()`;
            }

            let result = await eval(wrappedCode);

            console.log   = originalLog;
            console.error = originalError;
            console.warn  = originalWarn;

            const timeTaken = Date.now() - startTime;

            // ── SMART FILTER: ONLY filter obvious WhatsApp send responses ──
            function isWhatsAppSendResponse(result) {
                if (!result) return false;
                
                // Check if it's a reaction message response
                if (result.message?.reactionMessage) return true;
                
                // Check if it's a sendMessage response with key but no meaningful data
                if (result.key && result.messageTimestamp && !result.conversation && !result.text) {
                    return true;
                }
                
                return false;
            }
            
            // ── CHECK IF USER WANTS RAW OUTPUT (by adding .raw to the command) ──
            const wantsRaw = text.includes('.raw') || text.includes('//raw');
            
            // Build output
            let output = '';
            if (consoleOutput) output += consoleOutput.trimEnd();
            
            // Handle result
            const isSendResponse = !wantsRaw && isWhatsAppSendResponse(result);
            
            if (isSendResponse) {
                // Do not hide successful protocol-only sends (for example
                // chatTheme/colorSchemeId).  They return a normal WA message
                // key but have no visible message body, so report the key.
                if (!consoleOutput) {
                    const messageId = result.key?.id || 'unknown';
                    output = `Sent successfully (message id: ${messageId})`;
                }
            } else if (result !== undefined) {
                // Show result normally (including m.quoted, m.isGroup, etc.)
                let resultStr;
                
                if (Buffer.isBuffer(result)) {
                    resultStr = `<Buffer ${result.length} bytes>`;
                } else if (typeof result === 'function') {
                    resultStr = `[Function: ${result.name || 'anonymous'}]`;
                } else if (typeof result === 'object') {
                    // Always show objects properly - this includes m.quoted, m.chat, etc.
                    resultStr = util.inspect(result, { 
                        depth: wantsRaw ? 5 : 3, 
                        colors: false, 
                        maxArrayLength: wantsRaw ? 50 : 20,
                        breakLength: wantsRaw ? 80 : 60
                    });
                    
                    // Truncate only if extremely long
                    if (resultStr.length > 8000) {
                        resultStr = resultStr.slice(0, 8000) + '\n... (truncated)';
                    }
                } else {
                    resultStr = String(result);
                }
                
                if (output) output += '\n' + resultStr;
                else output = resultStr;
            }
            
            // Send response if there's output
            if (output && output.trim() && output.trim() !== 'undefined') {
                const finalOutput = output.slice(0, 4000);
                await reply(`*✆ Result* _(${timeTaken}ms)_\n\`\`\`\n${finalOutput}\n\`\`\``);
            } else if (!consoleOutput && (result === undefined || isSendResponse)) {
                // Silent operation
                if (!isSendResponse) {
                    await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } }).catch(() => {});
                }
            }

        } catch (err) {
            console.log   = originalLog;
            console.error = originalError;
            console.warn  = originalWarn;

            const timeTaken = Date.now() - startTime;
            let errMsg = err.message || String(err);
            if (consoleOutput) errMsg = consoleOutput.trimEnd() + '\n' + errMsg;

            reply(`*✘ Error* _(${timeTaken}ms)_\n\`\`\`\n${errMsg.slice(0, 4000)}\n\`\`\``);
        }
    }
};
