# Task Relations — Design

**Date:** 2026-06-03
**Status:** Approved

## Goal

Generic, typed relations between tasks. Ship parent/child, next/previous, related
relation pairs now, with a model generic enough to add more later (e.g. blocking).
Replace the existing single `parentId` field.

## Relation Types

| Type      | Inverse   |
| --------- | --------- |
| `parent`  | `child`   |
| `next`    | `previous`|
| `related` | `related` (symmetric) |

`RelationType = 'parent' | 'child' | 'next' | 'previous' | 'related'`

(No `blocks`/`blocked-by` in this iteration. Inverse map is the single extension
point for future types.)

## Data Model

Embedded array on the `Task` document (matches existing embedded sub-doc style):

```ts
relations: { type: RelationType; targetTaskId: ObjectId }[]
```

- The `parentId` field is **removed entirely**. No data migration of existing docs.
- New index: `{ userId: 1, 'relations.targetTaskId': 1 }`.

## Write Semantics — Auto-Mirror

Both sides of a relation are stored (MongoDB is eventually consistent; storing both
sides lets either task be read directly without a reverse scan).

- **Add** `addRelation({ userId, taskId, type, targetTaskId })`:
  - Validate both tasks exist and are owned by `userId`.
  - Write `{ type, targetTaskId }` on the source task and the inverse
    `{ type: inverse(type), targetTaskId: taskId }` on the target task.
  - Wrap both writes in a Mongo session/transaction so both land or neither.
  - Dedupe: a `(type, targetTaskId)` pair already present is a no-op (no duplicates).
- **Remove** `removeRelation({ userId, taskId, type, targetTaskId })`:
  - Pull the relation from the source and the inverse from the target. Transactional.
- **On task delete**: pull any relations across the user's tasks whose
  `targetTaskId` equals the deleted task id (cleanup of dangling references).

## Sync Code

The sync path currently derives a parent link from the source's parent id and writes
`parentId`. It now writes a `parent`/`child` relation pair instead. No `parentId`.

## API + Types

In `packages/api-client/src/types.ts` (and exported from `index.ts`):

- `TaskDto.relations: { type: RelationType; targetTaskId: string }[]` — replaces
  `TaskDto.parentId`.
- Remove `parentId` from the create-task request type.
- New request type: `TaskRelationDto = { type: RelationType; targetTaskId: string }`.

Endpoints (NestJS controller in `apps/main`):

- `POST /tasks/:id/relations` body `TaskRelationDto` → `TaskDto`
- `DELETE /tasks/:id/relations` body `TaskRelationDto` → `TaskDto`

NestJS DTO classes live in `apps/main/src/tasks/dto/` and `implements` the
api-client types.

## Error Handling

Use typed errors from `@ctm/errors`:

- target/source task not found or not owned by user → not-found error
- invalid `type` value → validation error (class-validator enum)
- self-relation (`taskId === targetTaskId`) → validation error

## Testing

Real-DB integration specs (co-located `*.spec.ts`, real MongoDB per project
conventions):

- add relation writes both sides with correct inverse
- remove relation clears both sides
- adding a duplicate `(type, target)` is a no-op
- deleting a task removes dangling relations on other tasks
- ownership enforced (cannot relate to another user's task)
- self-relation rejected
- schema: `relations` defaults to `[]`; `parentId` path no longer exists

## Out of Scope

- `blocks`/`blocked-by` and other future types (model supports adding them).
- Data migration of existing `parentId` values.
- Web UI for managing relations (CLI/MCP/web surfacing is follow-up work).
