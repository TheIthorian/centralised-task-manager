---
id: cli
title: CLI
sidebar_position: 6
---

# CLI (`ctm`)

The `ctm` CLI lets you manage tasks and connectors from the terminal. It uses the same API as the MCP server.

## Installation

```bash
# From the repo root (development)
pnpm --filter @ctm/cli build
# Then link the binary or run directly:
node apps/cli/dist/main.js --help
```

## Authentication

### Interactive login (stores credentials)

```bash
ctm login
# Prompts for email and password
# Stores tokens in ~/.config/ctm/config.json
```

### API token (non-interactive)

Generate a long-lived token in the web app or via the API (`POST /auth/tokens`), then pass it via flag or environment variable:

```bash
ctm tasks --token <your-token> list
# or
CTM_TOKEN=<your-token> ctm tasks list
```

### Custom server URL

```bash
ctm tasks --base-url https://your-server.example.com list
# or
CTM_BASE_URL=https://your-server.example.com ctm tasks list
```

## Commands

### `ctm login`

Prompts for email and password, stores access and refresh tokens locally.

```bash
ctm login [--base-url <url>]
```

### `ctm logout`

Clears stored credentials from `~/.config/ctm/config.json`.

### `ctm tasks list`

```bash
ctm tasks list [--filter all|today|upcoming|done] [--json]
```

List tasks. Default filter: `all`.

### `ctm tasks create`

```bash
ctm tasks create --title "Buy milk" --source local [--description "..."] [--priority 1-4] [--due 2026-06-01]
```

### `ctm tasks update`

```bash
ctm tasks update <id> [--title "New title"] [--description "..."] [--priority 2] [--due 2026-06-01] [--tags "work,urgent"]
```

### `ctm tasks complete`

```bash
ctm tasks complete <id> [--json]
```

### `ctm tasks delete`

```bash
ctm tasks delete <id>
```

### `ctm tasks set-fuzzy-deadline`

```bash
ctm tasks set-fuzzy-deadline <id> --type this_week|this_month|someday [--remind daily|weekly]
```

### `ctm connectors list`

```bash
ctm connectors list [--json]
```

### `ctm connectors connect`

```bash
ctm connectors connect todoist
# Opens OAuth URL in your default browser
```

### `ctm connectors disconnect`

```bash
ctm connectors disconnect todoist
```

## Flags

`--token` and `--base-url` are available on the `tasks` and `connectors` command groups:

| Flag               | Env var        | Description                 | Example                                |
| ------------------ | -------------- | --------------------------- | -------------------------------------- |
| `--token <t>`      | `CTM_TOKEN`    | Override stored credentials | `ctm tasks --token <t> list`           |
| `--base-url <url>` | `CTM_BASE_URL` | Override API base URL       | `ctm tasks --base-url http://... list` |
