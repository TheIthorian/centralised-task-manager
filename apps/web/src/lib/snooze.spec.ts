import { describe, expect, it } from 'vitest';
import { nextMorning } from './snooze.js';

describe('nextMorning', () => {
    it('lands on the next day at 09:00 local time', () => {
        const result = nextMorning({ from: new Date(2026, 6, 30, 22, 41) });

        expect(result.getDate()).toBe(31);
        expect(result.getHours()).toBe(9);
        expect(result.getMinutes()).toBe(0);
    });

    it('rolls over the end of a month', () => {
        const result = nextMorning({ from: new Date(2026, 6, 31, 9, 5) });

        expect(result.getMonth()).toBe(7);
        expect(result.getDate()).toBe(1);
    });

    it('does not mutate the date it was given', () => {
        const from = new Date(2026, 6, 30, 22, 41);
        nextMorning({ from });

        expect(from.getDate()).toBe(30);
    });
});
