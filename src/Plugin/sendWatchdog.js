'use strict'

const WINDOW_MS = 10 * 60 * 1000
const TRIP_AFTER = 3
const TIMEOUT_PATTERN = /Timed Out|Connection Closed|Socket closed|Session closed|Connection terminated/i
const INSTALLED = Symbol.for('cody.sendWatchdogInstalled')

function isTimeout(error) {
  return TIMEOUT_PATTERN.test(String(error?.message || error || ''))
}

function installSendWatchdog(sock, { warn = console.error } = {}) {
  if (!sock || typeof sock.sendMessage !== 'function' || sock[INSTALLED]) return false

  const sendMessage = sock.sendMessage.bind(sock)
  const openedAt = Date.now()
  let successes = 0
  let failures = []
  let tripped = false

  sock.sendMessage = async (jid, content, options) => {
    try {
      const result = await sendMessage(jid, content, options)
      successes += 1
      failures = []
      return result
    } catch (error) {
      if (isTimeout(error)) {
        const now = Date.now()
        failures = failures.filter(at => now - at < WINDOW_MS)
        failures.push(now)
        const uptime = Math.round((now - openedAt) / 1000)
        warn(`[SEND FAIL] ${String(error?.message || error)} uptime=${uptime}s successes=${successes}`)
        if (failures.length >= TRIP_AFTER && !tripped) {
          tripped = true
          warn(`[WATCHDOG] ${TRIP_AFTER} send timeouts in ${WINDOW_MS / 60000} min, restarting socket`)
          try {
            sock.end(new Error('send watchdog'))
          } catch (endError) {
            warn('[WATCHDOG] end() failed:', endError?.message || endError)
          }
        }
      }
      throw error
    }
  }

  Object.defineProperty(sock, INSTALLED, { value: true })
  return true
}

module.exports = { installSendWatchdog, isTimeout }
