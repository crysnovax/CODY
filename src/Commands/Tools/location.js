module.exports = {
    name: 'location',
    alias: ['loc', 'locaton', 'mylocation', 'whereami'],
    desc: 'Share your current location or find a place',
    category: 'Tools',
    usage: '.location <place> | reply to address with .location',

    execute: async (sock, m, { args, reply, prefix }) => {
        const quotedText = (m.quoted && (m.quoted.text || m.quoted.caption || m.quoted.conversation)) ? (m.quoted.text || m.quoted.caption || m.quoted.conversation).trim() : ''
        let typed = args.join(' ').trim()
        let query = typed
        if (quotedText) {
            if (!query) query = quotedText
            else if (!quotedText.includes(query)) query = query + ' ' + quotedText
        }
        if (!query) {
            try {
                await sock.sendMessage(m.chat, { text: '📍 Send address or reply to an address message with .location' }, { quoted: m })
                return
            } catch (e) { return reply('`✘ Failed to request location`') }
        }

        if (query.toLowerCase() === 'live') {
            try {
                await sock.sendMessage(m.chat, { location: { degreesLatitude: 6.5244, degreesLongitude: 3.3792, accuracy: 10, speed: 0, degrees: 0, sequenceNumber: 1, timeOffset: 0, comment: '♲ Live location', address: 'Lagos, Nigeria' } }, { quoted: m })
         //       return reply('`📍 Live location sent`')
            } catch (e) { return reply('`✘ Failed to send live location`') }
        }

        const coord = query.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/)
        if (coord) {
            const lat = parseFloat(coord[1])
            const lon = parseFloat(coord[2])
            try {
                await sock.sendMessage(m.chat, { location: { degreesLatitude: lat, degreesLongitude: lon, name: 'ⓘ Custom location', address: `${lat}, ${lon}`, comment: `https://www.google.com/maps?q=${lat},${lon}` } }, { quoted: m })
                return
            } catch (e) { return reply('`✘ Failed to send location`') }
        }

        const lines = query.split('\n').map(s => s.trim()).filter(Boolean)
        const searchQuery = lines.join(', ')
        const customName = lines[0] || searchQuery
        const customAddress = lines.join(', ')

        await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
            const res = await fetch(url, { headers: { 'User-Agent': 'CRYSNOVA-Bot/1.0', 'Accept': 'application/json' } })
            const results = await res.json()
            if (!results || !results.length) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } })
                return reply(`\`✘ No location found for "${searchQuery}"\``)
            }
            const place = results[0]
            const lat = parseFloat(place.lat)
            const lon = parseFloat(place.lon)
            const name = customName.length > 100 ? customName.substring(0, 97) + '...' : customName
            await sock.sendMessage(m.chat, { location: { degreesLatitude: lat, degreesLongitude: lon, name: `♲ ${name}`, address: customAddress, comment: `${customAddress}\nhttps://www.google.com/maps?q=${lat},${lon}` } }, { quoted: m })
            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } })
        } catch (e) {
            console.error('[LOCATION ERROR]', e.message)
            await sock.sendMessage(m.chat, { react: { text: '💤', key: m.key } })
            reply('`✘ Failed to search location`')
        }
    }
}
