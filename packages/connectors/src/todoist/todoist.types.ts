/** Todoist API task object. See: https://developer.todoist.com/rest/reference#get-active-tasks */
export type TodoistTask = {
    user_id: string;
    id: string;
    project_id: string;
    section_id: string | null;
    parent_id: string | null;
    added_by_uid: string;
    assigned_by_uid: string | null;
    responsible_uid: string | null;
    labels: string[];
    deadline: { date: string; lang: string; string: string } | null;
    duration: { amount: number; unit: 'minute' | 'day' } | null;
    is_collapsed: boolean;
    checked: boolean;
    is_deleted: boolean;
    added_at: string;
    completed_at: string | null;
    completed_by_uid: string | null;
    updated_at: string;
    due: { date: string; timezone: string | null; string: string; lang: string; is_recurring: boolean } | null;
    priority: number;
    child_order: number;
    content: string;
    description: string;
    note_count: number;
    day_order: number;
    goal_ids: string[];
};

/** Todoist user object returned by the sync `user` resource. */
export type TodoistUser = {
    id: string;
    email: string;
};

/** Response from POST /sync with resource_types ["user"]. */
export type TodoistSyncUserResponse = {
    user: TodoistUser;
};

/** OAuth2 token response from the Todoist token endpoint. */
export type TodoistTokenResponse = {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number;
};

/** Paginated response envelope for the Todoist tasks list endpoint. */
export type TodoistTasksResponse = {
    results: TodoistTask[];
    next_cursor: string | null;
};
