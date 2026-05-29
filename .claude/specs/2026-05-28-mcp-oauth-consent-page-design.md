# MCP OAuth Consent Page & Shared UI Library

**Date:** 2026-05-28
**Status:** Approved

## Overview

Two parallel improvements:

1. **`packages/ui`** — extract the existing `apps/web/src/components/ui` components into a shared package so other apps (starting with `apps/web` itself) can consume them cleanly.
2. **OAuth consent page** — replace the server-rendered inline-HTML login page in `apps/main/src/oauth` with a proper React page in `apps/web`, aligned with the web UI's neobrutalist design and showing granular, opt-out scopes.

`apps/main` remains the authorization server. No new app is introduced.

## packages/ui

### What moves

Extract `apps/web/src/components/ui/` to `packages/ui/src/`:

- `Button.tsx`
- `Input.tsx`
- `Badge.tsx`
- `Modal.tsx`
- `Checkbox.tsx`
- `index.ts` (barrel export)

### Package config

- Name: `@ctm/ui`
- Peer deps: `react`, `clsx`
- Tailwind CSS v4 theme tokens (`nb-yellow`, `nb-black`, etc.) are defined per-app in each app's `index.css`; `packages/ui` components use them but do not define them
- `apps/web` updates imports from `../components/ui` → `@ctm/ui`

## OAuth Consent Page

### Flow

Current:

```
MCP client → GET /oauth/authorize → NestJS returns inline HTML → user submits → POST /oauth/authorize → redirect with code
```

New:

```
MCP client → GET /oauth/authorize → NestJS redirects to /oauth/consent?{params} → React SPA renders consent page → user submits → POST /oauth/authorize → redirect with code
```

The React consent page lives at `/oauth/consent` in `apps/web`. It reads query params (`redirect_uri`, `code_challenge`, `scope`, `state`, `client_id`), displays the scope panel, and POSTs credentials + selected scopes to `POST /oauth/authorize` on `apps/main`.

### apps/main changes

- `GET /oauth/authorize` redirects to `{WEB_BASE_URL}/oauth/consent?{original_params}` instead of returning inline HTML
- `POST /oauth/authorize` accepts `selected_scopes` as a form body field (space-separated string) alongside `email`/`password`; falls back to the `scope` query param if absent
- Add `WEB_BASE_URL` env var (default `http://localhost:5173` in dev, same origin in production)

### Consent page design

Neobrutalist, matches `LoginPage.tsx`:

- Yellow dot-grid background
- White card with 4px black border + 6px offset shadow
- Permissions box with `#fffbe8` background (hint of yellow) and `#111` borders
- `openid` shown greyed out and locked (always required)
- Other scopes grouped by resource (Tasks, Connectors, Notifications, Profile) with Read/Write checkboxes
- Checked = yellow fill + black inner square; unchecked = white bg + black border
- Credentials (email + password) below the scope panel
- "Authorise →" submit button (neobrutalist black)

### Scope registry

Defined as a static map in `apps/main/src/oauth/scopes.ts`:

| Scope                       | Label                     | Required |
| --------------------------- | ------------------------- | -------- |
| `openid`                    | Verify identity           | Yes      |
| `tasks:read`                | Read tasks                | No       |
| `tasks:write`               | Create & manage tasks     | No       |
| `connectors:read`           | Read connectors           | No       |
| `connectors:write`          | Manage connectors         | No       |
| `connectors:sync`           | Trigger connector sync    | No       |
| `notifications:read`        | Read notifications        | No       |
| `notification-config:read`  | Read notification prefs   | No       |
| `notification-config:write` | Manage notification prefs | No       |
| `profile:read`              | Read profile              | No       |
| `profile:write`             | Update profile            | No       |

The consent page receives the requested scopes via query param, filters to known scopes, groups them by resource prefix, and renders checkboxes. Unknown scopes are ignored.

`openid` is always included in the issued token regardless of what is selected.

### apps/web new route

Add `/oauth/consent` to the React Router config. This route is public (no auth required). It must not be wrapped by `ProtectedRoute`.

Component: `apps/web/src/pages/OAuthConsentPage.tsx`

### Error handling

- If `redirect_uri`, `code_challenge`, or `response_type` are missing/invalid: `GET /oauth/authorize` returns a 400 before redirecting (same as today)
- If credentials are wrong: `POST /oauth/authorize` returns a 401; the consent page re-renders with an error message (same UX pattern as `LoginPage`)
- If the user deselects all non-required scopes: the POST still proceeds with just `openid`

## Migration notes

- No breaking change to existing tokens — same JWT secret, same signing algorithm
- `apps/main` well-known endpoints (`openid-configuration`, `oauth-authorization-server`, `jwks.json`) stay in place
- `apps/mcp` well-known metadata unchanged — it already points at `apps/main` as the authorization server
- The inline HTML in `OAuthController.authorizeGet` is replaced by a redirect; the POST handler gains `selected_scopes` support

## Out of scope

- Scope enforcement on API endpoints (mapping scopes to guards) — that is a follow-up task
- Dark mode on the consent page (can be added later; `LoginPage` supports it as a reference)
- Client name display (requires client registry lookup; `client_id` is optional today)
