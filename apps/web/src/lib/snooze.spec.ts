import { describe, expect, it } from 'vitest';
import { toDateKey, zonedHour } from '@ctm/time';
import { nextMorning } from './snooze.js';

const LONDON = 'Europe/London';
const AUCKLAND = 'Pacific/Auckland';

describe('nextMorning', () => {
    it('lands on the next day at 09:00 in the reader zone', () => {
        const result = nextMorning({ timeZone: LONDON, from: new Date('2026-07-30T21:41:00.000Z') });

        expect(toDateKey({ instant: result, timeZone: LONDON })).toBe('2026-07-31');
        expect(zonedHour({ instant: result, timeZone: LONDON })).toBe(9);
    });

    it('rolls over the end of a month', () => {
        const result = nextMorning({ timeZone: LONDON, from: new Date('2026-07-31T08:05:00.000Z') });

        expect(toDateKey({ instant: result, timeZone: LONDON })).toBe('2026-08-01');
    });

    it('resolves to a different instant for two readers in different zones', () => {
        const from = new Date('2026-07-30T21:41:00.000Z');

        expect(nextMorning({ timeZone: LONDON, from }).toISOString()).toBe('2026-07-31T08:00:00.000Z');
        // 21:41Z is already the 31st in Auckland, so its next morning is 09:00 on the 1st.
        expect(nextMorning({ timeZone: AUCKLAND, from }).toISOString()).toBe('2026-07-31T21:00:00.000Z');
    });

    it('keeps 09:00 on the wall across a daylight saving change', () => {
        // New York moves its clocks forward overnight on 8 March 2026.
        const result = nextMorning({ timeZone: 'America/New_York', from: new Date('2026-03-08T02:00:00.000Z') });

        expect(zonedHour({ instant: result, timeZone: 'America/New_York' })).toBe(9);
    });

    it('does not mutate the date it was given', () => {
        const from = new Date('2026-07-30T21:41:00.000Z');

        nextMorning({ timeZone: LONDON, from });

        expect(from.toISOString()).toBe('2026-07-30T21:41:00.000Z');
    });
});
