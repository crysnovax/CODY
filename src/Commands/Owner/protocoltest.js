'use strict';

// Temporary, owner-only diagnostics for a disposable test chat.
// This intentionally uses only the normal plogme send/edit/revoke APIs.
const { proto } = require('plogme');

const targets = new Map();
const pendingCapture = new Map();

function summarize(value, event) {
  const message = value?.message || value?.update?.message || value;
  const protocol = message?.protocolMessage || value?.update?.protocolMessage;
  const edited = protocol?.editedMessage || message?.editedMessage || value?.update?.message?.editedMessage;
  const key = protocol?.key || value?.key || value?.update?.key;
  return {
    event,
    key: key ? {
      remoteJid: key.remoteJid,
      fromMe: key.fromMe,
      id: key.id,
      participant: key.participant,
      participantAlt: key.participantAlt,
    } : undefined,
    protocolType: protocol?.type,
    protocolTypeName: protocol?.type != null ? Object.keys(proto.Message.ProtocolMessage.Type)
      .find(name => proto.Message.ProtocolMessage.Type[name] === protocol.type) : undefined,
    hasEditedMessage: !!edited,
    hasRevoke: protocol?.type === proto.Message.ProtocolMessage.Type.REVOKE || value?.update?.message === null,
    messageStubType: value?.update?.messageStubType ?? value?.messageStubType,
    updateKeys: value?.update ? Object.keys(value.update) : undefined,
  };
}

function capture(sock, chat, targetId, timeoutMs = 12000) {
  const old = pendingCapture.get(chat);
  if (old) old.finish();

  let timer;
  let done = false;
  const result = [];
  const finish = () => {
    if (done) return result;
    done = true;
    clearTimeout(timer);
    sock.ev.off('messages.upsert', onUpsert);
    sock.ev.off('messages.update', onUpdate);
    sock.ev.off('messages.delete', onDelete);
    pendingCapture.delete(chat);
    return result;
  };
  const collect = (value, event) => {
    const item = summarize(value, event);
    if (item.key?.id === targetId || item.key?.id == null || item.protocolType != null) result.push(item);
  };
  const onUpsert = payload => (payload?.messages || []).forEach(value => collect(value, 'messages.upsert'));
  const onUpdate = values => (Array.isArray(values) ? values : []).forEach(value => collect(value, 'messages.update'));
  const onDelete = payload => (Array.isArray(payload) ? payload : (payload?.keys || [])).forEach(value => collect({ key: value }, 'messages.delete'));
  sock.ev.on('messages.upsert', onUpsert);
  sock.ev.on('messages.update', onUpdate);
  sock.ev.on('messages.delete', onDelete);
  timer = setTimeout(finish, timeoutMs);
  pendingCapture.set(chat, { finish });
  return { finish, result };
}

function formatKey(key) {
  return JSON.stringify({
    remoteJid: key?.remoteJid,
    fromMe: key?.fromMe,
    id: key?.id,
    participant: key?.participant,
    participantAlt: key?.participantAlt,
  }, null, 2);
}

function formatEvents(events) {
  if (!events.length) return 'No matching raw event arrived before the timeout.';
  return events.map((event, index) => `Event ${index + 1}:\n${JSON.stringify(event, null, 2)}`).join('\n\n');
}

module.exports = {
  name: 'protocoltest',
  alias: ['prototest', 'watrace'],
  category: 'owner',
  owner: true,
  desc: 'Safely compare normal WhatsApp edit and revoke events in a disposable chat',
  usage: '.protocoltest send | edit | revoke | status | reset',

  execute: async (sock, m, { args, reply }) => {
    const action = (args[0] || 'status').toLowerCase();
    const chat = m.chat;

    if (action === 'status') {
      const key = targets.get(chat);
      return reply(key
        ? `Protocol test target saved:\n\n${formatKey(key)}\n\nNext: .protocoltest edit or .protocoltest revoke`
        : 'No test target saved in this chat. Run .protocoltest send first.');
    }

    if (action === 'reset') {
      targets.delete(chat);
      const pending = pendingCapture.get(chat);
      if (pending) pending.finish();
      return reply('Protocol test state reset for this chat.');
    }

    if (action === 'send') {
      const marker = `CODY-PROTOCOL-TEST ${Date.now()}`;
      const sent = await sock.sendMessage(chat, { text: marker });
      if (!sent?.key?.id) return reply('Could not obtain the test message key.');
      targets.set(chat, sent.key);
      return reply(`Baseline message sent.\n\nTarget key:\n${formatKey(sent.key)}\n\nNow run .protocoltest edit or .protocoltest revoke in this same disposable chat.`);
    }

    const target = targets.get(chat);
    if (!target?.id) return reply('Run .protocoltest send first in this disposable chat.');

    if (action === 'edit') {
      const listener = capture(sock, chat, target.id);
      await sock.sendMessage(chat, { text: `CODY-PROTOCOL-EDIT ${Date.now()}`, edit: target });
      await new Promise(resolve => setTimeout(resolve, 1500));
      const events = listener.finish();
      return reply(`Normal MESSAGE_EDIT test completed.\n\nExpected protocol type: ${proto.Message.ProtocolMessage.Type.MESSAGE_EDIT}\n\n${formatEvents(events)}`);
    }

    if (action === 'revoke' || action === 'delete') {
      const listener = capture(sock, chat, target.id);
      await sock.sendMessage(chat, { delete: target });
      await new Promise(resolve => setTimeout(resolve, 1500));
      const events = listener.finish();
      return reply(`Normal REVOKE test completed.\n\nExpected protocol type: ${proto.Message.ProtocolMessage.Type.REVOKE}\n\n${formatEvents(events)}`);
    }

    return reply('Usage: .protocoltest send | edit | revoke | status | reset');
  },
};

module.exports.capture = capture;
module.exports.summarize = summarize;
