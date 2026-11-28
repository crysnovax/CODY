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

        const candidates = []
        const addCand = (c) => { c = (c || '').trim(); if (c && !candidates.includes(c)) candidates.push(c) }
        addCand(searchQuery)
        addCand(lines[0])
        addCand(searchQuery + ', Uyo, Akwa Ibom, Nigeria')
        addCand(lines[0] + ', Uyo, Nigeria')
        addCand(lines[0] + ', Akwa Ibom, Nigeria')
        addCand(query.replace(/permanent site/i, '').trim())
        addCand(query.replace(/obio etoi/i, '').trim())
        addCand('University of Uyo')
        if (searchQuery.toLowerCase().includes('akpabio')) addCand('Akpabio International Stadium Uyo')
        if (searchQuery.toLowerCase().includes('university of uyo')) addCand('University of Uyo')

        const searchOne = async (q) => {
            try {
                const r1 = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, { headers: { 'User-Agent': 'CRYSNOVA-Bot/1.0', 'Accept': 'application/json' } })
                const d1 = await r1.json()
                if (d1 && d1.length) return { lat: parseFloat(d1[0].lat), lon: parseFloat(d1[0].lon), display: d1[0].display_name }
            } catch (e) {}
            try {
                const r2 = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`)
                const d2 = await r2.json()
                if (d2 && d2.features && d2.features.length) {
                    const f = d2.features[0]
                    return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], display: f.properties.name + ', ' + (f.properties.city || '') }
                }
            } catch (e) {}
            return null
        }

        await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } })
        try {
            let found = null
            for (const c of candidates) {
                found = await searchOne(c)
                if (found) break
            }
            if (!found) {
                const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } })
                return reply(`\`✘ No exact coords in OSM for "${searchQuery}"\`\nBut e dey for Google Maps — open am here:\n${gmaps}`)
            }
            const place = found
            const lat = place.lat
            const lon = place.lon
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
