'use strict';

const { createSocket, hasLocalSession } = require('../library/connection/connection');
const { DisconnectReason } = require('plogme');

const phone = String(process.env.PAIRING_PHONE || '').replace(/\D/g, '');
if (!/^\d{8,15}$/.test(phone)) {
  console.error('PAIRING_ERROR: invalid international phone number');
  process.exit(2);
}

(async () => {
  const { sock, saveCreds, state } = await createSocket('');
  sock.ev.on('creds.update', saveCreds);
  let finished = false;
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open' && !finished) {
      finished = true;
      console.log('CODYMINI_PAIRING_CONNECTED');
      setTimeout(() => process.exit(0), 750);
    }
    if (connection === 'close' && !finished) {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.error(`PAIRING_ERROR: connection closed (${code || 'unknown'})`);
      process.exit(1);
    }
  });
  if (state.creds.registered || hasLocalSession()) {
    console.log('CODYMINI_PAIRING_ALREADY_REGISTERED');
    setTimeout(() => process.exit(0), 750);
    return;
  }
  await new Promise(resolve => setTimeout(resolve, 800));
  const code = await sock.requestPairingCode(phone);
  console.log(`CODYMINI_PAIRING_CODE:${code}`);
})().catch(error => {
  console.error(`PAIRING_ERROR: ${error?.message || error}`);
  process.exit(1);
});
