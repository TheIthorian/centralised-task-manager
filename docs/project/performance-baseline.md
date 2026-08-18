# Performance baseline — landing, main, mcp, web

Measured 2026-08-18 on macOS (Darwin 25.5.0), Node v24.5.0, Apple Silicon, from the committed
`dist/` output on branch `fix/single-fastify-version`. Local MongoDB via `docker compose`.

Re-measure with the same harness before and after any change:

```bash
pnpm build
scripts/perf/measure.sh main 3      # module graph profile + boot timings
scripts/perf/measure.sh mcp 3
scripts/perf/bundle-size.sh         # web + landing browser assets
```

`measure.sh` sources the app's `.env.test`, requires `dist/bootstrap.js`, and calls
`createApp()` + `app.init()`. It stops short of `listen()`, so the numbers are module import
plus dependency-injection cost, not network setup.

## Server boot — apps/main

Median of 3 runs, warm filesystem cache. Bare `node -e ""` on this machine is 25 ms.

| Metric                         | Value  |
| ------------------------------ | ------ |
| Module import                  | 414 ms |
| Nest DI (`createApp` + `init`) | 118 ms |
| Total to ready                 | 531 ms |
| Process uptime at ready        | 541 ms |
| RSS at ready                   | 195 MB |
| `Module._load` calls           | 6026   |
| Modules in `require.cache`     | 1999   |

Import is 78% of boot. Self time by package (excludes children):

| Package             | Self  |
| ------------------- | ----- |
| `<app + workspace>` | 83 ms |
| `@nestjs/common`    | 34 ms |
| `mongoose`          | 33 ms |
| `rxjs`              | 29 ms |
| `mongodb`           | 24 ms |
| `@nestjs/core`      | 23 ms |
| `zod`               | 19 ms |
| `joi`               | 17 ms |
| `@nestjs/swagger`   | 14 ms |
| `lodash`            | 11 ms |
| `axios`             | 10 ms |
| `ajv`               | 8 ms  |
| `sharp` + native    | 11 ms |

Hottest individual files: `packages/request-logger/dist/index.js` (15 ms),
`@nestjs/common/services/console-logger.service.js` (12 ms), `axios/dist/node/axios.cjs` (10 ms),
`lodash/lodash.js` (6 ms), `@img/sharp-darwin-arm64/…/*.node` (5 ms).

## Server boot — apps/mcp

| Metric                         | Value  |
| ------------------------------ | ------ |
| Module import                  | 272 ms |
| Nest DI (`createApp` + `init`) | 35 ms  |
| Total to ready                 | 307 ms |
| RSS at ready                   | 146 MB |
| `Module._load` calls           | 3223   |
| Modules in `require.cache`     | 1196   |

Import is 88% of boot. Self time by package:

| Package                     | Self  |
| --------------------------- | ----- |
| `<app + workspace>`         | 54 ms |
| `@nestjs/common`            | 33 ms |
| `rxjs`                      | 26 ms |
| `@nestjs/core`              | 22 ms |
| `zod`                       | 22 ms |
| `joi`                       | 17 ms |
| `@modelcontextprotocol/sdk` | 13 ms |
| `ajv`                       | 8 ms  |

Hottest files: `packages/api-client/dist/index.js` (34 ms — barrel resolution, not execution),
`packages/request-logger/dist/index.js` (15 ms), `@nestjs/common/services/console-logger.service.js`
(14 ms), `@modelcontextprotocol/sdk/dist/cjs/types.js` (14 ms).

## Browser assets — apps/web

| Asset                | Raw    | Gzip   |
| -------------------- | ------ | ------ |
| `assets/index-*.js`  | 616 KB | 186 KB |
| `assets/index-*.css` | 46 KB  | 8.8 KB |
| `index.html`         | 514 B  | 334 B  |

One JavaScript chunk. `src/App.tsx` imports all 13 page components eagerly, so a visitor on
`/login` downloads and parses the tasks board, calendar, timeline, settings, and
`socket.io-client` before the login form renders.

## Browser assets — apps/landing

| Asset                | Raw     | Gzip   |
| -------------------- | ------- | ------ |
| `_astro/client.*.js` | 192 KB  | 60 KB  |
| `_astro/index.*.css` | 33 KB   | 7.0 KB |
| `index.html`         | 12.5 KB | 3.3 KB |

`index.html` references no script from `_astro/`, so the page ships zero JavaScript. The 192 KB
React client runtime is emitted by the `@astrojs/react` integration and then uploaded unused: no
component in `src/pages/index.astro` carries a `client:*` directive.

## Changes made against this baseline

### Route-level code splitting in apps/web

Every route below a pathless root is now loaded through React Router's `lazy`, including the
authenticated shell. `RouteFallback` gives the router somewhere to render while a chunk is in
flight. `LoginPage` stays eager: it is where an anonymous visitor lands, and inlining it costs
less than the extra round trip splitting it would add.

Measured on the initial load — the entry script plus every chunk `index.html` preloads:

|            | Before    | After                            |
| ---------- | --------- | -------------------------------- |
| Initial JS | 186 KB gz | 153 KB gz                        |
| Chunks     | 1         | 27 total, 11 on the initial load |
| CSS        | 8.8 KB gz | 8.8 KB gz                        |

An 18% cut. `socket.io-client` (12.8 KB gz), the calendar, the timeline and every settings page
now load on demand rather than before the login form.

What did not move: the entry chunk is still 76 KB gz of React, React DOM and the router, the
i18n catalogue is still awaited before the first render in `main.tsx`, and `AuthContext` pulls
33 KB gz of `@ctm/api-client` into the login path. Those are the next places to look.

### `_headers` for both Pages projects

`apps/web/public/_headers` and `apps/landing/public/_headers` mark the content-hashed asset
directories `immutable` for a year and hold `index.html` at `must-revalidate`. Repeat visits stop
revalidating assets whose URL cannot change.

### Lazy-load `sharp` in apps/main

`encodeLogo` now imports `sharp` at call time. Same tree, same machine, median of 3:

|                | Before | After  |
| -------------- | ------ | ------ |
| Module import  | 470 ms | 452 ms |
| Total to ready | 585 ms | 573 ms |
| RSS at ready   | 196 MB | 183 MB |

The 13 MB of resident memory is the real result; the boot timings are inside run-to-run noise.
Note these numbers are from the `perf/web-bundle-and-boot` worktree, which measures slower than
the figures at the top of this document — compare within a tree, never across.

## Rejected

### Dropping `@astrojs/react` from apps/landing

Not viable. The six landing sections are `.tsx` files that render `Badge` and `LinkButton` from
`@ctm/ui`, so the React renderer is what puts the design system on the page even though nothing
hydrates. `@astrojs/react` emits its 192 KB client runtime unconditionally — version 6.0.1 has no
option to suppress it, and a fresh build reproduces the orphaned file. Removing the integration
means reimplementing those components as `.astro`, duplicating markup the design system already
owns, to delete a file no browser requests. Left alone.

### `autoIndex: false` for Mongoose

Mongoose issues a `createIndex` for all 28 declared indexes on every boot of `apps/main` and
`apps/sync`. Turning it off requires somewhere else for indexes to come from, and there is no
migration tooling in this repo yet. Revisit when there is.

### Bundling the server apps

6026 module loads for `apps/main` and 3223 for `apps/mcp` are mostly filesystem resolution
through pnpm's symlinked store. Bundling `dist/` would remove most of that, but boot happens once
per deploy on a long-lived container and nothing about it is on a request path. Not worth the
risk to Nest's emitted metadata unless these services ever scale to zero.

### Replacing Joi with Zod in the env schemas

`joi` costs 17 ms, once, at import. Env is parsed a single time at boot and never again. Removing
a working validator to reclaim that is not a performance change.

### Stripping `@nestjs/swagger`

`@nestjs/swagger` (14 ms) drags in `lodash` (11 ms) for decorators the runtime never reads — the
OpenAPI document is generated by a build script. Stripping it needs the decorators replaced
across 14 controllers and DTOs, so the 25 ms is not worth it until something else needs that
refactor.
