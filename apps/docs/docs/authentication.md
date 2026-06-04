---
id: authentication
title: Authentication
sidebar_position: 3
---

# Authentication

CTM authenticates with short-lived **JWT access tokens** plus refresh tokens. CLI and MCP clients obtain these via the OAuth 2.0 flow.

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

## OAuth 2.0 (third-party apps)

CTM exposes a PKCE-based OAuth 2.0 authorization server for third-party integrations.
See the [OAuth 2.0 token endpoint](/api/o-auth-controller-token) in the API reference.
