import { describe, expect, it } from 'vitest';
import { ValidationError } from '@ctm/errors';
import {
    addDays,
    assertTimeZone,
    dayOfWeek,
    differenceInCalendarDays,
    instantFromWallClock,
    isValidTimeZone,
    offsetAt,
    parseDateKey,
    startOfDay,
    startOfLastDayOfWeek,
    startOfWeek,
    toDateKey,
    UTC,
    zonedHour,
    zonedParts,
} from './index.js';

const AUCKLAND = 'Pacific/Auckland';
const LONDON = 'Europe/London';
const NEW_YORK = 'America/New_York';
const KOLKATA = 'Asia/Kolkata';

describe('isValidTimeZone', () => {
    it('accepts IANA identifiers', () => {
        expect(isValidTimeZone(LONDON)).toBe(true);
        expect(isValidTimeZone(UTC)).toBe(true);
    });

    it('rejects anything else', () => {
        expect(isValidTimeZone('GMT+1')).toBe(false);
        expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    });
});

describe('assertTimeZone', () => {
    it('returns the zone when it is known', () => {
        expect(assertTimeZone(KOLKATA)).toBe(KOLKATA);
    });

    it('throws a ValidationError when it is not', () => {
        expect(() => assertTimeZone('Nowhere/Nothing')).toThrow(ValidationError);
    });
});

describe('toDateKey', () => {
    it('puts one instant on different days in different zones', () => {
        // 09:00 in London on 13 July is 20:00 the same day in Auckland, but 04:00 in New York.
        const instant = new Date('2026-07-13T08:00:00.000Z');

        expect(toDateKey({ instant, timeZone: LONDON })).toBe('2026-07-13');
        expect(toDateKey({ instant, timeZone: AUCKLAND })).toBe('2026-07-13');
        expect(toDateKey({ instant, timeZone: NEW_YORK })).toBe('2026-07-13');
    });

    it('crosses the date line for an instant near midnight UTC', () => {
        const instant = new Date('2026-07-13T23:30:00.000Z');

        expect(toDateKey({ instant, timeZone: UTC })).toBe('2026-07-13');
        expect(toDateKey({ instant, timeZone: AUCKLAND })).toBe('2026-07-14');
        expect(toDateKey({ instant, timeZone: NEW_YORK })).toBe('2026-07-13');
    });

    it('handles a half-hour offset zone', () => {
        const instant = new Date('2026-07-13T19:00:00.000Z');

        expect(toDateKey({ instant, timeZone: KOLKATA })).toBe('2026-07-14');
    });

    it('pads single digit months and days', () => {
        expect(toDateKey({ instant: new Date('2026-01-05T12:00:00.000Z'), timeZone: UTC })).toBe('2026-01-05');
    });
});

describe('parseDateKey', () => {
    it('splits a well-formed key', () => {
        expect(parseDateKey('2026-02-29')).toEqual({ year: 2026, month: 2, day: 29 });
    });

    it('rejects a malformed key', () => {
        expect(() => parseDateKey('13/07/2026')).toThrow(ValidationError);
    });
});

describe('instantFromWallClock', () => {
    it('resolves a wall clock to the instant it happens at', () => {
        const instant = instantFromWallClock({ dateKey: '2026-07-13', hour: 9, timeZone: LONDON });

        expect(instant.toISOString()).toBe('2026-07-13T08:00:00.000Z');
    });

    it('resolves the same wall clock to a different instant in another zone', () => {
        const instant = instantFromWallClock({ dateKey: '2026-07-13', hour: 9, timeZone: AUCKLAND });

        expect(instant.toISOString()).toBe('2026-07-12T21:00:00.000Z');
    });

    it('defaults to midnight', () => {
        const instant = instantFromWallClock({ dateKey: '2026-07-13', timeZone: NEW_YORK });

        expect(instant.toISOString()).toBe('2026-07-13T04:00:00.000Z');
    });

    it('picks the first occurrence of a repeated hour when the clocks go back', () => {
        // New York repeats 01:00-02:00 on 1 November 2026: 01:30 happens at 05:30Z and 06:30Z.
        const instant = instantFromWallClock({ dateKey: '2026-11-01', hour: 1, minute: 30, timeZone: NEW_YORK });

        expect(instant.toISOString()).toBe('2026-11-01T05:30:00.000Z');
    });

    it('lands on a real instant for a wall clock the clocks skip over', () => {
        // New York skips 02:00-03:00 on 8 March 2026, so 02:30 never reads on the wall.
        const instant = instantFromWallClock({ dateKey: '2026-03-08', hour: 2, minute: 30, timeZone: NEW_YORK });

        expect(zonedParts({ instant, timeZone: NEW_YORK }).hour).toBe(3);
    });
});

describe('startOfDay', () => {
    it('is local midnight, not UTC midnight', () => {
        const instant = new Date('2026-07-13T20:00:00.000Z');

        expect(startOfDay({ instant, timeZone: NEW_YORK }).toISOString()).toBe('2026-07-13T04:00:00.000Z');
        expect(startOfDay({ instant, timeZone: AUCKLAND }).toISOString()).toBe('2026-07-13T12:00:00.000Z');
    });
});

describe('addDays', () => {
    it('keeps the wall-clock time across a spring forward', () => {
        // 09:00 on 7 March is 14:00Z; 09:00 on 8 March is 13:00Z, an hour less elapsed.
        const from = instantFromWallClock({ dateKey: '2026-03-07', hour: 9, timeZone: NEW_YORK });
        const next = addDays({ instant: from, days: 1, timeZone: NEW_YORK });

        expect(toDateKey({ instant: next, timeZone: NEW_YORK })).toBe('2026-03-08');
        expect(zonedHour({ instant: next, timeZone: NEW_YORK })).toBe(9);
        expect(next.getTime() - from.getTime()).toBe(23 * 60 * 60 * 1000);
    });

    it('rolls over a month boundary', () => {
        const from = instantFromWallClock({ dateKey: '2026-01-31', hour: 9, timeZone: LONDON });

        expect(toDateKey({ instant: addDays({ instant: from, days: 1, timeZone: LONDON }), timeZone: LONDON })).toBe(
            '2026-02-01',
        );
    });

    it('goes backwards', () => {
        const from = instantFromWallClock({ dateKey: '2026-03-01', hour: 9, timeZone: LONDON });

        expect(toDateKey({ instant: addDays({ instant: from, days: -1, timeZone: LONDON }), timeZone: LONDON })).toBe(
            '2026-02-28',
        );
    });
});

describe('startOfWeek and startOfLastDayOfWeek', () => {
    it('runs Monday to Sunday in the given zone', () => {
        const wednesday = instantFromWallClock({ dateKey: '2026-07-15', hour: 13, timeZone: AUCKLAND });

        expect(toDateKey({ instant: startOfWeek({ instant: wednesday, timeZone: AUCKLAND }), timeZone: AUCKLAND })).toBe(
            '2026-07-13',
        );
        expect(
            toDateKey({ instant: startOfLastDayOfWeek({ instant: wednesday, timeZone: AUCKLAND }), timeZone: AUCKLAND }),
        ).toBe('2026-07-19');
    });

    it('treats Sunday as the end of the week it closes, not the start of the next', () => {
        const sunday = instantFromWallClock({ dateKey: '2026-07-19', hour: 13, timeZone: LONDON });

        expect(toDateKey({ instant: startOfWeek({ instant: sunday, timeZone: LONDON }), timeZone: LONDON })).toBe(
            '2026-07-13',
        );
    });
});

describe('differenceInCalendarDays', () => {
    it('counts a DST day as one day', () => {
        const from = instantFromWallClock({ dateKey: '2026-03-07', hour: 23, timeZone: NEW_YORK });
        const to = instantFromWallClock({ dateKey: '2026-03-08', hour: 1, timeZone: NEW_YORK });

        expect(differenceInCalendarDays({ from, to, timeZone: NEW_YORK })).toBe(1);
    });

    it('is negative when the target is earlier', () => {
        const from = new Date('2026-07-13T12:00:00.000Z');
        const to = new Date('2026-07-10T12:00:00.000Z');

        expect(differenceInCalendarDays({ from, to, timeZone: UTC })).toBe(-3);
    });

    it('disagrees between zones for the same pair of instants', () => {
        const from = new Date('2026-07-13T23:00:00.000Z');
        const to = new Date('2026-07-14T01:00:00.000Z');

        expect(differenceInCalendarDays({ from, to, timeZone: UTC })).toBe(1);
        expect(differenceInCalendarDays({ from, to, timeZone: AUCKLAND })).toBe(0);
    });
});

describe('dayOfWeek', () => {
    it('reads a date key without touching the machine clock', () => {
        expect(dayOfWeek('2026-07-13')).toBe(1);
        expect(dayOfWeek('2026-07-19')).toBe(0);
    });
});

describe('offsetAt', () => {
    it('reports the zone offset in milliseconds', () => {
        expect(offsetAt({ instant: new Date('2026-07-13T12:00:00.000Z'), timeZone: LONDON })).toBe(60 * 60 * 1000);
        expect(offsetAt({ instant: new Date('2026-01-13T12:00:00.000Z'), timeZone: LONDON })).toBe(0);
        expect(offsetAt({ instant: new Date('2026-07-13T12:00:00.000Z'), timeZone: KOLKATA })).toBe(
            5.5 * 60 * 60 * 1000,
        );
    });
});
