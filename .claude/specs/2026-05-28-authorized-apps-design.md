# Authorized Apps — Design Spec

**Date:** 2026-05-28

## Overview

Add an "Authorized Apps" section to Settings where users can see which OAuth clients they have granted access to and revoke that access. Dynamic clients (RFC 7591 registered) are deleted entirely on revoke; static clients only lose the user's tokens.

## Schema Changes

### `OAuthClient`

Add `isDynamic: boolean` (default `true`). All clients created via `POST /register` are dynamic.

### `RefreshToken`

- `clientId?: string` — already exists
- Add `scopes: string[]` (default `[]`) — stores the scopes granted at authorization time

## Data Flow

When a user completes the OAuth consent flow:

1. `POST /oauth/authorize` creates an `AuthCode` with `clientId` + `scopes`
2. `POST /oauth/token` calls `exchangeCode`, which now passes `clientId` + `scopes` into `issueTokens`
3. `issueTokens` stores `clientId` + `scopes` on the `RefreshToken` document

No token values (raw refresh tokens, client secrets) are ever returned to the web UI.

## Backend

### New methods on `OAuthService` (or `AuthService`)

**`getAuthorizedApps(userId: string): Promise<AuthorizedAppDto[]>`**

- Query `RefreshToken` where `userId` matches and `clientId` exists
- Deduplicate by `clientId`, pick latest `createdAt` for `authorizedAt`
- Join `OAuthClient` for `clientName`, `isDynamic`, `scopes` (registered scopes as fallback)
- Return metadata only — no token data

**`revokeAuthorizedApp({ userId, clientId }): Promise<void>`**

- Look up `OAuthClient` by `clientId`
- If `isDynamic`: delete the `OAuthClient` doc + all `RefreshToken` docs for that `clientId` (across all users)
- Else: delete only `RefreshToken` docs matching `userId` + `clientId`

### New endpoints (JWT-protected, `GET /auth/me/*`)

| Method   | Path                                 | Response             |
| -------- | ------------------------------------ | -------------------- |
| `GET`    | `/auth/me/authorized-apps`           | `AuthorizedAppDto[]` |
| `DELETE` | `/auth/me/authorized-apps/:clientId` | `204 No Content`     |

## API Client (`packages/api-client`)

New type:

```ts
type AuthorizedAppDto = {
    clientId: string;
    clientName: string;
    scopes: string[];
    authorizedAt: string; // ISO 8601
};
```

New methods on `ApiClient`:

- `getAuthorizedApps(): Promise<AuthorizedAppDto[]>`
- `revokeAuthorizedApp(clientId: string): Promise<void>`

## Web (`apps/web`)

### New page: `AuthorizedAppsPage`

Route: `/settings/authorized-apps`

- Fetches list via `useQuery`
- Each row shows: app name, scopes as small chips, authorized date
- "Revoke" button per row — click shows inline confirmation ("Revoke access for [name]?") with Confirm/Cancel
- On confirm: calls `DELETE`, invalidates query, removes row
- Empty state: "No authorized apps."
- Loading / error states consistent with other settings pages

### `SettingsLayout`

Add "Authorized Apps" tab pointing to `/settings/authorized-apps`.

## What is NOT exposed to the UI

- Raw refresh token values
- Client secret hashes
- Token hashes
- Any internal DB IDs beyond `clientId`
