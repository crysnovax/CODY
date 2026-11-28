'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'database', 'execution_toggles.json');
const DEFAULTS = Object.freeze({ eval: false, shell: false });
const VALID_KEYS = new Set(Object.keys(DEFAULTS));

function load() {
    try {
        if (fs.existsSync(FILE)) {
            const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
            return { ...DEFAULTS, ...data };
        }
    } catch {}
    return { ...DEFAULTS };
}

function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const temporary = `${FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, FILE);
}

function isEnabled(key) {
    return VALID_KEYS.has(key) && load()[key] === true;
}

function setEnabled(key, enabled) {
    if (!VALID_KEYS.has(key)) throw new Error(`Unknown execution toggle: ${key}`);
    const data = load();
    data[key] = Boolean(enabled);
    save(data);
    return data[key];
}

function getState() {
    return load();
}

module.exports = { FILE, isEnabled, setEnabled, getState };
