# Discord Connector & NotificationChannel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Discord OAuth into `packages/connectors` as a typed `OAuthConnector`, introduce `NotificationChannel<TConfig>` and `DiscordChannel` in that package, and consolidate the standalone `DiscordConnection` collection into the shared `connectorconfigs` collection.

**Architecture:** `packages/connectors` gains pure, framework-free `DiscordOAuthConnector` and `DiscordChannel` classes. The NestJS `DiscordChannel` wrapper in `apps/main` delegates all HTTP work to the package class and handles DB persistence itself. `ConnectorConfig` adds an `internalSettings` field (never sent to clients) that Discord uses for `botToken` and the cached `dmChannelId`.

**Tech Stack:** TypeScript, NestJS, Mongoose, Discord API v10, vitest

---

## File Map

**Create:**

- `packages/connectors/src/discord/discord.types.ts` — Discord API response shapes
- `packages/connectors/src/discord/discord.oauth.ts` — `DiscordOAuthConnector` + config type
- `packages/connectors/src/discord/discord.oauth.spec.ts` — unit tests (fetch mocked)
- `packages/connectors/src/discord/discord.channel.ts` — `DiscordChannel` + types
- `packages/connectors/src/discord/discord.channel.spec.ts` — unit tests (fetch mocked)

**Modify:**

- `packages/connectors/src/types.ts` — add `NotificationChannel<TConfig>`, `DiscordChannelConfig`
- `packages/connectors/src/index.ts` — export Discord classes and new types
- `apps/main/src/connectors/schemas/connector-config.schema.ts` — add `internalSettings`, `TypedConnectorConfig` union
- `apps/main/src/connectors/connectors.service.ts` — strip `internalSettings` from API responses
- `apps/main/src/connectors/connectors.module.ts` — remove `DiscordConnection`, add `DiscordOAuthConnector` to registry
- `apps/main/src/connectors/discord.controller.ts` — use `DiscordOAuthConnector`, write to `ConnectorConfig`
- `apps/main/src/notifications/channels/discord.channel.ts` — switch to `ConnectorConfig`, delegate to package class
- `apps/main/src/notifications/channels/discord.channel.spec.ts` — update tests for new structure
- `apps/main/src/notifications/notifications.module.ts` — remove `DiscordConnection`, add `ConnectorConfig` model

**Delete:**

- `apps/main/src/connectors/schemas/discord-connection.schema.ts`

---

## Task 1: Add `NotificationChannel<TConfig>` and `DiscordChannelConfig` to shared types

**Files:**

- Modify: `packages/connectors/src/types.ts`

- [ ] **Step 1: Add the two new types** at the bottom of `packages/connectors/src/types.ts`:

```ts
/** Config passed per-send to a Discord notification channel. */
export type DiscordChannelConfig = {
    discordUserId: string;
    botToken: string;
    dmChannelId?: string | null;
};

/** Notification delivery contract. Generic over per-channel connection config. */
export type NotificationChannel<TConfig> = {
    readonly name: string;
    send(args: { config: TConfig; title: string; body: string }): Promise<void>;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @ctm/connectors build
```

Expected: exits 0, no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/connectors/src/types.ts
git commit -m "feat(connectors): add NotificationChannel and DiscordChannelConfig types"
```

---

## Task 2: Create `discord.types.ts`

**Files:**

- Create: `packages/connectors/src/discord/discord.types.ts`

- [ ] **Step 1: Create the file**

```ts
/** OAuth2 token response from POST /oauth2/token */
export type DiscordTokenResponse = {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope: string;
};

/** User object from GET /users/@me */
export type DiscordUserResponse = {
    id: string;
    username: string;
    discriminator: string;
};

/** DM channel response from POST /users/@me/channels */
export type DiscordDmChannelResponse = {
    id: string;
    type: number;
};
```

- [ ] **Step 2: Build to confirm no syntax errors**

```bash
pnpm --filter @ctm/connectors build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/connectors/src/discord/discord.types.ts
git commit -m "feat(connectors): add Discord API response types"
```

---

## Task 3: Create `DiscordOAuthConnector`

**Files:**

- Create: `packages/connectors/src/discord/discord.oauth.ts`
- Create: `packages/connectors/src/discord/discord.oauth.spec.ts`

- [ ] **Step 1: Write the failing test** at `packages/connectors/src/discord/discord.oauth.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OAuthTokens } from '../types.js';
import { DiscordOAuthConnector } from './discord.oauth.js';

const config = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://example.com/connectors/discord/callback',
};

const tokens: OAuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('DiscordOAuthConnector', () => {
    let connector: DiscordOAuthConnector;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        connector = new DiscordOAuthConnector(config);
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
    });

    it('name is "discord"', () => {
        expect(connector.name).toBe('discord');
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, state, identify+bot scope, permissions=2048', () => {
            const url = connector.getAuthUrl('state-xyz');
            expect(url).toContain('client_id=client-id');
            expect(url).toContain('state=state-xyz');
            expect(url).toContain('scope=identify+bot');
            expect(url).toContain('permissions=2048');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('response_type=code');
        });
    });

    describe('exchangeCode', () => {
        it('posts form-encoded body and returns OAuthTokens', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'acc',
                    refresh_token: 'ref',
                    token_type: 'Bearer',
                    expires_in: 604800,
                    scope: 'identify bot',
                }),
            });

            const before = Date.now();
            const result = await connector.exchangeCode('code-abc');
            const after = Date.now();

            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/oauth2/token');
            expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
            expect(result.accessToken).toBe('acc');
            expect(result.refreshToken).toBe('ref');
            expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 604800 * 1000);
            expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 604800 * 1000);
        });

        it('throws on non-ok response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 400 });
            await expect(connector.exchangeCode('bad-code')).rejects.toThrow('Discord token exchange failed: 400');
        });
    });

    describe('refreshToken', () => {
        it('posts refresh_token grant and returns updated tokens', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'new-acc',
                    refresh_token: 'new-ref',
                    token_type: 'Bearer',
                    expires_in: 604800,
                    scope: 'identify bot',
                }),
            });

            const result = await connector.refreshToken(tokens);

            expect(result.accessToken).toBe('new-acc');
            expect(result.refreshToken).toBe('new-ref');
        });

        it('falls back to existing refreshToken if response omits it', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'new-acc',
                    token_type: 'Bearer',
                    expires_in: 604800,
                    scope: 'identify bot',
                }),
            });

            const result = await connector.refreshToken(tokens);
            expect(result.refreshToken).toBe(tokens.refreshToken);
        });
    });

    describe('resolveUserId', () => {
        it('calls GET /users/@me with Bearer token and returns the user id', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({ id: 'discord-user-123', username: 'testuser', discriminator: '0001' }),
            });

            const id = await connector.resolveUserId(tokens);

            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/users/@me');
            expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
            expect(id).toBe('discord-user-123');
        });

        it('throws on non-ok response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 401 });
            await expect(connector.resolveUserId(tokens)).rejects.toThrow('Discord user fetch failed: 401');
        });
    });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @ctm/connectors test discord.oauth.spec.ts
```

Expected: FAIL — `DiscordOAuthConnector` not found.

- [ ] **Step 3: Implement `discord.oauth.ts`**

```ts
import type { OAuthConnector, OAuthTokens } from '../types.js';
import type { DiscordTokenResponse, DiscordUserResponse } from './discord.types.js';

const DISCORD_API = 'https://discord.com/api/v10';

/** Configuration required to instantiate a {@link DiscordOAuthConnector}. */
export type DiscordOAuthConnectorConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
};

export class DiscordOAuthConnector implements OAuthConnector {
    readonly name = 'discord';

    constructor(private readonly config: DiscordOAuthConnectorConfig) {}

    /** Build the Discord OAuth2 authorization URL. Requests identify + bot scopes with DM permission. */
    getAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'identify bot',
            permissions: '2048',
            state,
        });

        return `https://discord.com/oauth2/authorize?${params.toString()}`;
    }

    /** Exchange authorization code for Discord OAuth tokens. */
    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`);

        const data = (await res.json()) as DiscordTokenResponse;

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? '',
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    /** Refresh an expired Discord access token. */
    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const res = await fetch(`${DISCORD_API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            }),
        });

        if (!res.ok) throw new Error(`Discord token refresh failed: ${res.status}`);

        const data = (await res.json()) as DiscordTokenResponse;

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? tokens.refreshToken,
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };
    }

    /** Fetch the Discord snowflake user ID for the given access token. */
    async resolveUserId(tokens: OAuthTokens): Promise<string> {
        const res = await fetch(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });

        if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`);

        const data = (await res.json()) as DiscordUserResponse;

        return data.id;
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @ctm/connectors test discord.oauth.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors/src/discord/
git commit -m "feat(connectors): add DiscordOAuthConnector"
```

---

## Task 4: Create `DiscordChannel` in `packages/connectors`

**Files:**

- Create: `packages/connectors/src/discord/discord.channel.ts`
- Create: `packages/connectors/src/discord/discord.channel.spec.ts`

- [ ] **Step 1: Write the failing test** at `packages/connectors/src/discord/discord.channel.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordChannel } from './discord.channel.js';
import type { DiscordChannelConfig } from '../types.js';

const config: DiscordChannelConfig = {
    discordUserId: 'discord-user-1',
    botToken: 'bot-token',
    dmChannelId: 'chan-99',
};

describe('DiscordChannel', () => {
    let channel: DiscordChannel;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        channel = new DiscordChannel();
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);
    });

    it('name is "discord"', () => {
        expect(channel.name).toBe('discord');
    });

    describe('send', () => {
        it('sends a message to the cached dmChannelId', async () => {
            fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

            await channel.send({ config, title: 'Hi', body: 'Go!' });

            expect(fetchSpy).toHaveBeenCalledOnce();
            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/channels/chan-99/messages');
            expect((opts.headers as Record<string, string>).Authorization).toBe('Bot bot-token');
            const body = JSON.parse(opts.body as string) as { content: string };
            expect(body.content).toContain('Hi');
            expect(body.content).toContain('Go!');
        });

        it('opens a DM channel when dmChannelId is null', async () => {
            const configWithoutChannel: DiscordChannelConfig = { ...config, dmChannelId: null };
            fetchSpy
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-chan', type: 1 }) })
                .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

            await channel.send({ config: configWithoutChannel, title: 'T', body: 'B' });

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const [firstUrl] = fetchSpy.mock.calls[0] as [string];
            expect(firstUrl).toBe('https://discord.com/api/v10/users/@me/channels');
        });

        it('throws on 401 when opening DM channel', async () => {
            const configWithoutChannel: DiscordChannelConfig = { ...config, dmChannelId: null };
            fetchSpy.mockResolvedValue({ ok: false, status: 401 });

            await expect(channel.send({ config: configWithoutChannel, title: 'T', body: 'B' })).rejects.toThrow(
                'Discord open DM failed: 401',
            );
        });

        it('throws on non-ok response when sending a message', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 500 });

            await expect(channel.send({ config, title: 'T', body: 'B' })).rejects.toThrow(
                'Discord send message failed: 500',
            );
        });
    });

    describe('openDmChannel', () => {
        it('POSTs to /users/@me/channels and returns the channel id', async () => {
            fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ id: 'ch-123', type: 1 }) });

            const id = await channel.openDmChannel({ botToken: 'bot-token', discordUserId: 'user-1' });

            expect(id).toBe('ch-123');
            const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('https://discord.com/api/v10/users/@me/channels');
            expect((opts.headers as Record<string, string>).Authorization).toBe('Bot bot-token');
        });

        it('throws on non-ok response', async () => {
            fetchSpy.mockResolvedValue({ ok: false, status: 403 });
            await expect(channel.openDmChannel({ botToken: 'bot-token', discordUserId: 'user-1' })).rejects.toThrow(
                'Discord open DM failed: 403',
            );
        });
    });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @ctm/connectors test discord.channel.spec.ts
```

Expected: FAIL — `DiscordChannel` not found.

- [ ] **Step 3: Implement `discord.channel.ts`**

```ts
import type { NotificationChannel, DiscordChannelConfig } from '../types.js';
import type { DiscordDmChannelResponse } from './discord.types.js';

const DISCORD_API = 'https://discord.com/api/v10';

export class DiscordChannel implements NotificationChannel<DiscordChannelConfig> {
    readonly name = 'discord';

    /** Send a DM via Discord bot. Opens a DM channel first if dmChannelId is absent. */
    async send({ config, title, body }: { config: DiscordChannelConfig; title: string; body: string }): Promise<void> {
        const channelId = config.dmChannelId ?? (await this.openDmChannel(config));

        await this.sendMessage({ channelId, botToken: config.botToken, content: `**${title}**\n${body}` });
    }

    /** Open a DM channel with a Discord user and return the channel ID. */
    async openDmChannel({ botToken, discordUserId }: { botToken: string; discordUserId: string }): Promise<string> {
        const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
            method: 'POST',
            headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: discordUserId }),
        });

        if (!res.ok) throw new Error(`Discord open DM failed: ${res.status}`);

        const data = (await res.json()) as DiscordDmChannelResponse;

        return data.id;
    }

    private async sendMessage({
        channelId,
        botToken,
        content,
    }: {
        channelId: string;
        botToken: string;
        content: string;
    }): Promise<void> {
        const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });

        if (!res.ok) throw new Error(`Discord send message failed: ${res.status}`);
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @ctm/connectors test discord.channel.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors/src/discord/discord.channel.ts packages/connectors/src/discord/discord.channel.spec.ts
git commit -m "feat(connectors): add DiscordChannel implementing NotificationChannel"
```

---

## Task 5: Export Discord classes from `packages/connectors`

**Files:**

- Modify: `packages/connectors/src/index.ts`

- [ ] **Step 1: Add Discord exports** to `packages/connectors/src/index.ts`:

```ts
export type {
    RemoteTask,
    OAuthTokens,
    CreateTaskDto,
    UpdateTaskDto,
    OAuthConnector,
    ExternalTaskSource,
    ConnectionField,
    ConnectionDetailsSchema,
    NotificationChannel,
    DiscordChannelConfig,
} from './types.js';
export { OAuthConnectorRegistry, ExternalTaskSourceRegistry } from './registry.js';
export { TodoistOAuthConnector } from './todoist/todoist.oauth.js';
export type { TodoistOAuthConnectorConfig } from './todoist/todoist.oauth.js';
export { TodoistTaskSource } from './todoist/todoist.source.js';
export type { TodoistTaskSourceConfig } from './todoist/todoist.source.js';
export { GoogleTasksOAuthConnector } from './google-tasks/google-tasks.oauth.js';
export type { GoogleTasksOAuthConnectorConfig } from './google-tasks/google-tasks.oauth.js';
export { GoogleTasksTaskSource } from './google-tasks/google-tasks.source.js';
export type { GoogleTasksTaskSourceConfig } from './google-tasks/google-tasks.source.js';
export { NotionOAuthConnector } from './notion/notion.oauth.js';
export type { NotionOAuthConnectorConfig } from './notion/notion.oauth.js';
export { NotionTaskSource } from './notion/notion.source.js';
export type { NotionTaskSourceConfig } from './notion/notion.source.js';
export { DiscordOAuthConnector } from './discord/discord.oauth.js';
export type { DiscordOAuthConnectorConfig } from './discord/discord.oauth.js';
export { DiscordChannel } from './discord/discord.channel.js';
```

- [ ] **Step 2: Build the package**

```bash
pnpm --filter @ctm/connectors build
```

Expected: exits 0, all exports resolve.

- [ ] **Step 3: Commit**

```bash
git add packages/connectors/src/index.ts
git commit -m "feat(connectors): export Discord connector and channel classes"
```

---

## Task 6: Add `internalSettings` + `TypedConnectorConfig` to the schema

**Files:**

- Modify: `apps/main/src/connectors/schemas/connector-config.schema.ts`

- [ ] **Step 1: Add the `internalSettings` prop and `TypedConnectorConfig` type**

Replace the full file content with:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Mongoose document type for ConnectorConfig. */
export type ConnectorConfigDocument = HydratedDocument<ConnectorConfig>;

type OAuthConnectorConfig = {
    source: 'todoist' | 'google_tasks' | 'notion';
    settings: Record<string, unknown>;
    internalSettings: Record<string, unknown>;
};

type DiscordConnectorConfig = {
    source: 'discord';
    settings: { discordUserId: string };
    internalSettings: { botToken: string; dmChannelId: string | null };
};

/** `ConnectorConfig` narrowed by `source` discriminant. */
export type TypedConnectorConfig = ConnectorConfig & (OAuthConnectorConfig | DiscordConnectorConfig);

@Schema({ timestamps: true })
export class ConnectorConfig {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId!: Types.ObjectId;

    @Prop({ type: String, required: true, maxlength: 50 })
    source!: string;

    @Prop({ type: String, required: true })
    accessToken!: string;

    @Prop({ type: String, default: '' })
    refreshToken!: string;

    @Prop({ type: Date, required: true })
    tokenExpiresAt!: Date;

    @Prop({ type: Object, default: {} })
    settings!: Record<string, unknown>;

    /** Server-only config — never included in API responses. */
    @Prop({ type: Object, default: {} })
    internalSettings!: Record<string, unknown>;

    @Prop({ type: Date, default: null })
    lastSyncedAt!: Date | null;

    @Prop({ type: String, default: null, maxlength: 2000 })
    lastError!: string | null;

    @Prop({ type: Boolean, default: true })
    enabled!: boolean;
}

export const ConnectorConfigSchema = SchemaFactory.createForClass(ConnectorConfig);
ConnectorConfigSchema.index({ userId: 1, source: 1 }, { unique: true });
```

- [ ] **Step 2: Build `apps/main` to confirm no type errors**

```bash
pnpm --filter @ctm/main build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/connectors/schemas/connector-config.schema.ts
git commit -m "feat(main): add internalSettings field and TypedConnectorConfig discriminated union"
```

---

## Task 7: Strip `internalSettings` from API responses in `ConnectorsController`

**Files:**

- Modify: `apps/main/src/connectors/connectors.controller.ts`

- [ ] **Step 1: Verify where `settings` is returned to the client**

Open `apps/main/src/connectors/connectors.controller.ts`. The `listConfigs` method at line 57 maps configs — confirm it does NOT include `settings` or `internalSettings` in the mapped object. If it doesn't, no change needed here. If it does, remove both fields from the mapping.

The current map (around line 60) is:

```ts
return configs.map((c) => ({
    id: String(c._id),
    source: c.source,
    enabled: c.enabled,
    lastSyncedAt: c.lastSyncedAt,
    lastError: c.lastError,
}));
```

`settings` and `internalSettings` are already excluded — no change required.

- [ ] **Step 2: Check `ConnectorsService.update` patch validation**

In `apps/main/src/connectors/connectors.service.ts`, `update` accepts `patch: { enabled?: boolean; settings?: Record<string, unknown> }`. Confirm that `internalSettings` is not patchable via this method. The current type already excludes it — no change needed.

- [ ] **Step 3: Commit (even if no changes — document the decision)**

```bash
git commit --allow-empty -m "chore(main): verify internalSettings excluded from all API responses"
```

---

## Task 8: Refactor `apps/main` `DiscordChannel` to delegate to package

**Files:**

- Modify: `apps/main/src/notifications/channels/discord.channel.ts`
- Modify: `apps/main/src/notifications/channels/discord.channel.spec.ts`

- [ ] **Step 1: Write new failing tests** (replace existing `discord.channel.spec.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { DiscordChannel } from './discord.channel.js';
import { ConnectorConfig } from '../../connectors/schemas/connector-config.schema.js';
import type { TypedConnectorConfig } from '../../connectors/schemas/connector-config.schema.js';

function makeDiscordConfig(overrides?: Partial<{ dmChannelId: string | null }>): TypedConnectorConfig {
    return {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        source: 'discord',
        accessToken: '',
        refreshToken: '',
        tokenExpiresAt: new Date(),
        settings: { discordUserId: 'discord-user-1' },
        internalSettings: { botToken: 'bot-token', dmChannelId: overrides?.dmChannelId ?? 'chan-99' },
        enabled: true,
        lastSyncedAt: null,
        lastError: null,
    } as unknown as TypedConnectorConfig;
}

describe('DiscordChannel (NestJS wrapper)', () => {
    let channel: DiscordChannel;
    let mockFindOne: ReturnType<typeof vi.fn>;
    let mockFindOneAndUpdate: ReturnType<typeof vi.fn>;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        mockFindOne = vi.fn();
        mockFindOneAndUpdate = vi.fn().mockResolvedValue({});
        fetchSpy = vi.fn();
        vi.stubGlobal('fetch', fetchSpy);

        const module = await Test.createTestingModule({
            providers: [
                DiscordChannel,
                {
                    provide: getModelToken(ConnectorConfig.name),
                    useValue: { findOne: mockFindOne, findOneAndUpdate: mockFindOneAndUpdate },
                },
            ],
        }).compile();

        channel = module.get(DiscordChannel);
    });

    it('is a no-op when user has no discord ConnectorConfig', async () => {
        mockFindOne.mockResolvedValue(null);
        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'T', body: 'B' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('sends a message to the cached dmChannelId', async () => {
        mockFindOne.mockResolvedValue(makeDiscordConfig({ dmChannelId: 'chan-99' }));
        fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'Hi', body: 'Go!' });

        expect(fetchSpy).toHaveBeenCalledOnce();
        const [url] = fetchSpy.mock.calls[0] as [string];
        expect(url).toBe('https://discord.com/api/v10/channels/chan-99/messages');
    });

    it('opens a DM channel and persists dmChannelId when null', async () => {
        mockFindOne.mockResolvedValue(makeDiscordConfig({ dmChannelId: null }));
        fetchSpy
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 'new-chan', type: 1 }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

        await channel.send({ userId: new Types.ObjectId().toHexString(), type: 'reminder', title: 'T', body: 'B' });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
        expect(mockFindOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ source: 'discord' }), {
            'internalSettings.dmChannelId': 'new-chan',
        });
    });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @ctm/main test discord.channel.spec.ts
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Implement the new `DiscordChannel` wrapper**

Replace `apps/main/src/notifications/channels/discord.channel.ts` with:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscordChannel as DiscordChannelConnector } from '@ctm/connectors';
import {
    ConnectorConfig,
    type ConnectorConfigDocument,
    type TypedConnectorConfig,
} from '../../connectors/schemas/connector-config.schema.js';
import type { SendNotificationDto } from '../dto/send-notification.dto.js';

const connector = new DiscordChannelConnector();

@Injectable()
export class DiscordChannel {
    private readonly logger = new Logger(DiscordChannel.name);

    constructor(@InjectModel(ConnectorConfig.name) private readonly model: Model<ConnectorConfigDocument>) {}

    /** Send a DM via Discord bot. No-op if the user has no discord ConnectorConfig. */
    async send({ userId, title, body }: SendNotificationDto): Promise<void> {
        const config = await this.model.findOne({
            userId: new Types.ObjectId(userId),
            source: 'discord',
        });

        if (!config) return;

        const typed = config as unknown as TypedConnectorConfig & { source: 'discord' };
        const { discordUserId } = typed.settings;
        const { botToken, dmChannelId } = typed.internalSettings;

        if (!dmChannelId) {
            const openedChannelId = await connector.openDmChannel({ botToken, discordUserId });

            await this.model.findOneAndUpdate(
                { userId: new Types.ObjectId(userId), source: 'discord' },
                { 'internalSettings.dmChannelId': openedChannelId },
            );

            await connector.send({ config: { discordUserId, botToken, dmChannelId: openedChannelId }, title, body });

            return;
        }

        await connector.send({ config: { discordUserId, botToken, dmChannelId }, title, body });
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @ctm/main test discord.channel.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/notifications/channels/discord.channel.ts apps/main/src/notifications/channels/discord.channel.spec.ts
git commit -m "refactor(main): DiscordChannel delegates to @ctm/connectors, reads from ConnectorConfig"
```

---

## Task 9: Refactor `DiscordController` to use `DiscordOAuthConnector`

**Files:**

- Modify: `apps/main/src/connectors/discord.controller.ts`

- [ ] **Step 1: Replace the controller**

Replace `apps/main/src/connectors/discord.controller.ts` with:

```ts
import {
    Controller,
    Get,
    Post,
    Delete,
    Query,
    Request,
    Res,
    UseGuards,
    HttpCode,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DiscordOAuthConnector, DiscordChannel as DiscordChannelConnector } from '@ctm/connectors';
import { CombinedAuthGuard } from '../auth/guards/combined-auth.guard.js';
import {
    ConnectorConfig,
    type ConnectorConfigDocument,
    type TypedConnectorConfig,
} from './schemas/connector-config.schema.js';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';

type OAuthStatePayload = { sub: string };

const TEST_MESSAGES = [
    '👋 Hey! Your CTM notifications are working perfectly!',
    "🎉 Connection successful! I'll ping you here when something needs your attention.",
    '✅ All systems go! CTM is ready to send you notifications.',
    "🚀 Discord connected! You're all set to receive task reminders here.",
    '💬 Hello from CTM! Notifications are live and ready to go.',
];

interface AuthRequest {
    user: JwtPayload;
}

@ApiTags('Discord')
@Controller('connectors/discord')
export class DiscordController {
    private readonly logger = new Logger(DiscordController.name);
    private readonly oauthConnector: DiscordOAuthConnector;
    private readonly channelConnector = new DiscordChannelConnector();

    constructor(
        private readonly config: ConfigService,
        private readonly jwt: JwtService,
        @InjectModel(ConnectorConfig.name) private readonly configModel: Model<ConnectorConfigDocument>,
    ) {
        this.oauthConnector = new DiscordOAuthConnector({
            clientId: config.getOrThrow<string>('DISCORD_CLIENT_ID'),
            clientSecret: config.getOrThrow<string>('DISCORD_CLIENT_SECRET'),
            redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/discord/callback`,
        });
    }

    /** Return the Discord OAuth2 URL (for programmatic clients). */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get Discord OAuth URL' })
    @UseGuards(CombinedAuthGuard)
    @Get('connect-url')
    connectUrl(@Request() req: AuthRequest): { url: string } {
        const state = this.jwt.sign({ sub: req.user.sub }, { expiresIn: '15m' });

        return { url: this.oauthConnector.getAuthUrl(state) };
    }

    /** Redirect user to Discord OAuth2 consent screen. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Connect Discord — redirect to OAuth' })
    @UseGuards(CombinedAuthGuard)
    @Get('connect')
    async connect(@Request() req: AuthRequest, @Res() res: FastifyReply): Promise<void> {
        const { url } = this.connectUrl(req);
        await res.status(302).header('Location', url).send();
    }

    /** Discord OAuth2 callback — called by Discord after user grants access. No auth required. */
    @ApiOperation({ summary: 'Discord OAuth callback (called by Discord)' })
    @Get('callback')
    @HttpCode(302)
    async callback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Res() res: FastifyReply,
    ): Promise<void> {
        const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:5173');

        try {
            let userId: string;

            try {
                const payload = this.jwt.verify<OAuthStatePayload>(state);
                userId = payload.sub;
            } catch {
                throw new UnauthorizedException('Invalid or expired OAuth state');
            }

            const tokens = await this.oauthConnector.exchangeCode(code);
            const discordUserId = await this.oauthConnector.resolveUserId(tokens);
            const botToken = this.config.getOrThrow<string>('DISCORD_BOT_TOKEN');

            await this.configModel.findOneAndUpdate(
                { userId: new Types.ObjectId(userId), source: 'discord' },
                {
                    userId: new Types.ObjectId(userId),
                    source: 'discord',
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    tokenExpiresAt: tokens.expiresAt,
                    settings: { discordUserId },
                    internalSettings: { botToken, dmChannelId: null },
                    enabled: true,
                    lastError: null,
                },
                { upsert: true, new: true },
            );

            this.logger.log(`Discord connected: appUserId=${userId} discordUserId=${discordUserId}`);

            await res.status(302).header('Location', `${webUrl}/settings/sources?discord=connected`).send();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Discord callback failed: ${message}`);
            await res
                .status(302)
                .header('Location', `${webUrl}/settings/sources?error=${encodeURIComponent(message)}`)
                .send();
        }
    }

    /** Send a test DM to verify the Discord connection is working. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Test Discord connection' })
    @UseGuards(CombinedAuthGuard)
    @Post('test')
    async test(@Request() req: AuthRequest): Promise<{ sent: boolean }> {
        const config = await this.configModel.findOne({
            userId: new Types.ObjectId(req.user.sub),
            source: 'discord',
        });

        if (!config) return { sent: false };

        const typed = config as unknown as TypedConnectorConfig & { source: 'discord' };
        const { discordUserId } = typed.settings;
        const { botToken, dmChannelId } = typed.internalSettings;

        const message = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)]!;

        let resolvedChannelId = dmChannelId;

        if (!resolvedChannelId) {
            resolvedChannelId = await this.channelConnector.openDmChannel({ botToken, discordUserId });
            await this.configModel.findOneAndUpdate(
                { userId: new Types.ObjectId(req.user.sub), source: 'discord' },
                { 'internalSettings.dmChannelId': resolvedChannelId },
            );
        }

        await this.channelConnector.send({
            config: { discordUserId, botToken, dmChannelId: resolvedChannelId },
            title: message,
            body: '',
        });

        return { sent: true };
    }

    /** Disconnect Discord — removes stored connection. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Disconnect Discord' })
    @UseGuards(CombinedAuthGuard)
    @Delete()
    @HttpCode(204)
    async disconnect(@Request() req: AuthRequest): Promise<void> {
        await this.configModel.deleteOne({ userId: new Types.ObjectId(req.user.sub), source: 'discord' });
    }

    /** Get Discord connection status for the current user. */
    @ApiBearerAuth('jwt')
    @ApiOperation({ summary: 'Get Discord connection status' })
    @UseGuards(CombinedAuthGuard)
    @Get('status')
    async status(@Request() req: AuthRequest): Promise<{ connected: boolean; discordUserId?: string }> {
        const config = await this.configModel.findOne({
            userId: new Types.ObjectId(req.user.sub),
            source: 'discord',
        });

        if (!config) return { connected: false };

        const typed = config as unknown as TypedConnectorConfig & { source: 'discord' };

        return { connected: true, discordUserId: typed.settings.discordUserId };
    }
}
```

- [ ] **Step 2: Build `apps/main` to confirm no type errors**

```bash
pnpm --filter @ctm/main build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/connectors/discord.controller.ts
git commit -m "refactor(main): DiscordController uses DiscordOAuthConnector from @ctm/connectors"
```

---

## Task 10: Update modules and delete `DiscordConnection` schema

**Files:**

- Modify: `apps/main/src/connectors/connectors.module.ts`
- Modify: `apps/main/src/notifications/notifications.module.ts`
- Delete: `apps/main/src/connectors/schemas/discord-connection.schema.ts`

- [ ] **Step 1: Update `connectors.module.ts`** — remove `DiscordConnection` import and `MongooseModule` entry:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
    OAuthConnectorRegistry,
    ExternalTaskSourceRegistry,
    TodoistOAuthConnector,
    TodoistTaskSource,
    GoogleTasksOAuthConnector,
    GoogleTasksTaskSource,
    NotionOAuthConnector,
    NotionTaskSource,
} from '@ctm/connectors';
import { createLogger } from '@ctm/logger';
import { ConnectorConfig, ConnectorConfigSchema } from './schemas/connector-config.schema.js';
import { ConnectorsService } from './connectors.service.js';
import { ConnectorsController } from './connectors.controller.js';
import { DiscordController } from './discord.controller.js';
import { EncryptionService } from './encryption.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: ConnectorConfig.name, schema: ConnectorConfigSchema }]),
        AuthModule,
        UsersModule,
    ],
    controllers: [ConnectorsController, DiscordController],
    providers: [
        ConnectorsService,
        EncryptionService,
        {
            provide: OAuthConnectorRegistry,
            inject: [ConfigService],
            useFactory: (config: ConfigService): OAuthConnectorRegistry => {
                const registry = new OAuthConnectorRegistry();
                const logger = createLogger('connectors');

                registry.register(
                    new TodoistOAuthConnector({
                        clientId: config.getOrThrow<string>('TODOIST_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('TODOIST_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/todoist`,
                        logger,
                    }),
                );

                registry.register(
                    new GoogleTasksOAuthConnector({
                        clientId: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/google_tasks`,
                        logger,
                    }),
                );

                registry.register(
                    new NotionOAuthConnector({
                        clientId: config.getOrThrow<string>('NOTION_CLIENT_ID'),
                        clientSecret: config.getOrThrow<string>('NOTION_CLIENT_SECRET'),
                        redirectUri: `${config.getOrThrow<string>('REDIRECT_BASE_URL')}/connectors/oauth/callback/notion`,
                        logger,
                    }),
                );

                return registry;
            },
        },
        {
            provide: ExternalTaskSourceRegistry,
            useFactory: (): ExternalTaskSourceRegistry => {
                const registry = new ExternalTaskSourceRegistry();
                const logger = createLogger('connectors');

                registry.register(new TodoistTaskSource({ logger }));
                registry.register(new GoogleTasksTaskSource({ logger }));
                registry.register(new NotionTaskSource({ logger }));

                return registry;
            },
        },
    ],
    exports: [ConnectorsService, EncryptionService, OAuthConnectorRegistry, ExternalTaskSourceRegistry],
})
export class ConnectorsModule {}
```

- [ ] **Step 2: Update `notifications.module.ts`** — remove `DiscordConnection`, add `ConnectorConfig`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './schemas/notification.schema.js';
import { ConnectorConfig, ConnectorConfigSchema } from '../connectors/schemas/connector-config.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { InAppChannel } from './channels/in-app.channel.js';
import { EmailChannel } from './channels/email.channel.js';
import { DiscordChannel } from './channels/discord.channel.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { UsersModule } from '../users/users.module.js';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
            { name: ConnectorConfig.name, schema: ConnectorConfigSchema },
            { name: User.name, schema: UserSchema },
        ]),
        UsersModule,
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService, InAppChannel, EmailChannel, DiscordChannel],
    exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 3: Update `notifications.service.ts`** — remove `DiscordAuthExpiredError` (bot tokens don't expire via user OAuth; failures are now generic and caught by `safeRun`).

Replace the import line:

```ts
import { DiscordChannel, DiscordAuthExpiredError } from './channels/discord.channel.js';
```

with:

```ts
import { DiscordChannel } from './channels/discord.channel.js';
```

Replace the `sendDiscord` private method:

```ts
private async sendDiscord(dto: SendNotificationDto): Promise<void> {
    await this.discord.send(dto);
}
```

- [ ] **Step 4: Delete the old schema file**

```bash
git rm apps/main/src/connectors/schemas/discord-connection.schema.ts
```

- [ ] **Step 5: Update `notifications.service.ts`** — remove `DiscordAuthExpiredError` (bot tokens don't expire via user OAuth; generic failures are already caught by `safeRun`).

Replace the import:

```ts
import { DiscordChannel, DiscordAuthExpiredError } from './channels/discord.channel.js';
```

with:

```ts
import { DiscordChannel } from './channels/discord.channel.js';
```

Replace the `sendDiscord` private method:

```ts
private async sendDiscord(dto: SendNotificationDto): Promise<void> {
    await this.discord.send(dto);
}
```

- [ ] **Step 6: Delete the old schema file**

```bash
git rm apps/main/src/connectors/schemas/discord-connection.schema.ts
```

- [ ] **Step 7: Build and run all tests**

```bash
pnpm --filter @ctm/main build && pnpm --filter @ctm/main test
```

Expected: build exits 0, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/main/src/connectors/connectors.module.ts apps/main/src/notifications/notifications.module.ts apps/main/src/notifications/notifications.service.ts
git commit -m "refactor(main): remove DiscordConnection schema, use ConnectorConfig for discord"
```

---

## Task 11: Final build and test pass

- [ ] **Step 1: Run full workspace build**

```bash
pnpm build
```

Expected: all packages build, exits 0.

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: exits 0, no errors.
