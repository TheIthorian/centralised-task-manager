# Unverified clients on the OAuth consent screen

## Problem

`POST /.well-known/oauth-client` is public and unauthenticated, so any caller can register a client
whose `client_name` is "Google Tasks (Official)". The consent screen renders that self-declared name
with nothing around it, so the user has no way to tell a dynamically registered stranger from a
client the operator configured, and no view of where the authorization code is about to be sent.

## Behaviour

`GET /oauth/client-info?client_id=…` returns the public metadata the consent screen needs:

| Field           | Meaning                                                                |
| --------------- | ---------------------------------------------------------------------- |
| `clientId`      | echo of the query value                                                |
| `clientName`    | the client's self-declared name, empty string when it registered none  |
| `isDynamic`     | true when the client came from dynamic registration                    |
| `redirectHosts` | distinct `host` of each registered redirect URI, in registration order |

Only hosts are returned. A full redirect URI carries a path and a query the user cannot judge, and
the host is the part that answers "where am I being sent".

The endpoint requires a JWT: the consent screen only renders for a signed-in user, and an
unauthenticated endpoint would turn client ids into a public existence oracle. An unknown
`client_id` is a 404.

## Consent screen

- The requesting client is named from `clientName`, falling back to the client id, falling back to
  generic copy when the request carries no `client_id` at all.
- A dynamic client renders an `UnverifiedAppNotice`: a warning-tone panel with a warning glyph, the
  heading "Unverified app", body copy explaining that anyone can register an app under any name, and
  the registered redirect hosts.
- The marker is text plus an icon, never colour alone, and the notice sits above the permissions box
  so it is read before any scope is toggled.
- A client that is not dynamic renders no notice at all. Absence is the quiet state; only the
  unverified case is worth interrupting for.
- Client metadata loads asynchronously. The screen stays usable while it is in flight and simply
  renders no notice if the lookup fails, since a failed lookup is not evidence of verification, but
  blocking consent on a metadata call would break the flow for a network blip.

## Non-goals

- No verification workflow, allow-list, or operator review queue. `isDynamic` is the only signal
  that exists today.
- No change to what the consent POST accepts or issues.
