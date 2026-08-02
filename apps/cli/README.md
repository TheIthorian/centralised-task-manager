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

## API base URL

Resolved in this order, first match wins:

1. `--base-url <url>`
2. `CTM_BASE_URL`
3. `baseUrl` in `~/.config/ctm/config.json`, written by `ctm login`
4. The URL baked in when the release was bundled

Release builds bake the production URL, so a downloaded `ctm` needs no configuration. The stored
config outranks it: logging into a different server keeps you on that server.

## Local build

```bash
pnpm exec turbo run bundle --filter=@ctm/cli   # -> apps/cli/dist/ctm.cjs
```

Set `CTM_DEFAULT_BASE_URL` to bake a default into a local bundle. Without it the bundle has no
default and requires `--base-url` or `CTM_BASE_URL`.
