'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { installSendWatchdog } = require('../src/Plugin/sendWatchdog')

function makeSocket(sendMessage = async () => 'sent') {
  return {
    sendMessage,
    endCalls: [],
    end(error) {
      this.endCalls.push(error)
    }
  }
}

function timeout() {
  return new Error('Connection Closed')
}

async function rejectedSend(sock, error) {
  await assert.rejects(sock.sendMessage('jid', { text: 'hello' }), error)
}

test('three timeout errors trip sock.end exactly once', async () => {
  const sock = makeSocket(async () => { throw timeout() })
  installSendWatchdog(sock, { warn() {} })

  await rejectedSend(sock, /Connection Closed/)
  await rejectedSend(sock, /Connection Closed/)
  await rejectedSend(sock, /Connection Closed/)
  await rejectedSend(sock, /Connection Closed/)

  assert.equal(sock.endCalls.length, 1)
  assert.equal(sock.endCalls[0].message, 'send watchdog')
})

test('a successful send resets the timeout count', async () => {
  let shouldFail = true
  const sock = makeSocket(async () => {
    if (shouldFail) throw timeout()
    return 'sent'
  })
  installSendWatchdog(sock, { warn() {} })

  await rejectedSend(sock, /Connection Closed/)
  await rejectedSend(sock, /Connection Closed/)
  shouldFail = false
  assert.equal(await sock.sendMessage('jid', { text: 'hello' }), 'sent')
  shouldFail = true
  await rejectedSend(sock, /Connection Closed/)
  await rejectedSend(sock, /Connection Closed/)

  assert.equal(sock.endCalls.length, 0)
})

test('rate-overlimit errors never trip the watchdog', async () => {
  const sock = makeSocket(async () => { throw new Error('rate-overlimit') })
  installSendWatchdog(sock, { warn() {} })

  await rejectedSend(sock, /rate-overlimit/)
  await rejectedSend(sock, /rate-overlimit/)
  await rejectedSend(sock, /rate-overlimit/)

  assert.equal(sock.endCalls.length, 0)
})

test('installing twice is a no-op', async () => {
  const sock = makeSocket()
  assert.equal(installSendWatchdog(sock, { warn() {} }), true)
  const wrapped = sock.sendMessage
  assert.equal(installSendWatchdog(sock, { warn() {} }), false)
  assert.equal(sock.sendMessage, wrapped)
  assert.equal(await sock.sendMessage('jid', { text: 'hello' }), 'sent')
})
