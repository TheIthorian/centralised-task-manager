# users

User account module for `apps/main`.

## Responsibilities

- **Create** — `UsersService.create` bcrypt-hashes the password (cost 12) and inserts a user. Throws `ConflictException` on duplicate email.
- **Lookup** — `findByEmail` / `findById` for use by auth strategies.
- **Update** — `update` allows changing email and/or password.
- **Notification preferences** — `getNotificationPreferences` / `updateNotificationPreferences` patch per-trigger channel settings (stored in the User document).
- **Delete** — `delete` removes the user and cascades to connector configs and tasks.

## Schema

`User` (`users` collection) — key fields:

| Field                     | Notes                                                           |
| ------------------------- | --------------------------------------------------------------- |
| `email`                   | Unique, lowercased                                              |
| `passwordHash`            | bcrypt, cost 12                                                 |
| `name`                    | Display name                                                    |
| `notificationPreferences` | `NotificationPreferences` — nested per-trigger channel booleans |

## HTTP endpoints

| Method   | Route                                | Description                 |
| -------- | ------------------------------------ | --------------------------- |
| `GET`    | `/users/me`                          | Get current user profile    |
| `PATCH`  | `/users/me`                          | Update email / password     |
| `DELETE` | `/users/me`                          | Delete account and all data |
| `GET`    | `/users/me/notification-preferences` | Get preferences             |
| `PATCH`  | `/users/me/notification-preferences` | Update preferences          |
