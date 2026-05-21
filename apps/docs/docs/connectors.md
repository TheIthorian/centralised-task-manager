---
id: connectors
title: Connectors
sidebar_position: 4
---

# Connectors

Connectors link CTM to external task services. Each connector stores encrypted OAuth tokens and syncs tasks every 15 minutes.

## Supported sources

| Source       | ID             |
| ------------ | -------------- |
| Todoist      | `todoist`      |
| Google Tasks | `google_tasks` |

## Connecting a source

### 1. Get the OAuth URL

```http
POST /connectors/configs
Authorization: Bearer <token>
Content-Type: application/json

{ "source": "todoist" }
```

### 2. Redirect the user

Open the returned `url` in a browser. The user authorises CTM; the provider redirects back to `/connectors/oauth/callback/:source`.

### 3. Check the connection

```http
GET /connectors/configs
Authorization: Bearer <token>
```

```json
[
    {
        "id": "...",
        "source": "todoist",
        "enabled": true,
        "lastSyncedAt": "2026-05-20T10:00:00.000Z",
        "lastError": null
    }
]
```

## Enabling / disabling a connector

```http
PATCH /connectors/configs/:id
Authorization: Bearer <token>
Content-Type: application/json

{ "enabled": false }
```

## Removing a connector

```http
DELETE /connectors/configs/:id
Authorization: Bearer <token>
```

Returns `204 No Content`. Tasks mirrored from this source remain in CTM.
