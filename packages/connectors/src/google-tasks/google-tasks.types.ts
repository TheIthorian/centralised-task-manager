/** A Google Tasks task list container. */
export interface GoogleTaskList {
    id: string;
    title: string;
}

/** Google Tasks API task object. See: https://developers.google.com/tasks/reference/rest/v1/tasks */
export interface GoogleTask {
    kind: string;
    id: string;
    etag: string;
    title: string;
    updated: string;
    selfLink: string;
    position: string;
    status: 'needsAction' | 'completed';
    due?: string;
    notes?: string;
    links?: Array<{ type?: string; description?: string; link?: string }>;
    webViewLink?: string;
    deleted?: boolean;
    hidden?: boolean;
}

/** OAuth2 token response from the Google token endpoint. */
export interface GoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}
