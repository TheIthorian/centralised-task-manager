import { describe, expect, it } from 'vitest';
import { buildDays, rangeLabel, shiftAnchor, startOfRange, toDateKey } from './calendar-range.js';

// A Thursday, mid-month, in a month with 31 days.
const anchor = new Date(2026, 6, 30);

describe('buildDays', () => {
    it('covers a whole month whatever weekday it starts on', () => {
        const days = buildDays({ anchor, range: 'month' });

        expect(days).toHaveLength(31);
        expect(toDateKey(days[0] as Date)).toBe('2026-07-01');
        expect(toDateKey(days[30] as Date)).toBe('2026-07-31');
    });

    it('starts a week on the Sunday that contains the anchor', () => {
        const days = buildDays({ anchor, range: 'week' });

        expect(days).toHaveLength(7);
        expect(toDateKey(days[0] as Date)).toBe('2026-07-26');
        expect(toDateKey(days[6] as Date)).toBe('2026-08-01');
    });

    it('starts a three day range at the anchor itself', () => {
        const days = buildDays({ anchor, range: 'threeDay' });

        expect(days.map(toDateKey)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01']);
    });

    it('crosses a month boundary without renumbering', () => {
        const days = buildDays({ anchor: new Date(2026, 11, 31), range: 'threeDay' });

        expect(days.map(toDateKey)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
    });
});

describe('shiftAnchor', () => {
    it('pages a month at a time', () => {
        expect(toDateKey(shiftAnchor({ anchor, range: 'month', direction: 1 }))).toBe('2026-08-01');
        expect(toDateKey(shiftAnchor({ anchor, range: 'month', direction: -1 }))).toBe('2026-06-01');
    });

    it('pages a week from the start of the week, so no day is shown twice or skipped', () => {
        const next = shiftAnchor({ anchor, range: 'week', direction: 1 });

        expect(toDateKey(next)).toBe('2026-08-02');
        expect(toDateKey(startOfRange({ anchor: next, range: 'week' }))).toBe('2026-08-02');
    });

    it('pages three days at a time', () => {
        expect(toDateKey(shiftAnchor({ anchor, range: 'threeDay', direction: -1 }))).toBe('2026-07-27');
    });
});

describe('rangeLabel', () => {
    it('names the month and year', () => {
        expect(rangeLabel({ anchor, range: 'month', locale: 'en-GB' })).toBe('July 2026');
    });

    it('names the weekday for a single day', () => {
        expect(rangeLabel({ anchor, range: 'day', locale: 'en-GB' })).toBe('Thursday 30 July');
    });

    it('repeats the month in a span only when the span crosses one', () => {
        expect(rangeLabel({ anchor, range: 'week', locale: 'en-GB' })).toBe('26 Jul – 1 Aug 2026');
        expect(rangeLabel({ anchor: new Date(2026, 6, 6), range: 'week', locale: 'en-GB' })).toBe('5 – 11 Jul 2026');
    });
});
