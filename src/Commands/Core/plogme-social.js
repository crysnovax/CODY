'use strict';

const MAX_CHATS = 200;
const DEFAULT_CONTRIBUTION_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_REACTION_COOLDOWN_MS = 20 * 1000;
const chats = new Map();

function bucket(chat) {
    const key = String(chat || '').trim();
    if (!key) return null;
    let state = chats.get(key);
    if (!state) {
        state = {
            reactionEnabled: true,
            contributionEnabled: true,
            contributionCooldownMs: DEFAULT_CONTRIBUTION_COOLDOWN_MS,
            reactionCooldownMs: DEFAULT_REACTION_COOLDOWN_MS,
            lastContributionAt: 0,
            lastReactionAt: 0,
            lastContributionTopic: '',
            lastContributionText: ''
        };
        chats.set(key, state);
        while (chats.size > MAX_CHATS) chats.delete(chats.keys().next().value);
    }
    return state;
}

function parseDuration(value, fallback = DEFAULT_CONTRIBUTION_COOLDOWN_MS) {
    const text = String(value || '').trim().toLowerCase();
    const match = text.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?$/);
    if (!match) return fallback;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) return fallback;
    const unit = match[2] || 'm';
    const factor = unit.startsWith('s') ? 1000 : unit.startsWith('h') ? 60 * 60 * 1000 : 60 * 1000;
    return Math.min(Math.round(amount * factor), 24 * 60 * 60 * 1000);
}

function topicKey(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(word => word.length > 2)
        .slice(0, 12)
        .join(' ');
}

function canReact(chat, now = Date.now()) {
    const state = bucket(chat);
    return !!state?.reactionEnabled && now - state.lastReactionAt >= state.reactionCooldownMs;
}

function markReaction(chat, now = Date.now()) {
    const state = bucket(chat);
    if (state) state.lastReactionAt = now;
}

function canContribute(chat, text, now = Date.now()) {
    const state = bucket(chat);
    if (!state?.contributionEnabled) return false;
    if (now - state.lastContributionAt < state.contributionCooldownMs) return false;
    const key = topicKey(text);
    if (key && state.lastContributionTopic && key === state.lastContributionTopic) return false;
    return true;
}

function markContribution(chat, text, now = Date.now()) {
    const state = bucket(chat);
    if (!state) return;
    state.lastContributionAt = now;
    state.lastContributionTopic = topicKey(text);
    state.lastContributionText = String(text || '').slice(0, 500);
}

function setReactionEnabled(chat, enabled) {
    const state = bucket(chat);
    if (state) state.reactionEnabled = !!enabled;
}

function setContributionEnabled(chat, enabled) {
    const state = bucket(chat);
    if (state) state.contributionEnabled = !!enabled;
}

function setContributionCooldown(chat, value) {
    const state = bucket(chat);
    if (!state) return DEFAULT_CONTRIBUTION_COOLDOWN_MS;
    state.contributionCooldownMs = parseDuration(value, state.contributionCooldownMs);
    return state.contributionCooldownMs;
}

function setReactionCooldown(chat, value) {
    const state = bucket(chat);
    if (!state) return DEFAULT_REACTION_COOLDOWN_MS;
    state.reactionCooldownMs = parseDuration(value, state.reactionCooldownMs);
    return state.reactionCooldownMs;
}

function formatDuration(ms) {
    const value = Math.max(0, Number(ms) || 0);
    if (value % (60 * 60 * 1000) === 0) return `${value / (60 * 60 * 1000)}h`;
    if (value % (60 * 1000) === 0) return `${value / (60 * 1000)}m`;
    return `${Math.round(value / 1000)}s`;
}

function getStatus(chat, now = Date.now()) {
    const state = bucket(chat);
    return {
        reactionEnabled: state.reactionEnabled,
        contributionEnabled: state.contributionEnabled,
        contributionCooldown: formatDuration(state.contributionCooldownMs),
        reactionCooldown: formatDuration(state.reactionCooldownMs),
        contributionAvailableIn: formatDuration(Math.max(0, state.contributionCooldownMs - (now - state.lastContributionAt))),
        reactionAvailableIn: formatDuration(Math.max(0, state.reactionCooldownMs - (now - state.lastReactionAt))),
        lastContributionText: state.lastContributionText
    };
}

function clear(chat) {
    if (chat) chats.delete(String(chat));
    else chats.clear();
}

module.exports = {
    DEFAULT_CONTRIBUTION_COOLDOWN_MS,
    DEFAULT_REACTION_COOLDOWN_MS,
    parseDuration,
    topicKey,
    canReact,
    markReaction,
    canContribute,
    markContribution,
    setReactionEnabled,
    setContributionEnabled,
    setContributionCooldown,
    setReactionCooldown,
    formatDuration,
    getStatus,
    clear
};
