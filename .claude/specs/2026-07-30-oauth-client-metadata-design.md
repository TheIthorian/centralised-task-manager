# RFC 7591 client metadata on the Authorized Apps tab

Issue: #28

## Problem

Dynamic client registration accepts only `client_name`, `redirect_uris`, `grant_types`,
`response_types` and `scopes`. Everything else RFC 7591 §2 defines is stripped, so the Authorized
Apps tab shows a bare self-declared name and the user has nothing else to judge an app by before
revoking it.

## Scope

Accept, validate and persist `logo_uri`, `client_uri`, `tos_uri`, `policy_uri`, `contacts` and
`software_id`. Return the non-logo fields on `GET /auth/me/authorized-apps` and render them.

## Validation

`registerClientSchema` stays a plain `z.object` (RFC 7591 §3.1 requires unknown metadata to be
ignored, not rejected).

| Field         | Rule                                                |
| ------------- | --------------------------------------------------- |
| `logo_uri`    | absolute `https:` URI, no fragment, max 2048        |
| `client_uri`  | same                                                |
| `tos_uri`     | same                                                |
| `policy_uri`  | same                                                |
| `contacts`    | max 5 entries, each an email address, max 254 chars |
| `software_id` | max 100 chars, printable only                       |

`https:` only, with no loopback exception. These are display links, not callbacks: a `http://`
link on a settings page is a downgrade the user cannot see, and a loopback link is meaningless to
anyone but the registering machine.

## Rendering, and why there is no logo

`logo_uri` is an attacker-supplied URL arriving through a public unauthenticated endpoint that
would render inside an authenticated page. A plain `<img src>` hands the registrant a request from
every viewer's browser (IP, user agent, per-view timing) and a phishing primitive: a real Google
logo beside a client that called itself "Google Tasks".

The safe version is a server-side fetch with content-type, size and dimension caps, re-encoding,
private-range refusal and caching. That is its own piece of work, so this change takes the fallback
the issue offers: persist `logo_uri`, never return it to the browser, and open a follow-up for the
proxy.

The remaining fields are self-declared and unverified, so the page renders every URI as plain text
rather than as a link. A link would let a client that registered anonymously borrow the
credibility of the settings page to land the user on a page of its choosing. Contacts render as
plain text, not `mailto:`. The block is labelled as provided by the app, so richer metadata does
not read as verification this server has not performed (see #22).

## Out of scope

- Server-side logo fetch, re-encode and cache (follow-up issue).
- The unverified-app marker on the consent screen (#22).
