export type FuzzyDeadlineInfo = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery: 'daily' | 'weekly' | null;
};

export type UserDto = {
    id: string;
    email: string;
    name?: string;
};

export type TaskDto = {
    id: string;
    title: string;
    description?: string | null;
    priority?: 1 | 2 | 3 | 4 | null;
    dueDate?: string | null;
    fuzzyDeadline?: FuzzyDeadlineInfo | null;
    completed: boolean;
    source: string;
    sourceId: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
};

export type CreateTaskDto = {
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    source: string;
};

export type UpdateTaskDto = {
    title?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    tags?: string[];
};

export type SetTaskStatusDto = {
    status: 'open' | 'done';
};

export type SetFuzzyDeadlineDto = {
    type: 'this_week' | 'this_month' | 'someday';
    remindEvery?: 'daily' | 'weekly';
};

export type ConnectorStatusDto = {
    source: string;
    connected: boolean;
    lastSynced?: string;
};

export type UpdateUserDto = {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
};

export type TokenPair = {
    accessToken: string;
    refreshToken: string;
    user: UserDto;
};

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'done';
