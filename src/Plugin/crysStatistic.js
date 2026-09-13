/**
 * CRYSNOVA AI V2.0 - Statistics (Kord-style)
 */

const crysStatistic = (app, io) => {
    app.get('/api/stats', (req, res) => {
        res.json(global.crysStats || {});
    });

    app.get('/api/commands', (req, res) => {
        const { getByCategory } = require('./crysCmd');
        res.json(getByCategory());
    });

    setInterval(() => {
        if (global.crysStats) {
            global.crysStats.uptime = Math.floor((Date.now() - global.crysStats.startTime) / 1000);
            io.emit('stats-update', global.crysStats);
        }
    }, 5000).unref?.();
};

module.exports = { crysStatistic };
