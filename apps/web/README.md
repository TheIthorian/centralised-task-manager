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
cp .env.example .env.local   # set VITE_API_URL if needed
pnpm --filter @ctm/web dev
```

### Environment Variables

| Variable       | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| `VITE_API_URL` | Base URL of `apps/main` (defaults to `http://localhost:3000`) |

## Commands

```bash
pnpm --filter @ctm/web dev      # Vite dev server
pnpm --filter @ctm/web build    # production build → dist/
pnpm --filter @ctm/web test     # vitest
```
