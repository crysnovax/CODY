const MISSING_APP_STATE_KEY = /(?:app state key not present|myAppStateKey|app-state-sync-key)/i;

const isMissingAppStateKeyError = (error) =>
    Boolean(error?.data?.isMissingKey) || MISSING_APP_STATE_KEY.test(String(error?.message || error));

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
            await sock.resyncAppState(['regular_high', 'regular_low', 'regular'], true);
            await new Promise(resolve => setTimeout(resolve, 1200));
        } catch (_) {
            // Preserve the actionable original error if the recovery request
            // itself cannot complete (for example, while the socket is offline).
        }

        return operation();
    }
};

module.exports = { isMissingAppStateKeyError, withAppStateRecovery };
