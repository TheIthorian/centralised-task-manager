# Performance improvements — August 2026

What changed, and what it was worth. Method, raw profiles and the options that were rejected are
in [performance-baseline.md](./performance-baseline.md).

## Results

| Change | Metric | Before | After |
| ------ | ------ | ------ | ----- |
| Route-level code splitting (`apps/web`) | Initial JS, gzipped | 186 KB | 153 KB |
| Lazy `sharp` (`apps/main`) | RSS at ready | 196 MB | 183 MB |
| `_headers` (`apps/web`, `apps/landing`) | Asset revalidation on repeat visit | every load | none for a year |

## Route-level code splitting

`apps/web` built to a single 616 KB chunk. A visitor on `/login` downloaded and parsed the tasks
board, the calendar, the timeline, every settings page and `socket.io-client` before the login
form rendered.

Routes now sit under a pathless root carrying a `HydrateFallback`, which lets each one load
through React Router's `lazy` without a blank first paint. The authenticated shell moved into
`ProtectedShell` so it splits too: leaving it eager kept `socket.io-client` in the login path and
gave back only a third of the win. `LoginPage` stays eager, because it is where anonymous
visitors land and the extra round trip costs more than inlining it.

27 chunks now, 11 of them on the initial load, 153 KB gzipped between them.

## Lazy `sharp`

`oauth/logo-image.ts` imported `sharp` at module scope, loading a ~17 MB libvips binary into
every `apps/main` process. Logos are encoded only when an OAuth client registers or changes one,
so `encodeLogo` now imports it at call time. 13 MB off resident memory; the effect on boot time
is inside run-to-run noise.

This does not shrink the container — sharp is still a dependency and still installed.

## Immutable asset caching

Neither Pages project shipped a `_headers` file, so content-hashed assets got the default policy
and were revalidated on every repeat visit. `/assets/*` and `/_astro/*` are now `immutable` for a
year, with `index.html` held at `must-revalidate`.

Both directories are fingerprinted by the bundler, so a changed file gets a new URL. Anything
added to them that is **not** fingerprinted would be pinned in browser caches for a year.

## Measuring again

```bash
pnpm build
scripts/perf/bundle-size.sh         # web + landing, including initial-load weight
scripts/perf/measure.sh main 3      # module graph profile + boot timings
scripts/perf/measure.sh mcp 3
```

Timings vary by checkout — compare runs within one tree, never across.

## Not done

`apps/landing` still uploads a 192 KB React client runtime that no browser requests, Mongoose
still builds 28 indexes on every boot, and the server apps are still unbundled. Each was measured
and deliberately left; the reasoning is in the baseline document.
