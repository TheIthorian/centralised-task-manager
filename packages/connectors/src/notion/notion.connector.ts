import { HttpClient, type Logger } from '@ctm/http-client';

import type {
    ConnectionDetailsSchema,
    CreateTaskDto,
    OAuthTokens,
    RemoteTask,
    TaskConnector,
    UpdateTaskDto,
} from '../types.js';
import type {
    NotionDatabase,
    NotionPage,
    NotionPropertyValue,
    NotionQueryResponse,
    NotionSearchResponse,
    NotionTokenResponse,
} from './notion.types.js';

export type NotionConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    logger?: Logger;
};

const NOTION_VERSION = '2022-06-28';
const DEFAULT_EXPIRY_SECONDS = 3600;

const PRIORITY_MAP: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
};

export class NotionConnector implements TaskConnector {
    readonly source = 'notion';

    readonly connectionDetailsSchema: ConnectionDetailsSchema = {
        databaseId: {
            type: 'remote_select',
            label: 'Task Database',
            required: true,
            endpoint: '/connectors/notion/databases',
        },
    };

    private readonly http: HttpClient;

    constructor(private readonly config: NotionConnectorConfig) {
        this.http = new HttpClient({ baseUrl: 'https://api.notion.com', logger: config.logger });
    }

    /** Build the OAuth authorization URL for the given user state. */
    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            owner: 'user',
            state: userId,
        });

        return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
    }

    /** Exchange authorization code for OAuth tokens. Notion does not return expires_in; default to 1 hour. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await this.http.post<NotionTokenResponse>(
            '/v1/oauth/token',
            { grant_type: 'authorization_code', code, redirect_uri: this.config.redirectUri },
            { Authorization: `Basic ${this.basicAuth()}`, 'Content-Type': 'application/json' },
        );

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? '',
            expiresAt: new Date(Date.now() + DEFAULT_EXPIRY_SECONDS * 1000),
        };
    }

    /** Refresh an expired Notion access token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const res = await this.http.post<NotionTokenResponse>(
            '/v1/oauth/token',
            { grant_type: 'refresh_token', refresh_token: tokens.refreshToken },
            { Authorization: `Basic ${this.basicAuth()}`, 'Content-Type': 'application/json' },
        );

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? tokens.refreshToken,
            expiresAt: new Date(Date.now() + DEFAULT_EXPIRY_SECONDS * 1000),
        };
    }

    /** Fetch all tasks from the user's chosen Notion database. Paginates automatically. */
    async fetchTasks(tokens: OAuthTokens, connectionDetails?: Record<string, unknown>): Promise<RemoteTask[]> {
        const databaseId = String(connectionDetails?.['databaseId'] ?? '');
        if (!databaseId) throw new Error('NotionConnector: connectionDetails.databaseId is required');
        const headers = this.notionHeaders(tokens);
        const tasks: RemoteTask[] = [];
        let cursor: string | null = null;

        do {
            const body: Record<string, unknown> = cursor ? { start_cursor: cursor } : {};
            const res = await this.http.post<NotionQueryResponse>(`/v1/databases/${databaseId}/query`, body, headers);

            tasks.push(...res.results.map((p) => this.toRemoteTask(p)));
            cursor = res.has_more ? res.next_cursor : null;
        } while (cursor);

        return tasks;
    }

    /** Create a new task as a Notion page in the user's database. */
    async createTask(
        tokens: OAuthTokens,
        task: CreateTaskDto,
        connectionDetails?: Record<string, unknown>,
    ): Promise<RemoteTask> {
        const databaseId = String(connectionDetails?.['databaseId'] ?? '');
        if (!databaseId) throw new Error('NotionConnector: connectionDetails.databaseId is required');
        const properties: Record<string, unknown> = {
            Name: { title: [{ text: { content: task.title } }] },
        };

        if (task.due) {
            properties['Due date'] = { date: { start: task.due.date.toISOString().split('T')[0] } };
        }

        if (task.priority !== undefined) {
            const priorityName = Object.entries(PRIORITY_MAP).find(([, v]) => v === task.priority)?.[0];

            if (priorityName) {
                properties['Priority'] = { select: { name: this.capitalize(priorityName) } };
            }
        }

        const page = await this.http.post<NotionPage>(
            '/v1/pages',
            { parent: { database_id: databaseId }, properties },
            this.notionHeaders(tokens),
        );

        return this.toRemoteTask(page);
    }

    /** Update an existing Notion page (task). */
    async updateTask(
        tokens: OAuthTokens,
        sourceId: string,
        patch: UpdateTaskDto,
        _connectionDetails?: Record<string, unknown>,
    ): Promise<RemoteTask> {
        const properties: Record<string, unknown> = {};

        if (patch.title !== undefined) {
            properties['Name'] = { title: [{ text: { content: patch.title } }] };
        }

        if (patch.due !== undefined) {
            properties['Due date'] = { date: { start: patch.due.date.toISOString().split('T')[0] } };
        }

        if (patch.priority !== undefined) {
            const priorityName = Object.entries(PRIORITY_MAP).find(([, v]) => v === patch.priority)?.[0];

            properties['Priority'] = priorityName ? { select: { name: this.capitalize(priorityName) } } : { select: null };
        }

        const page = await this.http.patch<NotionPage>(
            `/v1/pages/${sourceId}`,
            { properties },
            this.notionHeaders(tokens),
        );

        return this.toRemoteTask(page);
    }

    /** Mark a Notion page (task) as done by setting Status = "Done". */
    async completeTask(
        tokens: OAuthTokens,
        sourceId: string,
        _connectionDetails?: Record<string, unknown>,
    ): Promise<void> {
        await this.http.patch<NotionPage>(
            `/v1/pages/${sourceId}`,
            { properties: { Status: { status: { name: 'Done' } } } },
            this.notionHeaders(tokens),
        );
    }

    /** Archive a Notion page (soft-delete). */
    async deleteTask(
        tokens: OAuthTokens,
        sourceId: string,
        _connectionDetails?: Record<string, unknown>,
    ): Promise<void> {
        await this.http.patch<NotionPage>(
            `/v1/pages/${sourceId}`,
            { archived: true },
            this.notionHeaders(tokens),
        );
    }

    /** List all databases the user has shared with this integration. */
    async listDatabases(tokens: OAuthTokens): Promise<{ id: string; name: string }[]> {
        const res = await this.http.post<NotionSearchResponse>(
            '/v1/search',
            { filter: { value: 'database', property: 'object' } },
            this.notionHeaders(tokens),
        );

        return res.results.map((db: NotionDatabase) => ({
            id: db.id,
            name: db.title[0]?.plain_text ?? 'Untitled',
        }));
    }

    private toRemoteTask(page: NotionPage): RemoteTask {
        const props = page.properties;

        return {
            sourceId: page.id,
            title: this.extractTitle(props),
            description: null,
            status: this.extractStatus(props),
            priority: this.extractPriority(props),
            due: this.extractDue(props),
            deadline: null,
            duration: null,
            parentSourceId: null,
            tags: this.extractTags(props),
        };
    }

    private extractTitle(props: Record<string, NotionPropertyValue>): string {
        const titleProp = Object.values(props).find((p) => p.type === 'title');

        if (!titleProp || titleProp.type !== 'title') return '';

        const typedProp = titleProp as Extract<NotionPropertyValue, { type: 'title' }>;

        return typedProp.title.map((t) => t.plain_text).join('');
    }

    private extractStatus(props: Record<string, NotionPropertyValue>): 'open' | 'done' {
        const statusKey = Object.keys(props).find((k) => k.toLowerCase() === 'status');

        if (!statusKey) return 'open';

        const prop = props[statusKey];

        if (!prop || prop.type !== 'status') return 'open';

        const statusProp = prop as Extract<NotionPropertyValue, { type: 'status' }>;

        if (!statusProp.status) return 'open';

        return /done/i.test(statusProp.status.name) ? 'done' : 'open';
    }

    private extractPriority(props: Record<string, NotionPropertyValue>): number | null {
        const priorityKey = Object.keys(props).find((k) => k.toLowerCase() === 'priority');

        if (!priorityKey) return null;

        const prop = props[priorityKey];

        if (!prop || prop.type !== 'select') return null;

        const selectProp = prop as Extract<NotionPropertyValue, { type: 'select' }>;

        if (!selectProp.select) return null;

        return PRIORITY_MAP[selectProp.select.name.toLowerCase()] ?? null;
    }

    private extractDue(props: Record<string, NotionPropertyValue>): RemoteTask['due'] {
        const dueKey = Object.keys(props).find((k) => k.toLowerCase() === 'due date');

        if (!dueKey) return null;

        const prop = props[dueKey];

        if (!prop || prop.type !== 'date') return null;

        const dateProp = prop as Extract<NotionPropertyValue, { type: 'date' }>;

        if (!dateProp.date) return null;

        return {
            date: new Date(dateProp.date.start),
            timezone: dateProp.date.time_zone,
            recurrence: null,
        };
    }

    private extractTags(props: Record<string, NotionPropertyValue>): string[] {
        const tagsKey = Object.keys(props).find((k) => k.toLowerCase() === 'tags');

        if (!tagsKey) return [];

        const prop = props[tagsKey];

        if (!prop || prop.type !== 'multi_select') return [];

        const multiSelectProp = prop as Extract<NotionPropertyValue, { type: 'multi_select' }>;

        return multiSelectProp.multi_select.map((t) => t.name);
    }

    private notionHeaders(tokens: OAuthTokens): Record<string, string> {
        return {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Notion-Version': NOTION_VERSION,
        };
    }

    private basicAuth(): string {
        return Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    }

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
