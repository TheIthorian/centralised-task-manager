import { describe, expect, it } from 'vitest';
import { fromRepresentation, toRepresentation, type DueDate } from './deadline.js';

const due: DueDate = { date: new Date('2026-03-01T09:00:00.000Z'), timezone: 'Europe/London', recurrence: null };

describe('deadline representation', () => {
    it('stores an exact deadline as a due date with no fuzzy bucket', () => {
        expect(toRepresentation({ kind: 'exact', due })).toEqual({ due, fuzzyDeadline: null });
    });

    it('stores a fuzzy deadline as a bucket with no due date', () => {
        const fuzzy = { type: 'this_week' as const, remindEvery: 'daily' as const };

        expect(toRepresentation({ kind: 'fuzzy', fuzzy })).toEqual({ due: null, fuzzyDeadline: fuzzy });
    });

    it('clears both fields when there is no deadline', () => {
        expect(toRepresentation({ kind: 'none' })).toEqual({ due: null, fuzzyDeadline: null });
    });

    it('round-trips every kind back to itself', () => {
        const fuzzy = { type: 'someday' as const, remindEvery: null };

        expect(fromRepresentation(toRepresentation({ kind: 'exact', due }))).toEqual({ kind: 'exact', due });
        expect(fromRepresentation(toRepresentation({ kind: 'fuzzy', fuzzy }))).toEqual({ kind: 'fuzzy', fuzzy });
        expect(fromRepresentation(toRepresentation({ kind: 'none' }))).toEqual({ kind: 'none' });
    });

    it('prefers the exact date when a legacy document carries both', () => {
        const fuzzyDeadline = { type: 'this_month' as const, remindEvery: null };

        expect(fromRepresentation({ due, fuzzyDeadline })).toEqual({ kind: 'exact', due });
    });
});
