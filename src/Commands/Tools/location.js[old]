module.exports = {
    name: 'location',
    alias: ['loc', 'mylocation', 'whereami', 'shareloc'],
    desc: 'Share your current location or find a place',
    category: 'Tools',
    usage: '.location | .location <place name>',

    execute: async (sock, m, { args, reply, prefix }) => {
        const query = args.join(' ').trim();

        // If no query, share the user's current location using WhatsApp's live location
        if (!query) {
            // We need coordinates - for demo, we'll use a fixed location
            // In a real bot, you'd get this from the user's message or request it
            const demoLocation = {
                degreesLatitude: 6.5244,
                degreesLongitude: 3.3792,
                name: '📍 My Location'
            };

            try {
                await sock.sendMessage(m.chat, {
                    location: demoLocation
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '📍', key: m.key } });
                return;
            } catch (err) {
                return reply('`✘ Failed to send location`');
            }
        }

        // Search for a place
        await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

        try {
            // Use OpenStreetMap Nominatim API
            const encodedQuery = encodeURIComponent(query);
            const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5`;
            
            const axios = require('axios');
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'CRYSNOVA-Bot/1.0',
                    'Accept': 'application/json'
                },
                timeout: 15000
            });

            const results = response.data;

            if (!results || results.length === 0) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`\`✘ No location found for "${query}"\``);
            }

            // Send up to 3 locations
            const count = Math.min(results.length, 3);
            
            for (let i = 0; i < count; i++) {
                const place = results[i];
                const lat = parseFloat(place.lat);
                const lon = parseFloat(place.lon);
                const name = place.display_name || query;
                const shortName = name.length > 100 ? name.substring(0, 97) + '...' : name;

                await sock.sendMessage(m.chat, {
                    location: {
                        degreesLatitude: lat,
                        degreesLongitude: lon,
                        name: `📍 ${shortName}`
                    }
                }, { quoted: i === 0 ? m : undefined });

                // Small delay between locations
                if (i < count - 1) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (err) {
            console.error('[LOCATION ERROR]', err.message);
            await sock.sendMessage(m.chat, { react: { text: '💤', key: m.key } });
            reply('`✘ Failed to search location`');
        }
    }
};
