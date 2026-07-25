# Same-Origin API Proxy & HttpOnly Refresh Cookie

**Date:** 2026-07-25

## Problem

`apps/web` (Cloudflare Pages, `ctm-web.pages.dev`) calls `apps/main` (Railway,
`main-production-be0e.up.railway.app`) cross-origin. Auth tokens are stored by
`js-cookie` in `apps/web/src/auth/auth-storage.ts` — non-`HttpOnly`, so any XSS can
read and exfiltrate a 30-day refresh token.

An `HttpOnly` refresh cookie is the fix, but the two hosts are different registrable
sites. A cross-site cookie needs `SameSite=None; Secure`, which Safari ITP blocks and
Chrome restricts. So the cookie is only viable once web and API share an origin.

`REDIRECT_BASE_URL` on Railway is already set to `https://ctm-web.pages.dev/api`,
which currently resolves to the SPA's `index.html` — a proxy was assumed but never
built. This design builds it.

## Goals

- Web talks to a single origin: `/api/*` on the Pages domain.
- Refresh token becomes `HttpOnly` — unreadable by JavaScript.
- Access token lives in memory only.
- CLI, MCP, and external API clients are byte-for-byte unaffected.
- Request and response bodies are compressed on the wire.

## Non-goals

- Custom domain setup. The alternative fix is `app.<domain>` + `api.<domain>` under one
  registrable domain, which makes the two sites same-site and removes the need for a
  proxy entirely (this is how `picstack` works). Rejected here because it means buying a
  domain. If one is bought later, the Pages Function can be deleted and `API_ORIGIN`
  dropped; the cookie logic in `apps/main` stays as-is apart from `COOKIE_PATH`
  becoming `/auth/refresh`.
- Changing the access-token model. Bearer stays for every client, web included.
- Session/server-state auth. The API stays stateless.

---

## Architecture

```
browser ──► ctm-web.pages.dev/api/*  ──► Pages Function ──► Railway (apps/main)
                                          strip /api
                                          set X-Ctm-Client: web

CLI / MCP ────────────────────────────────────────────────► Railway (apps/main)
                                          no header → bearer mode, unchanged
```

Dev mirrors prod with the Vite dev-server proxy, so `/api` is the base URL in both
environments and cookie behaviour is identical.

### Why not `_redirects` or a Vite prod proxy

- `vite.config.ts` `server.proxy` runs only in the dev server. The production build is
  static files; there is no Node process.
- Cloudflare Pages `_redirects` rewrites only to assets within the same project. It
  cannot proxy to an external origin.

### Path stripping

The proxy strips the `/api` prefix; Nest keeps its current unprefixed routes
(`/auth`, `/connectors`, `/health`). The rejected alternative — `app.setGlobalPrefix('api')`
— would move every direct consumer: CLI base URL, `CTM_API_BASE_URL` for MCP, the
Railway healthcheck path, OAuth redirect URIs, and the docs.

---

## Components

### 1. Pages Function — `apps/web/functions/api/[[path]].ts`

Catch-all. For every request:

1. Rewrite the URL: strip the leading `/api`, keep path and query, swap the origin for
   `API_ORIGIN`.
2. Copy the incoming headers, then **delete any inbound `X-Ctm-Client`** and set
   `X-Ctm-Client: web`. A client cannot self-declare as the web app.
3. Forward method, headers, and body; stream the response back unmodified, including
   `Set-Cookie`.
4. Pass WebSocket upgrade requests through untouched (Workers `fetch` supports this).

`API_ORIGIN` is a Cloudflare Pages **environment variable**, read at request time.

### 2. Vite dev proxy — `apps/web/vite.config.ts`

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const apiOrigin = env["API_ORIGIN"];

  if (!apiOrigin) {
    throw new Error("API_ORIGIN is not set. Copy apps/web/.env.example to apps/web/.env.");
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          headers: { "X-Ctm-Client": "web" },
        },
      },
    },
  };
});
```

`loadEnv` with an empty prefix reads unprefixed vars, so dev and prod share the name
`API_ORIGIN`. No `VITE_*` variable is involved: the value is server-side config, not
bundle content.

No fallback target: an unset `API_ORIGIN` fails the dev server at startup with a
message naming the fix, rather than silently proxying somewhere wrong. Same rule in the
Pages Function, which throws on the first request. `apps/web/.env.example` carries the
local value.

### 3. Cookie mode in `apps/main`

Register `@fastify/cookie` in `createApp()` (`apps/main/src/bootstrap.ts`).

On `POST /auth/register`, `POST /auth/login`, and `POST /auth/refresh`, when the
request carries `X-Ctm-Client: web`:

- set `ctm_refresh` — `HttpOnly`, `Secure` (from `COOKIE_SECURE`), `SameSite=Lax`,
  `Path` (from `COOKIE_PATH`), `Max-Age` = `REFRESH_TOKEN_EXPIRES_DAYS`
- **omit** `refreshToken` from the JSON body; `accessToken` and `user` are returned
  as they are today

Without the header, responses are unchanged — the refresh token stays in the body.

`POST /auth/refresh` reads the token from the cookie when present, falling back to the
body. New `POST /auth/logout` deletes the refresh token server-side and clears the
cookie.

The server owns all cookie logic. The web client never reads or writes a cookie, and
the proxies pass `Set-Cookie` and `Cookie` through unmodified — their only edit is the
`X-Ctm-Client` request header.

#### Cookie path

The browser sees `/api/auth/refresh`; Nest sees `/auth/refresh`. Rather than have the
proxies rewrite the `Set-Cookie` path, Nest emits the browser-visible path directly
from `COOKIE_PATH` (`/api/auth/refresh` in both dev and prod).

#### CSRF

`SameSite=Lax` plus a POST-only refresh endpoint means no cross-site request can
trigger a refresh. Same-origin traffic needs no `SameSite=None`.

#### Credentials

Same-origin requests send cookies without `withCredentials`, so
`packages/api-client` needs no change and stays browser-agnostic.

### 4. Web client

- `config.ts` → `apiUrl: '/api'`, no env read.
- Access token in React state only. On mount, `AuthProvider` bootstraps with
  `POST /api/auth/refresh` and no body; a 401 means logged out.
- `auth-storage.ts` deleted. `js-cookie` and `@types/js-cookie` removed. The user
  profile comes from the refresh response.
- `WebApiClient` drops its `refreshToken` field; `retryWithRefresh` calls the refresh
  endpoint with no token argument and relies on the cookie.
- **socket.io**: `useNotificationSocket.ts` and `SourcesPage.tsx` need
  `path: '/api/socket.io'`. socket.io ignores the base URL for its handshake path and
  would otherwise hit `/socket.io` at the origin root, which the proxy does not match.
  The Nest gateway is unchanged; the proxy strips the prefix.

### 5. Compression in `apps/main`

Register `@fastify/compress` (v9) in `createApp()`. One plugin covers both directions:

- **Responses** — `br`, `gzip`, `deflate`, negotiated from `Accept-Encoding`. Default
  1 KB threshold, so small JSON stays uncompressed. Task lists, export payloads, and the
  OpenAPI spec are the wins.
- **Requests** — a `preParsing` hook decompresses `Content-Encoding: gzip|br|deflate`
  bodies. Enabled by default (`globalDecompression`). Mostly useful for the import
  endpoint; costs nothing when clients don't use it.

`zstd` is available on Node 24 but is left off: Cloudflare's subrequest layer doesn't
negotiate it, so it would only ever apply to direct CLI hits.

Ordering: register before `@fastify/multipart` so upload bodies are not double-handled.
Multipart uploads and export-file downloads are already binary — the threshold and
content-type checks skip them.

Interaction with the proxy: the Workers runtime normalises `Accept-Encoding` on
subrequests and may transparently decompress the response before the Function sees it.
The Function must therefore **not** copy `Content-Encoding` / `Content-Length` from the
origin response onto a re-built response — return the `fetch` result directly and let
the runtime set them. Cloudflare then compresses again at the edge for the browser.

No BREACH exposure: after this change the refresh token travels in `Set-Cookie`, not in
a compressed response body.

---

## Configuration

### New

| Variable        | Where                          | Value                                                                   |
| --------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `API_ORIGIN`    | Pages env var; `apps/web/.env` | `https://main-production-be0e.up.railway.app` / `http://127.0.0.1:3000` |
| `COOKIE_PATH`   | Railway `main`                 | `/api/auth/refresh`                                                     |
| `COOKIE_SECURE` | Railway `main`                 | `true` (prod), `false` (dev)                                            |

Both `main` variables are required in `env.schema.ts` — no defaults, per the
fail-fast convention.

### Removed

- `VITE_API_URL` — GitHub repo variable, `.github/workflows/deploy-cloudflare.yml`,
  and `apps/web/.env.example`.

### Unchanged

- `REDIRECT_BASE_URL=https://ctm-web.pages.dev/api` — wrong only because no proxy
  existed; correct under this design.
- `CORS_ORIGIN`, `WEB_URL` — already correct. CORS becomes redundant for web traffic
  but still covers direct hits.

### Deploy

`apps/web/wrangler.toml` with `pages_build_output_dir = "dist"`; the workflow runs
wrangler from `apps/web` so the `functions/` directory is picked up.

---

## Error handling

| Case                           | Behaviour                                                               |
| ------------------------------ | ----------------------------------------------------------------------- |
| `API_ORIGIN` unset             | Function throws at request time; Pages returns 500. No silent fallback. |
| Railway unreachable            | Function returns 502; web surfaces it through the existing toast path.  |
| Refresh cookie absent          | `POST /auth/refresh` → 401; `AuthProvider` treats it as logged out.     |
| Refresh cookie invalid/expired | 401; cookie cleared, redirect to `/login`.                              |
| WebSocket upgrade fails        | socket.io retries; existing behaviour.                                  |

---

## Testing

- **Pages Function** — plain `fetch` handler, unit tested: `/api` stripped; inbound
  `X-Ctm-Client` scrubbed and replaced; method, body, and query preserved;
  `Set-Cookie` passed through; upgrade requests forwarded.
- **`auth.controller.spec.ts`** (real DB, per convention) — with the header: cookie set
  with the right attributes and `refreshToken` absent from the body; without it:
  response identical to today; refresh reads the cookie; logout clears it and deletes
  the DB record.
- **`bootstrap.spec.ts`** — cookie and compress plugins registered, compress before
  multipart.
- **compression** — a response over the threshold comes back `br`/`gzip` when
  `Accept-Encoding` allows and uncompressed when it doesn't; a gzipped request body is
  decompressed and parsed.
- **`AuthContext.spec.tsx`** — bootstraps via refresh, no storage module, 401 →
  logged out.

---

## Migration

Users logged in at deploy time hold tokens in JS cookies the new client will not read.
They are logged out once and re-login. Their DB refresh tokens go stale and expire on
their own; no cleanup job needed.

**Rollback:** revert the web deploy. Railway keeps serving bearer mode, since cookie
mode only activates on the proxy header.

---

## Security outcome

XSS can still ride an active session by calling the API from the page. It can no
longer steal a 30-day refresh token. That is the intended boundary; closing the
former needs CSP, which is out of scope here.
