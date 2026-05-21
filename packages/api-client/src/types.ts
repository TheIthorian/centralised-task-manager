export type UserDto = {
    id: string;
    email: string;
    name?: string;
};

export type TaskDto = {
    id: string;
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    fuzzyDeadline?: string;
    completed: boolean;
    source: string;
    sourceId: string;
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
    completed?: boolean;
};

export type SetFuzzyDeadlineDto = {
    fuzzyDeadline: string;
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
