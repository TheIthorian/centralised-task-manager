import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TaskDto } from '@ctm/api-client';
import { CalendarMonth } from './CalendarMonth.js';
import { toDateKey } from '../../lib/calendar-range.js';

const day = new Date(2026, 6, 15);

const task = {
    id: 'task-1',
    title: 'Renew the studio insurance',
    completed: false,
    source: 'local',
    due: { date: day.toISOString() },
} as TaskDto;

function renderMonth({
    compact,
    onSelectDay = vi.fn(),
}: {
    compact: boolean;
    onSelectDay?: (date: Date) => void;
}): ReturnType<typeof render> {
    return render(
        <CalendarMonth
            days={[day]}
            tasksByDate={new Map([[toDateKey(day), [task]]])}
            todayKey={toDateKey(day)}
            locale="en-GB"
            onOpenTask={vi.fn()}
            compact={compact}
            onSelectDay={onSelectDay}
        />,
    );
}

describe('CalendarMonth', () => {
    it('shows task chips when there is room for them', () => {
        renderMonth({ compact: false });

        expect(screen.getByRole('button', { name: /Renew the studio insurance/ })).toBeInTheDocument();
    });

    it('replaces chips with a day target on a phone', async () => {
        const onSelectDay = vi.fn();
        renderMonth({ compact: true, onSelectDay });

        expect(screen.queryByRole('button', { name: /Renew the studio insurance/ })).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /15 July, 1 task/ }));

        expect(onSelectDay).toHaveBeenCalledWith(day);
    });
});
