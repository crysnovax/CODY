'use strict';

const { randomBytes } = require('node:crypto');

const MENU_IMAGE = 'https://cdn.crysnovax.link/files/1786913837400-12ad05cc-468a-4d71-8de8-1e5a11b48f3b.jpeg';
const PANEL_URL = 'https://sl.crysnovax.link/PANEL2';
const PAIR_URL = 'https://pair.crysnovax.link';
const TUTORIAL5_URL = 'https://sl.crysnovax.link/tutorial5';
const TUTORIAL3_URL = 'https://sl.crysnovax.link/tutorial3';
const DISCORD_URL = 'https://discord.com';

const quoteOptions = message => ({ quoted: message });

const sendRichMenu = async (sock, message, payload) => {
    if (typeof sock.richMenu !== 'function') {
        throw new Error('sock.richMenu is unavailable. Install @crysnovax/baileys 2.7.12 or newer and restart CODY.');
    }
    return sock.richMenu(message.chat, payload, quoteOptions(message));
};

const sendRichStep = async (sock, message, step) => {
    if (typeof sock.sendMessage !== 'function') {
        throw new Error('sock.sendMessage is unavailable.');
    }
    return sock.sendMessage(message.chat, {
        richResponse: [
            { text: step.title },
            { title: step.title, table: step.rows },
            ...(step.code ? [{ code: [{ codeContent: step.code, highlightType: 0 }], language: 'javascript' }] : [])
        ]
    }, quoteOptions(message));
};

const button = (id, text, menuNonce) => ({
    // WhatsApp clients cache CTA selection state by tool_call_id. A stable
    // `.deploy step1` id therefore stays visually selected forever for some
    // recipients. Keep the action stable but namespace every menu instance.
    id: `.deploy ${id} --menu=${menuNonce}`,
    text
});

const buildMenuPayload = (menuNonce = randomBytes(6).toString('hex')) => ({
    header: {
        title: 'CODY AI Deployment Guide',
        image: { url: MENU_IMAGE, mime_type: 'image/jpeg' }
    },
    body: {
        row: true,
        cards: [
            {
                title: 'Deployment Steps',
                buttons: [
                    button('step1', 'Step 1 · Discord', menuNonce),
                    button('step2', 'Step 2 · Panel', menuNonce),
                    button('step3', 'Step 3 · Pair', menuNonce)
                ]
            },
            {
                title: 'Finish & Help',
                buttons: [
                    button('step4', 'Step 4 · Upload', menuNonce),
                    button('help', 'Help', menuNonce),
                    button('tutorials', 'Tutorials', menuNonce)
                ]
            }
        ]
    },
    footer: {
        text: 'Open a step for the current instructions',
        url: TUTORIAL5_URL
    }
});

const tableRows = (...rows) => [
    { isHeading: true, items: ['Item', 'Instruction'] },
    ...rows.map(row => ({ items: row }))
];

const STEPS = {
    step1: {
        title: 'Step 1 · Discord account',
        rows: tableRows(
            ['Open', DISCORD_URL],
            ['Account', 'Create an account if you do not already have one.'],
            ['Verify', 'Verify the email address.'],
            ['Ready', 'Keep the verified Discord account ready for panel verification.']
        )
    },
    step2: {
        title: 'Step 2 · Specify panel',
        rows: tableRows(
            ['Open', PANEL_URL],
            ['Account', 'Create an account and verify it with Discord and your email address.'],
            ['Server', 'Create a Node.js server for CODY AI.']
        )
    },
    step3: {
        title: 'Step 3 · Pair and generate',
        rows: tableRows(
            ['Open', PAIR_URL],
            ['Session', 'Fill in the required details and obtain your session ID.'],
            ['Owner number', 'Use country-code digits only: no plus sign, spaces, or formatting.'],
            ['Generate', 'Click Generate index.js, then download the generated file.']
        ),
        code: 'Owner number: 234xxxxxxxxx\nGenerated file: index.js'
    },
    step4: {
        title: 'Step 4 · Upload and start',
        rows: tableRows(
            ['Upload', 'Upload index.js to the panel server root.'],
            ['Start', 'Start the server and watch the console until the bot connects.'],
            ['Command', 'If the panel asks for a startup command, use node index.js.']
        ),
        code: 'node index.js'
    },
    help: {
        title: 'Deployment help',
        rows: tableRows(
            ['Pairing', 'Confirm the owner number uses country-code digits only and generate a fresh script.'],
            ['Verification', 'Confirm Discord and panel email verification are complete.'],
            ['Panel', 'Confirm index.js is in the server root and the server starts with node index.js.']
        )
    },
    tutorials: {
        title: 'Current tutorials',
        rows: tableRows(
            ['Primary', TUTORIAL5_URL],
            ['Additional', TUTORIAL3_URL],
            ['Pairing', PAIR_URL],
            ['Panel', PANEL_URL]
        )
    }
};

const deployCommand = {
    name: 'deploy',
    alias: ['pair'],
    desc: 'Open the interactive Gen4 CODY deployment guide',
    category: 'System',
    ownerOnly: true,
    reactions: { start: '📚', success: '✅', error: '❌' },
    execute: async (sock, message, { args, reply }) => {
        const action = String(args?.[0] || 'menu').toLowerCase();

        try {
            if (action === 'menu' || action === 'start') {
                await sendRichMenu(sock, message, buildMenuPayload());
                return;
            }

            if (action === 'script') {
                return reply(`Generate the current index.js from ${PAIR_URL}; CODY does not send an embedded stale script. Use Step 3, then download the generated file.`);
            }

            const step = STEPS[action];
            if (!step) return reply('Use .deploy or .pair to open the Gen4 guide. Available actions: step1, step2, step3, step4, help, tutorials.');

            // Button clicks deliberately leave Gen4 mode. Each click produces
            // exactly one quoted richResponse containing the requested content.
            await sendRichStep(sock, message, step);
        } catch (error) {
            return reply(`Deployment guide failed: ${error?.message || error}`);
        }
    }
};

module.exports = deployCommand;
module.exports._internals = { buildMenuPayload, STEPS, sendRichStep };
