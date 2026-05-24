import { describe, it, expect } from 'vitest';
import { bucketTasks } from './bucket-tasks.js';
import type { TaskDto } from '@ctm/api-client';

/** Minimal TaskDto factory — only fields bucketTasks cares about. */
function makeTask(overrides: Partial<TaskDto> & { id: string }): TaskDto {
	return {
		title: 'Test task',
		completed: false,
		source: 'todoist',
		sourceId: overrides.id,
		tags: [],
		locations: [],
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
		...overrides,
	};
}

// Anchor: Wednesday 2026-05-20
const NOW = new Date(2026, 4, 20); // month is 0-indexed

describe('bucketTasks', () => {
	it('puts tasks with no due date in noDate', () => {
		const task = makeTask({ id: '1' });
		const result = bucketTasks([task], NOW);
		expect(result.noDate).toHaveLength(1);
		expect(result.noDate[0].id).toBe('1');
		expect(result.overdue).toHaveLength(0);
		expect(result.today).toHaveLength(0);
		expect(result.thisWeek).toHaveLength(0);
		expect(result.upcoming).toHaveLength(0);
	});

	it('puts tasks due before today in overdue', () => {
		const task = makeTask({ id: '2', due: { date: '2026-05-19', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.overdue).toHaveLength(1);
		expect(result.overdue[0].id).toBe('2');
	});

	it('puts tasks due today in today', () => {
		const task = makeTask({ id: '3', due: { date: '2026-05-20', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.today).toHaveLength(1);
		expect(result.today[0].id).toBe('3');
	});

	it('puts tasks due later this week (not today) in thisWeek', () => {
		// NOW is Wednesday 2026-05-20; week ends Sunday 2026-05-24
		const task = makeTask({ id: '4', due: { date: '2026-05-23', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.thisWeek).toHaveLength(1);
		expect(result.thisWeek[0].id).toBe('4');
	});

	it('puts tasks due after this week in upcoming', () => {
		const task = makeTask({ id: '5', due: { date: '2026-05-25', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.upcoming).toHaveLength(1);
		expect(result.upcoming[0].id).toBe('5');
	});

	it('treats Sunday as last day of the week', () => {
		const task = makeTask({ id: '6', due: { date: '2026-05-24', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.thisWeek).toHaveLength(1);
	});

	it('treats Monday as start of next week', () => {
		const task = makeTask({ id: '7', due: { date: '2026-05-25', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.upcoming).toHaveLength(1);
	});

	it('sorts dated buckets ascending by date', () => {
		const tasks = [
			makeTask({ id: 'b', due: { date: '2026-05-19', timezone: null, recurrence: null } }),
			makeTask({ id: 'a', due: { date: '2026-05-18', timezone: null, recurrence: null } }),
		];
		const result = bucketTasks(tasks, NOW);
		expect(result.overdue[0].id).toBe('a');
		expect(result.overdue[1].id).toBe('b');
	});

	it('handles full ISO-8601 date strings from the API', () => {
		const task = makeTask({ id: 'iso', due: { date: '2026-05-19T00:00:00.000Z', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.overdue).toHaveLength(1);
		expect(result.upcoming).toHaveLength(0);
	});

	it('defaults now to the current date', () => {
		// Smoke test: calling without now arg does not throw
		expect(() => bucketTasks([])).not.toThrow();
	});

	it('puts completed tasks in done regardless of due date', () => {
		const tasks = [
			makeTask({ id: 'd1', completed: true, due: { date: '2026-05-20', timezone: null, recurrence: null } }),
			makeTask({ id: 'd2', completed: true }),
		];
		const result = bucketTasks(tasks, NOW);
		expect(result.done).toHaveLength(2);
		expect(result.today).toHaveLength(0);
		expect(result.noDate).toHaveLength(0);
	});

	it('does not put incomplete tasks in done', () => {
		const task = makeTask({ id: 'o1', due: { date: '2026-05-20', timezone: null, recurrence: null } });
		const result = bucketTasks([task], NOW);
		expect(result.done).toHaveLength(0);
		expect(result.today).toHaveLength(1);
	});
});
