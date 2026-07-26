# Data Portability — Export & Import

**Date:** 2026-05-29

## Scope

### Exported collections

| Collection    | Fields                                     |
| ------------- | ------------------------------------------ |
| Profile       | `email`, `name`, `notificationPreferences` |
| Tasks         | all fields                                 |
| Notifications | all fields                                 |

### Excluded (ephemeral / secrets)

- Connector configs (tokens, OAuth state)
- API tokens, refresh tokens, auth codes
- OAuth clients (dynamic)
- Jobs

---

## File Format

Each file is a self-contained JSON envelope:

```json
{
  "version": "1",
  "exportedAt": "2026-05-29T12:00:00Z",
  "exportId": "uuid",
  "part": 1,
  "totalParts": 1,
  "profile": { "email": "...", "name": "...", "notificationPreferences": { ... } },
  "tasks": [ ... ],
  "notifications": [ ... ]
}
```

- Max 50 MB per file.
- If payload exceeds 50 MB, tasks and notifications are chunked across numbered part files.
- `profile` always lives in part 1.
- Each part is independently valid (can be imported standalone).

---

## Storage Interface

```ts
interface FileStorage {
  save(exportId: string, filename: string, data: Buffer): Promise<void>;
  read(exportId: string, filename: string): Promise<Buffer>;
  list(exportId: string): Promise<string[]>;
  delete(exportId: string): Promise<void>;
}
```

`LocalFileStorage` writes to a configured directory (env var `EXPORT_DIR`, default `./exports/`).
S3 implementation is a drop-in replacement later.

---

## API

| Method | Path                                    | Description                                                  |
| ------ | --------------------------------------- | ------------------------------------------------------------ |
| `POST` | `/users/me/export`                      | Generate export, save to storage, return metadata            |
| `GET`  | `/users/me/exports/:exportId/:filename` | Serve a file from storage                                    |
| `POST` | `/users/me/import`                      | Upload 1+ part files + `onConflict` body field, apply import |

### POST /users/me/export

Response `200`:

```json
{
  "exportId": "uuid",
  "files": [{ "name": "export-part-1.json", "sizeBytes": 12345 }]
}
```

### GET /users/me/exports/:exportId/:filename

- Streams the file from `FileStorage`.
- Returns `404` if exportId/filename unknown or belongs to a different user.
- `Content-Disposition: attachment; filename="<filename>"`

### POST /users/me/import

Request body (JSON, alongside multipart files):

```json
{ "onConflict": "replace" | "ignore" }
```

- Multipart upload; accepts one or more part files plus the JSON body.
- Validates `version` field; rejects unknown versions.
- Re-maps all `userId` references to the authenticated user (prevents cross-user injection).
- Returns `200` with summary: `{ imported: { tasks: n, notifications: n }, skipped: { tasks: n, notifications: n } }`

---

## Conflict Resolution

Global `onConflict` body field applies to all collections.

| Collection    | Conflict key                 | `replace`                                    | `ignore` |
| ------------- | ---------------------------- | -------------------------------------------- | -------- |
| Profile       | current user (always exists) | overwrite `name` + `notificationPreferences` | skip     |
| Tasks         | `userId + source + sourceId` | update all fields                            | skip     |
| Notifications | `_id`                        | overwrite                                    | skip     |

---

## File Persistence (DB)

A reusable `StoredFile` embedded sub-document schema is defined once (in `apps/main/src/files/`) and embedded directly into any model that needs to track persisted files — no separate collection:

```ts
@Schema({ _id: false })
class StoredFile {
  storagePath: string; // opaque key for FileStorage (e.g. "exports/{exportId}/export-part-1.json")
  filename: string; // display filename
  sizeBytes: number;
  contentType: string; // MIME type
  sha256: string; // hex SHA-256 for integrity verification
}
```

The `Export` schema embeds `StoredFile[]` directly:

```ts
@Schema({ timestamps: true })
class Export {
  userId: Types.ObjectId;
  exportId: string; // uuid, used as storage path prefix
  files: StoredFile[];
}
```

- `ExportService` saves files to `FileStorage`, then writes one `Export` doc with embedded `StoredFile` entries.
- `GET /users/me/exports/:exportId/:filename` looks up the `Export` doc (ownership check), finds the matching `StoredFile`, reads from `FileStorage` via `storagePath`.
- `sha256` lets clients verify integrity after download.

---

## Module Structure

New module: `apps/main/src/data-portability/`

```
files/                           # domain module — file storage abstraction
  files.module.ts                # exports FilesService
  files.service.ts               # wraps FileStorage interface; injectable by any domain service
  schemas/
    stored-file.schema.ts        # StoredFile embedded sub-document schema (no collection)
  storage/
    file-storage.interface.ts    # FileStorage interface
    local-file-storage.ts        # disk implementation; injected via provider token

data-portability/
  data-portability.module.ts     # imports FilesModule
  data-portability.controller.ts
  export.service.ts
  import.service.ts
  schemas/
    export.schema.ts             # Export schema embeds StoredFile[]
  dto/
    export-response.dto.ts
    import-response.dto.ts
    import-request.dto.ts        # { onConflict }
    export-envelope.dto.ts       # shape of each JSON part file
```

`FilesModule` exports `FilesService`. Any domain module imports `FilesModule` to get file save/read/delete. `StoredFile` embedded schema imported directly where needed (no Mongoose model registration required).

---

## Error Handling

- Invalid file format / missing `version` → `400 Bad Request`
- `exportId` not found or not owned by requester → `404 Not Found`
- Storage write failure → `503 Service Unavailable`
- All errors use typed errors from `@ctm/errors`
