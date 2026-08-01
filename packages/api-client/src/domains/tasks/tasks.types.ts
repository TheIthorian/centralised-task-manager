/** ISO date string with optional timezone and recurrence rule. */
export type DueDate = {
    date: string;
    timezone: string | null;
    recurrence: string | null;
};

/** Time estimate for a task. */
export type Duration = {
    amount: number;
    unit: 'minute' | 'day';
};

/** The kind of relation from one task to another. */
export type RelationType = 'parent' | 'child' | 'next' | 'previous' | 'related';

/** A typed link from one task to another. */
export type TaskRelationDto = {
    type: RelationType;
    targetTaskId: string;
};

/** Vague deadline classification with optional reminder cadence. */
export type FuzzyDeadlineInfo = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery: 'daily' | 'weekly' | null;
};

/** A single point-in-time reminder attached to a task. */
export type ReminderDto = {
    remindAt: string; // ISO datetime
    firedAt: string | null; // set once the notification has been sent
};

/** Physical or virtual location attached to a task. */
export type LocationDto = {
    name: string;
    googleMapsUrl: string;
};

/** Full task representation returned by the API. */
export type TaskDto = {
    id: string;
    title: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4 | null;
    due?: DueDate | null;
    deadlineDate?: string | null;
    duration?: Duration | null;
    relations: TaskRelationDto[];
    fuzzyDeadline?: FuzzyDeadlineInfo | null;
    reminders: ReminderDto[];
    dueDateNotifiedAt: string | null;
    completed: boolean;
    source: string;
    sourceId: string;
    externalAccountId: string | null;
    tags: string[];
    locations: LocationDto[];
    createdAt: string;
    updatedAt: string;
};

/** Payload for creating a new task. */
export type CreateTaskDto = {
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: Duration;
    source: string;
    locations?: LocationDto[];
};

/** Partial payload for updating an existing task. */
export type UpdateTaskDto = {
    title?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due?: { date: string; timezone?: string; recurrence?: string };
    deadlineDate?: string;
    duration?: Duration;
    tags?: string[];
    locations?: LocationDto[];
};

/** Payload for changing a task's open/done status. */
export type SetTaskStatusDto = {
    status: 'open' | 'done';
};

/** Payload for setting a fuzzy deadline on a task. */
export type SetFuzzyDeadlineDto = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery?: 'daily' | 'weekly';
};

/** Body for adding a reminder to a task. */
export type AddReminderDto = {
    remindAt: string; // ISO datetime
};

/** Named preset filter for the task list endpoint. */
export type TaskFilter = 'all' | 'today' | 'upcoming' | 'done';

/** Parameters for {@link TasksClient.listTasks}. */
export type ListTasksParams = {
    filter?: TaskFilter;
    /** ISO date string — only return tasks updated on or after this date. */
    lastUpdatedFromDate?: string;
    /** Page number (1-based). */
    page?: number;
    /** Number of tasks per page. */
    limit?: number;
    /** Filter by status directly (alternative to `filter` preset). */
    status?: 'open' | 'done' | 'archived';
    /** ISO date string — only tasks where due.date < dueBefore. Must not be combined with the `filter` preset. */
    dueBefore?: string;
    /** ISO date string — only tasks where due.date >= dueAfter. Must not be combined with the `filter` preset. */
    dueAfter?: string;
    /** When true, only return tasks with no due date. */
    noDate?: boolean;
};

/** Parameters for {@link TasksClient.getTask}. */
export type GetTaskParams = {
    id: string;
};

/** Parameters for {@link TasksClient.createTask}. */
export type CreateTaskParams = {
    dto: CreateTaskDto;
};

/** Parameters for {@link TasksClient.updateTask}. */
export type UpdateTaskParams = {
    id: string;
    dto: UpdateTaskDto;
};

/** Parameters for {@link TasksClient.deleteTask}. */
export type DeleteTaskParams = {
    id: string;
};

/** Parameters for {@link TasksClient.setTaskStatus}. */
export type SetTaskStatusParams = {
    id: string;
    dto: SetTaskStatusDto;
};

/** Parameters for {@link TasksClient.setFuzzyDeadline}. */
export type SetFuzzyDeadlineParams = {
    id: string;
    dto: SetFuzzyDeadlineDto;
};

/** Parameters for {@link TasksClient.removeFuzzyDeadline}. */
export type RemoveFuzzyDeadlineParams = {
    id: string;
};

/** Parameters for {@link TasksClient.addReminder}. */
export type AddReminderParams = {
    id: string;
    dto: AddReminderDto;
};

/** Parameters for {@link TasksClient.removeReminder}. */
export type RemoveReminderParams = {
    id: string;
    index: number;
};

/** Parameters for {@link TasksClient.addRelation}. */
export type AddRelationParams = {
    id: string;
    dto: { type: RelationType; targetTaskId: string };
};

/** Parameters for {@link TasksClient.removeRelation}. */
export type RemoveRelationParams = {
    id: string;
    dto: { type: RelationType; targetTaskId: string };
};
