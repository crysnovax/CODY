'use strict';

function parseEndDate(value, now = Date.now()) {
    const duration = /^(\d+)(m|h|d)$/i.exec(String(value || ''));
    let date;
    if (duration) {
        const scale = { m: 60_000, h: 3_600_000, d: 86_400_000 }[duration[2].toLowerCase()];
        date = new Date(now + Number(duration[1]) * scale);
    } else {
        date = new Date(value);
    }
    return Number.isNaN(date.getTime()) || date.getTime() <= now ? null : date;
}

function parsePollInput(args = []) {
    let text = args.join(' ').trim();
    const settings = {};
    let selectableOverride;

    const endMatch = /(?:^|\s)--end(?:=|\s+)(\S+)/i.exec(text);
    if (endMatch) {
        settings.endDate = parseEndDate(endMatch[1]);
        if (!settings.endDate) return { error: 'Poll end time must be a valid future date or duration such as `8h`.' };
        text = text.replace(endMatch[0], ' ').trim();
    }

    const selectMatch = /(?:^|\s)--select(?:=|\s+)(\d+)(?=\s|$)/i.exec(text);
    if (selectMatch) {
        selectableOverride = Number(selectMatch[1]);
        text = text.replace(selectMatch[0], ' ').trim();
    }

    if (/(?:^|\s)--multi\b/i.test(text)) {
        settings.isMulti = true;
        text = text.replace(/(?:^|\s)--multi\b/i, ' ').trim();
    }

    const hideMatch = /(?:^|\s)--hide-voters?(?:=(true|false))?/i.exec(text);
    if (hideMatch) {
        settings.hideVoter = hideMatch[1] !== 'false';
        text = text.replace(hideMatch[0], ' ').trim();
    }
    if (/(?:^|\s)--show-voters?\b/i.test(text)) {
        settings.hideVoter = false;
        text = text.replace(/(?:^|\s)--show-voters?\b/i, ' ').trim();
    }

    const noAddMatch = /(?:^|\s)--no-add-option\b/i.exec(text);
    if (noAddMatch) {
        settings.canAddOption = false;
        text = text.replace(noAddMatch[0], ' ').trim();
    } else {
        const addMatch = /(?:^|\s)--can-add-option(?:=(true|false))?/i.exec(text);
        if (addMatch) {
            settings.canAddOption = addMatch[1] !== 'false';
            text = text.replace(addMatch[0], ' ').trim();
        }
    }

    let isMulti = Boolean(settings.isMulti);
    if (/^multi\s+/i.test(text)) {
        isMulti = true;
        text = text.replace(/^multi\s+/i, '').trim();
    }

    const parts = text.split('|').map(part => part.trim()).filter(Boolean);
    if (parts.length < 3) return { error: 'Need a question and at least 2 options. Separate them with `|`.' };

    const question = parts[0];
    const options = [];
    for (const part of parts.slice(1)) {
        const imageOption = /^(.*?)\s*(?:::|=>)\s*(.+)$/i.exec(part);
        if (!imageOption) {
            if (part.length > 100) return { error: `Option too long: "${part.slice(0, 20)}..." (max 100 characters).` };
            options.push(part);
            continue;
        }

        const name = imageOption[1].trim();
        const imageUrl = imageOption[2].trim();
        if (!name) return { error: 'An image option needs a name before `::`.' };
        if (name.length > 100) return { error: `Option too long: "${name.slice(0, 20)}..." (max 100 characters).` };
        try {
            const parsedUrl = new URL(imageUrl);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('unsupported protocol');
        } catch {
            return { error: `Invalid image URL for option "${name}".` };
        }
        options.push({ name, image: { url: imageUrl } });
    }

    if (options.length > 12) return { error: 'Maximum 12 options allowed.' };
    if (question.length > 255) return { error: 'Question too long (max 255 characters).' };

    const selectableCount = selectableOverride === undefined ? (isMulti ? 0 : 1) : selectableOverride;
    if (selectableCount > options.length) return { error: `Selectable count must be 0–${options.length}.` };

    const poll = { name: question, values: options, selectableCount };
    if (settings.endDate) poll.endDate = settings.endDate;
    if (settings.hideVoter !== undefined) poll.hideVoter = settings.hideVoter;
    if (settings.canAddOption !== undefined) poll.canAddOption = settings.canAddOption;
    return { poll };
}

module.exports = {
    name: 'poll',
    alias: ['createpoll', 'vote'],
    desc: 'Create a native WhatsApp poll with optional images, expiry, voter privacy, and add-option controls',
    category: 'Group',
    groupOnly: false,
    reactions: { start: '📊', success: '❔' },
    usage: '.poll [multi] Question | Option | Option [--end 8h] [--hide-voter] [--no-add-option]',

    execute: async (sock, m, { args = [], reply, prefix = '.' }) => {
        if (!args.length) {
            return reply(
                `╭─❍ *📊 POLL CREATOR*\n│\n` +
                `│ Single choice: ${prefix}poll Question | Option 1 | Option 2\n` +
                `│ Multi choice: ${prefix}poll multi Question | Option 1 | Option 2\n` +
                `│ Image option: Option name :: https://image-url\n` +
                `│ Expiry: --end 8h (or --end <future ISO date>)\n` +
                `│ Privacy: --hide-voter | --show-voter\n` +
                `│ Options: --can-add-option | --no-add-option\n` +
                `│ Selection: --select 0 (unlimited) or --select 2\n` +
                `│ 2–12 options; option labels up to 100 characters\n` +
                `╰──────────────────`
            );
        }

        const parsed = parsePollInput(args);
        if (parsed.error) return reply(`_✘ ${parsed.error}_`);

        try {
            await sock.sendMessage(m.chat, { poll: parsed.poll }, { quoted: m });
        } catch (error) {
            console.error('[POLL ERROR]', error.message);
            return reply(`${prefix}_✘ Failed to create poll: ${error?.message || error}_`);
        }
    },
    parsePollInput,
    parseEndDate,
};
