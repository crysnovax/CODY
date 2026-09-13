const registry = new Map();

/* First-come-first-served fallback key: "story" -> "story2" -> "story3" ...
 * Two commands (or a name and another command's alias) must never silently
 * cancel each other out. Previously a colliding NAME dropped the whole command
 * (it stayed unreachable forever) and a colliding ALIAS was silently ignored.
 * Now the newcomer is registered under a suffixed name/alias instead, so both
 * commands keep working. The winner is untouched, so nothing that already
 * worked can regress. */
const resolveFreeKey = (base) => {
    if (!registry.has(base)) return base;
    let suffix = 2;
    while (registry.has(`${base}${suffix}`)) suffix++;
    return `${base}${suffix}`;
};

/* Add command (Singleton Safe) */
const addCommand = (cmd) => {
    if (!cmd?.name || typeof cmd.execute !== 'function') return false;

    const name = cmd.name.toLowerCase();

    if (registry.has(name)) {
        const fallback = resolveFreeKey(name);
        console.warn(`[CMD COLLISION] name "${name}" already registered; loading ${cmd.name} as "${fallback}"`);
        registry.set(fallback, cmd);
    } else {
        registry.set(name, cmd);
    }

    // Register aliases safely
    if (Array.isArray(cmd.alias)) {
        for (const a of cmd.alias) {
            if (typeof a !== 'string' || !a.trim()) continue;
            const alias = a.toLowerCase();

            if (!registry.has(alias)) {
                registry.set(alias, cmd);
            } else if (registry.get(alias) !== cmd) {
                const fallback = resolveFreeKey(alias);
                console.warn(`[CMD COLLISION] alias "${alias}" for "${name}" already registered; adding "${fallback}"`);
                registry.set(fallback, cmd);
            }
        }
    }

    return true;
};

/* Register external/dynamic command (public API for plugins) */
const registerCommand = (cmd) => {
    if (!cmd?.name) return false;

    const name = cmd.name.toLowerCase();

    // Allow overwriting for plugin updates
    registry.set(name, cmd);

    // Register aliases
    if (Array.isArray(cmd.alias)) {
        for (const a of cmd.alias) {
            const alias = a.toLowerCase();
            registry.set(alias, cmd);
        }
    }

    return true;
};

/* Clear registry */
const clearRegistry = () => registry.clear();

/* Get command */
const getCommand = (name) =>
    registry.get(name?.toLowerCase());

/* Get all commands */
const getAll = () => registry;

/* Category grouping */
const getByCategory = () => {
    const categories = {};

    for (const [, cmd] of registry) {
        if (cmd?.isAlias) continue;

        const cat = cmd.category || 'General';

        if (!categories[cat]) categories[cat] = [];

        categories[cat].push(cmd);
    }

    return categories;
};

module.exports = {
    addCommand,
    registerCommand,
    clearRegistry,
    getCommand,
    getAll,
    getByCategory
};
