type Logger = { warn: (msg: string) => void };

const DAY_TO_BYDAY: Record<string, string> = {
    monday: 'MO',
    tuesday: 'TU',
    wednesday: 'WE',
    thursday: 'TH',
    friday: 'FR',
    saturday: 'SA',
    sunday: 'SU',
};

const BYDAY_TO_DAY: Record<string, string> = Object.fromEntries(
    Object.entries(DAY_TO_BYDAY).map(([day, code]) => [code, day]),
);

type PatternEntry = [RegExp, (match: RegExpMatchArray) => string];

const PATTERNS: PatternEntry[] = [
    [/^every day$/i, () => 'FREQ=DAILY'],
    [/^every (\d+) days?$/i, (m) => `FREQ=DAILY;INTERVAL=${m[1]}`],
    [/^every week$/i, () => 'FREQ=WEEKLY'],
    [/^every (\d+) weeks?$/i, (m) => `FREQ=WEEKLY;INTERVAL=${m[1]}`],
    [/^every workday$/i, () => 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
    [/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i, (m) => `FREQ=WEEKLY;BYDAY=${DAY_TO_BYDAY[m[1].toLowerCase()]}`],
    [/^every month$/i, () => 'FREQ=MONTHLY'],
    [/^every (\d+) months?$/i, (m) => `FREQ=MONTHLY;INTERVAL=${m[1]}`],
    [/^every year$/i, () => 'FREQ=YEARLY'],
];

/** Convert a Todoist recurrence string to an RRULE string. Returns null for unknown patterns. */
export function todoistStringToRrule(s: string, logger?: Logger): string | null {
    for (const [pattern, build] of PATTERNS) {
        const match = s.match(pattern);

        if (match) return build(match);
    }

    logger?.warn(`Unknown Todoist recurrence pattern: "${s}" — recurrence will be null`);

    return null;
}

/** Convert an RRULE string to a Todoist due_string. Returns the original string for unrecognised patterns. */
export function rruleToTodoistString(rrule: string): string {
    const parts = Object.fromEntries(rrule.split(';').map((p) => p.split('='))) as Record<string, string | undefined>;
    const freq = parts['FREQ'];
    const interval = parts['INTERVAL'] ? Number(parts['INTERVAL']) : 1;
    const byDay = parts['BYDAY'];

    if (freq === 'DAILY') return interval === 1 ? 'every day' : `every ${interval} days`;

    if (freq === 'WEEKLY') {
        if (byDay === 'MO,TU,WE,TH,FR') return 'every workday';

        if (byDay) {
            const days = byDay.split(',');

            if (days.length === 1 && BYDAY_TO_DAY[days[0]]) return `every ${BYDAY_TO_DAY[days[0]]}`;

            // Unknown BYDAY pattern; pass through
            return rrule;
        }

        return interval === 1 ? 'every week' : `every ${interval} weeks`;
    }

    if (freq === 'MONTHLY') return interval === 1 ? 'every month' : `every ${interval} months`;

    if (freq === 'YEARLY') return 'every year';

    return rrule;
}
