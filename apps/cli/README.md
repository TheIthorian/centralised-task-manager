# @ctm/cli

`ctm` — task and connector management from the terminal.

## Install

Download `ctm-cli.tar.gz` from the latest release (or from the `ctm-cli` artifact of a
`release-cli` workflow run), then:

```bash
tar -xzf ctm-cli.tar.gz
sudo mv ctm /usr/local/bin/ctm
ctm login
```

The download is a single self-contained file and needs only Node.js 24 on `PATH`.

## Running from source

No build step. Node strips the types and a resolve hook points the compiled-output `.js`
specifiers back at their `.ts` files:

```bash
pnpm -s ctm tasks list
pnpm -s ctm login --base-url http://localhost:3000
```

Keep the `-s`. Without it pnpm echoes the command it runs and appends its own
`ELIFECYCLE`/`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` after any non-zero exit, which buries the CLI's
own output. The released binary has neither. For a bare `ctm` that behaves like the real thing:

```bash
alias ctm="node --experimental-transform-types --disable-warning=ExperimentalWarning \
  --import $PWD/apps/cli/dev-loader.mjs $PWD/apps/cli/src/main.ts"
```

`--experimental-transform-types` is needed because `enum` is not erasable syntax.

Point it at a local API with `--base-url http://localhost:3000` or `CTM_BASE_URL`, and keep
development credentials separate from your real ones by logging in against that URL: tokens are
stored per base URL.

## API base URL

Resolved in this order, first match wins:

1. `--base-url <url>`
2. `CTM_BASE_URL`
3. `baseUrl` in `~/.config/ctm/config.json`, written by `ctm login`
4. The URL baked in when the release was bundled

## Credential storage

`ctm login` puts the access and refresh tokens in the operating system's secret store, keyed by
base URL: Keychain on macOS, the Secret Service (`secret-tool`) on Linux, DPAPI on Windows.
`~/.config/ctm/config.json` holds only the base URL and client id. An earlier version kept the
tokens in that file; they are ignored, so log in again once to move to the secret store.

Set `CTM_TOKEN_STORE=file` to keep them in `~/.config/ctm/credentials.json` instead, for CI and
headless machines with no secret service. That file is not encrypted on macOS or Linux, so it is
opt-in rather than a fallback: without it, an unreachable secret store is an error.

Release builds bake the production URL, so a downloaded `ctm` needs no configuration. The stored
config outranks it: logging into a different server keeps you on that server.

## Local build

```bash
pnpm exec turbo run bundle --filter=@ctm/cli   # -> apps/cli/dist/ctm.cjs
```

Set `CTM_DEFAULT_BASE_URL` to bake a default into a local bundle. Without it the bundle has no
default and requires `--base-url` or `CTM_BASE_URL`.
