/**
 * CRYSNOVA AI V2 – Entry Point
 * 🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖
 */

// ── DATABASE REDIRECT (Cloudflare KV on Render, local otherwise) ──
require('./redirect.js');
// ─────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// -------------------------------------------------------------------
// 1. Check if auto‑update is enabled
// -------------------------------------------------------------------
const CONFIG_PATH = path.join(process.cwd(), 'database', 'autoupdate.json');
let autoUpdateEnabled = false;

try {
    if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        autoUpdateEnabled = config.enabled === true;
    }
} catch (err) {
    console.error(chalk.red('[AUTO-UPDATE] Failed to read config:'), err.message);
}

// -------------------------------------------------------------------
// 2. Start Panel Connector API FIRST
// -------------------------------------------------------------------
try {
    require('./☁︎.js');
} catch (e) {
    console.error(chalk.red('🔌 [PANEL API] Failed:'), e.message);
}

// -------------------------------------------------------------------
// 3. Register with Cody Worker (silent)
// -------------------------------------------------------------------
const CODY_API_KEY = process.env.CODY_API_KEY || '';

if (CODY_API_KEY) {
    const axios = require('axios');
    axios.post('https://cody.crysnovax.link/register', {
        name: 'crysnova',
        url: `http://localhost:${process.env.PANEL_API_PORT || 9000}`,
        api_key: CODY_API_KEY
    }).then(() => console.log(chalk.green('✅ Registered with Cody Worker')))
      .catch(() => console.log(chalk.yellow('⚠️ Cody Worker registration failed.')));
} else {
    console.log(chalk.gray('ℹ️ Cody Worker registration skipped (no API key)'));
}

// -------------------------------------------------------------------
// 4. If enabled, run the update and WAIT for it to finish
// -------------------------------------------------------------------
(async () => {
    if (autoUpdateEnabled) {
        console.log(chalk.yellow('𝌆  updating...ⓘ'));
        console.log(chalk.cyan('🔖 [CRYSNOVA] —͟͟͞͞𖣘❚ Starting update (blocking startup)...'));

        const { performUpdate } = require('./src/Plugin/updater.js');

        try {
            const result = await performUpdate({ notifyOwner: null });
            if (result.success) {
                console.log(chalk.green('✓ [CRYSNOVA] Background update completed successfully.'));
                console.log(chalk.cyan('🔖 [CRYSNOVA] —͟͟͞͞𖣘❚ Changes applied.'));
            } else {
                console.log(chalk.red('✘ [CRYSNOVA] Background update failed:'), result.error);
            }
        } catch (err) {
            console.error(chalk.red('✘ [CRYSNOVA] Background update error:'), err);
        }
    } else {
        console.log(chalk.gray('ⓘ Auto‑update is disabled. Skipping.'));
    }

    // -------------------------------------------------------------------
    // 5. Load and start the main bot
    // -------------------------------------------------------------------
    console.log(chalk.cyan('🔖 [CRYSNOVA] —͟͟͞͞𖣘❚ Loading main bot...'));
    require('./⚉.js');
})();

//🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖🔖
