const axios = require('axios')

module.exports = {
    name: 'wss',
    alias: ['wssp','wsstab','wssfull','wssmobile','wssweb'],
    category: 'Tools',
    desc: 'Capture website screenshot',

    execute: async (sock, m, { args, reply }) => {
        try {

            const cmd = m.body.toLowerCase().split(/\s+/)[0].slice(1)

            // Collect all text sources
            const sources = [
                args.join(' '),
                m.quoted?.body || '',
                m.quoted?.text || '',
                m.quoted?.caption || ''
            ].join(' ').trim()

            if (!sources.trim()) return reply('*_✘ Add a link*_')

            // Extract ALL urls
            const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*)/g
            const rawMatches = sources.match(urlRegex) || []

            // Normalize — prepend https:// to bare domains
            const urls = [...new Set(
                rawMatches.map(u => !/^https?:\/\//i.test(u) ? 'https://' + u : u)
            )]

            if (!urls.length) return reply('_*𓄄 No valid urls found*_')

            await sock.sendMessage(m.chat, { react: { text: '📸', key: m.key } })

            let device = 'desktop'
            if (cmd === 'wssp' || cmd === 'wssmobile') device = 'phone'
            if (cmd === 'wsstab')  device = 'tablet'
            if (cmd === 'wssfull') device = 'full'

            // Screenshot each url
            for (const targetUrl of urls) {
                try {
                    const endpoints = [
                        `https://snapshot.xwolf.space/api/capture?siteUrl=${encodeURIComponent(targetUrl)}&device=${device}`,
                        `https://api-rebix.zone.id/api/ssweb?url=${encodeURIComponent(targetUrl)}&device=${device}`
                    ]
                    let response
                    let lastError
                    for (const api of endpoints) {
                        try {
                            const candidate = await axios.get(api, {
                                responseType: 'arraybuffer',
                                timeout: 30000,
                                validateStatus: status => status >= 200 && status < 300
                            })
                            const contentType = String(candidate.headers['content-type'] || '').toLowerCase()
                            if (!contentType.includes('image')) throw new Error(`Unexpected response type: ${contentType || 'unknown'}`)
                            response = candidate
                            break
                        } catch (error) {
                            lastError = error
                        }
                    }
                    if (!response) throw lastError || new Error('Screenshot service unavailable')
                    const buffer = Buffer.from(response.data)

                    await sock.sendMessage(m.chat, { image: buffer }, { quoted: m })
                } catch (err) {
                    await reply(`_*𓄄 Failed for:*_ ${targetUrl}`)
                }
            }

        } catch (err) {
            console.log(err.message)
            reply('_*✘ error*_')
        }
    }
}
