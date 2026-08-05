
// © 2026 ZEE BOT | Powered by CRYSNOVA AI V2 Technology
// Config reads from .env (primary) → getVar runtime (secondary) → defaults
//

const fs   = require('fs');
const path = require('path');
const { getVar } = require('../src/Plugin/configManager');

const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

const getBoolean = (key, userValue, fallback) => {
    const envValue = process.env[key];
    if (envValue !== undefined) return parseBoolean(envValue, fallback);
    const runtimeValue = getVar(key, undefined);
    if (runtimeValue !== undefined && runtimeValue !== null) return parseBoolean(runtimeValue, fallback);
    return parseBoolean(userValue, fallback);
};

/*
──────────────────────────────────────────
Load User Config (optional JSON override)
──────────────────────────────────────────
*/
const USER_CONFIG_PATH = path.join(__dirname, '../database/user-config.json');
let userConfig = {};
try {
    if (fs.existsSync(USER_CONFIG_PATH)) {
        userConfig = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'));
    }
} catch {}

/*
──────────────────────────────────────────
Auto-detect number from session creds
Priority:
  1. process.env (from .env file)
  2. getVar() runtime override (setvar command)
  3. user-config.json
  4. sessions/creds.json  ← auto after pairing
  5. Hardcoded fallback
──────────────────────────────────────────
*/
const getSessionNumber = () => {
    try {
        const credsPath = path.join(__dirname, '../sessions/creds.json');
        if (fs.existsSync(credsPath)) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            const rawId = creds?.me?.id;
            if (rawId) return rawId.split(':')[0].split('@')[0];
        }
    } catch {}
    return null;
};

const defaultNumber = process.env.OWNER_NUMBER || '2347043550282';

const resolvedOwner =
    process.env.OWNER_NUMBER        ||
    getVar('OWNER_NUMBER')          ||
    userConfig?.owner?.number       ||
    getSessionNumber()              ||
    defaultNumber;

/*
──────────────────────────────────────────
Config (ZEE BOT structure + CRYSNOVA V2 fields)
──────────────────────────────────────────
*/
const config = {

    // ════════════════════════════════════════════
    // BOT IDENTITY (ZEE BOT .env style)
    // ════════════════════════════════════════════
    owner: resolvedOwner,

    botNumber:
        process.env.BOT_NUMBER       ||
        getVar('BOT_NUMBER')         ||
        userConfig?.bot?.number      ||
        getSessionNumber()           ||
        defaultNumber,

    session:
        process.env.SESSION_NAME     ||
        getVar('SESSION_NAME')       ||
        userConfig?.session          ||
        'sessions',

    thumbUrl:
        process.env.MENU_URL         ||
        process.env.THUMB_URL        ||
        getVar('MENU_URL')           ||
        getVar('THUMB_URL')          ||
        userConfig?.thumbUrl         ||
    //    'https://cdn.crysnovax.link/files/1783469167623-6d58c43c-68b4-41ce-87ab-c0da1f615b28.mp4',
       // 'https://cdn.crysnovax.link/files/1778529162616-eca99707-7b11-453a-802a-e85a9d1c2395.jpeg',
        'https://cdn.crysnovax.link/files/1784725819117-db2035e8-f797-4f47-8d41-e1dd6f546553.mp4',

    // ════════════════════════════════════════════
    // PANEL CONNECTOR API (CODY)
    // ════════════════════════════════════════════
    panelApiPort:
        process.env.PANEL_API_PORT   ||
        getVar('PANEL_API_PORT')     ||
        userConfig?.panelApiPort     ||
        9000,

    panelRoot:
        process.env.PANEL_ROOT       ||
        getVar('PANEL_ROOT')         ||
        userConfig?.panelRoot        ||
        process.cwd(),

    // ════════════════════════════════════════════
    // BOT STATUS / MODE (ZEE BOT .env style)
    // ════════════════════════════════════════════
    status: {
        public:   getBoolean('PUBLIC_MODE', userConfig?.bot?.public, true),
        terminal: getBoolean('TERMINAL_MODE', userConfig?.bot?.terminal, true),
        reactsw:  getBoolean('REACT_STATUS', userConfig?.bot?.reactsw, true)
    },

    // ════════════════════════════════════════════
    // BOT MODE FLAGS (ZEE BOT specific)
    // ════════════════════════════════════════════
    mode: {
        autoRead:      getBoolean('AUTO_READ', userConfig?.bot?.autoRead, true),
        autoTyping:    getBoolean('AUTO_TYPING', userConfig?.bot?.autoTyping, false),
        autoRecording: getBoolean('AUTO_RECORDING', userConfig?.bot?.autoRecording, false),
        alwaysOnline:  getBoolean('ALWAYS_ONLINE', userConfig?.bot?.alwaysOnline, true),
        selfBot:       getBoolean('SELF_BOT', userConfig?.bot?.selfBot, false)
    },

    // ════════════════════════════════════════════
    // SETTINGS (CRYSNOVA V2 style with .env)
    // ════════════════════════════════════════════
    settings: {
        title:
            process.env.BOT_NAME         ||
            getVar('BOT_NAME')           ||
            userConfig?.bot?.name        ||
            'CRYSNOVA AI',

        packname:
            process.env.BOT_NAME         ||
            getVar('BOT_NAME')           ||
            userConfig?.bot?.name        ||
            'CRYSNOVA AI',

        prefix: (() => {
            const envPrefix = process.env.PREFIX;
            if (envPrefix !== undefined) {
                return (envPrefix === 'null' || envPrefix === '') ? '' : envPrefix;
            }

            const runtimePrefix = getVar('PREFIX');
            if (runtimePrefix !== undefined && runtimePrefix !== null) {
                return (runtimePrefix === 'null' || runtimePrefix === '') ? '' : runtimePrefix;
            }

            const userPrefix = userConfig?.bot?.prefix;
            if (userPrefix !== undefined && userPrefix !== null) {
                return (userPrefix === 'null' || userPrefix === '') ? '' : userPrefix;
            }

            return '.';
        })(),

        description: 'Professional WhatsApp Bot — ZEE BOT powered by CRYSNOVA AI V2',
        author:      'https://github.com/crysnovax/CRYSNOVA_AI',
        footer:      '© ZEE BOT | Powered by CRYSNOVA AI',

        ownerJid:
            getVar('OWNER_JID')          ||
            userConfig?.owner?.jid       ||
            `${resolvedOwner}@s.whatsapp.net`,

        ownerName:
            process.env.OWNER_NAME       ||
            getVar('OWNER_NAME')         ||
            userConfig?.owner?.name      ||
            'ZEE OWNER'
    },

    // ════════════════════════════════════════════
    // PERMISSIONS (ZEE BOT .env style)
    // ════════════════════════════════════════════
    permissions: {
        owners: process.env.OWNER_NUMBERS
            ? process.env.OWNER_NUMBERS.split(',').map(n => n.trim() + '@s.whatsapp.net')
            : [`${resolvedOwner}@s.whatsapp.net`],
        premium: [],
        banned: []
    },

    // ════════════════════════════════════════════
    // MESSAGES (CRYSNOVA V2 style)
    // ════════════════════════════════════════════
    message: {
        owner:   '`ⓘ OWNER ONLY 彡`',
        group:   '`⟁⃝GROUP ONLY!℘`',
        admin:   '`⚠︎ ADMIN ONLY! 𓃼`',
        private: 'ಠ_ಠ_*USE THIS IN DM*_ 𓀀'
    },

    mess: {
        owner: '`☠︎︎ OWNER ONLY!`',
        done:  '`㋛ Mode changed!!`',
        error: 'Something went wrong! ✘',
        wait:  '_Please wait... ⚉_'
    },

    // ════════════════════════════════════════════
    // AUTO REPLY (ZEE BOT feature)
    // ════════════════════════════════════════════
    autoReply: {
        enabled: process.env.AUTO_REPLY !== 'false',
        ai: {
            enabled:   true,
            apiUrl:    process.env.AI_API_URL   || 'https://all-in-1-ais.officialhectormanuel.workers.dev/',
            model:     process.env.AI_MODEL     || 'gpt-4.5-preview',
            maxMemory: 10
        },
        greetings: {
            enabled:  true,
            keywords: ['hi', 'hello', 'hey', 'morning', 'afternoon', 'evening'],
            response: 'Hello! 👋 How can ZEE BOT help you today?'
        }
    },

    // ════════════════════════════════════════════
    // NEWSLETTER (CRYSNOVA V2 style)
    // ════════════════════════════════════════════
    newsletter: {
        name:
            process.env.BOT_NAME ||
            getVar('BOT_NAME')   ||
            'CRYSNOVA AI',
        id: '120363402922206865@newsletter'
    },

    // ════════════════════════════════════════════
    // API KEYS (ZEE BOT .env style)
    // ════════════════════════════════════════════
    api: {
        baseurl:
            process.env.API_BASEURL  ||
            getVar('API_BASEURL')    ||
            'https://hector-api.vercel.app/',
        apikey:
            process.env.API_KEY      ||
            getVar('API_KEY')        ||
            'hector',
        groq:
            process.env.GROQ_API_KEY ||
            getVar('GROQ_API_KEY')   ||
            '',
        openai:
            process.env.OPENAI_API_KEY  ||
            getVar('OPENAI_API_KEY')    ||
            '',
        weather:
            process.env.WEATHER_API_KEY ||
            getVar('WEATHER_API_KEY')   ||
            'e6926030169752d7e0d85377e489c415',
        
        gateway:
            process.env.GATEWAY_URL     ||
            getVar('GATEWAY_URL')       ||
            'https://api.crysnovax.link',
        gatewayToken:
            process.env.GATEWAY_TOKEN   ||
            getVar('GATEWAY_TOKEN')     ||
            'x',

        cdn:
            process.env.CDN_URL         ||
            getVar('CDN_URL')           ||
            'https://cdn.crysnovax.link',
        imageBase:
            process.env.IMAGE_API_BASE  ||
            getVar('IMAGE_API_BASE')    ||
            'https://apis.prexzyvilla.site/ai',
        removebg:
            process.env.REMOVE_BG_API_KEY ||
            getVar('REMOVE_BG_API_KEY')   ||
            'fy5Va5Qivw2BUQoojeSzzcHp'
    },

    // ════════════════════════════════════════════
    // STICKER (CRYSNOVA V2 style)
    // ════════════════════════════════════════════
    sticker: {
        // PACK_NAME drives the sticker pack name: all stickers become "⚉ • <PACK_NAME>"
        packname: (() => {
            const raw =
                process.env.PACK_NAME    ||
                getVar('PACK_NAME')      ||
                process.env.BOT_NAME     ||
                getVar('BOT_NAME')       ||
                'crysnovax';
            return `⚉ • ${raw}`;
        })(),
        author:
            process.env.STICKER_AUTHOR   ||
            getVar('STICKER_AUTHOR')     ||
            process.env.PACK_NAME        ||
            getVar('PACK_NAME')          ||
            'crysnovax'
    },

    // ════════════════════════════════════════════
    // BRANDING (ZEE BOT style)
    // ════════════════════════════════════════════
    branding: {
        footer:  '© ZEE BOT | Powered by CRYSNOVA AI',
        channel: 'https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38',
        group:   process.env.GROUP_LINK || 'https://chat.whatsapp.com/Besbj8VIle1GwxKKZv1lax?mode=gi_t',
        repo:    'https://github.com/crysnovax/CRYSNOVA_AI'
    },

    // ════════════════════════════════════════════
    // LOGGING (ZEE BOT style)
    // ════════════════════════════════════════════
    logging: {
        level:       process.env.LOG_LEVEL || 'silent',
        logCommands: true,
        logMessages: false
    },

    // ════════════════════════════════════════════
    // STATUS HANDLER SETTINGS (CRYSNOVA V2)
    // ════════════════════════════════════════════
    statusHandler: {
        autoView:
            process.env.AUTO_STATUS_VIEW !== undefined
                ? process.env.AUTO_STATUS_VIEW !== 'false'
                : (getVar('AUTO_STATUS_VIEW') ?? true),

        autoLike:
            process.env.AUTO_STATUS_LIKE !== undefined
                ? process.env.AUTO_STATUS_LIKE !== 'false'
                : (getVar('AUTO_STATUS_LIKE') ?? true),

        statusEmoji:
            process.env.STATUS_EMOJI     ||
            getVar('STATUS_EMOJI')       ||
            '❤️‍🔥',

        ghostMode:
            process.env.GHOST_MODE !== undefined
                ? process.env.GHOST_MODE !== 'false'
                : (getVar('GHOST_MODE') ?? false)
    }
};

module.exports = config;
