/** OAuth token response from POST /v1/oauth/token */
export type NotionTokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
    bot_id: string;
    workspace_id: string;
    workspace_name: string;
};

/** Response from GET /v1/users/me (the bot user for the integration). */
export type NotionMeResponse = {
    id: string;
    name: string | null;
    bot: {
        workspace_name: string | null;
        owner?: { user?: { person?: { email?: string } } };
    };
};

/** A single option in a select or status property */
export type NotionSelectOption = {
    id: string;
    name: string;
    color: string;
};

/** A single rich-text element (we only use plain_text) */
export type NotionRichText = {
    plain_text: string;
};

/** Notion property value shapes (only the types we map) */
export type NotionPropertyValue =
    | { type: 'title'; title: NotionRichText[] }
    | { type: 'status'; status: NotionSelectOption | null }
    | { type: 'date'; date: { start: string; end: string | null; time_zone: string | null } | null }
    | { type: 'select'; select: NotionSelectOption | null }
    | { type: 'multi_select'; multi_select: NotionSelectOption[] }
    | { type: string };

/** A Notion page (task) */
export type NotionPage = {
    id: string;
    archived: boolean;
    properties: Record<string, NotionPropertyValue>;
};

/** A Notion database (from search results) */
export type NotionDatabase = {
    id: string;
    title: NotionRichText[];
};

/** Response from POST /v1/databases/:id/query */
export type NotionQueryResponse = {
    results: NotionPage[];
    has_more: boolean;
    next_cursor: string | null;
};

/** Response from POST /v1/search */
export type NotionSearchResponse = {
    results: NotionDatabase[];
    has_more: boolean;
    next_cursor: string | null;
};

/** A single block from GET /v1/blocks/:id/children */
export type NotionBlock = {
    type: string;
    [key: string]: unknown;
};

/** Response from GET /v1/blocks/:id/children */
export type NotionBlocksResponse = {
    results: NotionBlock[];
    has_more: boolean;
    next_cursor: string | null;
};
