'use strict';

const DEFAULT_TIMEZONE = 'Africa/Lagos';

function isValidTimezone(timezone) {
    if (typeof timezone !== 'string' || !timezone.trim()) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
        return true;
    } catch {
        return false;
    }
}

function resolveTimezone(value, warn = console.warn) {
    if (value === undefined || value === null) return DEFAULT_TIMEZONE;
    const requested = String(value).trim();
    if (!requested) return DEFAULT_TIMEZONE;
    if (isValidTimezone(requested)) return requested;
    warn(`[TIMEZONE] Invalid IANA time zone "${requested}"; using ${DEFAULT_TIMEZONE}.`);
    return DEFAULT_TIMEZONE;
}

function getRequestedTimezone() {
    try {
        // Runtime `.setvar TIMEZONE` remains the existing source of truth when
        // present; otherwise the canonical TIMEZONE environment variable wins.
        const { getVar } = require('../Plugin/configManager');
        return getVar('TIMEZONE', process.env.TIMEZONE || DEFAULT_TIMEZONE);
    } catch {
        return process.env.TIMEZONE || DEFAULT_TIMEZONE;
    }
}

const warnedInvalidValues = new Set();
function warnInvalidOnce(message) {
    if (warnedInvalidValues.has(message)) return;
    warnedInvalidValues.add(message);
    console.warn(message);
}

// Validate immediately so a bad .env/.setvar value is visible at startup.
resolveTimezone(getRequestedTimezone(), warnInvalidOnce);

function getBotTimezone() {
    return resolveTimezone(getRequestedTimezone(), warnInvalidOnce);
}

function formatDateTimeInTimezone(value, timezone, locale = 'en-GB', options = {}) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const effectiveTimezone = resolveTimezone(timezone, warnInvalidOnce);
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: effectiveTimezone }).format(date);
}

function formatBotDateTime(value = new Date(), locale = 'en-GB', options = {}) {
    return formatDateTimeInTimezone(value, getBotTimezone(), locale, options);
}

function formatBotDate(value = new Date(), locale = 'en-GB', options = {}) {
    return formatBotDateTime(value, locale, {
        year: 'numeric', month: '2-digit', day: '2-digit', ...options,
    });
}

function formatBotTime(value = new Date(), locale = 'en-GB', options = {}) {
    return formatBotDateTime(value, locale, {
        hour: '2-digit', minute: '2-digit', ...options,
    });
}

function getBotDateParts(value = new Date(), timezone = getBotTimezone()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function getCronOptions(timezone = getBotTimezone()) {
    return { timezone };
}

module.exports = {
    DEFAULT_TIMEZONE,
    getBotTimezone,
    resolveTimezone,
    isValidTimezone,
    formatDateTimeInTimezone,
    formatBotDateTime,
    formatBotDate,
    formatBotTime,
    getBotDateParts,
    getCronOptions,
};
