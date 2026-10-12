'use strict';

const fs = require('fs');
const path = require('path');
const DB_PATH = process.env.CODY_ANTIDELETE_DB || path.join(__dirname, '../../database/antidelete.json');

function readConfig() {
    try {
        const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function writeConfig(config) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

module.exports = {
    name: 'antideletestatus',
    alias: ['antistatusdelete', 'statusantidelete'],
    desc: 'Recover revoked WhatsApp Status posts to the bot owner privately',
    category: 'Tools',
    ownerOnly: true,
    usage: '.antideletestatus on/off/status',
    execute: async (_sock, _m, { args = [], reply }) => {
        const action = String(args[0] || 'status').toLowerCase();
        const config = readConfig();
        if (action === 'on') {
            config._status = true;
            writeConfig(config);
            return reply('Status anti-delete is ON. Revoked Status posts will be sent to the bot owner privately when WhatsApp provides the deletion event.');
        }
        if (action === 'off') {
            config._status = false;
            writeConfig(config);
            return reply('Status anti-delete is OFF.');
        }
        if (action === 'status') {
            return reply(`Status anti-delete: *${config._status ? 'ON' : 'OFF'}*`);
        }
        return reply('Usage: .antideletestatus on, .antideletestatus off, or .antideletestatus status');
    },
};
