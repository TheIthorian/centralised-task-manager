/** Response from GET /config — public client configuration. */
export type AppConfigDto = {
    /** Base URL of the MCP server clients such as Claude should connect to. */
    mcpUrl: string;
};

/** Response from GET /health — service liveness for platform healthchecks. */
export type HealthDto = {
    status: 'ok' | 'degraded';
    /** Mongo connection state; omitted by services that have no database. */
    database?: 'up' | 'down';
    uptimeSeconds: number;
};
