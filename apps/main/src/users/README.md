# users

User account module for `apps/main`.

## Responsibilities

- **Account lifecycle** — creation, profile updates, and deletion with cascade to connectors and tasks so no orphaned data is left behind.
- **Lookup for auth** — `findByEmail` / `findById` are the primary integration points with the auth module's Passport strategies.
- **Notification preferences** — per-trigger channel settings are stored on the user document so they travel with the account and don't require a separate collection.
