const crypto = require('crypto');
const { generateWAMessageFromContent } = require('plogme');

/**
 * Sends an HTML payload through the FOAHtmlPrimitiveDemoDONOTUSE rich-response
 * primitive. This is the same envelope as your htmlGoon() / slots.js — pulled
 * into one place so every game file doesn't repeat the same ~25 lines of
 * boilerplate. Behavior is unchanged; this is a refactor, not a new payload shape.
 *
 * @param {import('@crysnovax/baileys').WASocket} sock
 * @param {string} jid
 * @param {string} html
 */
async function sendHtmlPrimitive(sock, jid, html) {
    const msg = generateWAMessageFromContent(jid, {
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    unifiedResponse: {
                        data: Buffer.from(
                            JSON.stringify({
                                __typename: 'GenAIUnifiedResponse',
                                response_id: crypto.randomUUID(),
                                sections: [
                                    {
                                        __typename: 'GenAIUnifiedResponseSection',
                                        view_model: {
                                            __typename: 'GenAISingleLayoutViewModel',
                                            primitive: {
                                                __typename: 'FOAHtmlPrimitiveDemoDONOTUSE',
                                                trusted_sources: [],
                                                payload: html.trim()
                                            }
                                        }
                                    }
                                ]
                            })
                        ).toString('base64')
                    },
                    contextInfo: {
                        isForwarded: true,
                        forwardOrigin: 4
                    }
                }
            }
        }
    }, {});

    return sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
}

module.exports = { sendHtmlPrimitive };
