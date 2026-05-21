---
id: tasks
title: Tasks
sidebar_position: 5
---

# Tasks

Tasks are mirrored from connected sources. CTM adds local-only fields (fuzzy deadlines) on top of the source data.

## Listing tasks

```http
GET /tasks
Authorization: Bearer <token>
```

### Filters

| Parameter  | Values                               | Description                    |
| ---------- | ------------------------------------ | ------------------------------ |
| `status`   | `open`, `done`, `archived`           | Filter by status               |
| `source`   | `todoist`, `google_tasks`            | Filter by source               |
| `fuzzy`    | `this_week`, `this_month`, `someday` | Filter by fuzzy deadline label |
| `surfaced` | `true` / `false`                     | Filter by surfaced flag        |
| `page`     | integer (default `1`)                | Page number                    |
| `limit`    | integer (default `50`)               | Items per page                 |

Example:

```http
GET /tasks?status=open&fuzzy=this_week
```

## Creating a task

Creates the task in CTM and writes it through to the specified connector source.

```http
POST /tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Write quarterly report",
  "description": "Include Q1 metrics",
  "source": "todoist",
  "priority": 2
}
```

## Fuzzy deadlines

Fuzzy deadlines are stored locally in CTM and **never synced to the source**.

**Set:**

```http
PATCH /tasks/:id/fuzzy-deadline
Authorization: Bearer <token>
Content-Type: application/json

{ "type": "this_week", "remindEvery": "daily" }
```

**Remove:**

```http
DELETE /tasks/:id/fuzzy-deadline
Authorization: Bearer <token>
```

## Completing a task

Marks the task complete in CTM and writes through to the source.

```http
POST /tasks/:id/complete
Authorization: Bearer <token>
```
