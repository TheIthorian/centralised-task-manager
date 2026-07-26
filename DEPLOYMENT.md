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

`ctm-web` (the Pages **project**, not the GitHub repo) needs its own environment
variable, set in the Cloudflare dashboard under Pages → `ctm-web` → Settings →
Environment variables:

| Name          | Value                                              |
| ------------- | --------------------------------------------------- |
| `API_ORIGIN`  | `https://main-production-be0e.up.railway.app` (the Railway `main` public URL) |

`API_ORIGIN` is read at **request time** by the Pages Function
(`apps/web/functions/api/[[path]].ts`) that proxies `/api/*` to `apps/main` — it is
not a build-time/Vite variable and is not baked into the JS bundle, so it does not
go in GitHub Actions and a redeploy is not needed to change it.

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
