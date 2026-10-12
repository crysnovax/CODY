'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    DEFAULT_TIMEZONE,
    formatDateTimeInTimezone,
    getBotDateParts,
    getCronOptions,
    resolveTimezone,
} = require('../src/Utils/timezone');

test('legacy timezone default remains Africa/Lagos', () => {
    assert.equal(DEFAULT_TIMEZONE, 'Africa/Lagos');
    assert.equal(resolveTimezone('', () => {}), 'Africa/Lagos');
    assert.equal(resolveTimezone(undefined, () => {}), 'Africa/Lagos');
});

test('an IANA zone other than Lagos is accepted for local display and schedules', () => {
    assert.equal(resolveTimezone('America/Toronto', () => {}), 'America/Toronto');
    assert.deepEqual(getCronOptions('America/Toronto'), { timezone: 'America/Toronto' });
    const parts = getBotDateParts(new Date('2024-01-15T12:00:00.000Z'), 'Asia/Tokyo');
    assert.equal(parts.hour, '21');
    assert.equal(parts.day, '15');
    assert.equal(
        formatDateTimeInTimezone(new Date('2024-01-15T12:00:00.000Z'), 'Asia/Tokyo', 'en-GB', {
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }),
        '21:00'
    );
});

test('invalid zones warn and fall back without throwing', () => {
    const warnings = [];
    assert.equal(resolveTimezone('Not/A_Real_Zone', message => warnings.push(message)), 'Africa/Lagos');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Invalid IANA time zone/);
    assert.match(warnings[0], /Africa\/Lagos/);
    assert.equal(resolveTimezone(123, message => warnings.push(message)), 'Africa/Lagos');
    assert.equal(warnings.length, 2);
});

test('zoned local time follows daylight-saving transitions', () => {
    const before = getBotDateParts(new Date('2024-03-10T06:59:00.000Z'), 'America/Toronto');
    const after = getBotDateParts(new Date('2024-03-10T07:00:00.000Z'), 'America/Toronto');
    assert.equal(before.hour, '01');
    assert.equal(before.minute, '59');
    assert.equal(after.hour, '03');
    assert.equal(after.minute, '00');
    assert.equal(formatDateTimeInTimezone(new Date('2024-03-10T06:59:00.000Z'), 'America/Toronto', 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), '01:59');
    assert.equal(formatDateTimeInTimezone(new Date('2024-03-10T07:00:00.000Z'), 'America/Toronto', 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }), '03:00');
});
