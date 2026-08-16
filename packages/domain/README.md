# @ctm/domain

Business logic, with no framework attached. One folder per domain; `src/tasks` is the first.

## Layout

A domain owns its rules, its service, and nothing else. Persistence schemas stay in `@ctm/db`,
because the operator API queries across domains and should not depend on each one in turn. Wire
types stay in `@ctm/api-client`, which has to stay browser-safe.

Domains share a package rather than getting one each: they reference each other freely (reminders
belong to tasks, tasks carry reminders), and as separate packages those references would be
dependency cycles to design around rather than ordinary imports.

## src/tasks

- **`Task`** (`src/tasks/task.ts`) — an immutable value carrying the rules: status transitions,
  deadlines, relations, reminder bounds. Every method returns a new `Task`, so a caller cannot
  half-apply a change.
- **`relate` / `unrelate`** — link two tasks and write the inverse type on the other side. The
  pairing lives here rather than at the call site so the two halves cannot disagree.
- **`Deadline`** (`src/tasks/deadline.ts`) — the union a task's due date really is, plus the
  conversions to and from the pair of nullable columns it is stored as.
- **`TasksService`** — reads and writes, over a Mongoose model handed in by the caller.

## Using it

`TasksService` is a plain class. Construct it with a model; whoever builds it decides which
database it talks to.

```ts
const tasks = new TasksService({ taskModel });
```

Under Nest that is a factory provider rather than `@Injectable`, so the service stays callable from
a worker, a CLI or an agent that never boots Nest:

```ts
{
    provide: TasksService,
    inject: [getModelToken(Task.name)],
    useFactory: (taskModel: Model<TaskDocument>) => new TasksService({ taskModel }),
}
```

## The domain / IO split

The rule modules are pure: no Mongoose import, no IO, unit-testable with no database. `TasksService`
loads a document, calls the domain, and writes back through `doc.set(task.toState())` — Mongoose
diffs the result and issues a `$set` for the changed paths only.

`TaskState` is deliberately not the whole document. It carries only the fields the domain has rules
about, which is what keeps `toState()` narrow enough to hand straight to `doc.set()` without
mapping every field by hand.

Fields with no rules attached (title, tags, description) never enter the domain; the service writes
them directly.

## Deadlines

A task has an exact date, a fuzzy bucket, or neither. Holding both at once was representable before
and had to be defended against by hand in every new code path; the `Deadline` union makes it a
compile error instead.

Documents written earlier can still carry both. `fromRepresentation` reads those as the exact date,
and the next write normalises them.

## Transactions

Writes that touch two documents — both halves of a relation, a delete and the relations pointing at
it — run inside one transaction via `runInTransaction` from `@ctm/db`.

Transactions need a replica set or a sharded cluster. Against a standalone mongod the work still
runs and still shares one session, but without atomicity; pass `onTransactionsUnavailable` to the
constructor to hear about it. `docker-compose.yml` runs a single-member replica set so local
development matches production.

One trap: a `ClientSession` carries a single transaction number, so operations sharing it must run
sequentially. `Promise.all` over two session-bound queries makes the server reject the second.
