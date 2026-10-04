const MISSING_APP_STATE_KEY = /(?:app state key not present|myAppStateKey|app-state-sync-key)/i;

const isMissingAppStateKeyError = (error) =>
    Boolean(error?.data?.isMissingKey) || MISSING_APP_STATE_KEY.test(String(error?.message || error));

const waitForAppStateKey = (sock, timeoutMs = 10000) => {
    const emitter = sock?.ev;
    if (!emitter?.on) return Promise.resolve(false);

    return new Promise(resolve => {
        let timer;
        const finish = received => {
            clearTimeout(timer);
            emitter.off?.('creds.update', onUpdate);
            resolve(received);
        };
        const onUpdate = update => {
            if (update?.myAppStateKeyId) finish(true);
        };
        emitter.on('creds.update', onUpdate);
        timer = setTimeout(() => finish(false), timeoutMs);
    });
};

/**
 * Run an app-state operation and recover once when an older session has not
 * received its app-state key yet. The socket emits the key while resyncing;
 * retrying the original operation then lets commands work without re-pairing.
 */
const withAppStateRecovery = async (sock, operation) => {
    try {
        return await operation();
    } catch (error) {
        if (!isMissingAppStateKeyError(error) || typeof sock?.resyncAppState !== 'function') {
            throw error;
        }

        try {
            // Listen before requesting the snapshot so a key-share event
            // emitted during resync cannot be missed.
            const keyArrival = waitForAppStateKey(sock);
            await sock.resyncAppState(['regular_high', 'regular_low', 'regular'], true);
            await Promise.race([
                keyArrival,
                new Promise(resolve => setTimeout(resolve, 2500))
            ]);
        } catch (_) {
            // Preserve the actionable original error if the recovery request
            // itself cannot complete (for example, while the socket is offline).
        }

        return operation();
    }
};

module.exports = { isMissingAppStateKeyError, withAppStateRecovery };
