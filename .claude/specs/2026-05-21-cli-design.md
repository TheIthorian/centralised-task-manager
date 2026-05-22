# CLI App Design — `apps/cli`

## Overview

A Node.js CLI (`ctm`) that wraps the same `@ctm/api-client` package used by the MCP server. Full task and connector management from the terminal.

## Architecture

```
apps/cli/
  src/
    main.ts              # Entry point — builds commander program, wires commands
    auth.ts              # Token storage: read/write ~/.config/ctm/config.json
    client.ts            # Factory: build CtmApiClient from flag/env/stored token
    output.ts            # Table printer (cli-table3) + --json passthrough
    commands/
      login.ts           # ctm login
      logout.ts          # ctm logout
      tasks.ts           # ctm tasks *
      connectors.ts      # ctm connectors *
  package.json           # bin: { ctm: "./dist/main.js" }
  tsconfig.json
  tsconfig.build.json
```

## Auth Flow

Priority order for credentials:

1. `--token <t>` flag (per-invocation override)
2. `CTM_TOKEN` environment variable
3. Stored access token from `~/.config/ctm/config.json`

`ctm login` prompts for email + password, calls `client.login()`, stores `{ accessToken, refreshToken }` to config file. On 401, CLI auto-calls `client.refresh()` and retries once, then updates stored tokens.

`ctm logout` deletes the config file.

`--base-url` flag and `CTM_BASE_URL` env var override the default server URL.

## Commands

```
ctm login
ctm logout

ctm tasks list [--filter all|today|upcoming|done] [--json]
ctm tasks create --title <t> [--description <d>] [--priority 1-4] [--due <date>] --source <s>
ctm tasks update <id> [--title <t>] [--description <d>] [--priority 1-4] [--due <date>] [--tags <t,...>]
ctm tasks complete <id>
ctm tasks delete <id>
ctm tasks set-fuzzy-deadline <id> --type this_week|this_month|someday [--remind daily|weekly]

ctm connectors list [--json]
ctm connectors connect <source>     # prints OAuth URL + opens in browser via `open`
ctm connectors disconnect <source>
```

## Output

Default: human-readable tables via `cli-table3`.  
`--json` flag: raw `JSON.stringify` of the API response, suitable for piping.

Errors print to stderr with a short message. On `ApiClientError`, show `statusCode + message`. Exit code 1 on error.

## Dependencies

- `commander` — CLI framework
- `cli-table3` — terminal tables
- `@inquirer/prompts` — interactive login prompts
- `open` — open OAuth URLs in browser
- `@ctm/api-client` — shared REST client (workspace dep)

## Testing

Unit tests co-located (`*.spec.ts`). Test `auth.ts` and `output.ts` in isolation. Integration tests skipped (API calls covered by api-client package tests).

## Docs

- Update `apps/docs` OpenAPI reference is auto-generated; no change needed.
- Add CLI usage section to the Docusaurus docs site under a new `cli.md` page.
- Update root `CLAUDE.md` monorepo overview to include `apps/cli`.
