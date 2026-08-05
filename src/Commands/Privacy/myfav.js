const fs = require('fs')
const path = require('path')

const FAV_FILE = path.join(__dirname, '..', '..', 'database', 'favorites.json')

const loadFavs = () => {
    try { return JSON.parse(fs.readFileSync(FAV_FILE, 'utf8')) } 
    catch { return [] }
}

const saveFavs = (favs) => {
    fs.mkdirSync(path.dirname(FAV_FILE), { recursive: true })
    fs.writeFileSync(FAV_FILE, JSON.stringify(favs, null, 2))
}

const normalizeJid = (jid) => {
    if (!jid.includes('@')) return `${jid}@s.whatsapp.net`
    return jid
}

module.exports = {
    name: 'myfavorite',
    alias: ['myfav', 'addmyfav'],
    desc: 'Add/Remove/List WhatsApp Favorites',
    category: 'Tools',

    reactions: {
        start: '⭐',
        success: '✨'
    },

    execute: async (sock, m, { reply, args, usedPrefix, command: cmdName , prefix}) => {
        try {
            const prefix = usedPrefix || '.'
            const command = cmdName || 'myfav'
            
            const subCmd = args[0]?.toLowerCase() || 'add'
            const isList = subCmd === 'list'
            const isRemove = subCmd === 'remove' || subCmd === 'rm' || subCmd === 'del' || subCmd === 'delete'
            const isAdd = subCmd === 'add' || !['list', 'remove', 'rm', 'del', 'delete'].includes(subCmd)

            // Shift args if subcommand was provided
            const targetArgs = isList ? [] : (isAdd || isRemove ? args.slice(1) : args)

            if (isList) {
                const favs = loadFavs()
                if (!favs.length) {
                    return reply(
`╭─❍ *FAVORITES*
│ ಥ⁠‿⁠ಥ No favorites saved
│
│ Use ${prefix}${command} add <jid>
│ or reply to a message
╰─ 𓄄`
                    )
                }
                const list = favs.map((jid, i) => `│ ${i + 1}. ${jid}`).join('\n')
                return reply(
`╭─❍ *FAVORITES* (${favs.length})
${list}
╰─ 𓄄`
                )
            }

            // Resolve target JID
            let target = targetArgs[0] || ''
            if (!target && !isRemove) {
                target = m.quoted?.sender || m.quoted?.key?.participant || ''
            }
            if (!target) {
                return reply(
`╭─❍ *FAVORITE*
│ ಥ⁠‿⁠ಥ Provide a JID or reply to a message
│
│ Usage:
│ • ${prefix}${command} add <jid>    — add to favorites
│ • ${prefix}${command} remove <jid> — remove from favorites
│ • ${prefix}${command} list         — show all favorites
╰─ 𓄄`
                )
            }

            target = normalizeJid(target)
            const existing = loadFavs()

            if (isAdd) {
                if (existing.includes(target)) {
                    return reply(
`╭─❍ *FAVORITES*
│ ( ͡° ʖ̯ ͡°) Already in favorites
│ ❏◦ JID · ${target}
╰─ 𓄄`
                    )
                }

                const merged = [...existing, target]
                await sock.addToFavorites(merged)
                saveFavs(merged)

                await sock.sendMessage(m.chat, { react: { text: '⭐', key: m.key } })

                return reply(
`╭─❍ *FAVORITES*
│ ( ͡❛ ₃ ͡❛) Added to favorites
│ ❏◦ JID   · ${target}
│ ❏◦ Total · ${merged.length}
╰─ 𓄄`
                )
            }

            if (isRemove) {
                if (!existing.includes(target)) {
                    return reply(
`╭─❍ *FAVORITES*
│ ( ͡° ʖ̯ ͡°) Not in favorites
│ ❏◦ JID · ${target}
╰─ 𓄄`
                    )
                }

                const remaining = existing.filter(jid => jid !== target)
                await sock.addToFavorites(remaining)
                saveFavs(remaining)

                await sock.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } })

                return reply(
`╭─❍ *FAVORITES*
│ ( ͡❛ ₃ ͡❛) Removed from favorites
│ ❏◦ JID   · ${target}
│ ❏◦ Total · ${remaining.length}
╰─ 𓄄`
                )
            }

        } catch (err) {
            console.error('FAVORITE ERROR:', err)
            reply(
`╭─❍ *ERROR*
│ ಠ_ಠ Failed: ${err.message}
╰─ 𓄄`
            )
        }
    }
}

