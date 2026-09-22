// autoApprove.js — group join requests get approved automatically after a
// delay (default 60s, adjustable), with an optional country-code filter.
// Vars: AUTO_APPROVE, AUTO_APPROVE_DELAY (seconds), AUTO_APPROVE_CC.
//
// FIX09-08-26 — rewritten for reliability:
//  • detects approval-mode groups by EITHER metadata field
//    (`joiningApprovalMode` OR `joinApprovalMode`)
//  • fetches the pending request list through `groupRequestParticipantsList`
//    (the same call the .approve command uses) instead of trusting the
//    sometimes-stale `pendingParticipants` in cached metadata
//  • approves through `groupRequestParticipantsUpdate` with a
//    `groupAcceptJoinRequest` fallback
//  • group list refreshes on `groups.upsert` events + periodic re-poll, and
//    instantly when `.autoadd on` runs
// @crysnovax—FIX06-08-26 / FIX09-08-26
const { getVar } = require('./configManager');

const pending = new Map(); // `${groupId}:${jid}` -> firstSeen timestamp
let interval = null;
let approvalGroups = []; // group metadata of groups with join-approval mode on
let tickCount = 0;
let sockRef = null;
// The socket is closed during a disconnect/reconnect. Polling it then threw on
// every tick and flooded the console with "[AUTO-APPROVE] refresh failed:
// Connection Closed" until the server was restarted. We now track the live
// connection state and stay quiet while it is down. (@crysnovax—FIX22-09-26)
let connected = false;
let consecutiveFailures = 0;

const isApprovalGroup = (g) =>
    !!g && (g.joiningApprovalMode === true || g.joinApprovalMode === true);

async function refreshApprovalGroups(sock) {
    try {
        if (!sock || !connected) return;
        if (typeof sock.groupFetchAllParticipating !== 'function') return;
        const groups = await sock.groupFetchAllParticipating();
        approvalGroups = Object.values(groups || {}).filter(isApprovalGroup);
        consecutiveFailures = 0;
    } catch (err) {
        consecutiveFailures++;
        // Report the first failure, then only every 10th one so a flapping
        // connection cannot fill the console. (@crysnovax—FIX22-09-26)
        if (consecutiveFailures === 1 || consecutiveFailures % 10 === 0) {
            console.error('[AUTO-APPROVE] refresh failed:', err.message);
        }
    }
}

// Pull the CURRENT pending request list for a group. This is the same method
// the .approve command relies on — much more reliable than metadata cache.
async function getPendingJids(sock, groupId) {
    try {
        if (typeof sock.groupRequestParticipantsList === 'function') {
            const list = await sock.groupRequestParticipantsList(groupId);
            if (Array.isArray(list)) return list.map(r => r?.jid).filter(Boolean);
        }
    } catch (err) {
        // fall back to metadata pendingParticipants below
    }
    try {
        const meta = await sock.groupMetadata(groupId).catch(() => null);
        const pend = meta?.pendingParticipants || [];
        if (Array.isArray(pend)) return pend.map(p => p?.id).filter(Boolean);
    } catch {}
    return [];
}

async function approveJid(sock, groupId, jid) {
    if (typeof sock.groupRequestParticipantsUpdate === 'function') {
        await sock.groupRequestParticipantsUpdate(groupId, [jid], 'approve');
        return true;
    }
    if (typeof sock.groupAcceptJoinRequest === 'function') {
        await sock.groupAcceptJoinRequest(groupId, jid);
        return true;
    }
    return false;
}

async function tick(sock) {
    try {
        if (!getVar('AUTO_APPROVE', false)) return;

        const delayMs = (parseInt(getVar('AUTO_APPROVE_DELAY', 60), 10) || 60) * 1000;
        const cc = String(getVar('AUTO_APPROVE_CC') || '').trim();
        const now = Date.now();

        for (const g of approvalGroups) {
            if (!g?.id) continue;

            const pend = await getPendingJids(sock, g.id);
            if (!pend.length) continue;

            for (const jid of pend) {
                if (!jid) continue;

                // country code filter, e.g. cc = "234" only approves +234 numbers
                if (cc) {
                    const num = jid.split('@')[0].replace(/\D/g, '');
                    if (!num.startsWith(cc)) {
                        pending.delete(`${g.id}:${jid}`);
                        continue;
                    }
                }

                const key = `${g.id}:${jid}`;
                if (!pending.has(key)) pending.set(key, now);

                if (now - pending.get(key) >= delayMs) {
                    try {
                        await approveJid(sock, g.id, jid);
                        console.log(`[AUTO-APPROVE] approved ${jid} in ${g.id}`);
                    } catch (err) {
                        console.error('[AUTO-APPROVE] approve failed:', err.message);
                    }
                    pending.delete(key);
                }
            }
        }

        // forget stale requests after 24h
        for (const [key, ts] of pending) {
            if (now - ts > 24 * 3600000) pending.delete(key);
        }
    } catch (err) {
        console.error('[AUTO-APPROVE] tick error:', err.message);
    }
}

function setupAutoApprove(sock) {
    // Always adopt the NEW socket: after a reconnect the old one is dead, and
    // the previous early-return left every interval bound to it.
    // (@crysnovax—FIX22-09-26)
    sockRef = sock;

    try {
        sock.ev?.on?.('connection.update', ({ connection } = {}) => {
            connected = connection === 'open';
            if (connected) { consecutiveFailures = 0; refreshApprovalGroups(sockRef); }
        });
    } catch {}
    // Best-effort initial state: an already-open socket reports 'open' again on
    // its next update, so also allow a refresh when the socket looks usable.
    if (sock?.user) connected = true;

    if (interval) return;

    refreshApprovalGroups(sockRef);
    console.log('[AUTO-APPROVE] started — polling join requests every 30s');

    interval = setInterval(() => {
        if (!connected) return;
        tickCount++;
        // refresh the group list every 10th tick (~5 minutes)
        if (tickCount % 10 === 0) refreshApprovalGroups(sockRef);
        tick(sockRef);
    }, 30000).unref?.();

    // refresh immediately when group metadata changes (new group / approval
    // toggled on) so we never wait up to 5 minutes
    try {
        sock.ev?.on?.('groups.upsert', () => refreshApprovalGroups(sockRef).catch(() => {}));
        sock.ev?.on?.('group-participants.update', () => {
            // a leave can remove a member from pending; just re-poll next tick
        });
    } catch {}
}

module.exports = { setupAutoApprove, refreshApprovalGroups };
