---
id: introduction
title: Introduction
sidebar_position: 1
slug: /
---

# Centralised Task Manager

CTM aggregates tasks from Google Tasks, Todoist, and other sources into a single REST API.
You manage tasks through one interface; CTM writes changes back to the original source.

## Key concepts

| Concept            | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| **Connector**      | An authenticated link to an external task source (e.g. Todoist).           |
| **Task**           | A task mirrored from a connector source, enriched with CTM-local fields.   |
| **Fuzzy deadline** | A local-only deadline label ("this week", "someday") that is never synced. |
| **API token**      | A long-lived bearer token for CLI and MCP use.                             |

## Base URL

All API endpoints are relative to your CTM server:

```
http://localhost:3000
```

## Authentication

Most endpoints require a bearer token in the `Authorization` header:

```http
Authorization: Bearer <your-token>
```

See [Authentication](./authentication) for how to obtain tokens.
