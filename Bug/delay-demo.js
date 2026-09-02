'use strict';

/**
 * Safe local demonstration of the delayed payload shape.
 * This module deliberately does not evaluate embedded markup or send messages.
 */
async function delayDemo(target, delayMs = 10_000) {
  const crypto = require('crypto');
  const em = {
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          unifiedResponse: {
            data: Buffer.from(JSON.stringify({
              __typename: 'GenAIUnifiedResponse',
              response_id: crypto.randomUUID(),
              sections: [{
                __typename: 'GenAIUnifiedResponseSection',
                view_model: {
                  __typename: 'GenAISingleLayoutViewModel',
                  primitive: {
                    __typename: 'FOAHtmlPrimitiveDemoDONOTUSE',
                    trusted_sources: [],
                    payload: '<p>Safe local demonstration payload</p>'
                  }
                }
              }]
            })).toString('base64')
          },
          contextInfo: { isForwarded: true, forwardOrigin: 4 }
        }
      }
    }
  };

  await new Promise(resolve => setTimeout(resolve, delayMs));
  return { target, payload: em, sent: false };
}

module.exports = { delayDemo };
