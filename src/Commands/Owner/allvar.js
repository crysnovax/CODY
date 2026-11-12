const { allVars } = require('../../Plugin/configManager')

module.exports = {
    name: 'allvar',
    alias: ['listvars', 'vars'],
    desc: 'List all runtime variables',
    category: 'Owner',
    ownerOnly: true,
    // ⭐ Reaction config
    reactions: {
        start: '❇',
        success: '❔'
    },

    execute: async (sock, m, { reply, prefix }) => {
        const runtime = allVars()
        const keys = Object.keys(runtime)
        if (!keys.length) {
            return reply(`${prefix}📋 *No runtime variables set yet*\n\n*Usage:* setvar VARIABLE=VALUE`)
        }
        const entries = keys.map(k => `• ${k} = ${runtime[k]}`).join('\n')
        await reply(`${prefix}⚙️ *Runtime Variables (${keys.length})*\n\n${entries}\n\n_Use .delvar VARIABLE to reset to default_`)
    }
}
