import { HttpClient, type Logger } from '@ctm/http-client';

import { TaskConnectorName } from '../types.js';
import type {
    ConnectionDetailsSchema,
    CreateTaskDto,
    ExternalTaskSource,
    OAuthTokens,
    RemoteTask,
    UpdateTaskDto,
} from '../types.js';
import type {
    NotionBlock,
    NotionBlocksResponse,
    NotionDatabase,
    NotionPage,
    NotionPropertyValue,
    NotionQueryResponse,
    NotionSearchResponse,
} from './notion.types.js';

/** Configuration required to instantiate a {@link NotionTaskSource}. */
export type NotionTaskSourceConfig = {
    logger?: Logger;
};

const NOTION_VERSION = '2022-06-28';

const PRIORITY_MAP: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
};

/** Manage tasks that live in Notion */
export class NotionTaskSource implements ExternalTaskSource {
    readonly name = TaskConnectorName.Notion;

    private readonly http: HttpClient;

    constructor(config: NotionTaskSourceConfig) {
        this.http = new HttpClient({ baseUrl: 'https://api.notion.com', logger: config.logger });
    }

    /** Fetch all tasks from the user's chosen Notion database. Paginates automatically. */
    async fetchTasks(tokens: OAuthTokens, connectionDetails?: { databaseId: string }): Promise<RemoteTask[]> {
        const databaseId = String(connectionDetails?.['databaseId'] ?? '');
        if (!databaseId) throw new Error('NotionTaskSource: connectionDetails.databaseId is required');
        const headers = this.notionHeaders(tokens);
        const tasks: RemoteTask[] = [];
        let cursor: string | null = null;

        do {
            const body: Record<string, unknown> = cursor ? { start_cursor: cursor } : {};
            const res = await this.http.post<NotionQueryResponse>(`/v1/databases/${databaseId}/query`, body, headers);

            const remoteTasks = await Promise.all(
                res.results.map(async (p) => {
                    const description = await this.fetchPageDescription(p.id, headers);

                    return this.toRemoteTask(p, description);
                }),
            );

            tasks.push(...remoteTasks);
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
        if (!databaseId) throw new Error('NotionTaskSource: connectionDetails.databaseId is required');
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

            properties['Priority'] = priorityName
                ? { select: { name: this.capitalize(priorityName) } }
                : { select: null };
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
        await this.http.patch<NotionPage>(`/v1/pages/${sourceId}`, { archived: true }, this.notionHeaders(tokens));
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

    private async fetchPageDescription(pageId: string, headers: Record<string, string>): Promise<string | null> {
        const res = await this.http.get<NotionBlocksResponse>(`/v1/blocks/${pageId}/children`, headers);
        const lines: string[] = [];

        for (const block of res.results) {
            const text = this.extractBlockText(block);

            if (text) lines.push(text);
        }

        return lines.length > 0 ? lines.join('\n') : null;
    }

    private extractBlockText(block: NotionBlock): string {
        const richTextTypes = [
            'paragraph',
            'heading_1',
            'heading_2',
            'heading_3',
            'bulleted_list_item',
            'numbered_list_item',
            'quote',
            'callout',
            'toggle',
        ];

        for (const blockType of richTextTypes) {
            if (block.type === blockType) {
                const inner = block[blockType] as { rich_text?: Array<{ plain_text: string }> } | undefined;

                return inner?.rich_text?.map((t) => t.plain_text).join('') ?? '';
            }
        }

        return '';
    }

    private toRemoteTask(page: NotionPage, description?: string | null): RemoteTask {
        const props = page.properties;

        return {
            sourceId: page.id,
            title: this.extractTitle(props),
            description: description ?? null,
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

        if (!titleProp) return '';

        const typedProp = titleProp as Extract<NotionPropertyValue, { type: 'title' }>;

        return typedProp.title.map((t) => t.plain_text).join('');
    }

    private extractStatus(props: Record<string, NotionPropertyValue>): 'open' | 'done' {
        const statusKey = Object.keys(props).find((k) => k.toLowerCase() === 'status');

        if (!statusKey) return 'open';

        const prop = props[statusKey];

        if (!prop) return 'open';

        if (prop.type === 'status') {
            const statusProp = prop as Extract<NotionPropertyValue, { type: 'status' }>;

            return statusProp.status && /done/i.test(statusProp.status.name) ? 'done' : 'open';
        }

        if (prop.type === 'select') {
            const selectProp = prop as Extract<NotionPropertyValue, { type: 'select' }>;

            return selectProp.select && /done/i.test(selectProp.select.name) ? 'done' : 'open';
        }

        return 'open';
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

    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
