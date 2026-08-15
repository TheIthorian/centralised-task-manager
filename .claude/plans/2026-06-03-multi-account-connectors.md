# Multi-Account Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user connect any number of accounts per connector source, list them by email/label in the UI, pull tasks from every account, and stamp each task with the external account it came from.

**Architecture:** Generalise the singleton `(userId, source)` connector model into one row per connected account, keyed by the provider's external account id. Each `OAuthConnector` learns to resolve its account identity. Sync iterates every connection; tasks carry `externalAccountId`. Push/write-back is out of scope.

**Tech Stack:** NestJS (Fastify), Mongoose/MongoDB, Vitest (real DB), Vite+React, `@ctm/connectors`, `@ctm/api-client`.

**Spec:** `.claude/specs/2026-06-03-multi-account-connectors-design.md`

---

## Conventions (read first)

- Run a single package's tests with `pnpm --filter @ctm/<pkg> test`.
- Integration tests use the real DB. `MONGODB_URI` is in `process.env` (set by `apps/main/vitest.setup.ts`). Never mock the DB. Use `Date.now()` for unique ids. No cleanup.
- Never use `any`. Explicit return types. Object args for 2+ params. Typed errors from `@ctm/errors`. Blank line around log statements. Trailing commas.
- Request/response types live in `packages/api-client/src/types.ts`; DTO classes `implements` them.
- Conventional Commits, scope `connectors` / `main` / `web`.

## File Structure

**`packages/connectors`**

- `src/types.ts` — add `AccountIdentity` type + `resolveAccountIdentity` to `OAuthConnector`.
- `src/google-tasks/google-tasks.oauth.ts` — add email scope + identity via userinfo.
- `src/google-tasks/google-tasks.types.ts` — add `GoogleUserInfo`.
- `src/notion/notion.oauth.ts` — identity via `/v1/users/me`.
- `src/notion/notion.types.ts` — add `NotionMeResponse`.
- `src/todoist/todoist.oauth.ts` — identity via Todoist sync user.
- `src/todoist/todoist.types.ts` — add `TodoistUser`.

**`apps/main`**

- `src/connectors/schemas/connector-config.schema.ts` — new fields + indexes.
- `src/connectors/connectors.service.ts` — re-key to connection.
- `src/connectors/connectors.controller.ts` — `accounts[]` + per-connection routes.
- `src/tasks/schemas/task.schema.ts` — `externalAccountId` + index.
- `src/tasks/tasks.service.ts` — `upsertFromRemote` stamps `externalAccountId`.
- `src/jobs/schemas/task-sync-job.schema.ts` — `connectionId`.
- `src/sync/sync.service.ts` — sync per connection.
- `src/sync/sync.controller.ts` — route by connectionId.
- `src/sync/sync-job.dto.ts` — expose `connectionId`.

**`packages/api-client`**

- `src/types.ts` — `ConnectorAccountDto`, updated `ConnectorStatusDto`, `TaskSyncJobDto`, `TaskDto`.
- `src/index.ts` — export new types; client methods take `connectionId`.

**`apps/web`**

- `src/pages/SourcesPage.tsx` — group by source, track jobs by connectionId.
- `src/components/sources/SourceCard.tsx` — source group with account rows + "+ Add account".

---

## PHASE 1 — Connector identity resolution (`@ctm/connectors`)

### Task 1: Add `AccountIdentity` type + interface method

**Files:**

- Modify: `packages/connectors/src/types.ts`

- [ ] **Step 1: Add the type and interface method**

In `packages/connectors/src/types.ts`, add near `OAuthTokens`:

```ts
/** Identity of a single connected external account. */
export type AccountIdentity = {
    /** Provider's stable account id. Used as the per-account key. */
    externalAccountId: string;
    /** Account email, when the provider exposes one. */
    email?: string;
    /** Human-friendly label (e.g. a Notion workspace name) when no email. */
    label?: string;
};
```

Add this required method to the `OAuthConnector` type (after `resolveConnectionSettings?`):

```ts
    /** Resolve the external account identity for a freshly-connected token set. */
    resolveAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity>;
```

- [ ] **Step 2: Verify the package fails to compile (proves every connector must implement it)**

Run: `pnpm --filter @ctm/connectors build`
Expected: FAIL — `TodoistOAuthConnector`, `GoogleTasksOAuthConnector`, `NotionOAuthConnector`, `DiscordOAuthConnector` do not implement `resolveAccountIdentity`.

- [ ] **Step 3: Commit (type only — implementations follow in next tasks)**

```bash
git add packages/connectors/src/types.ts
git commit -m "feat(connectors): add AccountIdentity type and resolveAccountIdentity contract"
```

> The build stays red until Tasks 2–5 add implementations. That is expected; do not move to Phase 2 until green.

---

### Task 2: Google Tasks identity (userinfo + email scope)

**Files:**

- Modify: `packages/connectors/src/google-tasks/google-tasks.types.ts`
- Modify: `packages/connectors/src/google-tasks/google-tasks.oauth.ts`
- Test: `packages/connectors/src/google-tasks/google-tasks.oauth.spec.ts`

- [ ] **Step 1: Add the user-info type**

In `google-tasks.types.ts`:

```ts
/** Response from the Google OAuth2 userinfo endpoint. */
export type GoogleUserInfo = {
    sub: string;
    email: string;
};
```

- [ ] **Step 2: Write the failing test**

Add to `google-tasks.oauth.spec.ts` (follow the existing mocking style in that file for `HttpClient`):

```ts
it('resolveAccountIdentity returns sub as externalAccountId and email', async () => {
    const connector = new GoogleTasksOAuthConnector({
        clientId: 'id',
        clientSecret: 'secret',
        redirectUri: 'http://cb',
    });

    // @ts-expect-error private http replaced for test
    connector['http'] = {
        get: async () => ({ sub: 'google-123', email: 'a@b.com' }),
    };

    const identity = await connector.resolveAccountIdentity({
        accessToken: 'tok',
        refreshToken: 'r',
        expiresAt: new Date(),
    });

    expect(identity).toEqual({ externalAccountId: 'google-123', email: 'a@b.com' });
});

it('getAuthUrl requests the email scope', () => {
    const connector = new GoogleTasksOAuthConnector({
        clientId: 'id',
        clientSecret: 'secret',
        redirectUri: 'http://cb',
    });

    expect(connector.getAuthUrl('state')).toContain('email');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ctm/connectors test google-tasks.oauth`
Expected: FAIL — `resolveAccountIdentity is not a function`.

- [ ] **Step 4: Implement**

In `google-tasks.oauth.ts`:

1. Import the new type: add `GoogleUserInfo` to the existing `import type { ... } from './google-tasks.types.js'`.
2. Widen the scope in `getAuthUrl` — change `scope: 'https://www.googleapis.com/auth/tasks'` to:

```ts
            scope: 'https://www.googleapis.com/auth/tasks openid email',
```

3. Add the method (the userinfo endpoint lives on a different host, so call it with an absolute URL via a dedicated client or `fetch`). Add a second `HttpClient` in the constructor:

```ts
    private readonly userInfoHttp: HttpClient;
```

In the constructor body, after `this.http = ...`:

```ts
this.userInfoHttp = new HttpClient({
    baseUrl: 'https://www.googleapis.com',
    logger: config.logger,
});
```

Add the method:

```ts
    /** Resolve the Google account identity via the OAuth2 userinfo endpoint. */
    async resolveAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
        const info = await this.userInfoHttp.get<GoogleUserInfo>('/oauth2/v3/userinfo', {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return { externalAccountId: info.sub, email: info.email };
    }
```

4. Add `AccountIdentity` to the `import type { ... } from '../types.js'` list.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ctm/connectors test google-tasks.oauth`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/connectors/src/google-tasks
git commit -m "feat(connectors): resolve google account identity via userinfo"
```

---

### Task 3: Notion identity (`/v1/users/me`)

**Files:**

- Modify: `packages/connectors/src/notion/notion.types.ts`
- Modify: `packages/connectors/src/notion/notion.oauth.ts`
- Test: `packages/connectors/src/notion/notion.oauth.spec.ts`

- [ ] **Step 1: Add the response type**

In `notion.types.ts`:

```ts
/** Response from GET /v1/users/me (the bot user for the integration). */
export type NotionMeResponse = {
    id: string;
    name: string | null;
    bot: {
        workspace_name: string | null;
        owner?: { user?: { person?: { email?: string } } };
    };
};
```

- [ ] **Step 2: Write the failing test**

Add to `notion.oauth.spec.ts` (match existing HttpClient mocking style):

```ts
it('resolveAccountIdentity uses bot id and workspace name', async () => {
    const connector = new NotionOAuthConnector({
        clientId: 'id',
        clientSecret: 'secret',
        redirectUri: 'http://cb',
    });

    // @ts-expect-error private http replaced for test
    connector['http'] = {
        get: async () => ({
            id: 'bot-1',
            name: 'CTM',
            bot: { workspace_name: 'Acme', owner: { user: { person: { email: 'me@acme.com' } } } },
        }),
    };

    const identity = await connector.resolveAccountIdentity({
        accessToken: 'tok',
        refreshToken: '',
        expiresAt: new Date(),
    });

    expect(identity).toEqual({ externalAccountId: 'bot-1', email: 'me@acme.com', label: 'Acme' });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ctm/connectors test notion.oauth`
Expected: FAIL — method missing.

- [ ] **Step 4: Implement**

In `notion.oauth.ts`:

1. Add `NotionMeResponse` to the `import type { ... } from './notion.types.js'`.
2. Add `AccountIdentity` to the `import type { ... } from '../types.js'`.
3. Add the method:

```ts
    /** Resolve the Notion workspace/bot identity via /v1/users/me. */
    async resolveAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
        const me = await this.http.get<NotionMeResponse>('/v1/users/me', {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Notion-Version': NOTION_VERSION,
        });

        const email = me.bot.owner?.user?.person?.email;
        const label = me.bot.workspace_name ?? me.name ?? undefined;

        return { externalAccountId: me.id, email, label };
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ctm/connectors test notion.oauth`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/connectors/src/notion
git commit -m "feat(connectors): resolve notion account identity via users/me"
```

---

### Task 4: Todoist identity (sync user)

**Files:**

- Modify: `packages/connectors/src/todoist/todoist.types.ts`
- Modify: `packages/connectors/src/todoist/todoist.oauth.ts`
- Test: `packages/connectors/src/todoist/todoist.oauth.spec.ts`

- [ ] **Step 1: Add the user type**

In `todoist.types.ts`:

```ts
/** Todoist user object returned by the sync `user` resource. */
export type TodoistUser = {
    id: string;
    email: string;
};

/** Response from POST /sync with resource_types ["user"]. */
export type TodoistSyncUserResponse = {
    user: TodoistUser;
};
```

- [ ] **Step 2: Write the failing test**

Add to `todoist.oauth.spec.ts`:

```ts
it('resolveAccountIdentity returns user id and email', async () => {
    const connector = new TodoistOAuthConnector({
        clientId: 'id',
        clientSecret: 'secret',
        redirectUri: 'http://cb',
    });

    // @ts-expect-error private resourceHttp replaced for test
    connector['resourceHttp'] = {
        post: async () => ({ user: { id: 'todoist-9', email: 'x@y.com' } }),
    };

    const identity = await connector.resolveAccountIdentity({
        accessToken: 'tok',
        refreshToken: 'r',
        expiresAt: new Date(),
    });

    expect(identity).toEqual({ externalAccountId: 'todoist-9', email: 'x@y.com' });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ctm/connectors test todoist.oauth`
Expected: FAIL — method missing.

- [ ] **Step 4: Implement**

In `todoist.oauth.ts`:

1. Add `TodoistSyncUserResponse` to the `import type { ... } from './todoist.types.js'`.
2. Add `AccountIdentity` to the `import type { ... } from '../types.js'`.
3. Add the method (uses the `resourceHttp` client already pointing at `https://api.todoist.com/api/v1`):

```ts
    /** Resolve the Todoist account identity via the sync `user` resource. */
    async resolveAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
        const res = await this.resourceHttp.post<TodoistSyncUserResponse>(
            '/sync',
            { sync_token: '*', resource_types: '["user"]' },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return { externalAccountId: String(res.user.id), email: res.user.email };
    }
```

> If the installed `HttpClient.post` signature differs (check `packages/http`), adapt the call to match; the contract is "POST /sync with sync_token=* and resource_types user, read `user.id`/`user.email`".

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ctm/connectors test todoist.oauth`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/connectors/src/todoist
git commit -m "feat(connectors): resolve todoist account identity via sync user"
```

---

### Task 5: Discord identity (stub to satisfy interface)

**Files:**

- Modify: `packages/connectors/src/discord/discord.oauth.ts`
- Test: `packages/connectors/src/discord/discord.oauth.spec.ts`

Discord is a notification connector, not multi-account task sync, but it implements `OAuthConnector` so it must satisfy the new method.

- [ ] **Step 1: Write the failing test**

Add to `discord.oauth.spec.ts`:

```ts
it('resolveAccountIdentity returns the discord user id', async () => {
    // Construct DiscordOAuthConnector as the existing tests in this file do.
    // Replace its user-fetch path to return id 'discord-7'.
    // Assert: identity.externalAccountId === 'discord-7'.
});
```

Fill the body to mirror the existing Discord test setup in the file (it already exercises a "get current user" call returning `{ id }`). Assert `externalAccountId === 'discord-7'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ctm/connectors test discord.oauth`
Expected: FAIL — method missing.

- [ ] **Step 3: Implement**

Add to `discord.oauth.ts` (reuse whatever "current user" fetch the connector already has; Discord's `GET /users/@me` returns `{ id, username, email? }`):

```ts
    /** Resolve the Discord account identity via /users/@me. */
    async resolveAccountIdentity(tokens: OAuthTokens): Promise<AccountIdentity> {
        const me = await this.http.get<{ id: string; email?: string; username?: string }>('/users/@me', {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return { externalAccountId: me.id, email: me.email, label: me.username };
    }
```

Add `AccountIdentity` to the type imports. Adjust the base URL/client name to match the existing Discord OAuth code.

- [ ] **Step 4: Run test + whole package**

Run: `pnpm --filter @ctm/connectors test`
Expected: PASS. Then `pnpm --filter @ctm/connectors build` → PASS (interface now fully implemented).

- [ ] **Step 5: Commit**

```bash
git add packages/connectors/src/discord
git commit -m "feat(connectors): resolve discord account identity"
```

---

## PHASE 2 — Backend connection model (`apps/main`)

### Task 6: Connection schema — fields + indexes

**Files:**

- Modify: `apps/main/src/connectors/schemas/connector-config.schema.ts`

- [ ] **Step 1: Add fields and swap indexes**

Add three props after `source!`:

```ts
    @Prop({ type: String, default: null, maxlength: 255 })
    externalAccountId!: string | null;

    @Prop({ type: String, default: null, maxlength: 320 })
    email!: string | null;

    @Prop({ type: String, default: null, maxlength: 200 })
    label!: string | null;
```

Replace the index block at the bottom:

```ts
export const ConnectorConfigSchema = SchemaFactory.createForClass(ConnectorConfig);
// One row per connected external account. Partial filter lets legacy rows
// (externalAccountId null, pre-backfill) coexist without violating uniqueness.
ConnectorConfigSchema.index(
    { userId: 1, source: 1, externalAccountId: 1 },
    { unique: true, partialFilterExpression: { externalAccountId: { $type: 'string' } } },
);
ConnectorConfigSchema.index({ userId: 1 });
```

> `externalAccountId` is nullable to allow lazy backfill of legacy rows; it becomes effectively required once a connection has synced once (Task 8 sets it).

- [ ] **Step 2: Build the app to confirm types compile**

Run: `pnpm --filter @ctm/main build`
Expected: FAIL later in dependent files (service still references old shape) — but this file itself must compile. If errors are only in `connectors.service.ts`/controller, proceed to Task 7.

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/connectors/schemas/connector-config.schema.ts
git commit -m "feat(main): connection schema fields + per-account unique index"
```

---

### Task 7: ConnectorsService — re-key to connection

**Files:**

- Modify: `apps/main/src/connectors/connectors.service.ts`
- Test: `apps/main/src/connectors/connectors.service.spec.ts`

The service currently keys by `(userId, source)`. Re-key per-account operations by connection. Keep `userId+source` only where it genuinely means "all accounts of this source".

- [ ] **Step 1: Write failing tests**

Add to `connectors.service.spec.ts` (uses the real DB per project rules; follow existing suite's model setup):

```ts
it('handleCallback dedups by externalAccountId (re-auth updates in place)', async () => {
    const userId = new Types.ObjectId().toString();
    const source = ConnectorName.GoogleTasks;

    // Stub registry.get(source).exchangeCode + resolveAccountIdentity to return the SAME externalAccountId twice.
    // First call creates a row; second call must NOT create a second row.

    await service.handleCallback({ source, code: 'c1', userId });
    await service.handleCallback({ source, code: 'c2', userId });

    const rows = await service.listConnectionsForSource({ userId, source });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalAccountId).toBe('ext-1');
});

it('listConnectionsForSource returns all accounts of a source', async () => {
    const userId = new Types.ObjectId().toString();
    const source = ConnectorName.GoogleTasks;

    // Two callbacks with DIFFERENT externalAccountId (ext-A, ext-B).
    const rows = await service.listConnectionsForSource({ userId, source });
    expect(rows.map((r) => r.externalAccountId).sort()).toEqual(['ext-A', 'ext-B']);
});
```

> Look at the existing spec for how `registry` is provided/mocked; mirror that. The registry mock's `get()` must now also return `resolveAccountIdentity`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ctm/main test connectors.service`
Expected: FAIL — `listConnectionsForSource` undefined; second callback creates a duplicate.

- [ ] **Step 3: Implement service changes**

Edit `connectors.service.ts`:

(a) **`handleCallback`** — resolve identity, key upsert by `externalAccountId`:

```ts
    async handleCallback({
        source,
        code,
        userId,
    }: {
        source: ConnectorName;
        code: string;
        userId: string;
    }): Promise<ConnectorConfigDocument> {
        const connector = this.registry.get(source);
        const tokens = await connector.exchangeCode(code);
        const identity = await connector.resolveAccountIdentity(tokens);
        const extra = (await connector.resolveConnectionSettings?.(tokens)) ?? {};

        const doc = await this.configModel.findOneAndUpdate(
            { userId: new Types.ObjectId(userId), source, externalAccountId: identity.externalAccountId },
            {
                ...extra,
                externalAccountId: identity.externalAccountId,
                email: identity.email ?? null,
                label: identity.label ?? null,
                accessToken: this.encryption.encrypt(tokens.accessToken),
                refreshToken: this.encryption.encrypt(tokens.refreshToken),
                tokenExpiresAt: tokens.expiresAt,
                enabled: true,
                lastError: null,
            },
            { upsert: true, new: true },
        );

        if (!doc) throw new InternalError('Upsert failed unexpectedly');

        return doc;
    }
```

(b) **Add** `listConnectionsForSource`:

```ts
    /** List all of a user's connection rows for one source. */
    async listConnectionsForSource({
        userId,
        source,
    }: {
        userId: string;
        source: ConnectorName;
    }): Promise<ConnectorConfigDocument[]> {
        return this.configModel.find({ userId: new Types.ObjectId(userId), source });
    }
```

(c) **Re-key per-connection reads by `connectionId`.** Add overloads keyed by id and keep a private helper that loads-or-throws:

```ts
    /** Load a single connection by id, scoped to the user. Throws if not found. */
    private async getConnection({
        userId,
        connectionId,
    }: {
        userId: string;
        connectionId: string;
    }): Promise<ConnectorConfigDocument> {
        const doc = await this.configModel.findOne({
            _id: connectionId,
            userId: new Types.ObjectId(userId),
        });

        if (!doc) throw new NotFoundException('Connection not found');

        return doc;
    }
```

Rewrite `getDecryptedTokens`, `ensureFreshTokens`, `getSettings`, `updateLastSyncedAt` to take `{ userId, connectionId }` and use `getConnection`. For `ensureFreshTokens`, the refresh write targets `{ _id: connectionId }`. For the connector lookup, read `doc.source` and pass to `this.registry.get(doc.source as ConnectorName)`.

Example `ensureFreshTokens`:

```ts
    async ensureFreshTokens({
        userId,
        connectionId,
    }: {
        userId: string;
        connectionId: string;
    }): Promise<OAuthTokens> {
        const config = await this.getConnection({ userId, connectionId });

        const tokens: OAuthTokens = {
            accessToken: this.encryption.decrypt(config.accessToken),
            refreshToken: this.encryption.decrypt(config.refreshToken),
            expiresAt: config.tokenExpiresAt,
        };

        if (config.tokenExpiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
            return tokens;
        }

        const connector = this.registry.get(config.source as ConnectorName);
        const fresh = await connector.refreshToken(tokens);

        await this.configModel.findByIdAndUpdate(connectionId, {
            accessToken: this.encryption.encrypt(fresh.accessToken),
            refreshToken: this.encryption.encrypt(fresh.refreshToken),
            tokenExpiresAt: fresh.expiresAt,
        });

        return fresh;
    }
```

(d) **`update`** stays keyed by `configId` (already is). **`removeBySource`** → replace with `removeConnection`:

```ts
    /** Remove a single connection by id. */
    async removeConnection({ userId, connectionId }: { userId: string; connectionId: string }): Promise<void> {
        const result = await this.configModel.deleteOne({
            _id: connectionId,
            userId: new Types.ObjectId(userId),
        });

        if (result.deletedCount === 0) throw new NotFoundException('Connection not found');
    }
```

(e) **Delete** `getConfigIdBySource` (callers move to connectionId).

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @ctm/main test connectors.service`
Expected: PASS. (Controller/sync still won't compile — fixed in Tasks 8–11.)

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/connectors/connectors.service.ts apps/main/src/connectors/connectors.service.spec.ts
git commit -m "feat(main): re-key connectors service to per-account connections"
```

---

### Task 8: api-client — account DTOs

**Files:**

- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/index.ts` (exports + client method signatures)
- Test: none (types only); compile is the gate.

- [ ] **Step 1: Add/replace types in `types.ts`**

```ts
/** One connected external account under a source. */
export type ConnectorAccountDto = {
    connectionId: string;
    externalAccountId: string;
    email: string | null;
    label: string | null;
    lastSynced?: string;
    setupRequired: boolean;
};
```

Replace `ConnectorStatusDto` with:

```ts
/** Connection status for a single task source connector (now multi-account). */
export type ConnectorStatusDto = {
    source: string;
    connectorType: ConnectorType;
    connectionSchema: Record<string, unknown>;
    accounts: ConnectorAccountDto[];
};
```

Add `connectionId` to `ConnectorHealthDto` and `TaskSyncJobDto`:

```ts
export type ConnectorHealthDto = {
    source: string;
    connectionId: string;
    healthy: boolean;
    error?: string;
};
```

In `TaskSyncJobDto` add `connectionId: string;` after `source`.

Add `externalAccountId: string;` to `TaskDto` after `sourceId`.

- [ ] **Step 2: Update client methods in `index.ts`**

Change connection-scoped methods to take `connectionId` instead of `source`:

- `disconnectConnector({ connectionId })` → `DELETE /connectors/connections/{connectionId}`
- `syncConnector({ connectionId })` → `POST /connectors/connections/{connectionId}/sync`
- `cancelSyncJob({ connectionId, jobId })` → `DELETE /connectors/connections/{connectionId}/sync/{jobId}`
- `setConnectionDetails({ connectionId, body })` → `POST /connectors/connections/{connectionId}/connection-details`
- Keep `getConnectorAuthUrl({ source })` (add-account reuses it).

Export `ConnectorAccountDto`.

- [ ] **Step 3: Build**

Run: `pnpm --filter @ctm/api-client build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src
git commit -m "feat(api-client): per-account connector DTOs and connection-scoped methods"
```

---

### Task 9: ConnectorsController — accounts[] + per-connection routes

**Files:**

- Modify: `apps/main/src/connectors/connectors.controller.ts`
- Test: `apps/main/src/connectors/connectors.controller.spec.ts`

- [ ] **Step 1: Write failing test**

Add to `connectors.controller.spec.ts` (mirror existing setup):

```ts
it('listConnectors groups accounts under each source', async () => {
    // Seed two GoogleTasks connections (ext-A, ext-B) + one Notion (ext-C) for the user.
    const result = await controller.listConnectors({ user: { sub: userId } } as never);

    const google = result.find((c) => c.source === 'google_tasks');
    expect(google!.accounts.map((a) => a.externalAccountId).sort()).toEqual(['ext-A', 'ext-B']);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ctm/main test connectors.controller`
Expected: FAIL (shape mismatch / methods changed).

- [ ] **Step 3: Implement**

(a) **`listConnectors`** — build `accounts[]` per source:

```ts
    async listConnectors(@Request() req: AuthRequest): Promise<ConnectorStatusDto[]> {
        const available = this.connectors.listAvailable();
        const configs = await this.connectors.listConfigs(req.user.sub);

        const bySource = new Map<string, typeof configs>();

        for (const cfg of configs) {
            const list = bySource.get(cfg.source) ?? [];

            list.push(cfg);
            bySource.set(cfg.source, list);
        }

        return available.map((connectorName) => {
            const connector = this.oAuthConnectorRegistry.get(connectorName);
            const requiredKeys = Object.entries(connector.connectionDetailsSchema)
                .filter(([, v]) => v.inputDefinition.required)
                .map(([k]) => k);

            const accounts = (bySource.get(connectorName) ?? [])
                .filter((c) => c.enabled)
                .map((c) => ({
                    connectionId: String(c._id),
                    externalAccountId: c.externalAccountId ?? '',
                    email: c.email,
                    label: c.label,
                    lastSynced: c.lastSyncedAt?.toISOString(),
                    setupRequired: requiredKeys.some(
                        (k) => !(c.settings as Record<string, unknown>)[k],
                    ),
                }));

            return {
                source: connectorName,
                connectorType: connector.connectorType,
                connectionSchema: connector.connectionDetailsSchema,
                accounts,
            };
        });
    }
```

(b) **`checkHealth`** — iterate every task-sync connection, report `connectionId`:

```ts
    async checkHealth(@Request() req: AuthRequest): Promise<ConnectorHealthDto[]> {
        const configs = await this.connectors.listConfigs(req.user.sub);
        const taskSync = configs.filter((c) => {
            if (!c.enabled) return false;
            return this.oAuthConnectorRegistry.get(c.source as ConnectorName).connectorType === ConnectorType.TaskSync;
        });

        const results = await Promise.allSettled(
            taskSync.map(async (c) => {
                const tokens = await this.connectors.ensureFreshTokens({
                    userId: req.user.sub,
                    connectionId: String(c._id),
                });
                const taskSource = this.externalTaskSourceRegistry.get(c.source as unknown as TaskConnectorName);
                const health = await taskSource.healthCheck(tokens);

                return { source: c.source, connectionId: String(c._id), ...health };
            }),
        );

        return results.map((r, i) => {
            if (r.status === 'fulfilled') return r.value;
            const message = r.reason instanceof Error ? r.reason.message : 'Unknown error';

            return { source: taskSync[i]!.source, connectionId: String(taskSync[i]!._id), healthy: false, error: message };
        });
    }
```

(c) **`setConnectionDetails`** — route by connectionId:

```ts
    @Post('connections/:connectionId/connection-details')
    @UseGuards(CombinedAuthGuard)
    @HttpCode(200)
    async setConnectionDetails(
        @Request() req: AuthRequest,
        @Param('connectionId') connectionId: string,
        @Body() body: Record<string, unknown>,
    ): Promise<OkDto> {
        // ... keep existing AJV validation, but resolve the connector from the connection's source:
        // const source = (await this.connectors.getConnectionSource({ userId, connectionId })) as ConnectorName;
        // validate body, then:
        await this.connectors.update({ configId: connectionId, userId: req.user.sub, patch: { settings: body } });

        return { ok: true };
    }
```

Add a small service helper `getConnectionSource({ userId, connectionId }): Promise<string>` (reads `doc.source`) to `connectors.service.ts`, since AJV needs the schema for the right source.

(d) **`removeByConnectorName`** → `removeConnection`:

```ts
    @Delete('connections/:connectionId')
    @UseGuards(CombinedAuthGuard)
    @HttpCode(204)
    async removeConnection(
        @Request() req: AuthRequest,
        @Param('connectionId') connectionId: string,
    ): Promise<void> {
        await this.connectors.removeConnection({ userId: req.user.sub, connectionId });
    }
```

(e) **`listNotionDatabases`** — now needs a connectionId (a user may have several Notion accounts). Change route to `GET /connectors/connections/:connectionId/notion/databases` and use `ensureFreshTokens({ userId, connectionId })`. Update the Notion connection-details `endpoint` in `notion.oauth.ts` `connectionDetailsSchema` to a relative form the web resolves against the connection (web passes the connectionId; see Task 13). For now set endpoint to `/connectors/connections/{connectionId}/notion/databases` and have the web substitute `{connectionId}`.

(f) **`getOAuthUrl`** and **`oauthCallback`** stay keyed by source (add-account flow). After callback, redirect as today.

- [ ] **Step 4: Run to verify pass + build**

Run: `pnpm --filter @ctm/main test connectors.controller` → PASS.
Run: `pnpm --filter @ctm/main build` → resolve any remaining references (e.g. delete usages of `getConfigIdBySource`).

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/connectors
git commit -m "feat(main): connectors controller exposes per-account accounts and routes"
```

---

## PHASE 3 — Tasks + sync per connection

### Task 10: Task schema — externalAccountId + index

**Files:**

- Modify: `apps/main/src/tasks/schemas/task.schema.ts`

- [ ] **Step 1: Add field + swap index**

Add after `sourceId!`:

```ts
    @Prop({ type: String, default: null, maxlength: 255 })
    externalAccountId!: string | null;
```

Replace the unique index line:

```ts
TaskSchema.index({ userId: 1, source: 1, externalAccountId: 1, sourceId: 1 }, { unique: true });
```

> Legacy tasks have `externalAccountId: null`; the compound index still permits one null-account task per `(userId, source, sourceId)` until backfilled (Task 11).

- [ ] **Step 2: Build**

Run: `pnpm --filter @ctm/main build`
Expected: PASS (or only fails in `tasks.service.ts`, fixed next).

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/tasks/schemas/task.schema.ts
git commit -m "feat(main): task externalAccountId field + per-account unique index"
```

---

### Task 11: upsertFromRemote — stamp externalAccountId

**Files:**

- Modify: `apps/main/src/tasks/tasks.service.ts`
- Test: `apps/main/src/tasks/tasks.service.spec.ts`

- [ ] **Step 1: Write failing test**

```ts
it('upsertFromRemote stamps externalAccountId and isolates accounts', async () => {
    const userId = new Types.ObjectId().toString();
    const remote = {
        sourceId: 'r1',
        title: 'T',
        description: null,
        status: 'open' as const,
        priority: null,
        due: null,
        deadline: null,
        duration: null,
        parentSourceId: null,
        tags: [],
    };

    await service.upsertFromRemote({
        userId,
        source: TaskConnectorName.GoogleTasks,
        externalAccountId: 'acct-A',
        remoteTasks: [remote],
    });
    await service.upsertFromRemote({
        userId,
        source: TaskConnectorName.GoogleTasks,
        externalAccountId: 'acct-B',
        remoteTasks: [remote],
    });

    const tasks = await taskModel.find({ userId: new Types.ObjectId(userId), source: 'google_tasks', sourceId: 'r1' });
    expect(tasks).toHaveLength(2); // same sourceId, different account => two distinct tasks
    expect(tasks.map((t) => t.externalAccountId).sort()).toEqual(['acct-A', 'acct-B']);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ctm/main test tasks.service`
Expected: FAIL — `externalAccountId` not accepted / E11000 duplicate (old index) / only 1 task.

- [ ] **Step 3: Implement**

(a) Add `externalAccountId: string` to the `upsertFromRemote` args type.
(b) Scope `existingTasks` query by account:

```ts
const existingTasks = await this.taskModel.find({
    userId: userObjectId,
    source,
    externalAccountId,
    sourceId: { $in: sourceIds },
});
```

(c) In `buildInsert`, add `externalAccountId,` to the returned document (after `sourceId`).
(d) Update operations (`buildUpdate` / bulk `updateOne` filters) must match on `{ userId, source, externalAccountId, sourceId }`.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @ctm/main test tasks.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/tasks/tasks.service.ts apps/main/src/tasks/tasks.service.spec.ts
git commit -m "feat(main): upsertFromRemote stamps externalAccountId per account"
```

---

### Task 12: Sync job + service + controller per connection

**Files:**

- Modify: `apps/main/src/jobs/schemas/task-sync-job.schema.ts`
- Modify: `apps/main/src/sync/sync-job.dto.ts`
- Modify: `apps/main/src/sync/sync.service.ts`
- Modify: `apps/main/src/sync/sync.controller.ts`
- Modify: `apps/main/src/sync/sync.gateway.ts` (emit keyed by connectionId — verify event payload)
- Test: `apps/main/src/sync/sync.service.spec.ts`

- [ ] **Step 1: Schema — add connectionId**

In `task-sync-job.schema.ts`, add to the document type `connectionId: string;` and to the Schema:

```ts
    connectionId: { type: String, required: true },
```

In `sync-job.dto.ts`, add `connectionId: job.connectionId,` to the returned DTO.

- [ ] **Step 2: Write failing test**

```ts
it('createJob + runSync syncs a single connection and stamps its account', async () => {
    // Seed one GoogleTasks connection (connectionId C, externalAccountId acct-A).
    // Stub connectors.ensureFreshTokens / getSettings, registry.get(...).fetchTasks => [remote r1].
    const job = await service.createJob({ userId, connectionId: 'C' });
    // await completion (poll job status === 'done')
    const tasks = await taskModel.find({ userId: new Types.ObjectId(userId), externalAccountId: 'acct-A' });
    expect(tasks).toHaveLength(1);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @ctm/main test sync.service`
Expected: FAIL — `createJob` signature is `{ userId, source }`.

- [ ] **Step 4: Implement sync.service**

Change `createJob` and `runSync` to take `connectionId`. Inside `runSync`:

```ts
const connection = await this.connectors.getConnectionForSync({ userId, connectionId });
const source = connection.source as ConnectorName;
const tokens = await this.connectors.ensureFreshTokens({ userId, connectionId });
const settings = await this.connectors.getSettings({ userId, connectionId });
const connector = this.registry.get(source as unknown as TaskConnectorName);
const remoteTasks = await connector.fetchTasks(tokens, settings);
// ...
const { synced, skipped } = await this.tasks.upsertFromRemote({
    userId,
    source: source as unknown as TaskConnectorName,
    externalAccountId: connection.externalAccountId ?? '',
    remoteTasks,
});
// ...
await this.connectors.updateLastSyncedAt({ userId, connectionId });
```

Persist `connectionId` (and keep `source` for display) when creating the job:

```ts
const job = await this.taskSyncModel.create({
    userId: new Types.ObjectId(userId),
    connectionId,
    source,
    status: 'queued',
    stage: null,
    synced: 0,
    skipped: 0,
});
```

Add `getConnectionForSync({ userId, connectionId })` to `connectors.service.ts` returning the document (reuse the private `getConnection` via a public wrapper), OR widen `getConnection` to public. The job needs `source` + `externalAccountId`.

- [ ] **Step 5: Implement sync.controller**

Re-route under the connection:

```ts
@Controller('connectors/connections/:connectionId/sync')
// ...
    async createJob(@Request() req: AuthRequest, @Param('connectionId') connectionId: string): Promise<TaskSyncJobDto> {
        const job = await this.sync.createJob({ userId: req.user.sub, connectionId });

        return toSyncJobDto(job);
    }
```

`getJob` / `cancelJob` keep `jobId` (already user-scoped).

- [ ] **Step 6: Gateway**

In `sync.gateway.ts`, confirm `emitProgress` sends the full DTO. No key change needed if the web matches on `job.connectionId` (Task 13). If it currently emits by `source`, leave the room logic but ensure the payload includes `connectionId` (it does via `toSyncJobDto`).

- [ ] **Step 7: Run to verify pass + full app build**

Run: `pnpm --filter @ctm/main test sync.service` → PASS.
Run: `pnpm --filter @ctm/main build` → PASS.
Run: `pnpm --filter @ctm/main test` → PASS (whole app).

- [ ] **Step 8: Commit**

```bash
git add apps/main/src/jobs/schemas/task-sync-job.schema.ts apps/main/src/sync
git commit -m "feat(main): sync jobs run per connection and stamp account"
```

---

## PHASE 4 — Web UI

### Task 13: SourceCard becomes a source group with account rows + "+"

**Files:**

- Modify: `apps/web/src/components/sources/SourceCard.tsx`
- Modify: `apps/web/src/components/sources/SourceCard.spec.tsx`
- Modify: `apps/web/src/pages/SourcesPage.tsx`

- [ ] **Step 1: Write failing component test**

In `SourceCard.spec.tsx`, render a connector with two accounts and assert both emails appear and an "Add account" control exists:

```tsx
it('lists each connected account and an add-account button', () => {
    const connector = {
        source: 'google_tasks',
        connectorType: ConnectorType.TaskSync,
        connectionSchema: {},
        accounts: [
            { connectionId: '1', externalAccountId: 'A', email: 'a@x.com', label: null, setupRequired: false },
            { connectionId: '2', externalAccountId: 'B', email: 'b@x.com', label: null, setupRequired: false },
        ],
    };

    render(
        <SourceCard
            connector={connector}
            onConnect={() => {}}
            onDisconnect={() => {}}
            onSync={() => {}}
            onCancelSync={() => {}}
            isPending={false}
            syncJobs={new Map()}
            healthByConnection={new Map()}
        />,
    );

    expect(screen.getByText('a@x.com')).toBeInTheDocument();
    expect(screen.getByText('b@x.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add account/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ctm/web test SourceCard`
Expected: FAIL — props/shape changed.

- [ ] **Step 3: Implement SourceCard**

Rewrite props:

```tsx
type SourceCardProps = {
    connector: ConnectorStatusDto;
    onConnect: (source: string) => void; // add-account (OAuth)
    onDisconnect: (connectionId: string) => void;
    onSync: (connectionId: string) => void;
    onCancelSync: (connectionId: string, jobId: string) => void;
    onConfigure?: (connectionId: string) => void;
    onTest?: (source: string) => void;
    syncJobs: Map<string, TaskSyncJobDto>; // keyed by connectionId
    healthByConnection?: Map<string, ConnectorHealthDto>;
    isPending: boolean;
    isHealthLoading?: boolean;
};
```

Render a source header (icon + label) once, then `connector.accounts.map(account => <row>)` showing `account.email ?? account.label ?? account.externalAccountId`, last-synced, and per-account Sync / Configure / Disconnect (move the existing per-source button logic to per-account, reading `syncJobs.get(account.connectionId)` and `healthByConnection.get(account.connectionId)`). Below the rows render a `Button` "+ Add account" → `onConnect(connector.source)`. If `accounts.length === 0`, show a single "Connect" button → `onConnect(connector.source)`.

- [ ] **Step 4: Update SourcesPage**

- Track `syncJobs` as `Map<connectionId, TaskSyncJobDto>` (socket handler keys by `job.connectionId`).
- `disconnectMutation` / `syncMutation` / `cancelSyncMutation` take `connectionId`.
- `connectMutation` stays keyed by `source` (calls `getConnectorAuthUrl({ source })`).
- Build `healthByConnection` from `healthResults` keyed by `h.connectionId`.
- `enabled` for the health query: `connectors.some((c) => c.accounts.length > 0)`.
- Notion configure: pass the account's `connectionId` to `NotionSetupModal`; the modal's database fetch must call `api.listNotionDatabases({ connectionId })` (update `NotionSetupModal` + api-client method accordingly — substitute `{connectionId}` into the schema endpoint).

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter @ctm/web test`
Expected: PASS.

- [ ] **Step 6: Build web**

Run: `pnpm --filter @ctm/web build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): per-account source groups with add-account action"
```

---

### Task 14: MCP / CLI parity (connection-scoped)

**Files:**

- Modify: MCP connector tools (`list_connectors`, `sync_connector`, `disconnect_connector`, `set_connection_details`, `get_connector_health`) — locate under `apps/main` MCP module or `apps/cli`.
- Test: corresponding spec files.

> Per the project rule (memory: "after web UI ships, also expose prefs endpoints in CLI and MCP") and the api-client client boundary rule, the MCP/CLI surface must match the new connection-scoped API.

- [ ] **Step 1: Locate the MCP tool definitions**

Run: `grep -rl "sync_connector\|list_connectors\|disconnect_connector" apps --include=*.ts`

- [ ] **Step 2: Write/adjust failing tests**

For each tool, update its spec so inputs take `connectionId` (sync/disconnect/set-details) and `list_connectors` returns sources with `accounts[]`.

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @ctm/main test <mcp-tool-spec>` (or the package that owns the tools).
Expected: FAIL.

- [ ] **Step 4: Implement**

Route each tool through the updated api-client methods (`syncConnector({ connectionId })`, etc.). `list_connectors` returns the grouped `ConnectorStatusDto[]`.

- [ ] **Step 5: Run to verify pass**

Run: the same test command.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps
git commit -m "feat(main): connection-scoped MCP connector tools"
```

---

### Task 15: Full verification

- [ ] **Step 1: Whole-workspace build + lint + test**

```bash
pnpm build
pnpm lint
pnpm test
```

Expected: all PASS.

- [ ] **Step 2: Manual smoke (optional, via /run)**

Start the app, connect the same source twice with two accounts, confirm both emails list, sync each, confirm tasks carry distinct `externalAccountId`.

- [ ] **Step 3: Final commit (if any lint/format fixes)**

```bash
git add -A
git commit -m "chore: lint and format for multi-account connectors"
```

---

## Self-Review notes

- **Spec coverage:** identity resolution (Tasks 1–5), connection model + dedup + lazy backfill via nullable `externalAccountId` (Tasks 6–7, 10), task linkage by `externalAccountId` (Tasks 10–11), per-connection sync (Task 12), accounts[] API (Tasks 8–9), web "+"/email list (Task 13), MCP/CLI parity (Task 14), verification (Task 15). Push remains out of scope per spec.
- **Lazy backfill:** legacy rows/tasks keep `externalAccountId: null` and are filled on their next OAuth callback (Task 7 `handleCallback`) / next sync upsert (Task 11). Partial unique index (Task 6) and nullable compound index (Task 10) let legacy and new rows coexist.
- **Type consistency:** `connectionId` (string) and `externalAccountId` (string) names used uniformly across api-client, controller, service, sync, web. `resolveAccountIdentity` returns `AccountIdentity` everywhere.
