import { describe, it, expect, vi } from 'vitest';
import { todoistStringToRrule, rruleToTodoistString } from './todoist-recurrence.js';

describe('todoistStringToRrule', () => {
    it('maps "every day" → FREQ=DAILY', () => {
        expect(todoistStringToRrule('every day')).toBe('FREQ=DAILY');
    });

    it('maps "every 3 days" → FREQ=DAILY;INTERVAL=3', () => {
        expect(todoistStringToRrule('every 3 days')).toBe('FREQ=DAILY;INTERVAL=3');
    });

    it('maps "every week" → FREQ=WEEKLY', () => {
        expect(todoistStringToRrule('every week')).toBe('FREQ=WEEKLY');
    });

    it('maps "every 2 weeks" → FREQ=WEEKLY;INTERVAL=2', () => {
        expect(todoistStringToRrule('every 2 weeks')).toBe('FREQ=WEEKLY;INTERVAL=2');
    });

    it('maps "every monday" → FREQ=WEEKLY;BYDAY=MO', () => {
        expect(todoistStringToRrule('every monday')).toBe('FREQ=WEEKLY;BYDAY=MO');
    });

    it('maps "every friday" → FREQ=WEEKLY;BYDAY=FR', () => {
        expect(todoistStringToRrule('every friday')).toBe('FREQ=WEEKLY;BYDAY=FR');
    });

    it('maps "every workday" → FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', () => {
        expect(todoistStringToRrule('every workday')).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    });

    it('maps "every month" → FREQ=MONTHLY', () => {
        expect(todoistStringToRrule('every month')).toBe('FREQ=MONTHLY');
    });

    it('maps "every 3 months" → FREQ=MONTHLY;INTERVAL=3', () => {
        expect(todoistStringToRrule('every 3 months')).toBe('FREQ=MONTHLY;INTERVAL=3');
    });

    it('maps "every year" → FREQ=YEARLY', () => {
        expect(todoistStringToRrule('every year')).toBe('FREQ=YEARLY');
    });

    it('is case-insensitive', () => {
        expect(todoistStringToRrule('Every Day')).toBe('FREQ=DAILY');
    });

    it('returns null for unknown patterns and calls logger.warn', () => {
        const logger = { warn: vi.fn() };
        const result = todoistStringToRrule('every other weekend', logger);
        expect(result).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('every other weekend'),
        );
    });
});

describe('rruleToTodoistString', () => {
    it('maps FREQ=DAILY → "every day"', () => {
        expect(rruleToTodoistString('FREQ=DAILY')).toBe('every day');
    });

    it('maps FREQ=DAILY;INTERVAL=3 → "every 3 days"', () => {
        expect(rruleToTodoistString('FREQ=DAILY;INTERVAL=3')).toBe('every 3 days');
    });

    it('maps FREQ=WEEKLY → "every week"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY')).toBe('every week');
    });

    it('maps FREQ=WEEKLY;INTERVAL=2 → "every 2 weeks"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY;INTERVAL=2')).toBe('every 2 weeks');
    });

    it('maps FREQ=WEEKLY;BYDAY=MO → "every monday"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY;BYDAY=MO')).toBe('every monday');
    });

    it('maps FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR → "every workday"', () => {
        expect(rruleToTodoistString('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe('every workday');
    });

    it('maps FREQ=MONTHLY → "every month"', () => {
        expect(rruleToTodoistString('FREQ=MONTHLY')).toBe('every month');
    });

    it('maps FREQ=MONTHLY;INTERVAL=3 → "every 3 months"', () => {
        expect(rruleToTodoistString('FREQ=MONTHLY;INTERVAL=3')).toBe('every 3 months');
    });

    it('maps FREQ=YEARLY → "every year"', () => {
        expect(rruleToTodoistString('FREQ=YEARLY')).toBe('every year');
    });

    it('passes through unknown RRULE strings unchanged', () => {
        const unknown = 'FREQ=WEEKLY;BYDAY=MO,WE,FR';
        expect(rruleToTodoistString(unknown)).toBe(unknown);
    });
});
