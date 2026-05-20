---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

## 1. Register an account

```http
POST /auth/register
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "hunter2hunter2"
}
```

Response:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "email": "jane@example.com" }
}
```

## 2. Connect a task source

Use the access token to get an OAuth URL for a connector:

```http
POST /connectors/configs
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "source": "todoist" }
```

Response: `{ "url": "https://todoist.com/oauth/..." }`

Visit that URL in a browser to authorise CTM. The callback is handled automatically.

## 3. List your tasks

Once a connector is set up, the sync worker mirrors tasks within ~15 minutes:

```http
GET /tasks
Authorization: Bearer <accessToken>
```

## 4. Issue an API token (for CLI/MCP)

For non-interactive use (CLI, MCP server), create a long-lived API token:

```http
POST /auth/tokens
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "label": "my-cli" }
```

The `token` field is returned **once**. Store it securely — it cannot be retrieved again.
