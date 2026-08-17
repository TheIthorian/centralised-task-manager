# @ctm/mcp

The MCP server. It exposes the CTM API as tools over Streamable HTTP, and holds no state of its
own: every request carries the access token it acts under, and each tool call is forwarded to
`apps/main` through `@ctm/api-client`.

## Protocol revisions

The server answers four revisions, chosen per request from the `MCP-Protocol-Version` header. A
request with no header is treated as `2025-03-26`, the last revision before the header existed; an
unrecognised value is refused with `UnsupportedProtocolVersion` (`-32022`) listing what is
accepted.

`2026-07-28` is handled by `src/mcp/protocol`, not by the MCP SDK, which does not implement it.
That revision removed the `initialize` handshake, protocol-level sessions and the standalone GET
stream, so a request is answered from the metadata in its own `_meta` and headers and nothing
else. The mirrored `Mcp-Method` and `Mcp-Name` headers are checked against the body and a
disagreement is a `HeaderMismatch` (`-32020`), because an intermediary may route on the header
while this server executes on the body.

Earlier revisions still run through `StreamableHTTPServerTransport`. Both paths serve the same
`ToolRegistry`, so a tool is defined once and cannot drift between them.

## Authorization

The server is an OAuth 2.1 resource server. It validates RS256 access tokens issued by
`apps/main`, and publishes RFC 9728 protected resource metadata pointing at it, so a client
discovers where to authorize from a 401 alone. Clients registering with that authorization server
should use a Client ID Metadata Document; see `apps/main/src/oauth/README.md`.
