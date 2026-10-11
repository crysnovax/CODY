'use strict';

function canRunBroadcast(m, context = {}) {
    if (m?.isGroup) return Boolean(context.isAdmin || context.isGroupAdmin);
    return Boolean(context.isOwner || context.isDual);
}

function broadcastAccessMessage(m) {
    return m?.isGroup
        ? 'Only a group admin can use this broadcast command here.'
        : 'Only the bot owner can run this all-groups command from a private chat.';
}

module.exports = { canRunBroadcast, broadcastAccessMessage };
