const assert = require('node:assert/strict');
const test = require('node:test');

const evalCommand = require('../src/Commands/System/£.js');
const executionToggle = require('../src/Plugin/executionToggle');
const shellCommand = require('../src/Commands/System/shell.js');
const pythonCommand = require('../src/Commands/System/python.js');

const createContext = (text, overrides = {}) => {
    const replies = [];
    const sent = [];
    const reactions = [];

    const sock = {
        sendMessage: async (chat, content, options) => {
            sent.push({ chat, content, options });
            if (content.react) reactions.push(content.react);
            return {
                key: { id: `test-${sent.length}` },
                messageTimestamp: 1,
                message: content
            };
        }
    };

    const message = {
        chat: '12345@s.whatsapp.net',
        key: { id: 'incoming-test' }
    };

    return {
        command: 'raw-eval',
        text,
        args: [],
        prefix: '.',
        isOwner: true,
        isDual: false,
        reply: async value => replies.push(String(value)),
        ...overrides,
        sock,
        message,
        replies,
        sent,
        reactions
    };
};

test('eval returns the result of a simple JavaScript expression', async () => {
    const context = createContext('1 + 1');

    await evalCommand.execute(context.sock, context.message, context);

    assert.equal(context.replies.length, 1);
    assert.match(context.replies[0], /2/);
});

test('raw Python execution returns Python output', async () => {
    const context = createContext('print(1 + 1)', { command: 'raw-python' });

    await evalCommand.execute(context.sock, context.message, context);

    assert.equal(context.replies.length, 1);
    assert.match(context.replies[0], /2/);
});

test('raw Python bridge dispatches send_message and reply helpers', async () => {
    const context = createContext(
        'send_message(chat, "hello from Python")\nreply("bridge reply")',
        { command: 'raw-python' }
    );

    await evalCommand.execute(context.sock, context.message, context);

    assert.ok(context.sent.some(item => item.chat === context.message.chat && item.content.text === 'hello from Python'));
    assert.ok(context.replies.some(value => value === 'bridge reply'));
});

test('eval control only accepts on/off and enables the raw trigger', async t => {
    t.after(() => executionToggle.setEnabled('eval', false));
    const context = createContext('on', { command: 'eval', args: ['on'] });

    await evalCommand.execute(context.sock, context.message, context);

    assert.equal(executionToggle.isEnabled('eval'), true);
    assert.match(context.replies[0], /EVAL ENABLED/);
});

test('eval rejects arbitrary JavaScript instead of executing it', async () => {
    const context = createContext('process.exit()', { command: 'eval', args: ['process.exit()'] });

    await evalCommand.execute(context.sock, context.message, context);

    assert.equal(context.replies.length, 1);
    assert.match(context.replies[0], /Usage.*eval on\|off/s);
});

test('eval captures console output and restores the console', async () => {
    const originalLog = console.log;
    const context = createContext('console.log("captured"); undefined');

    await evalCommand.execute(context.sock, context.message, context);

    assert.equal(console.log, originalLog);
    assert.equal(context.replies.length, 1);
    assert.match(context.replies[0], /captured/);
});

test('eval returns multiline object diagnostics from the live socket context', async () => {
    const context = createContext(`({
        table: typeof sock.sendInteractiveTable,
        grid: typeof sock.sendRichButtonGrid,
        flow: typeof sock.sendWhatsAppFlow,
        status: typeof sock.sendStatus,
        sendMessage: typeof sock.sendMessage
    })`);

    await evalCommand.execute(context.sock, context.message, context);

    assert.equal(context.replies.length, 1);
    assert.match(context.replies[0], /table/);
    assert.match(context.replies[0], /sendMessage/);
});

test('eval exposes the socket and media helper contract used by bot owners', async () => {
    const context = createContext('sendImage(Buffer.from("image-data"), "caption")');
    context.sock = context.sock;

    await evalCommand.execute(context.sock, context.message, context);

    const imageMessage = context.sent.find(item => item.content.image);
    assert.ok(imageMessage);
    assert.equal(imageMessage.chat, context.message.chat);
    assert.deepEqual(imageMessage.content, {
        image: Buffer.from('image-data'),
        caption: 'caption'
    });
    assert.deepEqual(imageMessage.options, { quoted: context.message });
});

test('shell command only accepts on/off and persists the shell toggle', async t => {
    t.after(() => executionToggle.setEnabled('shell', false));
    const replies = [];

    await shellCommand.execute({}, {}, {
        args: ['on'],
        reply: async text => replies.push(String(text)),
        prefix: '.'
    });

    assert.equal(executionToggle.isEnabled('shell'), true);
    assert.match(replies[0], /SHELL ENABLED/);
});

test('shell command rejects arbitrary shell text', async () => {
    const replies = [];

    await shellCommand.execute({}, {}, {
        args: ['rm', '-rf', '/'],
        reply: async text => replies.push(String(text)),
        prefix: '.'
    });

    assert.match(replies[0], /Usage.*shell on\|off/s);
});

test('python command only accepts on/off and persists the Python toggle', async t => {
    t.after(() => executionToggle.setEnabled('python', false));
    const replies = [];

    await pythonCommand.execute({}, {}, {
        args: ['on'],
        reply: async text => replies.push(String(text)),
        prefix: '.'
    });

    assert.equal(executionToggle.isEnabled('python'), true);
    assert.match(replies[0], /PYTHON ENABLED/);
});

test('python command rejects arbitrary Python text', async () => {
    const replies = [];

    await pythonCommand.execute({}, {}, {
        args: ['print(1)', '&&', 'id'],
        reply: async text => replies.push(String(text)),
        prefix: '.'
    });

    assert.match(replies[0], /Usage.*py on\|off/s);
});
