import type {
    DueDate,
    Duration,
    FuzzyDeadlineInfo,
    ReminderDto as IReminderDto,
    TaskDto as ITaskDto,
} from '@ctm/api-client';
import { LocationDto } from './update-task.dto.js';
import { TaskRelationDto } from './task-relation.dto.js';

/** Due date as returned by the API — unset fields are explicit nulls on the wire. */
export class TaskDueDateDto implements DueDate {
    date!: string;
    timezone!: string | null;
    recurrence!: string | null;

    /** True when the date names a calendar day with no time, and must be read in UTC. */
    allDay!: boolean;
}

/** Time estimate for a task. */
export class TaskDurationDto implements Duration {
    amount!: number;
    unit!: 'minute' | 'day';
}

/** Vague deadline classification with optional reminder cadence. */
export class FuzzyDeadlineDto implements FuzzyDeadlineInfo {
    type!: 'this_week' | 'this_month' | 'someday';
    remindEvery!: 'daily' | 'weekly' | null;
}

/** A single point-in-time reminder attached to a task. */
export class ReminderDto implements IReminderDto {
    remindAt!: string;

    /** Set once the notification has been sent. */
    firedAt!: string | null;
}

/** Full task representation returned by the API. */
export class TaskDto implements ITaskDto {
    id!: string;
    title!: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4 | null;
    due?: TaskDueDateDto | null;
    deadlineDate?: string | null;
    duration?: TaskDurationDto | null;
    relations!: TaskRelationDto[];
    fuzzyDeadline?: FuzzyDeadlineDto | null;
    reminders!: ReminderDto[];
    dueDateNotifiedAt!: string | null;
    completed!: boolean;
    source!: string;
    sourceId!: string;
    externalAccountId!: string | null;
    tags!: string[];
    locations!: LocationDto[];
    createdAt!: string;
    updatedAt!: string;
}
