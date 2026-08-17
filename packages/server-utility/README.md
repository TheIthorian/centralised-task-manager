# @ctm/server-utility

Node-only helpers shared by the backend services. Nothing here touches a framework, a database or
the DOM, so it is safe for `apps/main`, `apps/sync`, `apps/admin` and the CLI alike, and unsafe for
the browser.

- `AssetFetcher` — fetches a URI supplied by someone else. Every host is resolved and refused
  unless all of its addresses are on the public internet, redirects are followed one hop at a time
  and re-checked, and the response is bounded in media type and size. The `HttpClient` and the
  resolver are injected, so a caller can supply its own logging or headers and a test can supply
  neither.
- `isPublicUnicastAddress` — classifies an IP address, rejecting loopback, private, CGNAT,
  link-local, multicast and reserved ranges, plus the v4 addresses that v6 forms embed.
