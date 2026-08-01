# Deployment

Production topology:

| Piece             | Host                     | How it deploys                                     |
| ----------------- | ------------------------ | -------------------------------------------------- |
| `apps/main` (API) | Railway (Docker service) | Railway GitHub integration, auto-deploys on `main` |
| `apps/mcp`        | Railway (Docker service) | Railway GitHub integration, auto-deploys on `main` |
| MongoDB           | MongoDB Atlas            | managed                                            |
| `apps/web` (SPA)  | Cloudflare Pages         | `.github/workflows/deploy-cloudflare.yml`          |
| `apps/landing`    | Cloudflare Pages         | same workflow                                      |
| `apps/docs`       | Cloudflare Pages         | same workflow                                      |

Sync and reminders run **inside `apps/main`** via `@nestjs/schedule` — there is no
separate worker service (`apps/sync` is an unimplemented stub).

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster (pick the region closest to the Railway region).
2. Create a database user, and a database named `ctm`.
3. Network access: Atlas has no static egress IP from Railway, so allow `0.0.0.0/0`
   and rely on SCRAM auth + TLS (Atlas enforces TLS).
4. Copy the SRV connection string — it becomes `MONGODB_URI`:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ctm?retryWrites=true&w=majority`

## 2. Railway — `main` service

- Source: this GitHub repo, root directory `/`.
- Config-as-code path: `railway.main.json` (builds `apps/main/Dockerfile`, healthcheck `/health`).
- Attach a **volume** mounted at `/data` (exports are written to `EXPORT_DIR`).
- Generate the secrets locally:

    ```bash
    # JWT_SECRET (32+ chars) and ENCRYPTION_KEY (64 hex chars)
    openssl rand -hex 32

    # RSA keypair, base64-encoded PEM
    node -e "const {generateKeyPairSync}=require('crypto');const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});console.log('RSA_PRIVATE_KEY='+Buffer.from(privateKey).toString('base64'));console.log('RSA_PUBLIC_KEY='+Buffer.from(publicKey).toString('base64'))"
    ```

- Variables: see the production block in `apps/main/.env.example`.
  **Every connector variable must exist**, even when unused — the connectors module
  reads them with `getOrThrow`, so set them to an empty string rather than omitting them.
- Generate a public domain for the service; that URL is `REDIRECT_BASE_URL`.
- Add `${REDIRECT_BASE_URL}/connectors/oauth/callback/<todoist|google_tasks|notion|discord>`
  as a redirect URI in each OAuth app.
- Also set `COOKIE_PATH=/api/auth` and `COOKIE_SECURE=true`. `COOKIE_PATH`
  carries the `/api` prefix because it is the browser-visible path — the SPA reaches
  `apps/main` through the Cloudflare Pages Function proxy at `/api/*`, not directly.
  It is scoped to `/api/auth`, not `/api/auth/refresh` — per RFC 6265 §5.1.4 a
  cookie's path must be a prefix of a route for the browser to send it, and
  `/api/auth/refresh` is not a prefix of `/api/auth/logout`. Scoping to
  `/api/auth/refresh` silently breaks logout: the browser never sends the
  cookie to `/auth/logout`, so the DB refresh-token record is never revoked.
- **Ordering hazard**: `COOKIE_PATH` and `COOKIE_SECURE` are `Joi…required()` in
  `env.schema.ts` — the API crash-loops on boot if they are unset. Existing
  deployments must set both variables on Railway BEFORE merging/deploying this
  change, not after.
- The rate-limit variables (`RATE_LIMIT_*`, `LOGIN_MAX_FAILED_ATTEMPTS`,
  `LOGIN_LOCKOUT_MINUTES`, `MAX_CONNECTIONS_PER_CONNECTOR`, `MAX_TASKS_PER_USER`)
  default in `env.schema.ts`; set them on Railway only to override.
- Rate-limit counters are held **in process**. Keep `main` on a single replica, or the
  effective limit multiplies by the replica count.
- `REDIRECT_BASE_URL` is `https://ctm-web.pages.dev/api` — the `/api` suffix is
  correct and must stay. Before the Pages Function proxy existed this was broken
  (the SPA's catch-all route just returned `index.html` for `/api/...`), but the
  proxy now forwards `/api/*` on the Pages origin to this service, so the redirect
  resolves correctly. Do not "fix" this back to a bare origin.

## 3. Railway — `mcp` service

- Same repo, config-as-code path `railway.mcp.json` (builds `apps/mcp/Dockerfile`).
- Variables: see the production block in `apps/mcp/.env.example`.
  `CTM_API_BASE_URL` uses the private network:
  `http://${{main.RAILWAY_PRIVATE_DOMAIN}}:3000` (both services bind `::`, which is
  required — Railway's private network is IPv6-only).
- `RSA_PUBLIC_KEY` must be byte-identical to the one on `main`.

## 4. Cloudflare Pages

Create three Pages projects (direct upload, no build step — CI uploads the built assets):
`ctm-web`, `ctm-landing`, `ctm-docs`.

GitHub repo **secrets**:

| Name                    | Value                                         |
| ----------------------- | --------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | token with the "Cloudflare Pages: Edit" scope |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id                         |

GitHub repo **variables**:

| Name       | Value                                    |
| ---------- | ---------------------------------------- |
| `DOCS_URL` | the public origin of the docs Pages site |

`API_ORIGIN` — the origin the `/api` proxy forwards to — lives in
`apps/web/wrangler.toml` under `[vars]`, so it deploys with the project and needs no
dashboard step. It is read at **request time** by the Pages Function
(`apps/web/functions/api/[[path]].ts`), not baked into the JS bundle, so it is not a
build-time/Vite variable and does not belong in GitHub Actions. It is not a secret:
the same URL was public in the pre-proxy bundle. To point the SPA at a different API,
edit that file and redeploy.

`VITE_API_URL` is retired — the SPA now always talks to the same-origin `/api`
path (see `apps/web/src/config.ts`), and the GitHub repo variable of that name is
no longer read by the workflow.

Then set `CORS_ORIGIN` and `WEB_URL` on the Railway `main` service to the Pages
origin of the SPA.

## 5. Smoke test

```bash
curl https://<main>.up.railway.app/health   # {"status":"ok","database":"up",...}
curl https://<mcp>.up.railway.app/health    # {"status":"ok",...}
```

Then load the SPA and log in — the network tab should hit same-origin `/api/...`
requests, which the Pages Function forwards to `API_ORIGIN`.

---

## 6. Observability

Both Node services log JSON to stdout. Railway captures stdout per service, so the
deployment's **Logs** tab is where you read them; there is no log shipping and no log
file on disk.

### Required variables

Three variables configure logging. All are **required on both `main` and `mcp`**, with no
defaults and nothing inferred from `NODE_ENV` — a service whose environment is missing any
of them refuses to boot. Set all three on both Railway services before deploying.

| Variable     | Values                                        | In production   |
| ------------ | --------------------------------------------- | --------------- |
| `LOG_LEVEL`  | `trace` `debug` `info` `warn` `error` `fatal` | usually `info`  |
| `LOG_PRETTY` | `true` `false`                                | must be `false` |
| `LOG_REDACT` | `true` `false`                                | must be `true`  |

The last two columns are enforced, not advisory. With `NODE_ENV=production`, the env
validator rejects `LOG_PRETTY=true` (pino-pretty is a devDependency and is absent from the
production image, so the first log line would crash the process) and rejects
`LOG_REDACT=false` (it would write tokens, passwords, cookies and OAuth codes to stdout in
plain text, where the log collector retains them long after the credential is rotated).
Neither can be turned on in production by accident.

### Levels

`LOG_LEVEL` gates everything at or above it.

| Level   | Use                                                                     |
| ------- | ----------------------------------------------------------------------- |
| `fatal` | The process cannot continue: `uncaughtException`, `unhandledRejection`. |
| `error` | A request or job failed and nothing downstream can recover it.          |
| `warn`  | A request rejected for a reason the caller controls, or a fallback.     |
| `info`  | One line per completed request, plus lifecycle events. Usual in prod.   |
| `debug` | Routine protocol detail: OAuth steps, socket connects.                  |
| `trace` | Everything. Never in production.                                        |

Raise the verbosity by setting `LOG_LEVEL=debug` on the Railway service and
redeploying. Put it back to `info` afterwards: `debug` logs every OAuth step of every
client.

### Following one request

Every response carries an `x-request-id` header, and every log line emitted while
handling that request carries the same value under `requestId`, plus `userId` once the
JWT is verified. Search the service's logs for the id to get the whole request in
order, including the error line from the exception filter.

A caller may supply its own `x-request-id` and it is reused, so a trace can span the
SPA, `mcp` and `main`. Values longer than 128 characters or carrying anything outside
`[A-Za-z0-9._:-]` are replaced with a generated UUID.

### What is not logged

With `LOG_REDACT=true`, `@ctm/logger` redacts authorization and cookie headers, passwords
and hashes, every token field, and the OAuth `code`, `code_verifier`, `state` and
`client_secret`, at the top level and two levels down. A new secret-bearing field has to be
added to `SECRET_KEYS` in `packages/logger/src/redaction.ts`; the list is matched by exact
key name, not by substring.

Set `LOG_REDACT=false` locally when you need to read one of those values back — say, to
check which token a connector actually sent. It is a local-only switch: production boots
are rejected with it off.

---

## One-off release steps

### Clear OAuth clients for the `AuthorizedClient` release

The release that introduces the `authorizedclients` collection does not migrate anything. The
authorized apps list used to be derived from refresh tokens; it is now read from an explicit grant
record that no existing row has. Rather than reconstruct that history, drop the OAuth state and let
users re-authorize from the consent screen.

Run this against production **after** the Railway `main` deploy is live, so nothing re-registers
between the wipe and the new build going up:

```bash
mongosh "$MONGODB_URI" --eval '
  db.oauthclients.deleteMany({});
  db.authorizedclients.deleteMany({});
  db.authcodes.deleteMany({});
  db.refreshtokens.deleteMany({ clientId: { $exists: true, $ne: null } });
'
```

What each line does:

- `oauthclients` — every dynamically registered CLI/MCP/third-party client. They re-register on
  their next connect.
- `authorizedclients` — the new grant records. Empty on a first deploy; included so the step stays
  safe to re-run.
- `authcodes` — authorization codes mid-flight. They live five minutes; a user part-way through a
  consent flow retries.
- `refreshtokens` **carrying a `clientId`** — OAuth-issued tokens only. The filter matters: browser
  session tokens from `POST /auth/login` have no `clientId`, so web users stay signed in.

Users see their connected apps disappear from **Settings → Authorized Apps** and reconnect each one
(`ctm auth login` for the CLI, re-adding the server for MCP clients). Connector OAuth tokens
(Todoist, Google) live in `connectorconfigs` and are untouched, so no task data is affected.

---

## Local MongoDB data

`docker-compose.yml` binds MongoDB's data directory to `./.data/mongodb` (git-ignored)
instead of a named volume, so `docker compose down -v` cannot wipe it.

If you previously ran with the named `mongodb_data` volume, migrate before recreating
the container:

```bash
docker compose stop mongodb
mkdir -p .data/mongodb
docker run --rm -v centralised-task-manager_mongodb_data:/from -v "$PWD/.data/mongodb":/to \
    alpine sh -c 'cp -a /from/. /to/'
docker compose up -d --force-recreate mongodb
```
