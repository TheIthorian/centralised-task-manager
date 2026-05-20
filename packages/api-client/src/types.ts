export interface UserDto {
    id: string;
    email: string;
    name?: string;
}

export interface TaskDto {
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
}

export interface CreateTaskDto {
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    source: string;
}

export interface UpdateTaskDto {
    title?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    completed?: boolean;
}

export interface SetFuzzyDeadlineDto {
    fuzzyDeadline: string;
}

export interface ConnectorStatusDto {
    source: string;
    connected: boolean;
    lastSynced?: string;
}

export interface UpdateUserDto {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    user: UserDto;
}

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'done';
