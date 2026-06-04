---
id: authentication
title: Authentication
sidebar_position: 3
---

# Authentication

CTM supports two token types: short-lived **JWT access tokens** (for web/SPA use) and long-lived **API tokens** (for CLI and MCP).

## JWT access tokens

JWTs are issued on `POST /auth/register` and `POST /auth/login`. They expire after 120 seconds by default (configurable via `JWT_ACCESS_EXPIRES`, in seconds).

Include them as a bearer token:

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

### Refreshing

When an access token expires, exchange the refresh token for a new pair:

```http
POST /auth/refresh
Content-Type: application/json

{ "refreshToken": "<refresh-token>" }
```

Refresh tokens are valid for 30 days.

## API tokens (CLI / MCP)

API tokens do not expire. They are hashed in the database; the raw value is shown once.

**Issue:**

```http
POST /auth/tokens
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "label": "my-cli" }
```

**Use:** pass the raw token as a bearer token — the same `Authorization: Bearer` header accepted everywhere.

**List:**

```http
GET /auth/tokens
Authorization: Bearer <accessToken>
```

**Revoke:**

```http
DELETE /auth/tokens/:id
Authorization: Bearer <accessToken>
```

## OAuth 2.0 (third-party apps)

CTM exposes a PKCE-based OAuth 2.0 authorization server for third-party integrations.
See the [OAuth 2.0 token endpoint](/api/o-auth-controller-token) in the API reference.
