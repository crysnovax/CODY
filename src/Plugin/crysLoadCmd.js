const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');

const { addCommand, clearRegistry } = require('./crysCmd');

/* Folder name is the single source of truth for a command's category.
 * Many command files carry stale metadata (e.g. Admin/antigm.js declaring
 * "Tools"), which scattered commands across unrelated menu sections. The
 * loader now overrides cmd.category with the folder it was loaded from.
 * Folders whose names aren't display-worthy are remapped here — keys are
 * folder names stripped to [a-z0-9] so unicode filenames match reliably. */
const normalizeFolderKey = (name) =>
    String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const CATEGORY_OVERRIDES = {
    // "B×͜×☠︎︎" normalizes to "b" — exploit/bug commands, group them under Bug
    'b': 'Bug',
    // "Business WhatsApp" folder -> Business
    'businesswhatsapp': 'Business',
};

const resolveFolderCategory = (folder) =>
    CATEGORY_OVERRIDES[normalizeFolderKey(folder)] || folder;

const loadCommands = () => {

    // Initialize global prefix before loading commands so ${prefix} in usage fields works
    const { getVar } = require('./configManager');
    global.prefix = getVar('PREFIX', '.');

    clearRegistry();

    const cmdPath = path.join(__dirname, '../Commands');

    if (!fs.existsSync(cmdPath)) {
        console.log(chalk.red('❌ Commands folder not found'));
        return 0;
    }

    const loadedFiles = new Set();
    let total = 0;

    const categories = fs.readdirSync(cmdPath);

    for (const cat of categories) {

        const catPath = path.join(cmdPath, cat);

        if (!fs.statSync(catPath).isDirectory()) continue;

        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));

        for (const file of files) {

            try {

                const filePath     = path.join(catPath, file);
                const resolvedPath = require.resolve(filePath);

                if (loadedFiles.has(resolvedPath)) continue;
                loadedFiles.add(resolvedPath);

                delete require.cache[resolvedPath];

                const cmdModule = require(filePath);

                // ✅ Support both single object and array of commands
                const commandsArray = Array.isArray(cmdModule) ? cmdModule : [cmdModule];

                for (const cmd of commandsArray) {
                    if (!cmd || typeof cmd !== 'object') {
                        throw new TypeError('command export must be an object or array of objects');
                    }
             //       if (typeof cmd.name !== 'string' || !cmd.name.trim()) {
                 //       throw new TypeError('command is missing a valid name');
             //       }
               //     if (typeof cmd.execute !== 'function') {
                 //       throw new TypeError(`command "${cmd.name}" is missing execute()`);
          //          }
                    // Folder wins: stale in-file categories must not scatter the menu
                    cmd.category = resolveFolderCategory(cat);
                    if (addCommand(cmd)) total++;
                }

            } catch (err) {
                console.log(chalk.red(`[CMD ERROR] ${file}: ${err.message}`));
            }
        }
    }

    console.log(chalk.green(`✅ Loaded ${total} commands`));

    return total;
};

module.exports = { loadCommands };
