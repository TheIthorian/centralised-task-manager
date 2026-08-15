# Same-Origin API Proxy & HttpOnly Refresh Cookie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route web traffic through a same-origin `/api` proxy so `apps/main` can issue an HttpOnly refresh cookie, while CLI and MCP keep bearer tokens unchanged.

**Architecture:** A Cloudflare Pages Function (prod) and the Vite dev-server proxy (dev) forward `/api/*` to `apps/main`, stripping the prefix and stamping `X-Ctm-Client: web`. `apps/main` sees that header and returns the refresh token as an HttpOnly cookie instead of in the JSON body. The web client holds the access token in React state only and no longer touches storage. `@fastify/compress` is added for wire compression in both directions.

**Tech Stack:** NestJS + Fastify, `@fastify/cookie`, `@fastify/compress`, Vite 8, React 19, Cloudflare Pages Functions, vitest.

**Spec:** `.claude/specs/2026-07-25-api-proxy-httponly-refresh-design.md`

## Global Constraints

- Never use `any`. Never use `unknown` where a real type or runtime guard fits.
- Prefer `type` over `interface`. Explicit return types on every function and method.
- Object arguments when a function takes two or more parameters.
- JSDoc on every public method and exported module-level function.
- Trailing commas on multi-line literals. Blank line before and after log statements.
- Typed errors from `@ctm/errors`. Never `throw new Error(...)` in `apps/main` or `packages/*`.
- Request/response types live in `packages/api-client/src/types.ts`; Nest DTOs `implements` them.
- Tests co-located as `*.spec.ts`. Integration tests use the real MongoDB via `process.env['MONGODB_URI']`. No cleanup; use `Date.now()` for unique identifiers.
- No config defaults or silent fallbacks. Missing required env fails loudly at startup.
- Conventional Commits.
- `COOKIE_PATH` = `/api/auth` in dev and prod. Cookie name `ctm_refresh`. Header name `X-Ctm-Client`, value `web`.
- `@fastify/compress` v9. `zstd` stays disabled.

---

### Task 1: Fastify plugins — compression and cookies

**Files:**

- Modify: `apps/main/package.json` (dependencies)
- Modify: `apps/main/src/bootstrap.ts`
- Test: `apps/main/src/bootstrap.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `createApp()` returns an app with `@fastify/compress` and `@fastify/cookie` registered. Later tasks call `reply.setCookie(...)` / `reply.clearCookie(...)` and read `request.cookies`.

- [ ] **Step 1: Add the dependencies**

```bash
pnpm --filter @ctm/main add @fastify/compress@9.1.0 @fastify/cookie@11.0.2
```

- [ ] **Step 2: Write the failing test**

Append to `apps/main/src/bootstrap.spec.ts`:

```ts
import { createApp } from './bootstrap.js';

describe('createApp plugin registration', () => {
    it('registers compression and cookie plugins', async () => {
        const app = await createApp();
        const instance = app.getHttpAdapter().getInstance();

        expect(typeof instance.compress).toBe('function');
        expect(typeof instance.parseCookie).toBe('function');

        await app.close();
    });

    it('leaves responses under the 1KB threshold uncompressed', async () => {
        const app = await createApp();

        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        const response = await app
            .getHttpAdapter()
            .getInstance()
            .inject({
                method: 'GET',
                url: '/health',
                headers: { 'accept-encoding': 'gzip, br' },
            });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-encoding']).toBeUndefined();

        await app.close();
    });

    it('compresses a payload over the threshold', async () => {
        const app = await createApp();
        const instance = app.getHttpAdapter().getInstance();

        instance.get('/__compress_probe', async (_request, reply) => reply.send({ blob: 'a'.repeat(4096) }));

        await app.init();
        await instance.ready();

        const response = await instance.inject({
            method: 'GET',
            url: '/__compress_probe',
            headers: { 'accept-encoding': 'gzip' },
        });

        expect(response.headers['content-encoding']).toBe('gzip');

        await app.close();
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @ctm/main test -- bootstrap.spec.ts`
Expected: FAIL — `instance.compress` and `instance.parseCookie` are `undefined`.

- [ ] **Step 4: Register the plugins**

In `apps/main/src/bootstrap.ts`, import both and register **compress before multipart**, cookie after:

```ts
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
```

Inside `createApp()`, immediately before the existing `app.register(multipart ...)` line:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
await app.register(compress as any, {
    global: true,
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
await app.register(cookie as any);
```

The `as any` casts match the existing `multipart` registration — Nest's `register` signature does not line up with Fastify plugin types.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ctm/main test -- bootstrap.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/main/package.json apps/main/src/bootstrap.ts apps/main/src/bootstrap.spec.ts pnpm-lock.yaml
git commit -m "feat(main): register compression and cookie plugins"
```

---

### Task 2: Cookie-mode env configuration

**Files:**

- Modify: `apps/main/src/config/env.schema.ts`
- Modify: `apps/main/.env.example`
- Modify: `apps/main/.env.test`
- Test: `apps/main/src/config/env.schema.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: validated `COOKIE_PATH: string` and `COOKIE_SECURE: boolean` available via `ConfigService`.

- [ ] **Step 1: Write the failing test**

Append to `apps/main/src/config/env.schema.spec.ts` (follow the existing valid-env fixture in that file — add both keys to it):

```ts
it('rejects an env without COOKIE_PATH', () => {
    const { COOKIE_PATH, ...withoutCookiePath } = validEnv;
    const { error } = envSchema.validate(withoutCookiePath);

    expect(error?.message).toContain('COOKIE_PATH');
});

it('rejects an env without COOKIE_SECURE', () => {
    const { COOKIE_SECURE, ...withoutCookieSecure } = validEnv;
    const { error } = envSchema.validate(withoutCookieSecure);

    expect(error?.message).toContain('COOKIE_SECURE');
});

it('coerces COOKIE_SECURE to a boolean', () => {
    const { value } = envSchema.validate({ ...validEnv, COOKIE_SECURE: 'true' });

    expect(value.COOKIE_SECURE).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ctm/main test -- env.schema.spec.ts`
Expected: FAIL — no `COOKIE_PATH` / `COOKIE_SECURE` in the schema, so the "rejects" cases find no error.

- [ ] **Step 3: Add the keys to the schema**

In `apps/main/src/config/env.schema.ts`, after the `WEB_URL` line:

```ts
    COOKIE_PATH: Joi.string().required(),
    COOKIE_SECURE: Joi.boolean().required(),
```

- [ ] **Step 4: Add them to the env files**

`apps/main/.env.example` — after the `WEB_URL` entry:

```
# Path the refresh cookie is scoped to, as the BROWSER sees it. With the /api
# proxy in front of this service that is /api/auth, not /auth. Must cover both
# /api/auth/refresh AND /api/auth/logout (RFC 6265 path-match rules).
COOKIE_PATH=/api/auth
# Must be true in production. false locally, because http://localhost drops Secure cookies.
COOKIE_SECURE=false
```

In the production block further down the same file, alongside `WEB_URL` and `CORS_ORIGIN`:

```
#   COOKIE_PATH=/api/auth
#   COOKIE_SECURE=true
```

`apps/main/.env.test` — add:

```
COOKIE_PATH=/api/auth
COOKIE_SECURE=false
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ctm/main test -- env.schema.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/main/src/config/env.schema.ts apps/main/src/config/env.schema.spec.ts apps/main/.env.example apps/main/.env.test
git commit -m "feat(main): require COOKIE_PATH and COOKIE_SECURE"
```

---

### Task 3: Cookie mode in the auth controller

**Files:**

- Modify: `packages/api-client/src/types.ts`
- Modify: `apps/main/src/auth/auth.controller.ts`
- Modify: `apps/main/src/auth/auth.service.ts`
- Modify: `apps/main/src/auth/dto/refresh.dto.ts`
- Create: `apps/main/src/auth/auth-cookie.ts`
- Test: `apps/main/src/auth/auth-cookie.spec.ts`
- Test: `apps/main/src/auth/auth.controller.spec.ts`

**Interfaces:**

- Consumes: cookie plugin from Task 1; `COOKIE_PATH` / `COOKIE_SECURE` from Task 2.
- Produces:
    - `REFRESH_COOKIE_NAME = 'ctm_refresh'`, `WEB_CLIENT_HEADER = 'x-ctm-client'`, `WEB_CLIENT_VALUE = 'web'`
    - `isWebClient({ headers }: { headers: Record<string, string | string[] | undefined> }): boolean`
    - `buildRefreshCookieOptions({ path, secure, maxAgeDays }: { path: string; secure: boolean; maxAgeDays: number }): CookieSerializeOptions`
    - `AuthService.revokeRefreshToken({ rawRefreshToken }: { rawRefreshToken: string }): Promise<void>`
    - `TokenPair.refreshToken` becomes optional (`refreshToken?: string`)

- [ ] **Step 1: Write the failing test for the cookie helpers**

Create `apps/main/src/auth/auth-cookie.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRefreshCookieOptions, isWebClient, REFRESH_COOKIE_NAME } from './auth-cookie.js';

describe('isWebClient', () => {
    it('returns true when the proxy header is present', () => {
        expect(isWebClient({ headers: { 'x-ctm-client': 'web' } })).toBe(true);
    });

    it('returns false when the header is absent', () => {
        expect(isWebClient({ headers: {} })).toBe(false);
    });

    it('returns false for any other header value', () => {
        expect(isWebClient({ headers: { 'x-ctm-client': 'cli' } })).toBe(false);
    });
});

describe('buildRefreshCookieOptions', () => {
    it('builds a locked-down cookie', () => {
        const options = buildRefreshCookieOptions({ path: '/api/auth', secure: true, maxAgeDays: 30 });

        expect(options).toEqual({
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/api/auth/refresh',
            maxAge: 30 * 24 * 60 * 60,
        });
    });

    it('allows insecure cookies for local http development', () => {
        const options = buildRefreshCookieOptions({ path: '/api/auth', secure: false, maxAgeDays: 1 });

        expect(options.secure).toBe(false);
    });

    it('exposes the cookie name', () => {
        expect(REFRESH_COOKIE_NAME).toBe('ctm_refresh');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ctm/main test -- auth-cookie.spec.ts`
Expected: FAIL — `./auth-cookie.js` does not exist.

- [ ] **Step 3: Write the cookie helpers**

Create `apps/main/src/auth/auth-cookie.ts`:

```ts
import type { CookieSerializeOptions } from '@fastify/cookie';

/** Name of the HttpOnly refresh cookie issued to the web client. */
export const REFRESH_COOKIE_NAME = 'ctm_refresh';

/** Request header the same-origin proxy stamps on web traffic. */
export const WEB_CLIENT_HEADER = 'x-ctm-client';

/** Value of {@link WEB_CLIENT_HEADER} that identifies the browser app. */
export const WEB_CLIENT_VALUE = 'web';

/**
 * Whether the request arrived through the web proxy and should get a cookie
 * instead of a refresh token in the response body.
 */
export function isWebClient({ headers }: { headers: Record<string, string | string[] | undefined> }): boolean {
    return headers[WEB_CLIENT_HEADER] === WEB_CLIENT_VALUE;
}

/** Cookie attributes for the refresh token. */
export function buildRefreshCookieOptions({
    path,
    secure,
    maxAgeDays,
}: {
    path: string;
    secure: boolean;
    maxAgeDays: number;
}): CookieSerializeOptions {
    return {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path,
        maxAge: maxAgeDays * 24 * 60 * 60,
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ctm/main test -- auth-cookie.spec.ts`
Expected: PASS

- [ ] **Step 5: Make `refreshToken` optional on the wire type**

In `packages/api-client/src/types.ts`:

```ts
export type TokenPair = {
    accessToken: string;
    /** Omitted for web clients — the refresh token is returned as an HttpOnly cookie instead. */
    refreshToken?: string;
    user: UserDto;
};
```

In `apps/main/src/auth/dto/refresh.dto.ts`, make the body optional so cookie-only refresh requests validate:

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class RefreshDto {
    @ApiPropertyOptional({
        description:
            'Refresh token issued by POST /auth/login or /auth/register. Omit when the ctm_refresh cookie is present.',
        maxLength: 4096,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(4096)
    refreshToken?: string;
}
```

- [ ] **Step 6: Write the failing controller tests**

Add to `apps/main/src/auth/auth.controller.spec.ts`, following the existing suite's app-bootstrap and unique-email (`Date.now()`) patterns:

```ts
it('returns the refresh token in the body for bearer clients', async () => {
    const email = `bearer-${Date.now()}@example.com`;
    const response = await request(server)
        .post('/auth/register')
        .send({ email, password: 'password123', name: 'Bearer' })
        .expect(201);

    expect(typeof response.body.refreshToken).toBe('string');
    expect(response.headers['set-cookie']).toBeUndefined();
});

it('returns an HttpOnly cookie and no body token for web clients', async () => {
    const email = `web-${Date.now()}@example.com`;
    const response = await request(server)
        .post('/auth/register')
        .set('X-Ctm-Client', 'web')
        .send({ email, password: 'password123', name: 'Web' })
        .expect(201);

    expect(response.body.refreshToken).toBeUndefined();
    expect(typeof response.body.accessToken).toBe('string');

    const cookie = response.headers['set-cookie'][0];

    expect(cookie).toContain('ctm_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/auth');
});

it('refreshes from the cookie with no request body', async () => {
    const email = `web-refresh-${Date.now()}@example.com`;
    const registerResponse = await request(server)
        .post('/auth/register')
        .set('X-Ctm-Client', 'web')
        .send({ email, password: 'password123', name: 'Web Refresh' })
        .expect(201);

    const cookie = registerResponse.headers['set-cookie'][0].split(';')[0];

    const refreshResponse = await request(server)
        .post('/auth/refresh')
        .set('X-Ctm-Client', 'web')
        .set('Cookie', cookie)
        .send({})
        .expect(200);

    expect(refreshResponse.body.refreshToken).toBeUndefined();
    expect(typeof refreshResponse.body.accessToken).toBe('string');
    expect(refreshResponse.headers['set-cookie'][0]).toContain('ctm_refresh=');
});

it('rejects a web refresh with no cookie and no body token', async () => {
    await request(server).post('/auth/refresh').set('X-Ctm-Client', 'web').send({}).expect(401);
});

it('clears the cookie and revokes the token on logout', async () => {
    const email = `web-logout-${Date.now()}@example.com`;
    const registerResponse = await request(server)
        .post('/auth/register')
        .set('X-Ctm-Client', 'web')
        .send({ email, password: 'password123', name: 'Web Logout' })
        .expect(201);

    const cookie = registerResponse.headers['set-cookie'][0].split(';')[0];

    const logoutResponse = await request(server)
        .post('/auth/logout')
        .set('X-Ctm-Client', 'web')
        .set('Cookie', cookie)
        .send()
        .expect(204);

    expect(logoutResponse.headers['set-cookie'][0]).toContain('ctm_refresh=;');

    await request(server).post('/auth/refresh').set('X-Ctm-Client', 'web').set('Cookie', cookie).send({}).expect(401);
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `pnpm --filter @ctm/main test -- auth.controller.spec.ts`
Expected: FAIL — no `Set-Cookie` header, and `POST /auth/logout` returns 404.

- [ ] **Step 8: Add token revocation to the service**

In `apps/main/src/auth/auth.service.ts`, alongside the existing `revokeAllForUser` method:

```ts
    /** Delete a single refresh token. No-op when the token is unknown. */
    async revokeRefreshToken({ rawRefreshToken }: { rawRefreshToken: string }): Promise<void> {
        const tokenHash = this.hashToken(rawRefreshToken);

        await this.refreshTokenModel.deleteOne({ tokenHash });
    }
```

Reuse whatever the existing private hashing helper is called in that file rather than introducing a second one.

- [ ] **Step 9: Apply cookie mode in the controller**

In `apps/main/src/auth/auth.controller.ts`:

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedError } from '@ctm/errors';
import { buildRefreshCookieOptions, isWebClient, REFRESH_COOKIE_NAME } from './auth-cookie.js';
```

Inject `ConfigService` into the constructor. Add one private helper and use it from `register`, `login`, and `refresh`:

```ts
    /**
     * For web clients, move the refresh token into an HttpOnly cookie and strip it
     * from the response body. Bearer clients get the pair unchanged.
     */
    private applyRefreshTransport({
        tokens,
        request,
        reply,
    }: {
        tokens: TokenPair & { refreshToken: string };
        request: FastifyRequest;
        reply: FastifyReply;
    }): TokenPair {
        if (!isWebClient({ headers: request.headers })) return tokens;

        reply.setCookie(
            REFRESH_COOKIE_NAME,
            tokens.refreshToken,
            buildRefreshCookieOptions({
                path: this.config.getOrThrow<string>('COOKIE_PATH'),
                secure: this.config.getOrThrow<boolean>('COOKIE_SECURE'),
                maxAgeDays: this.config.getOrThrow<number>('REFRESH_TOKEN_EXPIRES_DAYS'),
            }),
        );

        const { refreshToken: _omitted, ...rest } = tokens;

        return rest;
    }
```

Each of the three handlers gains `@Req() request: FastifyRequest` and `@Res({ passthrough: true }) reply: FastifyReply`, and returns `this.applyRefreshTransport({ tokens, request, reply })`.

`refresh` resolves its token from the cookie first, then the body:

```ts
    @Post('refresh')
    @HttpCode(200)
    async refresh(
        @Body() dto: RefreshDto,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<TokenPair> {
        const token = request.cookies[REFRESH_COOKIE_NAME] ?? dto.refreshToken;

        if (!token) throw new UnauthorizedError('No refresh token provided');

        const tokens = await this.auth.refreshTokens(token);

        return this.applyRefreshTransport({ tokens, request, reply });
    }
```

Add the logout endpoint:

```ts
    /** Revoke the current refresh token and clear the web cookie. */
    @ApiOperation({ summary: 'Log out — revoke the current refresh token' })
    @ApiResponse({ status: 204 })
    @Post('logout')
    @HttpCode(204)
    async logout(
        @Body() dto: RefreshDto,
        @Req() request: FastifyRequest,
        @Res({ passthrough: true }) reply: FastifyReply,
    ): Promise<void> {
        const token = request.cookies[REFRESH_COOKIE_NAME] ?? dto.refreshToken;

        if (token) {
            await this.auth.revokeRefreshToken({ rawRefreshToken: token });
        }

        if (isWebClient({ headers: request.headers })) {
            reply.clearCookie(REFRESH_COOKIE_NAME, {
                path: this.config.getOrThrow<string>('COOKIE_PATH'),
            });
        }
    }
```

Check `@ctm/errors` for the exact unauthorized error class name before using `UnauthorizedError`, and import whatever that package actually exports.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `pnpm --filter @ctm/main test -- auth.controller.spec.ts auth-cookie.spec.ts`
Expected: PASS, including the pre-existing bearer-mode tests.

- [ ] **Step 11: Typecheck the workspace**

Run: `pnpm build`
Expected: PASS. `TokenPair.refreshToken` becoming optional may surface errors in `apps/cli` — fix them at the call site by narrowing (`if (!result.refreshToken) throw ...`), not by casting.

- [ ] **Step 12: Commit**

```bash
git add apps/main/src/auth packages/api-client/src/types.ts
git commit -m "feat(auth): issue the refresh token as an HttpOnly cookie for web clients"
```

---

### Task 4: Add the refresh endpoints to the API client

**Files:**

- Modify: `packages/api-client/src/client.ts`
- Modify: `packages/api-client/src/client.types.ts`
- Test: `packages/api-client/src/client.spec.ts`

**Interfaces:**

- Consumes: `TokenPair` from Task 3.
- Produces:
    - `CtmApiClient.refresh({ refreshToken }?: RefreshParams): Promise<TokenPair>` — no longer throws when no token is available, so the cookie can carry it
    - `CtmApiClient.logout({ refreshToken }?: RefreshParams): Promise<void>`

- [ ] **Step 1: Write the failing test**

Add to the `describe('CtmApiClient', ...)` block in `packages/api-client/src/client.spec.ts`. That suite mocks `axios` and asserts on `mockInstance.request` — reuse it as-is.

```ts
it('posts an empty body to refresh when no token is held', async () => {
    const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });
    const payload = { accessToken: 'acc', user: { id: '1', email: 'a@b.com' } };

    mockInstance.request.mockResolvedValueOnce({ data: payload });

    const result = await client.refresh();

    expect(mockInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/auth/refresh',
        data: {},
        params: undefined,
    });
    expect(result).toEqual(payload);
});

it('posts the refresh token when one is held', async () => {
    const client = new CtmApiClient({ baseUrl: 'http://localhost:3000', refreshToken: 'rt' });

    mockInstance.request.mockResolvedValueOnce({
        data: { accessToken: 'acc', refreshToken: 'rt2', user: { id: '1', email: 'a@b.com' } },
    });

    await client.refresh();

    expect(mockInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/auth/refresh',
        data: { refreshToken: 'rt' },
        params: undefined,
    });
});

it('posts the held token to logout', async () => {
    const client = new CtmApiClient({ baseUrl: 'http://localhost:3000', refreshToken: 'rt' });

    mockInstance.request.mockResolvedValueOnce({ data: undefined });

    await client.logout();

    expect(mockInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/auth/logout',
        data: { refreshToken: 'rt' },
        params: undefined,
    });
});

it('posts an empty body to logout when no token is held', async () => {
    const client = new CtmApiClient({ baseUrl: 'http://localhost:3000' });

    mockInstance.request.mockResolvedValueOnce({ data: undefined });

    await client.logout();

    expect(mockInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/auth/logout',
        data: {},
        params: undefined,
    });
});
```

If the `params: undefined` key does not match how the private `request` helper builds its config, copy the exact shape asserted by the neighbouring `posts login credentials` test.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ctm/api-client test`
Expected: FAIL — `refresh()` throws `No refresh token available`; `logout` is not a method.

- [ ] **Step 3: Update the client**

Replace the guard in `refresh` (`packages/api-client/src/client.ts:96-110`) — an absent token is now valid, because the browser sends a cookie:

```ts
    /**
     * Exchange a refresh token for a new token pair. Web clients omit the token
     * and rely on the HttpOnly cookie.
     */
    async refresh({ refreshToken }: RefreshParams = {}): Promise<TokenPair> {
        const token = refreshToken ?? this.refreshToken;

        return this.request<TokenPair>({
            method: 'POST',
            path: '/auth/refresh',
            body: token ? { refreshToken: token } : {},
        });
    }

    /** Revoke the current refresh token. */
    async logout({ refreshToken }: RefreshParams = {}): Promise<void> {
        const token = refreshToken ?? this.refreshToken;

        await this.request<void>({
            method: 'POST',
            path: '/auth/logout',
            body: token ? { refreshToken: token } : {},
        });
    }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ctm/api-client test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src
git commit -m "feat(api-client): support cookie-based refresh and add logout"
```

---

### Task 5: The proxies

**Files:**

- Create: `apps/web/functions/api/[[path]].ts`
- Create: `apps/web/functions/api/proxy.ts`
- Create: `apps/web/functions/api/proxy.spec.ts`
- Create: `apps/web/wrangler.toml`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/.env.example`
- Create: `apps/web/.env` (local only — gitignored)
- Modify: `apps/web/package.json` (add `@cloudflare/workers-types`)

**Interfaces:**

- Consumes: nothing.
- Produces: `buildProxyRequest({ request, apiOrigin }: { request: Request; apiOrigin: string }): Request` — the pure, testable core of the Pages Function.

Splitting the pure logic into `proxy.ts` keeps `[[path]].ts` a thin Cloudflare entry point that needs no Workers runtime to test.

- [ ] **Step 1: Write the failing test**

Create `apps/web/functions/api/proxy.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildProxyRequest } from './proxy.js';

const apiOrigin = 'https://api.example.com';

describe('buildProxyRequest', () => {
    it('strips the /api prefix and swaps the origin', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/tasks');
    });

    it('preserves the query string', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks?filter=today&page=2');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/tasks?filter=today&page=2');
    });

    it('maps the bare /api root to /', () => {
        const request = new Request('https://ctm-web.pages.dev/api');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.url).toBe('https://api.example.com/');
    });

    it('stamps the web client header', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks');
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.headers.get('X-Ctm-Client')).toBe('web');
    });

    it('overwrites a spoofed client header', () => {
        const request = new Request('https://ctm-web.pages.dev/api/tasks', {
            headers: { 'X-Ctm-Client': 'cli' },
        });
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.headers.get('X-Ctm-Client')).toBe('web');
    });

    it('forwards the method, body, and cookies', async () => {
        const request = new Request('https://ctm-web.pages.dev/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: 'ctm_refresh=abc' },
            body: '{}',
        });
        const proxied = buildProxyRequest({ request, apiOrigin });

        expect(proxied.method).toBe('POST');
        expect(proxied.headers.get('Cookie')).toBe('ctm_refresh=abc');
        expect(await proxied.text()).toBe('{}');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ctm/web test -- proxy.spec.ts`
Expected: FAIL — `./proxy.js` does not exist.

Note: `apps/web/vitest.config.ts` uses the jsdom environment, which provides `Request`. If the config restricts includes to `src/**`, widen it to pick up `functions/**/*.spec.ts`.

- [ ] **Step 3: Write the proxy core**

Create `apps/web/functions/api/proxy.ts`:

```ts
const WEB_CLIENT_HEADER = 'X-Ctm-Client';
const WEB_CLIENT_VALUE = 'web';

/**
 * Rewrite a browser request for `/api/*` into a request against the API origin.
 * Strips the `/api` prefix and replaces any client-supplied `X-Ctm-Client`, so
 * only traffic that genuinely came through this proxy is treated as the web app.
 */
export function buildProxyRequest({ request, apiOrigin }: { request: Request; apiOrigin: string }): Request {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const target = new URL(`${path}${url.search}`, apiOrigin);

    const headers = new Headers(request.headers);

    headers.delete(WEB_CLIENT_HEADER);
    headers.set(WEB_CLIENT_HEADER, WEB_CLIENT_VALUE);

    return new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ctm/web test -- proxy.spec.ts`
Expected: PASS

- [ ] **Step 5: Write the Pages Function entry point**

```bash
pnpm --filter @ctm/web add -D @cloudflare/workers-types
```

Create `apps/web/functions/api/[[path]].ts`:

```ts
import { buildProxyRequest } from './proxy.js';

type Env = {
    API_ORIGIN: string;
};

/**
 * Same-origin proxy for the CTM API. Everything under /api is forwarded to
 * API_ORIGIN so the browser and the API share an origin, which is what makes
 * the HttpOnly refresh cookie possible.
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
    if (!env.API_ORIGIN) {
        return new Response('API_ORIGIN is not configured for this Pages project', { status: 500 });
    }

    return fetch(buildProxyRequest({ request, apiOrigin: env.API_ORIGIN }));
};
```

Return the `fetch` result directly. Do not rebuild the `Response` or copy `Content-Encoding` / `Content-Length` — the Workers runtime manages those, and copying them corrupts compressed responses.

- [ ] **Step 6: Add the wrangler config**

Create `apps/web/wrangler.toml`:

```toml
name = "ctm-web"
compatibility_date = "2026-07-25"
pages_build_output_dir = "dist"
```

- [ ] **Step 7: Update the Vite config**

Rewrite `apps/web/vite.config.ts`:

```ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    const apiOrigin = env['API_ORIGIN'];

    if (!apiOrigin) {
        throw new Error('API_ORIGIN is not set. Copy apps/web/.env.example to apps/web/.env.');
    }

    return {
        plugins: [react(), tailwindcss()],
        server: {
            host: '0.0.0.0',
            port: 5173,
            proxy: {
                '/api': {
                    target: apiOrigin,
                    changeOrigin: true,
                    ws: true,
                    rewrite: (path: string): string => path.replace(/^\/api/, ''),
                    headers: { 'X-Ctm-Client': 'web' },
                },
            },
        },
    };
});
```

- [ ] **Step 8: Replace the web env example**

`apps/web/.env.example`, entire contents:

```
# Origin of apps/main. Used by the Vite dev proxy; the production equivalent is the
# API_ORIGIN environment variable on the Cloudflare Pages project.
# Required — there is no fallback, so a missing value fails the dev server at startup.
API_ORIGIN=http://127.0.0.1:3000
```

Then create your local `apps/web/.env` with the same line (it is gitignored).

- [ ] **Step 9: Verify the dev server proxies**

Run `pnpm --filter @ctm/main dev` in one terminal and `pnpm --filter @ctm/web dev` in another, then:

```bash
curl -i http://localhost:5173/api/health
```

Expected: 200 with the health JSON from `apps/main`, not the SPA's HTML.

Also confirm the failure path — temporarily rename `apps/web/.env` and run `pnpm --filter @ctm/web dev`. Expected: startup throws `API_ORIGIN is not set`. Restore the file.

- [ ] **Step 10: Commit**

```bash
git add apps/web/functions apps/web/wrangler.toml apps/web/vite.config.ts apps/web/.env.example apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): proxy /api to the backend in dev and on Pages"
```

---

### Task 6: Move the web client off token storage

**Files:**

- Modify: `apps/web/src/config.ts`
- Modify: `apps/web/src/auth/AuthContext.tsx`
- Delete: `apps/web/src/auth/auth-storage.ts`
- Modify: `apps/web/src/api/web-api-client.ts`
- Modify: `apps/web/src/api/web-api-client.types.ts`
- Modify: `apps/web/src/hooks/useNotificationSocket.ts`
- Modify: `apps/web/src/pages/SourcesPage.tsx`
- Modify: `apps/web/package.json`
- Test: `apps/web/src/auth/AuthContext.spec.tsx`

**Interfaces:**

- Consumes: `CtmApiClient.refresh()` / `.logout()` from Task 4; the `/api` proxy from Task 5.
- Produces: `AuthProvider` holding `accessToken` in React state only; `WebApiClient` constructed without `refreshToken`.

- [ ] **Step 1: Rewrite the AuthContext tests**

Rewrite `apps/web/src/auth/AuthContext.spec.tsx`. The suite currently mocks `js-cookie` and asserts on `Cookies.get('ctm_refresh_token')` — delete the whole `vi.mock('js-cookie', ...)` block, the `import Cookies from 'js-cookie'` line, and every `Cookies.*` assertion. Keep the existing `WebApiClient` class mock, and add `refresh` and `logout` to `mockApi`:

```tsx
const mockApi = {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
};
```

`beforeEach` becomes just `vi.clearAllMocks()` plus a default rejection, so tests that do not care about bootstrap still land in the logged-out state:

```tsx
beforeEach(() => {
    vi.clearAllMocks();
    mockApi.refresh.mockRejectedValue({ statusCode: 401, code: 'unauthorized', message: 'Unauthorized' });
});
```

New tests:

```tsx
it('bootstraps the session from the refresh cookie on mount', async () => {
    mockApi.refresh.mockResolvedValueOnce({
        accessToken: 'acc',
        user: { id: '1', email: 'a@b.com' },
    });

    render(
        <ToastProvider>
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        </ToastProvider>,
    );

    expect(await screen.findByText('a@b.com')).toBeInTheDocument();
    expect(mockApi.refresh).toHaveBeenCalledTimes(1);
});

it('treats a failed bootstrap refresh as logged out', async () => {
    render(
        <ToastProvider>
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        </ToastProvider>,
    );

    await waitFor(() => expect(mockApi.refresh).toHaveBeenCalled());
    expect(screen.getByTestId('user').textContent).toBe('none');
});

it('writes no auth cookie on login', async () => {
    const user = userEvent.setup();

    mockApi.login.mockResolvedValueOnce({
        accessToken: 'acc',
        user: { id: '1', email: 'a@b.com' },
    });

    render(
        <ToastProvider>
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        </ToastProvider>,
    );

    await user.click(screen.getByText('Login'));

    expect(await screen.findByText('a@b.com')).toBeInTheDocument();
    expect(document.cookie).not.toContain('ctm_');
});

it('calls the logout endpoint and clears the user', async () => {
    const user = userEvent.setup();

    mockApi.refresh.mockResolvedValueOnce({
        accessToken: 'acc',
        user: { id: '1', email: 'a@b.com' },
    });
    mockApi.logout.mockResolvedValueOnce(undefined);

    render(
        <ToastProvider>
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        </ToastProvider>,
    );

    expect(await screen.findByText('a@b.com')).toBeInTheDocument();

    await user.click(screen.getByText('Logout'));

    expect(mockApi.logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
});
```

Add `waitFor` to the `@testing-library/react` import. The existing `TestConsumer` already renders `user.email`, so `findByText('a@b.com')` works without changing it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ctm/web test -- AuthContext.spec.tsx`
Expected: FAIL — the provider still reads from cookies and never calls refresh on mount.

- [ ] **Step 3: Point config at the proxy**

`apps/web/src/config.ts`:

```ts
const config = {
    apiUrl: '/api',
    isDev: import.meta.env.DEV as boolean,
} as const;

export default config;
```

- [ ] **Step 4: Rewrite AuthContext**

Hold `accessToken` and `user` in state; no reads or writes to storage. On mount, bootstrap via refresh using the `api` instance the provider already builds:

```tsx
useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
        try {
            const result = await api.refresh();

            if (cancelled) return;

            setAccessToken(result.accessToken);
            setUser(result.user);
        } catch {
            if (cancelled) return;

            setAccessToken(null);
            setUser(null);
        } finally {
            if (!cancelled) setIsLoading(false);
        }
    };

    void bootstrap();

    return () => {
        cancelled = true;
    };
}, []);
```

`login` and `register` store `result.accessToken` and `result.user` in state and nothing else. `logout` calls `api.logout()` and then clears state. `handleUnauthorized` clears state and redirects to `/login` as it does today, minus the `clearAuthStorage()` call.

`updateUser` sets state only.

- [ ] **Step 5: Delete the storage module and dependency**

```bash
git rm apps/web/src/auth/auth-storage.ts
pnpm --filter @ctm/web remove js-cookie @types/js-cookie
```

`StoredAuthTokens` was imported from that module by `web-api-client.ts` and `web-api-client.types.ts`. Replace it with a local type in `web-api-client.types.ts`:

```ts
/** Access token returned by the auth endpoints. The refresh token lives in an HttpOnly cookie. */
export type WebAuthTokens = {
    accessToken: string | null;
};
```

- [ ] **Step 6: Update WebApiClient**

- Drop the `refreshToken` field, the constructor option, and the `refreshToken` argument to `createApiClient()`.
- `setTokens` takes `{ accessToken }` only.
- `retryWithRefresh` loses its `if (!this.refreshToken)` early return — the cookie is invisible to JS, so a refresh is always worth attempting. A 401 from the refresh call itself still routes to `onUnauthorized()`.
- The `pendingRefresh` single-flight stays; it now resolves `{ accessToken }`.
- Add two public methods. `refresh` is what `AuthProvider` calls to bootstrap on mount, so it must not retry-on-401 or toast:

```ts
    /**
     * Exchange the HttpOnly refresh cookie for a new access token.
     * Deliberately bypasses `execute` — a 401 here means "not logged in", which is
     * the normal case for an anonymous visitor and must not trigger the
     * `onUnauthorized` redirect (that would loop on /login).
     */
    async refresh(): Promise<TokenPair> {
        const tokens = await this.apiClient.refresh();

        this.setTokens({ accessToken: tokens.accessToken });

        return tokens;
    }

    /** Revoke the current session server-side. */
    async logout(): Promise<void> {
        await this.execute({
            request: () => this.apiClient.logout(),
            retryOnUnauthorized: false,
            toastOnError: false,
        });
    }
```

- `login`, `register`, and the refresh path must handle `refreshToken` now being absent from `TokenPair`. Read only `accessToken` and `user`.

- [ ] **Step 7: Fix the socket.io paths**

`apps/web/src/hooks/useNotificationSocket.ts` — socket.io ignores the base URL when choosing its handshake path, so it must be told explicitly:

```ts
const socket = io(`${baseUrl}/notifications`, {
    path: '/api/socket.io',
    transports: ['websocket'],
    auth: { token },
});
```

`apps/web/src/pages/SourcesPage.tsx` — same `path` option, and the `readTokens()` call must go. Take the access token from the auth context's api client instead:

```ts
const socket = io(config.apiUrl, {
    path: '/api/socket.io',
    auth: { token: api.getAccessToken() },
    transports: ['websocket'],
});
```

Add `api` to that effect's dependency array.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @ctm/web test`
Expected: PASS

- [ ] **Step 9: Verify no storage references remain**

```bash
grep -rn "js-cookie\|auth-storage\|readTokens\|writeTokens\|clearAuthStorage" apps/web/src
```

Expected: no output.

- [ ] **Step 10: Manual end-to-end check**

With both dev servers running, in the browser at `http://localhost:5173`: register, then confirm in DevTools that

- Application → Cookies shows `ctm_refresh` with HttpOnly ticked, and no `ctm_access_token` / `ctm_user`
- `document.cookie` in the console does not contain `ctm_refresh`
- a page reload keeps you logged in (bootstrap refresh works)
- the sources page live sync progress still updates (socket path works)

- [ ] **Step 11: Commit**

```bash
git add apps/web/src apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): hold the access token in memory and drop cookie storage"
```

---

### Task 7: Deployment configuration and docs

**Files:**

- Modify: `.github/workflows/deploy-cloudflare.yml`
- Modify: `DEPLOYMENT.md`
- Modify: `apps/web/README.md`

**Interfaces:**

- Consumes: `wrangler.toml` from Task 5.
- Produces: a deploy pipeline that no longer injects `VITE_API_URL`.

- [ ] **Step 1: Update the workflow**

In `.github/workflows/deploy-cloudflare.yml`, the `web` job: drop the `env:` block carrying `VITE_API_URL` from the build step, and run wrangler from `apps/web` so `functions/` and `wrangler.toml` are picked up:

```yaml
- run: pnpm exec turbo run build --filter=@ctm/web
- run: pnpm exec wrangler pages deploy --branch=main
  working-directory: apps/web
```

`pages_build_output_dir` in `wrangler.toml` supplies the directory, and `name` supplies the project, so both flags drop off.

- [ ] **Step 2: Update DEPLOYMENT.md**

In the Cloudflare Pages section, document that `ctm-web` needs an `API_ORIGIN` environment variable set to the Railway `main` URL, that it is read at request time by the Pages Function (not baked into the bundle), and that `VITE_API_URL` is retired. In the Railway `main` section, add `COOKIE_PATH=/api/auth` and `COOKIE_SECURE=true`. Note that `REDIRECT_BASE_URL` stays `https://ctm-web.pages.dev/api` and now resolves through the proxy.

- [ ] **Step 3: Update apps/web/README.md**

Replace any `VITE_API_URL` instructions with `API_ORIGIN`, and note that the app always talks to `/api`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-cloudflare.yml DEPLOYMENT.md apps/web/README.md
git commit -m "build(web): deploy the Pages Function and retire VITE_API_URL"
```

---

### Task 8: Full verification and pull request

**Files:** none.

- [ ] **Step 1: Run the whole suite**

```bash
pnpm lint
pnpm build
pnpm test
```

Expected: all pass. Do not proceed on a failure — fix it first.

- [ ] **Step 2: Push the branch and open the PR**

```bash
git push -u origin <branch>
gh pr create --title "feat: same-origin API proxy and HttpOnly refresh cookie" --body "<summary>"
```

The PR body must list the manual deploy steps that are **not** covered by the merge, because the deploy will half-break without them:

1. Set `API_ORIGIN=https://main-production-be0e.up.railway.app` on the `ctm-web` Cloudflare Pages project.
2. Set `COOKIE_PATH=/api/auth` and `COOKIE_SECURE=true` on the Railway `main` service.
3. Delete the `VITE_API_URL` GitHub repo variable.
4. Note that existing users are logged out once and must sign in again.

- [ ] **Step 3: Post-merge smoke test**

After the deploy completes:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://ctm-web.pages.dev/api/health
```

Expected: 200 from `apps/main`. Then log in through the UI and confirm `ctm_refresh` appears as an HttpOnly cookie.

---

## Ordering Notes

Tasks 1–4 (`apps/main` + `api-client`) are independent of Task 5 (proxies). Task 6 depends on 4 and 5. Task 7 depends on 5. Task 8 is last.

Cookie mode only activates on the proxy header, so Tasks 1–4 are safe to merge and deploy on their own — bearer clients see no change.
