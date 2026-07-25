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

| Name           | Value                                    |
| -------------- | ---------------------------------------- |
| `VITE_API_URL` | the Railway `main` public URL            |
| `DOCS_URL`     | the public origin of the docs Pages site |

Then set `CORS_ORIGIN` and `WEB_URL` on the Railway `main` service to the Pages
origin of the SPA.

## 5. Smoke test

```bash
curl https://<main>.up.railway.app/health   # {"status":"ok","database":"up",...}
curl https://<mcp>.up.railway.app/health    # {"status":"ok",...}
```

Then load the SPA and log in — the network tab should hit `VITE_API_URL`.

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
