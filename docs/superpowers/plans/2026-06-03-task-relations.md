# Task Relations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `parentId` field on Task with a generic, typed `relations` array supporting parent/child, next/previous, and related pairs, auto-mirrored on both tasks.

**Architecture:** Embedded `relations: { type, targetTaskId }[]` array on the Task document. A service computes the inverse type and writes both sides with two sequential idempotent (`$addToSet` / `$pull`) writes (no Mongo transaction — standalone mongod). Two new REST endpoints add/remove relations. The `parentId` field is removed everywhere (no data migration).

**Tech Stack:** NestJS (Fastify), Mongoose, MongoDB, class-validator, vitest (real DB), `@ctm/api-client` typed REST wrapper.

---

## Reference: Relation Types & Inverse Map

```ts
export type RelationType = 'parent' | 'child' | 'next' | 'previous' | 'related';

export const RELATION_INVERSE: Record<RelationType, RelationType> = {
    parent: 'child',
    child: 'parent',
    next: 'previous',
    previous: 'next',
    related: 'related',
};
```

This map lives in the schema file (Task 1) and is imported by the service (Task 3).

---

## Task 1: Schema — replace `parentId` with `relations`

**Files:**
- Modify: `apps/main/src/tasks/schemas/task.schema.ts`
- Test: `apps/main/src/tasks/schemas/task.schema.spec.ts`

- [ ] **Step 1: Write failing tests**

In `apps/main/src/tasks/schemas/task.schema.spec.ts`, replace the existing
`parentId` test (the `it('has parentId field defaulting to null', ...)` block)
with these tests:

```ts
it('no longer has a parentId field', () => {
    expect(TaskSchema.path('parentId')).toBeUndefined();
});

it('has relations field defaulting to []', () => {
    const path = TaskSchema.path('relations');

    expect(path).toBeDefined();

    const doc = new (require('mongoose').Document)();

    // Default check via a model instance
    const TaskModel = require('mongoose').model('TaskRelTest', TaskSchema);
    const t = new TaskModel({
        userId: new (require('mongoose').Types.ObjectId)(),
        source: 'local',
        sourceId: 's1',
        title: 't',
        syncedAt: new Date(),
    });

    expect(Array.isArray(t.relations)).toBe(true);
    expect(t.relations).toHaveLength(0);
});

it('exposes RELATION_INVERSE mapping each type to its inverse', () => {
    expect(RELATION_INVERSE.parent).toBe('child');
    expect(RELATION_INVERSE.child).toBe('parent');
    expect(RELATION_INVERSE.next).toBe('previous');
    expect(RELATION_INVERSE.previous).toBe('next');
    expect(RELATION_INVERSE.related).toBe('related');
});
```

Add the import at the top of the spec file:

```ts
import { TaskSchema, RELATION_INVERSE } from './task.schema.js';
```

(Keep any existing import of `TaskSchema`; merge into one import line.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ctm/main test -- task.schema.spec`
Expected: FAIL — `relations`/`RELATION_INVERSE` undefined, and `parentId` path still defined.

- [ ] **Step 3: Implement schema change**

In `apps/main/src/tasks/schemas/task.schema.ts`:

Add the relation type + inverse map near the top (after the existing type
exports around line 10):

```ts
/** The kind of relation from one task to another. */
export type RelationType = 'parent' | 'child' | 'next' | 'previous' | 'related';

/** Maps each relation type to the inverse type stored on the target task. */
export const RELATION_INVERSE: Record<RelationType, RelationType> = {
    parent: 'child',
    child: 'parent',
    next: 'previous',
    previous: 'next',
    related: 'related',
};
```

Add a `TaskRelation` embedded sub-schema (place it next to the other
`@Schema({ _id: false })` classes, e.g. after `Reminder`):

```ts
@Schema({ _id: false })
class TaskRelation {
    @Prop({ type: String, required: true, enum: ['parent', 'child', 'next', 'previous', 'related'] })
    type!: RelationType;

    @Prop({ type: Types.ObjectId, ref: 'Task', required: true })
    targetTaskId!: Types.ObjectId;
}

const TaskRelationSchema = SchemaFactory.createForClass(TaskRelation);
```

Remove the `parentId` prop (the three lines around line 112):

```ts
    @Prop({ type: Types.ObjectId, ref: 'Task', default: null })
    parentId!: Types.ObjectId | null;
```

Add the `relations` prop in its place:

```ts
    @Prop({ type: [TaskRelationSchema], default: [] })
    relations!: { type: RelationType; targetTaskId: Types.ObjectId }[];
```

Replace the parent index. Remove nothing existing (there is no `parentId`
index), and add after the existing indexes (after line ~139):

```ts
TaskSchema.index({ userId: 1, 'relations.targetTaskId': 1 });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ctm/main test -- task.schema.spec`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/tasks/schemas/task.schema.ts apps/main/src/tasks/schemas/task.schema.spec.ts
git commit -m "feat(main): add generic task relations schema, drop parentId"
```

---

## Task 2: api-client types — `relations` on TaskDto, new relation DTO

**Files:**
- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/index.ts`

- [ ] **Step 1: Edit types**

In `packages/api-client/src/types.ts`:

Add near the top (after `Duration`, around line 12):

```ts
/** The kind of relation from one task to another. */
export type RelationType = 'parent' | 'child' | 'next' | 'previous' | 'related';

/** A typed link from one task to another. */
export type TaskRelationDto = {
    type: RelationType;
    targetTaskId: string;
};
```

In `TaskDto` (around line 48), remove:

```ts
    parentId?: string | null;
```

and add:

```ts
    relations: TaskRelationDto[];
```

In `CreateTaskDto` (around line 69), remove:

```ts
    parentId?: string;
```

- [ ] **Step 2: Export new types**

In `packages/api-client/src/index.ts`, ensure `RelationType` and
`TaskRelationDto` are exported. If the file uses `export * from './types.js'`,
no change is needed — verify with:

Run: `grep -n "types" packages/api-client/src/index.ts`

If it re-exports named types explicitly, add `RelationType` and
`TaskRelationDto` to that list.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ctm/api-client build`
Expected: PASS (no type errors). It is OK if downstream apps don't build yet —
they are fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types.ts packages/api-client/src/index.ts
git commit -m "feat(api-client): add TaskRelationDto, relations on TaskDto, drop parentId"
```

---

## Task 3: Service — add/remove relation with auto-mirror

**Files:**
- Modify: `apps/main/src/tasks/tasks.service.ts`
- Test: `apps/main/src/tasks/tasks.service.relations.spec.ts` (new)

- [ ] **Step 1: Write failing integration tests**

Create `apps/main/src/tasks/tasks.service.relations.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TasksService } from './tasks.service.js';
import { Task, TaskSchema, type TaskDocument } from './schemas/task.schema.js';

describe('TasksService relations', () => {
    let service: TasksService;
    let model: Model<TaskDocument>;
    const userId = new Types.ObjectId().toHexString();

    const makeTask = async (title: string): Promise<TaskDocument> =>
        model.create({
            userId: new Types.ObjectId(userId),
            source: 'local',
            sourceId: new Types.ObjectId().toHexString(),
            title,
            status: 'open',
            syncedAt: new Date(),
        });

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                MongooseModule.forRoot(process.env['MONGODB_URI']!),
                MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
            ],
            providers: [TasksService],
        }).compile();

        service = moduleRef.get(TasksService);
        model = moduleRef.get<Model<TaskDocument>>(getModelToken(Task.name));
    });

    it('addRelation writes both sides with inverse type', async () => {
        const a = await makeTask('A-' + Date.now());
        const b = await makeTask('B-' + Date.now());

        await service.addRelation({
            userId,
            taskId: String(a._id),
            type: 'parent',
            targetTaskId: String(b._id),
        });

        const fa = await model.findById(a._id);
        const fb = await model.findById(b._id);

        expect(fa!.relations).toHaveLength(1);
        expect(fa!.relations[0]!.type).toBe('parent');
        expect(String(fa!.relations[0]!.targetTaskId)).toBe(String(b._id));

        expect(fb!.relations).toHaveLength(1);
        expect(fb!.relations[0]!.type).toBe('child');
        expect(String(fb!.relations[0]!.targetTaskId)).toBe(String(a._id));
    });

    it('addRelation is idempotent (no duplicate pair)', async () => {
        const a = await makeTask('A2-' + Date.now());
        const b = await makeTask('B2-' + Date.now());

        const args = { userId, taskId: String(a._id), type: 'related' as const, targetTaskId: String(b._id) };

        await service.addRelation(args);
        await service.addRelation(args);

        const fa = await model.findById(a._id);

        expect(fa!.relations).toHaveLength(1);
    });

    it('removeRelation clears both sides', async () => {
        const a = await makeTask('A3-' + Date.now());
        const b = await makeTask('B3-' + Date.now());

        await service.addRelation({ userId, taskId: String(a._id), type: 'next', targetTaskId: String(b._id) });
        await service.removeRelation({ userId, taskId: String(a._id), type: 'next', targetTaskId: String(b._id) });

        const fa = await model.findById(a._id);
        const fb = await model.findById(b._id);

        expect(fa!.relations).toHaveLength(0);
        expect(fb!.relations).toHaveLength(0);
    });

    it('rejects a self-relation', async () => {
        const a = await makeTask('A4-' + Date.now());

        await expect(
            service.addRelation({ userId, taskId: String(a._id), type: 'related', targetTaskId: String(a._id) }),
        ).rejects.toThrow();
    });

    it('rejects relating to another user task', async () => {
        const a = await makeTask('A5-' + Date.now());
        const other = await model.create({
            userId: new Types.ObjectId(),
            source: 'local',
            sourceId: new Types.ObjectId().toHexString(),
            title: 'other',
            status: 'open',
            syncedAt: new Date(),
        });

        await expect(
            service.addRelation({ userId, taskId: String(a._id), type: 'parent', targetTaskId: String(other._id) }),
        ).rejects.toThrow();
    });

    it('removes dangling relations when a task is deleted', async () => {
        const a = await makeTask('A6-' + Date.now());
        const b = await makeTask('B6-' + Date.now());

        await service.addRelation({ userId, taskId: String(a._id), type: 'parent', targetTaskId: String(b._id) });
        await service.remove({ taskId: String(b._id), userId });

        const fa = await model.findById(a._id);

        expect(fa!.relations).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ctm/main test -- tasks.service.relations`
Expected: FAIL — `addRelation`/`removeRelation` not a function.

- [ ] **Step 3: Implement service methods**

In `apps/main/src/tasks/tasks.service.ts`:

Update the schema import to bring in the inverse map and type:

```ts
import { Task, RELATION_INVERSE, type RelationType, type TaskDocument } from './schemas/task.schema.js';
```

Add these two methods to the `TasksService` class (e.g. after `findOne`):

```ts
/** Add a typed relation between two of the user's tasks, auto-mirroring the
 *  inverse relation onto the target. Idempotent: re-adding the same pair is a no-op.
 *  Throws BadRequestException for self-relations and NotFoundException for
 *  missing/unowned tasks. */
async addRelation({
    userId,
    taskId,
    type,
    targetTaskId,
}: {
    userId: string;
    taskId: string;
    type: RelationType;
    targetTaskId: string;
}): Promise<TaskDocument> {
    if (taskId === targetTaskId) throw new BadRequestException('A task cannot relate to itself');

    const userObjectId = new Types.ObjectId(userId);

    const [source, target] = await Promise.all([
        this.taskModel.findOne({ _id: taskId, userId: userObjectId }),
        this.taskModel.findOne({ _id: targetTaskId, userId: userObjectId }),
    ]);

    if (!source || !target) throw new NotFoundException('Task not found');

    const inverse = RELATION_INVERSE[type];

    await this.taskModel.updateOne(
        { _id: taskId },
        { $addToSet: { relations: { type, targetTaskId: new Types.ObjectId(targetTaskId) } } },
    );

    await this.taskModel.updateOne(
        { _id: targetTaskId },
        { $addToSet: { relations: { type: inverse, targetTaskId: new Types.ObjectId(taskId) } } },
    );

    return this.taskModel.findById(taskId) as Promise<TaskDocument>;
}

/** Remove a typed relation between two tasks, clearing both the relation and its
 *  inverse. No-op if the relation does not exist. */
async removeRelation({
    userId,
    taskId,
    type,
    targetTaskId,
}: {
    userId: string;
    taskId: string;
    type: RelationType;
    targetTaskId: string;
}): Promise<TaskDocument> {
    const source = await this.findOne({ taskId, userId });

    const inverse = RELATION_INVERSE[type];

    await this.taskModel.updateOne(
        { _id: taskId },
        { $pull: { relations: { type, targetTaskId: new Types.ObjectId(targetTaskId) } } },
    );

    await this.taskModel.updateOne(
        { _id: targetTaskId },
        { $pull: { relations: { type: inverse, targetTaskId: new Types.ObjectId(taskId) } } },
    );

    void source;

    return this.taskModel.findById(taskId) as Promise<TaskDocument>;
}
```

Update `remove` to clear dangling relations. Replace the body of `remove`
(around line 187) with:

```ts
async remove({ taskId, userId }: { taskId: string; userId: string }): Promise<void> {
    await this.findOne({ taskId, userId });

    // Outbound sync (CTM → external source) is disabled; deletes are local-only.
    await this.taskModel.deleteOne({ _id: taskId });

    // Clear any relations on other tasks pointing at the deleted task.
    await this.taskModel.updateMany(
        { userId: new Types.ObjectId(userId), 'relations.targetTaskId': new Types.ObjectId(taskId) },
        { $pull: { relations: { targetTaskId: new Types.ObjectId(taskId) } } },
    );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ctm/main test -- tasks.service.relations`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/tasks/tasks.service.ts apps/main/src/tasks/tasks.service.relations.spec.ts
git commit -m "feat(main): add/remove task relations with auto-mirror + delete cleanup"
```

---

## Task 4: Service + sync — drop `parentId` from create and upsert

**Files:**
- Modify: `apps/main/src/tasks/tasks.service.ts`
- Modify: `apps/main/src/data-portability/import.service.ts`

- [ ] **Step 1: Remove `parentId` from `create`**

In `apps/main/src/tasks/tasks.service.ts`, in the `create` method:

Delete the parent validation block (around lines 105-109):

```ts
if (dto.parentId) {
    const parent = await this.taskModel.findOne({ _id: dto.parentId, userId: new Types.ObjectId(userId) });

    if (!parent) throw new BadRequestException('Parent task not found');
}
```

Delete the `parentId` line in the `create` document (around line 127):

```ts
            parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
```

- [ ] **Step 2: Convert sync parent linking to relations**

In the `upsertFromRemote` method, the `buildInsert` helper currently computes a
`parentId`. Replace the parent resolution so it writes a `relations` array
instead.

Replace the `buildInsert` function (around lines 268-300) with:

```ts
const buildInsert = (remote: RemoteTask, id: Types.ObjectId): object => {
    const parentSourceId = remote.parentSourceId;
    let parentObjectId: Types.ObjectId | null = null;

    if (parentSourceId) {
        const existingParent = existingBySourceId.get(parentSourceId);

        if (existingParent) {
            parentObjectId = existingParent._id as Types.ObjectId;
        } else {
            parentObjectId = newIdBySourceId.get(parentSourceId) ?? null;
        }
    }

    const relations = parentObjectId
        ? [{ type: 'parent' as RelationType, targetTaskId: parentObjectId }]
        : [];

    return {
        _id: id,
        userId: userObjectId,
        source,
        sourceId: remote.sourceId,
        title: remote.title,
        description: remote.description ?? null,
        status: remote.status,
        priority: (remote.priority ?? null) as 1 | 2 | 3 | 4 | null,
        tags: remote.tags,
        due: remote.due ?? null,
        deadlineDate: remote.deadline ?? null,
        duration: remote.duration ?? null,
        relations,
        createdAt: now,
        updatedAt: now,
        syncedAt: now,
    };
};
```

Note: this writes only the `parent` side on the child during sync (the inverse
`child` relation on the parent is not mirrored here — sync builds the tree
top-down per source). This matches prior behavior where only the child held
`parentId`. Mirroring during sync is out of scope.

- [ ] **Step 3: Fix import.service.ts**

In `apps/main/src/data-portability/import.service.ts` (around line 163), remove
the line:

```ts
        parentId: null,
```

(The `relations` field defaults to `[]` via the schema, so no replacement is
needed.)

- [ ] **Step 4: Run main tests**

Run: `pnpm --filter @ctm/main test`
Expected: PASS. If any existing test referenced `parentId` on create/sync, update
it to assert on `relations` instead (search: `grep -rn parentId apps/main/src`).

- [ ] **Step 5: Commit**

```bash
git add apps/main/src/tasks/tasks.service.ts apps/main/src/data-portability/import.service.ts
git commit -m "refactor(main): drop parentId from create and sync, write parent relation"
```

---

## Task 5: Controller — response mapping + relation endpoints

**Files:**
- Create: `apps/main/src/tasks/dto/task-relation.dto.ts`
- Modify: `apps/main/src/tasks/tasks.controller.ts`
- Test: `apps/main/src/tasks/tasks.controller.spec.ts`

- [ ] **Step 1: Create the request DTO**

Create `apps/main/src/tasks/dto/task-relation.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';
import type { TaskRelationDto as ITaskRelationDto, RelationType } from '@ctm/api-client';

const RELATION_TYPES: RelationType[] = ['parent', 'child', 'next', 'previous', 'related'];

/** Request body for adding or removing a relation between two tasks. */
export class TaskRelationDto implements ITaskRelationDto {
    @ApiProperty({ enum: RELATION_TYPES, example: 'parent' })
    @IsIn(RELATION_TYPES)
    type!: RelationType;

    @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'CTM task ObjectId of the related task' })
    @IsMongoId()
    targetTaskId!: string;
}
```

- [ ] **Step 2: Write failing controller test**

In `apps/main/src/tasks/tasks.controller.spec.ts`, add a test that the
controller maps `relations` into the response and exposes the endpoints. Add
within the existing describe block (adapt to the file's existing setup/mocks —
the service is mocked there):

```ts
it('addRelation delegates to service and returns mapped task', async () => {
    const fakeTask = {
        _id: 'a1',
        source: 'local',
        sourceId: 's',
        title: 't',
        description: null,
        status: 'open',
        priority: null,
        tags: [],
        locations: [],
        due: null,
        deadlineDate: null,
        duration: null,
        relations: [{ type: 'parent', targetTaskId: 'b2' }],
        fuzzyDeadline: null,
        reminders: [],
        dueDateNotifiedAt: null,
        syncedAt: new Date(),
    };

    (service.addRelation as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(fakeTask);

    const res = await controller.addRelation({ user: { sub: 'u1' } } as never, 'a1', {
        type: 'parent',
        targetTaskId: 'b2',
    });

    expect(service.addRelation).toHaveBeenCalledWith({
        userId: 'u1',
        taskId: 'a1',
        type: 'parent',
        targetTaskId: 'b2',
    });
    expect(res.relations).toEqual([{ type: 'parent', targetTaskId: 'b2' }]);
});
```

Ensure the mocked `service` object in this file includes `addRelation` and
`removeRelation` as `vi.fn()` (add them where the other service methods are
mocked).

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ctm/main test -- tasks.controller.spec`
Expected: FAIL — `controller.addRelation` not a function.

- [ ] **Step 4: Update controller**

In `apps/main/src/tasks/tasks.controller.ts`:

Add import:

```ts
import { TaskRelationDto } from './dto/task-relation.dto.js';
```

In `toResponse`, replace the `parentId` line:

```ts
            parentId: t.parentId ? String(t.parentId) : null,
```

with:

```ts
            relations: t.relations.map((r) => ({ type: r.type, targetTaskId: String(r.targetTaskId) })),
```

Add two endpoints (e.g. after `removeReminder`):

```ts
/** Add a typed relation between two tasks (auto-mirrors the inverse). */
@ApiOperation({ summary: 'Add a relation between two tasks' })
@Post(':id/relations')
async addRelation(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: TaskRelationDto,
): Promise<TaskDto> {
    const t = await this.tasks.addRelation({
        userId: req.user.sub,
        taskId: id,
        type: dto.type,
        targetTaskId: dto.targetTaskId,
    });

    return this.toResponse(t);
}

/** Remove a typed relation between two tasks (clears the inverse too). */
@ApiOperation({ summary: 'Remove a relation between two tasks' })
@Delete(':id/relations')
async removeRelation(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: TaskRelationDto,
): Promise<TaskDto> {
    const t = await this.tasks.removeRelation({
        userId: req.user.sub,
        taskId: id,
        type: dto.type,
        targetTaskId: dto.targetTaskId,
    });

    return this.toResponse(t);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ctm/main test -- tasks.controller.spec`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/main/src/tasks/dto/task-relation.dto.ts apps/main/src/tasks/tasks.controller.ts apps/main/src/tasks/tasks.controller.spec.ts
git commit -m "feat(main): add POST/DELETE /tasks/:id/relations endpoints"
```

---

## Task 6: create-task DTO — drop `parentId`

**Files:**
- Modify: `apps/main/src/tasks/dto/create-task.dto.ts`

- [ ] **Step 1: Remove the `parentId` field**

In `apps/main/src/tasks/dto/create-task.dto.ts`, remove the block:

```ts
    @ApiPropertyOptional({ example: 'abc123', description: 'CTM task ObjectId of parent task' })
    @IsOptional()
    @IsMongoId()
    parentId?: string;
```

If `IsMongoId` is now unused in this file, remove it from the `class-validator`
import. Verify with:

Run: `grep -n "IsMongoId" apps/main/src/tasks/dto/create-task.dto.ts`

- [ ] **Step 2: Build to confirm types**

Run: `pnpm --filter @ctm/main build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/main/src/tasks/dto/create-task.dto.ts
git commit -m "refactor(main): drop parentId from create-task DTO"
```

---

## Task 7: api-client — relation methods on the client

**Files:**
- Modify: `packages/api-client/src/client.ts`
- Modify: `packages/api-client/src/client.types.ts`

- [ ] **Step 1: Add param types**

In `packages/api-client/src/client.types.ts`, add (follow the file's existing
param-type style):

```ts
import type { RelationType } from './types.js';

export type AddRelationParams = {
    id: string;
    dto: { type: RelationType; targetTaskId: string };
};

export type RemoveRelationParams = {
    id: string;
    dto: { type: RelationType; targetTaskId: string };
};
```

(If `client.types.ts` already imports from `./types.js`, merge the
`RelationType` import into the existing import line instead of adding a new one.)

- [ ] **Step 2: Add client methods**

In `packages/api-client/src/client.ts`, import the new param types (merge into
the existing `client.types.js` import), then add methods after `removeReminder`:

```ts
/** Add a typed relation between two tasks. */
async addRelation({ id, dto }: AddRelationParams): Promise<TaskDto> {
    return this.request<TaskDto>({ method: 'POST', path: `/tasks/${id}/relations`, body: dto });
}

/** Remove a typed relation between two tasks. */
async removeRelation({ id, dto }: RemoveRelationParams): Promise<TaskDto> {
    return this.request<TaskDto>({ method: 'DELETE', path: `/tasks/${id}/relations`, body: dto });
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @ctm/api-client build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/client.ts packages/api-client/src/client.types.ts
git commit -m "feat(api-client): add addRelation/removeRelation client methods"
```

---

## Task 8: Fix web build + full verification

**Files:**
- Modify: any `apps/web/src` files referencing `task.parentId` (if present)

- [ ] **Step 1: Find web usages**

Run: `grep -rn "parentId" apps/web/src`
Expected: list of references (may be empty).

- [ ] **Step 2: Fix each usage**

For each reference, replace `parentId` logic with `relations`. If a usage finds
the parent, derive it as:

```ts
const parentId = task.relations.find((r) => r.type === 'parent')?.targetTaskId ?? null;
```

If there are no references, skip this step.

- [ ] **Step 3: Full workspace verification**

Run: `pnpm build && pnpm test && pnpm lint`
Expected: all PASS. Confirm no remaining `parentId` references:

Run: `grep -rn "parentId" apps packages --include=*.ts | grep -v node_modules`
Expected: no results.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(web): use task relations instead of parentId"
```

---

## Self-Review Notes

- **Spec coverage:** schema (T1), api-client types (T2), service add/remove+mirror+dedupe+delete-cleanup (T3), sync/create drop parentId (T4), endpoints+response mapping (T5), create DTO (T6), client methods (T7), web + full verify (T8). All spec sections covered.
- **Transactions:** deferred per user decision; two sequential idempotent writes (`$addToSet`/`$pull`) used instead. Documented in spec.
- **Type consistency:** `RelationType` and `RELATION_INVERSE` defined in schema (T1) and reused; `TaskRelationDto` defined in api-client (T2) and implemented by NestJS DTO (T5). `relations` shape `{ type, targetTaskId }` consistent across schema, wire types, service, controller.
