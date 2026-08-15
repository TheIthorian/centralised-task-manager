# @ctm/db

Mongoose schemas for the CTM database, plus the vocabulary those schemas store.

Every app that talks to MongoDB reads its collection shapes from here, so a document written by one
app is a document another app can read. `apps/main` owns the connection and registers the models;
this package only describes them.

## Layout

```
src/
  schemas/          # one file per collection
  code-challenge.ts # PKCE methods stored on an auth code
  notification-types.ts
  index.ts          # barrel — import from '@ctm/db', never a deep path
```

## Conventions

- A schema file exports the class, its `HydratedDocument` type, and the compiled `*Schema`.
- Indexes are declared on the compiled schema, next to the class they belong to.
- Nothing here imports from an app, and nothing here reaches for `@nestjs/common`, zod or
  `node:crypto`. Validation and protocol logic belong to the app that owns the endpoint; this
  package is the storage contract alone.
- `mongoose` and `@nestjs/mongoose` are peer dependencies so the consuming app keeps a single
  mongoose instance.

## Tests

```bash
pnpm --filter @ctm/db test
```

Specs run against a real MongoDB at `MONGODB_URI` (see `.env.test`) and leave their data behind, so
give fixtures unique identifiers.
