module.exports = {
  name: 'md',
  alias: ['code', 'markdown', 'syntax'],
  desc: 'Send syntax-highlighted code block',
  category: 'Tools',
  usage: '.md <language> | <code>',
  reactions: {
    start: '💻',
    success: '👾',
    error: '❔'
  },
  execute: async (sock, msg, { args, reply, prefix }) => {
    const text = args.join(' ').trim();

    if (!text) {
      return reply(
        '╭─❍ *CODE BLOCK*\n│\n' +
        ('│ ⚉ *Usage:* ' + prefix + 'md <language> | <code>\n│\n') +
        '│ ✪ *Example:*\n' +
        ('│ ' + prefix + 'md javascript | console.log(\'Hello!\')\n') +
        ('│ ' + prefix + 'md python | print("Hello World")\n│\n') +
        '│ 📝 *Languages:* js, py, java, cpp, html, css, etc.\n' +
        '╰──────────────────'
      );
    }

    const pipeIndex = text.indexOf('|');
    let langInput, code;

    if (pipeIndex !== -1) {
      langInput = text.slice(0, pipeIndex).trim().toLowerCase();
      code = text.slice(pipeIndex + 1).trim();
    } else {
      langInput = 'javascript';
      code = text;
    }

    const langMap = {
      'js': 'javascript',
      'javascript': 'javascript',
      'py': 'python',
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c++': 'cpp',
      'c': 'c',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'ts': 'typescript',
      'typescript': 'typescript',
      'go': 'go',
      'rust': 'rust',
      'php': 'php',
      'ruby': 'ruby',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'sql': 'sql',
      'shell': 'bash',
      'bash': 'bash',
      'sh': 'bash'
    };

    const language = langMap[langInput] || langInput;

    await sock.sendMessage(msg.chat, {
      react: { text: '💻', key: msg.key }
    });

    try {
      await sock.sendRichAIResponse(msg.chat, {
        codeBlock: {
          language: language,
          code: code
        }
      });

      await sock.sendMessage(msg.chat, {
        react: { text: '👾', key: msg.key }
      });
    } catch (err) {
      console.error('[MD ERROR]', err.message);

      await sock.sendMessage(msg.chat, {
        react: { text: '🙊', key: msg.key }
      });

      reply('```' + language + '\n' + code + '\n```');
    }
  }
};
