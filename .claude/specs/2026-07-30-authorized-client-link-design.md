# Explicit user <-> OAuth client link (AuthorizedClient)

Issue: #27

## Problem

`AuthorizedAppsService.getAuthorizedApps` derives the set of OAuth clients a user has authorized by
loading every `RefreshToken` document for that user, grouping by `clientId` and keeping the newest
per client. The relationship is inferred from credentials rather than recorded.

Consequences:

- The read scans all of a user's refresh tokens, and the grouping happens in application memory.
- A client the user authorized disappears from the list the moment its last refresh token expires
  (the collection has a TTL index on `expiresAt`), even though the grant itself was never revoked.
- There is no audit trail: nothing records that a grant happened, only that a token exists.
- Revocation has to reason about tokens to decide what a user is allowed to revoke.

## Model

A new Mongoose collection, `AuthorizedClient`, records one document per `(userId, clientId)` grant.

| Field          | Type       | Notes                                                             |
| -------------- | ---------- | ----------------------------------------------------------------- |
| `userId`       | `string`   | Indexed. Mongo id of the granting user.                           |
| `clientId`     | `string`   | Indexed. `OAuthClient.clientId`, not a Mongo `_id`.               |
| `scopes`       | `string[]` | Scopes the most recent grant carried.                             |
| `isDynamic`    | `boolean`  | Snapshot of the client's registration kind at grant time.         |
| `authorizedAt` | `Date`     | When this user first granted this client. Never moved afterwards. |

Unique compound index on `{ userId, clientId }`, which makes the grant idempotent and makes the
listing read a single indexed query.

`isDynamic` is duplicated from `OAuthClient` deliberately: dynamically registered clients are
reaped by a TTL index, and the link has to survive well enough to describe what was granted.
`OAuthClient` stays the source of truth for revocation while it exists.

## Writes

`AuthorizedClientService.recordAuthorization` upserts the link. It is called from
`OAuthService.issueTokens` whenever a `clientId` is present, which is the same place and the same
condition under which a refresh token carrying a `clientId` is written today, so the set of links
matches the set of clients the old scan would have found.

`scopes` and `isDynamic` are written on every call; `authorizedAt` uses `$setOnInsert`, so it means
"first granted" rather than "most recently refreshed". This is a deliberate change from the old
value, which moved forward on every refresh token rotation.

## Reads

`getAuthorizedApps` queries `AuthorizedClient` by `userId`, sorted newest first, and joins
`OAuthClient` in one `$in` query for the client name. A link whose client no longer exists is
skipped, matching the previous behaviour.

## Revocation

Unchanged in effect, with the link cleaned up alongside the tokens:

- **Dynamic client** — delete the `OAuthClient`, every `AuthorizedClient` for that client, and every
  refresh token for that client.
- **Static client** — delete this user's `AuthorizedClient` and this user's refresh tokens for that
  client. Other users keep theirs.
- **Unknown client** — `NotFoundError`.

When the `OAuthClient` document is gone but a link survives, the link's `isDynamic` decides. This
only arises for a TTL-reaped dynamic client, where deleting the leftovers is the right outcome.

## Migration

`apps/main/scripts/backfill-authorized-clients.ts`, run once before the deploy that ships the read
change. It aggregates `refreshtokens` grouped by `userId` + `clientId`, taking the newest
`createdAt` as `authorizedAt` and that document's scopes, and upserts into `authorizedclients`.
Idempotent: re-running it never creates duplicates and never moves an existing `authorizedAt`.

Grants whose refresh tokens have all expired are not recoverable and are not backfilled. They were
already invisible in the old listing.

## Out of scope

Account deletion does not currently remove refresh tokens, and will not remove authorized clients
either. Tracked separately.
