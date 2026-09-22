const fs = require('fs');
const path = require('path');

const RUNTIME_FILE = path.join(__dirname, '../../database/runtime-config.json');

let runtime = {};

/* Load runtime config */
const load = () => {
    try {
        fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true });

        if (fs.existsSync(RUNTIME_FILE)) {
            runtime = JSON.parse(
                fs.readFileSync(RUNTIME_FILE, 'utf8')
            );
        } else {
            runtime = {};
            save();
        }
    } catch {
        runtime = {};
    }
};

/* Save runtime config */
const save = () => {
    try {
        fs.writeFileSync(
            RUNTIME_FILE,
            JSON.stringify(runtime, null, 2)
        );
    } catch (e) {
        console.error('configManager save error:', e.message);
    }
};

/* Set variable */
const setVar = (key, value) => {

    let v = value;

    if (value === 'true') v = true;
    else if (value === 'false') v = false;
    else if (!isNaN(value) && value !== '') v = Number(value);

    runtime[key] = v;
    save();

    // Configuration modules read runtime values through getVar. Do not evict
    // arbitrary dependencies whose path happens to contain "config".
    return v;
};

/* Get variable */
const getVar = (key, fallback = null) => {
    if (!runtime) load();

    // Runtime (`.setvar`) always wins — it is the user's in-bot change and must
    // never be re-overridden by the environment.
    if (Object.prototype.hasOwnProperty.call(runtime, key)) return runtime[key];

    // PREFIX special case: PREFIX is read as `getVar('PREFIX', '.')` all over
    // the bot, so a PREFIX provided by `.env`/the deploy script used to be
    // replaced by '.' in those call sites and appeared to be ignored. Returning
    // the env value here fixes every caller at once. A PREFIX='' or 'null' in
    // .env still means "no prefix mode". (@crysnovax—FIX22-09-26)
    if (key === 'PREFIX') {
        const envPrefix = process.env.PREFIX;
        if (envPrefix !== undefined && envPrefix !== null) {
            return (envPrefix === 'null' || envPrefix === '') ? '' : String(envPrefix);
        }
    }

    return fallback;
};

/*
 * Resolve the command prefix everywhere the same way.
 *
 * Precedence is runtime (`.setvar PREFIX`) → `.env`/process env → '.'. The
 * deploy value therefore applies from the first start, while any later change
 * made inside the bot keeps winning — the environment never re-overrides it.
 * (The router previously read ONLY the runtime value with a hard '.' default,
 * so a PREFIX set in .env was ignored for command dispatch entirely.)
 * Returned value is '' for no-prefix mode (PREFIX empty or "null").
 * (@crysnovax—FIX22-09-26)
 */
const resolvePrefix = () => {
    const raw = getVar('PREFIX', '.');
    if (raw === undefined || raw === null) return '.';
    return (raw === 'null' || raw === '') ? '' : String(raw);
};

/* Delete variable */
const delVar = (key) => {
    if (runtime && runtime.hasOwnProperty(key)) {
        delete runtime[key];
        save();
        return true;
    }
    return false;
};

/* Get all variables */
const allVars = () => {
    if (!runtime) load();
    return { ...runtime };
};

/* Reset all variables */
const resetAll = () => {
    runtime = {};
    save();
};

load();

module.exports = {
    setVar,
    getVar,
    delVar,
    allVars,
    resetAll,
    resolvePrefix
};
