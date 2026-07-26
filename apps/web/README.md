# @ctm/web

Vite + React SPA. The main user-facing task management interface. In production it is served as static files by `apps/main`.

## Pages

| Route               | Description                                    |
| ------------------- | ---------------------------------------------- |
| `/login`            | Login form                                     |
| `/register`         | Registration form                              |
| `/tasks`            | Task list — view, create, update, delete tasks |
| `/settings/sources` | Connect / disconnect Todoist and Google Tasks  |
| `/settings/profile` | Edit profile and account settings              |

## Stack

- Vite + React + TypeScript (strict)
- React Router v7
- TanStack Query
- Tailwind CSS v4
- `@ctm/api-client` as the pure typed REST layer
- a web-only API wrapper for cookie auth, refresh, redirect-on-401, and toast errors

## Setup

```bash
cp .env.example .env.local   # set API_ORIGIN — required, the dev server throws without it
pnpm --filter @ctm/web dev
```

The SPA always talks to the same-origin `/api` path (`apps/web/src/config.ts`) —
there is no build-time API URL to configure. In dev, the Vite proxy forwards
`/api/*` to `API_ORIGIN`; in production, the Cloudflare Pages Function
(`functions/api/[[path]].ts`) does the same, reading `API_ORIGIN` from the Pages
project's environment variables at request time.

### Environment Variables

| Variable     | Description                                                                                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_ORIGIN` | Origin of `apps/main` (no default — required). Read by the Vite dev proxy locally, **and** by the Cloudflare Pages Function in production, where it is a Pages project environment variable (Dashboard → Settings), not a build-time/`VITE_*` variable. |

## Commands

```bash
pnpm --filter @ctm/web dev      # Vite dev server
pnpm --filter @ctm/web build    # production build → dist/
pnpm --filter @ctm/web test     # vitest
```
