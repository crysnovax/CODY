'use strict';

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database', 'antis.json');

function read() {
    try {
        return fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {};
    } catch {
        return {};
    }
}

function write(data) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function isModerationEnabled(group) {
    const config = read()[group];
    return config?.enabled !== false;
}

function setModerationEnabled(group, enabled) {
    const data = read();
    data[group] = { ...(data[group] || {}), enabled: Boolean(enabled) };
    write(data);
    return data[group];
}

module.exports = { DB_PATH, read, write, isModerationEnabled, setModerationEnabled };
