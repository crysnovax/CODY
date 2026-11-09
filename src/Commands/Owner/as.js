const saveStatus = require('./savestatus.js');

module.exports = {
    ...saveStatus,
    name: 'as',
    alias: [],
    desc: 'Shortcut for saving a quoted WhatsApp status',
    usage: '.as (reply to a status)',
    execute: (...args) => saveStatus.execute(...args)
};
