# MCP Server Design

**Date:** 2026-05-21

## Overview

New `apps/mcp` — a NestJS + Fastify HTTP MCP server that exposes CTM task and connector operations as MCP tools. Stateless: no database, delegates all API calls to `apps/main` via `@ctm/api-client`. Authentication uses MCP OAuth — `apps/main` acts as the OAuth Authorization Server; `apps/mcp` is a pure resource server.

## Changes to apps/main (OAuth Authorization Server)

Add three endpoints to the existing auth module:

- `GET /.well-known/oauth-authorization-server` — OAuth discovery metadata
- `GET /authorize` — accepts `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method`; presents login UI; on success issues a short-lived auth code (signed JWT, TTL 60s) and redirects to `redirect_uri`
- `POST /token` — exchanges auth code for CTM JWT pair (`grant_type=authorization_code`), or refreshes (`grant_type=refresh_token`)

No new database schema needed — auth codes are stateless signed JWTs.

## apps/mcp Structure

```
apps/mcp/
  src/
    app.module.ts
    main.ts
    auth/
      auth.module.ts
      jwt.strategy.ts       # Validates Bearer CTM JWT on all MCP endpoints
    mcp/
      mcp.module.ts
      mcp.controller.ts     # POST /mcp, GET /mcp (SSE transport)
      mcp.service.ts        # Registers tools, instantiates CtmApiClient per request
      tools/
        tasks.tool.ts       # list_tasks, create_task, update_task,
                            # complete_task, delete_task, set_fuzzy_deadline
        connectors.tool.ts  # list_connectors, get_connector_auth_url,
                            # disconnect_connector
  Dockerfile
  package.json
  tsconfig.json
  tsconfig.build.json
```

## MCP Tools

### Tasks
| Tool | Maps to |
|------|---------|
| `list_tasks` | `client.listTasks({ filter })` |
| `create_task` | `client.createTask({ dto })` |
| `update_task` | `client.updateTask({ id, dto })` |
| `complete_task` | `client.completeTask({ id })` |
| `delete_task` | `client.deleteTask({ id })` |
| `set_fuzzy_deadline` | `client.setFuzzyDeadline({ id, dto })` |

### Connectors
| Tool | Maps to |
|------|---------|
| `list_connectors` | `client.listConnectors()` |
| `get_connector_auth_url` | `client.getConnectorAuthUrl({ source })` |
| `disconnect_connector` | `client.disconnectConnector({ source })` |

## Auth Flow

1. MCP client discovers AS via `/.well-known/oauth-authorization-server` on `apps/main`
2. MCP client redirects user to `apps/main /authorize`
3. User logs in; `apps/main` issues signed auth code, redirects to MCP client's `redirect_uri`
4. MCP client calls `apps/main POST /token` to exchange code for CTM JWT pair
5. MCP client sends `Authorization: Bearer <access_token>` on all MCP requests
6. `apps/mcp` validates JWT via `jwt.strategy.ts` (same secret as `apps/main`), extracts token, passes to `CtmApiClient`

## Request Flow (per tool call)

```
MCP client → POST /mcp (Bearer JWT)
  → jwt.strategy validates token
  → mcp.service instantiates CtmApiClient({ baseUrl, accessToken: jwt })
  → tool handler calls api-client method
  → returns MCP tool result
```

## Environment Variables

| Variable | Used by |
|----------|---------|
| `CTM_API_BASE_URL` | apps/mcp — base URL of apps/main |
| `JWT_SECRET` | apps/mcp — shared with apps/main for token validation |
| `PORT` | apps/mcp — HTTP port (default 3002) |

## Transport

MCP Streamable HTTP transport (`@modelcontextprotocol/sdk`):
- `POST /mcp` — client → server messages
- `GET /mcp` — server-sent events stream

## Out of Scope

- User profile management (get/update/delete me)
- Stdio transport (handled by a future CLI app)
- Per-user token storage (stateless; client holds tokens)
