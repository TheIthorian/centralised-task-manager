# Plan 1: Monorepo Scaffold + Shared Packages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Turborepo monorepo with all shared packages (`tsconfig`, `config`, `logger`, `errors`, `http`, `connectors`) built and tested — ready for `apps/main`, `apps/sync`, etc. to be added in Plan 2.

**Architecture:** pnpm workspaces + Turborepo 2. All packages are CommonJS + TypeScript, compiled to `dist/`. The `packages/connectors` package defines the `TaskConnector` interface and ships `TodoistConnector` and `GoogleTasksConnector` as the V1 implementations, tested with mocked `fetch`.

**Tech Stack:** Node.js 24, pnpm 9, Turborepo 2, TypeScript 5, Vitest 3, Pino 9, ESLint + typescript-eslint, Prettier

---

## File Map

```
# New files
package.json                                  root workspace manifest
pnpm-workspace.yaml                           workspace package globs
turbo.json                                    pipeline config
.npmrc                                        pnpm settings
.gitignore                                    standard Node ignores
docker-compose.yml                            dev services
.env.example                                  env var reference

packages/tsconfig/
  package.json
  base.json                                   base TS config (CJS, strict)
  nestjs.json                                 extends base + decorators
  react.json                                  extends base + bundler resolution

packages/config/
  package.json
  eslint.node.js                              migrated from configs/node.js
  eslint.react.js                             migrated from configs/react.js
  prettier.mjs                                migrated from configs/prettier.mjs

packages/logger/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/index.ts
  src/logger.spec.ts

packages/errors/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/index.ts
  src/errors.spec.ts

packages/http/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/index.ts
  src/http-client.spec.ts

packages/connectors/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/types.ts                                TaskConnector interface + DTOs
  src/registry.ts                             ConnectorRegistry
  src/index.ts                                barrel exports
  src/todoist/todoist.connector.ts
  src/todoist/todoist.connector.spec.ts
  src/google-tasks/google-tasks.connector.ts
  src/google-tasks/google-tasks.connector.spec.ts

# Modified
configs/   -> deleted after migration (contents moved to packages/config)
CLAUDE.md  -> update lint/format tooling note
```

---

## Task 1: Root scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ctm",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test",
    "lint": "turbo lint",
    "format": "turbo format"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.3"
  },
  "engines": {
    "node": ">=24.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "format": {},
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Create `.npmrc`**

```
shamefully-hoist=false
strict-peer-dependencies=false
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.turbo/
*.env
*.env.local
.DS_Store
*.log
```

- [ ] **Step 6: Create `docker-compose.yml`**

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - '27017:27017'
    volumes:
      - mongodb_data:/data/db

  main:
    build:
      context: .
      dockerfile: apps/main/Dockerfile
    ports:
      - '3000:3000'
    env_file: apps/main/.env
    depends_on:
      - mongodb

  sync:
    build:
      context: .
      dockerfile: apps/sync/Dockerfile
    env_file: apps/sync/.env
    depends_on:
      - mongodb

volumes:
  mongodb_data:
```

- [ ] **Step 7: Create `.env.example`**

```
# MongoDB
MONGODB_URI=mongodb://localhost:27017/ctm

# JWT
JWT_SECRET=change_me_in_production_32_chars_min

# Token encryption (AES-256 — must be exactly 32 chars)
ENCRYPTION_KEY=change_me_in_production_32chars!

# Todoist OAuth
TODOIST_CLIENT_ID=
TODOIST_CLIENT_SECRET=
TODOIST_REDIRECT_URI=http://localhost:3000/connectors/oauth/callback/todoist

# Google Tasks OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/connectors/oauth/callback/google_tasks
```

- [ ] **Step 8: Install turbo**

```bash
pnpm install
```

Expected: `node_modules/` created at root, no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .npmrc .gitignore docker-compose.yml .env.example
git commit -m "chore: root monorepo scaffold"
```

---

## Task 2: packages/tsconfig

**Files:**
- Create: `packages/tsconfig/package.json`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/nestjs.json`
- Create: `packages/tsconfig/react.json`

- [ ] **Step 1: Create `packages/tsconfig/package.json`**

```json
{
  "name": "@ctm/tsconfig",
  "version": "0.0.1",
  "private": true,
  "exports": {
    "./base.json": "./base.json",
    "./nestjs.json": "./nestjs.json",
    "./react.json": "./react.json"
  }
}
```

- [ ] **Step 2: Create `packages/tsconfig/base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

- [ ] **Step 3: Create `packages/tsconfig/nestjs.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 4: Create `packages/tsconfig/react.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/tsconfig
git commit -m "chore: add packages/tsconfig shared TS configs"
```

---

## Task 3: packages/config

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/eslint.node.js`
- Create: `packages/config/eslint.react.js`
- Create: `packages/config/prettier.mjs`
- Delete: `configs/` directory (contents migrated here)

- [ ] **Step 1: Create `packages/config/package.json`**

```json
{
  "name": "@ctm/config",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./eslint.node": "./eslint.node.js",
    "./eslint.react": "./eslint.react.js",
    "./prettier": "./prettier.mjs"
  },
  "dependencies": {
    "@eslint/js": "^9.27.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.1.0",
    "typescript-eslint": "^8.32.1"
  }
}
```

- [ ] **Step 2: Create `packages/config/eslint.node.js`** (migrated from `configs/node.js`)

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export function createNodeConfig(options = {}) {
    const {
        ignores = ['dist', 'pnpm-lock.yaml'],
        files = ['**/*.{ts,tsx}'],
        extraRules = {},
        tsconfigRootDir,
    } = options;

    return tseslint.config(
        { ignores },
        {
            extends: [js.configs.recommended, ...tseslint.configs.recommended],
            files,
            languageOptions: {
                ecmaVersion: 2022,
                globals: globals.node,
                parserOptions: { tsconfigRootDir },
            },
            rules: {
                '@typescript-eslint/no-unused-vars': 'off',
                '@typescript-eslint/explicit-function-return-type': 'error',
                ...extraRules,
            },
        },
    );
}
```

- [ ] **Step 3: Create `packages/config/eslint.react.js`** (migrated from `configs/react.js`)

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export function createReactConfig(options = {}) {
    const {
        ignores = ['dist', 'pnpm-lock.yaml'],
        files = ['**/*.{ts,tsx}'],
        extraRules = {},
        tsconfigRootDir,
    } = options;

    return tseslint.config(
        { ignores },
        {
            extends: [js.configs.recommended, ...tseslint.configs.recommended],
            files,
            languageOptions: {
                ecmaVersion: 2022,
                globals: globals.browser,
                parserOptions: { tsconfigRootDir },
            },
            plugins: {
                'react-hooks': reactHooks,
                'react-refresh': reactRefresh,
            },
            rules: {
                ...reactHooks.configs.recommended.rules,
                'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
                '@typescript-eslint/no-unused-vars': 'off',
                ...extraRules,
            },
        },
    );
}
```

- [ ] **Step 4: Create `packages/config/prettier.mjs`** (migrated from `configs/prettier.mjs`)

```js
/** @type {import('prettier').Config} */
const config = {
    arrowParens: 'avoid',
    htmlWhitespaceSensitivity: 'strict',
    jsxSingleQuote: true,
    singleQuote: true,
    tabWidth: 4,
    printWidth: 120,
    trailingComma: 'all',
};

export default config;
```

- [ ] **Step 5: Delete the old `configs/` directory**

```bash
rm -rf configs
```

- [ ] **Step 6: Install config package deps**

```bash
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add packages/config
git rm -r configs
git commit -m "chore: migrate configs/ into packages/config"
```

---

## Task 4: packages/logger

**Files:**
- Create: `packages/logger/package.json`
- Create: `packages/logger/tsconfig.json`
- Create: `packages/logger/tsconfig.build.json`
- Create: `packages/logger/vitest.config.ts`
- Create: `packages/logger/src/index.ts`
- Create: `packages/logger/src/logger.spec.ts`

- [ ] **Step 1: Create `packages/logger/package.json`**

```json
{
  "name": "@ctm/logger",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "lint": "eslint src",
    "dev": "tsc -p tsconfig.build.json --watch"
  },
  "dependencies": {
    "pino": "^9.7.0"
  },
  "devDependencies": {
    "@ctm/tsconfig": "workspace:*",
    "@types/pino": "*",
    "typescript": "^5.8.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `packages/logger/tsconfig.json`**

```json
{
  "extends": "@ctm/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/logger/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `packages/logger/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
    },
});
```

- [ ] **Step 5: Write the failing test first**

Create `packages/logger/src/logger.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createLogger } from './index.js';

describe('createLogger', () => {
    it('returns a logger with the given context name', () => {
        const logger = createLogger('test-context');
        expect(logger.bindings()).toMatchObject({ name: 'test-context' });
    });

    it('returns a child logger when child() is called', () => {
        const logger = createLogger('parent');
        const child = logger.child({ requestId: 'abc' });
        expect(child.bindings()).toMatchObject({ name: 'parent', requestId: 'abc' });
    });
});
```

- [ ] **Step 6: Run test — expect FAIL**

```bash
pnpm --filter @ctm/logger test
```

Expected: error like `Cannot find module './index.js'`

- [ ] **Step 7: Implement `packages/logger/src/index.ts`**

```ts
import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(context: string): pino.Logger {
    return pino({ name: context });
}
```

- [ ] **Step 8: Run test — expect PASS**

```bash
pnpm --filter @ctm/logger test
```

Expected: `2 passed`

- [ ] **Step 9: Build**

```bash
pnpm --filter @ctm/logger build
```

Expected: `dist/index.js` and `dist/index.d.ts` created.

- [ ] **Step 10: Commit**

```bash
git add packages/logger
git commit -m "feat: add packages/logger pino wrapper"
```

---

## Task 5: packages/errors

**Files:**
- Create: `packages/errors/package.json`
- Create: `packages/errors/tsconfig.json`
- Create: `packages/errors/tsconfig.build.json`
- Create: `packages/errors/vitest.config.ts`
- Create: `packages/errors/src/index.ts`
- Create: `packages/errors/src/errors.spec.ts`

- [ ] **Step 1: Create `packages/errors/package.json`**

```json
{
  "name": "@ctm/errors",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "dev": "tsc -p tsconfig.build.json --watch"
  },
  "devDependencies": {
    "@ctm/tsconfig": "workspace:*",
    "typescript": "^5.8.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `packages/errors/tsconfig.json`**

```json
{
  "extends": "@ctm/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/errors/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `packages/errors/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
    },
});
```

- [ ] **Step 5: Write the failing tests**

Create `packages/errors/src/errors.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    AppError,
    NotFoundError,
    UnauthorizedError,
    ConflictError,
    ExternalServiceError,
} from './index.js';

describe('AppError', () => {
    it('sets name, message, code, statusCode', () => {
        const err = new AppError('bad thing', 'ERR_GENERIC', 500);
        expect(err.message).toBe('bad thing');
        expect(err.code).toBe('ERR_GENERIC');
        expect(err.statusCode).toBe(500);
        expect(err.name).toBe('AppError');
        expect(err).toBeInstanceOf(Error);
    });
});

describe('NotFoundError', () => {
    it('formats message and uses 404', () => {
        const err = new NotFoundError('Task');
        expect(err.message).toBe('Task not found');
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
    });
});

describe('UnauthorizedError', () => {
    it('uses 401 with default message', () => {
        const err = new UnauthorizedError();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Unauthorized');
    });

    it('accepts custom message', () => {
        const err = new UnauthorizedError('Token expired');
        expect(err.message).toBe('Token expired');
    });
});

describe('ConflictError', () => {
    it('uses 409', () => {
        const err = new ConflictError('Email already taken');
        expect(err.statusCode).toBe(409);
        expect(err.message).toBe('Email already taken');
    });
});

describe('ExternalServiceError', () => {
    it('combines service name and message, uses 502', () => {
        const err = new ExternalServiceError('Todoist', 'rate limited');
        expect(err.message).toBe('Todoist: rate limited');
        expect(err.statusCode).toBe(502);
        expect(err.code).toBe('EXTERNAL_SERVICE_ERROR');
    });
});
```

- [ ] **Step 6: Run test — expect FAIL**

```bash
pnpm --filter @ctm/errors test
```

Expected: `Cannot find module './index.js'`

- [ ] **Step 7: Implement `packages/errors/src/index.ts`**

```ts
export class AppError extends Error {
    constructor(
        public override readonly message: string,
        public readonly code: string,
        public readonly statusCode: number,
    ) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(`${resource} not found`, 'NOT_FOUND', 404);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 'UNAUTHORIZED', 401);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 'CONFLICT', 409);
    }
}

export class ExternalServiceError extends AppError {
    constructor(service: string, message: string) {
        super(`${service}: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502);
    }
}
```

- [ ] **Step 8: Run test — expect PASS**

```bash
pnpm --filter @ctm/errors test
```

Expected: `5 passed`

- [ ] **Step 9: Build**

```bash
pnpm --filter @ctm/errors build
```

- [ ] **Step 10: Commit**

```bash
git add packages/errors
git commit -m "feat: add packages/errors shared error hierarchy"
```

---

## Task 6: packages/http

**Files:**
- Create: `packages/http/package.json`
- Create: `packages/http/tsconfig.json`
- Create: `packages/http/tsconfig.build.json`
- Create: `packages/http/vitest.config.ts`
- Create: `packages/http/src/index.ts`
- Create: `packages/http/src/http-client.spec.ts`

- [ ] **Step 1: Create `packages/http/package.json`**

```json
{
  "name": "@ctm/http",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "dev": "tsc -p tsconfig.build.json --watch"
  },
  "dependencies": {
    "@ctm/errors": "workspace:*"
  },
  "devDependencies": {
    "@ctm/tsconfig": "workspace:*",
    "typescript": "^5.8.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `packages/http/tsconfig.json`**

```json
{
  "extends": "@ctm/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/http/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `packages/http/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
    },
});
```

- [ ] **Step 5: Write the failing tests**

Create `packages/http/src/http-client.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from './index.js';
import { ExternalServiceError } from '@ctm/errors';

describe('HttpClient', () => {
    const client = new HttpClient({ baseUrl: 'https://api.example.com' });

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('sends GET to the correct URL and returns parsed JSON', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ id: '1', name: 'test' }),
        }));

        const result = await client.get<{ id: string; name: string }>('/items/1');

        expect(fetch).toHaveBeenCalledWith(
            'https://api.example.com/items/1',
            expect.objectContaining({ method: 'GET' }),
        );
        expect(result).toEqual({ id: '1', name: 'test' });
    });

    it('sends POST with JSON body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: () => Promise.resolve({ id: '2' }),
        }));

        await client.post('/items', { name: 'new item' });

        expect(fetch).toHaveBeenCalledWith(
            'https://api.example.com/items',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ name: 'new item' }),
            }),
        );
    });

    it('returns undefined for 204 No Content', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 204,
        }));

        const result = await client.delete('/items/1');
        expect(result).toBeUndefined();
    });

    it('throws ExternalServiceError on non-ok response', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 429,
            text: () => Promise.resolve('Too Many Requests'),
        }));

        await expect(client.get('/items')).rejects.toThrow(ExternalServiceError);
        await expect(client.get('/items')).rejects.toThrow('429');
    });

    it('merges default headers with per-request headers', async () => {
        const authedClient = new HttpClient({
            baseUrl: 'https://api.example.com',
            headers: { Authorization: 'Bearer tok' },
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
        }));

        await authedClient.get('/me', { 'X-Request-Id': 'abc' });

        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer tok',
                    'X-Request-Id': 'abc',
                }),
            }),
        );
    });
});
```

- [ ] **Step 6: Run test — expect FAIL**

```bash
pnpm --filter @ctm/http test
```

Expected: `Cannot find module './index.js'`

- [ ] **Step 7: Implement `packages/http/src/index.ts`**

```ts
import { ExternalServiceError } from '@ctm/errors';

export interface HttpClientOptions {
    baseUrl: string;
    headers?: Record<string, string>;
}

export class HttpClient {
    constructor(private readonly options: HttpClientOptions) {}

    async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('GET', path, undefined, headers);
    }

    async post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('POST', path, body, headers);
    }

    async patch<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> {
        return this.request<T>('PATCH', path, body, headers);
    }

    async delete(path: string, headers?: Record<string, string>): Promise<void> {
        await this.request<void>('DELETE', path, undefined, headers);
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        extraHeaders?: Record<string, string>,
    ): Promise<T> {
        const url = `${this.options.baseUrl}${path}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...this.options.headers,
            ...extraHeaders,
        };

        const response = await fetch(url, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new ExternalServiceError(url, `HTTP ${response.status}: ${text}`);
        }

        if (response.status === 204) {

            return undefined as T;
        }

        return response.json() as Promise<T>;
    }
}
```

- [ ] **Step 8: Run test — expect PASS**

```bash
pnpm --filter @ctm/http test
```

Expected: `5 passed`

- [ ] **Step 9: Build**

```bash
pnpm --filter @ctm/http build
```

- [ ] **Step 10: Commit**

```bash
git add packages/http
git commit -m "feat: add packages/http typed fetch wrapper"
```

---

## Task 7: packages/connectors — types and registry

**Files:**
- Create: `packages/connectors/package.json`
- Create: `packages/connectors/tsconfig.json`
- Create: `packages/connectors/tsconfig.build.json`
- Create: `packages/connectors/vitest.config.ts`
- Create: `packages/connectors/src/types.ts`
- Create: `packages/connectors/src/registry.ts`
- Create: `packages/connectors/src/registry.spec.ts`
- Create: `packages/connectors/src/index.ts`

- [ ] **Step 1: Create `packages/connectors/package.json`**

```json
{
  "name": "@ctm/connectors",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "test": "vitest run",
    "dev": "tsc -p tsconfig.build.json --watch"
  },
  "dependencies": {
    "@ctm/errors": "workspace:*",
    "@ctm/http": "workspace:*",
    "@ctm/logger": "workspace:*"
  },
  "devDependencies": {
    "@ctm/tsconfig": "workspace:*",
    "typescript": "^5.8.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `packages/connectors/tsconfig.json`**

```json
{
  "extends": "@ctm/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/connectors/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `packages/connectors/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
    },
});
```

- [ ] **Step 5: Create `packages/connectors/src/types.ts`**

```ts
export interface RemoteTask {
    sourceId: string;
    title: string;
    description: string | null;
    status: 'open' | 'done';
    priority: number | null;
    dueDate: Date | null;
    tags: string[];
}

export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

export interface CreateTaskDto {
    title: string;
    description?: string;
    dueDate?: Date;
    priority?: number;
}

export interface UpdateTaskDto {
    title?: string;
    description?: string;
    dueDate?: Date;
    priority?: number;
}

export interface TaskConnector {
    readonly source: string;
    getAuthUrl(userId: string): string;
    exchangeCode(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;
    fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]>;
    createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask>;
    updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask>;
    completeTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
    deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void>;
}
```

- [ ] **Step 6: Write failing registry tests**

Create `packages/connectors/src/registry.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ConnectorRegistry } from './registry.js';
import type { TaskConnector } from './types.js';

function makeStubConnector(source: string): TaskConnector {
    return {
        source,
        getAuthUrl: () => '',
        exchangeCode: async () => ({ accessToken: '', refreshToken: '', expiresAt: new Date() }),
        refreshToken: async (t) => t,
        fetchTasks: async () => [],
        createTask: async () => ({ sourceId: '', title: '', description: null, status: 'open', priority: null, dueDate: null, tags: [] }),
        updateTask: async () => ({ sourceId: '', title: '', description: null, status: 'open', priority: null, dueDate: null, tags: [] }),
        completeTask: async () => undefined,
        deleteTask: async () => undefined,
    };
}

describe('ConnectorRegistry', () => {
    it('registers and retrieves a connector by source', () => {
        const registry = new ConnectorRegistry();
        const connector = makeStubConnector('todoist');
        registry.register(connector);
        expect(registry.get('todoist')).toBe(connector);
    });

    it('throws when getting an unregistered source', () => {
        const registry = new ConnectorRegistry();
        expect(() => registry.get('unknown')).toThrow('No connector registered for source: unknown');
    });

    it('lists all registered sources', () => {
        const registry = new ConnectorRegistry();
        registry.register(makeStubConnector('todoist'));
        registry.register(makeStubConnector('google_tasks'));
        expect(registry.list()).toEqual(['todoist', 'google_tasks']);
    });

    it('overwrites a connector when registered twice with same source', () => {
        const registry = new ConnectorRegistry();
        const first = makeStubConnector('todoist');
        const second = makeStubConnector('todoist');
        registry.register(first);
        registry.register(second);
        expect(registry.get('todoist')).toBe(second);
    });
});
```

- [ ] **Step 7: Run test — expect FAIL**

```bash
pnpm --filter @ctm/connectors test
```

Expected: `Cannot find module './registry.js'`

- [ ] **Step 8: Implement `packages/connectors/src/registry.ts`**

```ts
import type { TaskConnector } from './types.js';

export class ConnectorRegistry {
    private readonly connectors = new Map<string, TaskConnector>();

    register(connector: TaskConnector): void {
        this.connectors.set(connector.source, connector);
    }

    get(source: string): TaskConnector {
        const connector = this.connectors.get(source);

        if (!connector) {
            throw new Error(`No connector registered for source: ${source}`);
        }

        return connector;
    }

    list(): string[] {
        return Array.from(this.connectors.keys());
    }
}
```

- [ ] **Step 9: Create `packages/connectors/src/index.ts`** (barrel — extend as connectors are added)

```ts
export type { RemoteTask, OAuthTokens, CreateTaskDto, UpdateTaskDto, TaskConnector } from './types.js';
export { ConnectorRegistry } from './registry.js';
```

- [ ] **Step 10: Run test — expect PASS**

```bash
pnpm --filter @ctm/connectors test
```

Expected: `4 passed`

- [ ] **Step 11: Commit**

```bash
git add packages/connectors
git commit -m "feat: add packages/connectors types and registry"
```

---

## Task 8: TodoistConnector

**Files:**
- Create: `packages/connectors/src/todoist/todoist.connector.ts`
- Create: `packages/connectors/src/todoist/todoist.connector.spec.ts`
- Modify: `packages/connectors/src/index.ts`

Todoist API reference used in this task:
- Auth URL: `https://todoist.com/oauth/authorize`
- Token URL: `https://todoist.com/oauth/access_token`
- Tasks list: `GET https://api.todoist.com/rest/v2/tasks`
- Create task: `POST https://api.todoist.com/rest/v2/tasks`
- Update task: `POST https://api.todoist.com/rest/v2/tasks/{id}`
- Close task: `POST https://api.todoist.com/rest/v2/tasks/{id}/close`
- Delete task: `DELETE https://api.todoist.com/rest/v2/tasks/{id}`

Todoist priorities: `1` (normal) → `4` (urgent). We normalise to our own 1–4 scale (same values).

Todoist task shape:
```
{ id, content, description, is_completed, priority, due: { date } | null, labels }
```

- [ ] **Step 1: Write failing tests**

Create `packages/connectors/src/todoist/todoist.connector.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TodoistConnector } from './todoist.connector.js';
import type { OAuthTokens } from '../types.js';

const config = {
    clientId: 'test_client_id',
    clientSecret: 'test_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/todoist',
};

const tokens: OAuthTokens = {
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('TodoistConnector', () => {
    let connector: TodoistConnector;

    beforeEach(() => {
        connector = new TodoistConnector(config);
        vi.restoreAllMocks();
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state', () => {
            const url = connector.getAuthUrl('user-123');
            expect(url).toContain('client_id=test_client_id');
            expect(url).toContain('redirect_uri=');
            expect(url).toContain('state=user-123');
            expect(url).toContain('scope=task%3Aadd%2Cdata%3Aread%2Cdata%3Adelete');
        });
    });

    describe('fetchTasks', () => {
        it('maps Todoist tasks to RemoteTask shape', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve([
                    {
                        id: 'task-1',
                        content: 'Buy milk',
                        description: 'From the supermarket',
                        is_completed: false,
                        priority: 2,
                        due: { date: '2026-06-01' },
                        labels: ['shopping', 'errands'],
                    },
                ]),
            }));

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'task-1',
                title: 'Buy milk',
                description: 'From the supermarket',
                status: 'open',
                priority: 2,
                tags: ['shopping', 'errands'],
            });
            expect(tasks[0].dueDate).toBeInstanceOf(Date);
        });

        it('maps completed tasks to status "done"', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve([
                    { id: 't2', content: 'Done task', description: '', is_completed: true, priority: 1, due: null, labels: [] },
                ]),
            }));

            const tasks = await connector.fetchTasks(tokens);
            expect(tasks[0].status).toBe('done');
        });

        it('sets dueDate to null when no due date', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve([
                    { id: 't3', content: 'No due', description: '', is_completed: false, priority: 1, due: null, labels: [] },
                ]),
            }));

            const tasks = await connector.fetchTasks(tokens);
            expect(tasks[0].dueDate).toBeNull();
        });
    });

    describe('completeTask', () => {
        it('POSTs to the close endpoint', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
            await connector.completeTask(tokens, 'task-1');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks/task-1/close'),
                expect.objectContaining({ method: 'POST' }),
            );
        });
    });

    describe('deleteTask', () => {
        it('sends DELETE to the task endpoint', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
            await connector.deleteTask(tokens, 'task-1');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/tasks/task-1'),
                expect.objectContaining({ method: 'DELETE' }),
            );
        });
    });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @ctm/connectors test
```

Expected: `Cannot find module './todoist.connector.js'`

- [ ] **Step 3: Implement `packages/connectors/src/todoist/todoist.connector.ts`**

```ts
import { HttpClient } from '@ctm/http';
import type { CreateTaskDto, OAuthTokens, RemoteTask, TaskConnector, UpdateTaskDto } from '../types.js';

export interface TodoistConnectorConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface TodoistTask {
    id: string;
    content: string;
    description: string;
    is_completed: boolean;
    priority: number;
    due: { date: string } | null;
    labels: string[];
}

interface TodoistTokenResponse {
    access_token: string;
    token_type: string;
}

export class TodoistConnector implements TaskConnector {
    readonly source = 'todoist';

    private readonly http = new HttpClient({ baseUrl: 'https://api.todoist.com/rest/v2' });

    private readonly authHttp = new HttpClient({ baseUrl: 'https://todoist.com' });

    constructor(private readonly config: TodoistConnectorConfig) {}

    getAuthUrl(userId: string): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            scope: 'task:add,data:read,data:delete',
            state: userId,
            redirect_uri: this.config.redirectUri,
        });

        return `https://todoist.com/oauth/authorize?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const response = await this.authHttp.post<TodoistTokenResponse>('/oauth/access_token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
        });

        return {
            accessToken: response.access_token,
            refreshToken: '',
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        };
    }

    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        return tokens;
    }

    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const tasks = await this.http.get<TodoistTask[]>('/tasks', {
            Authorization: `Bearer ${tokens.accessToken}`,
        });

        return tasks.map(this.toRemoteTask);
    }

    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const created = await this.http.post<TodoistTask>(
            '/tasks',
            {
                content: task.title,
                description: task.description ?? '',
                due_date: task.dueDate?.toISOString().split('T')[0],
                priority: task.priority ?? 1,
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(created);
    }

    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        const updated = await this.http.post<TodoistTask>(
            `/tasks/${sourceId}`,
            {
                content: patch.title,
                description: patch.description,
                due_date: patch.dueDate?.toISOString().split('T')[0],
                priority: patch.priority,
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(updated);
    }

    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.http.post<void>(`/tasks/${sourceId}/close`, {}, {
            Authorization: `Bearer ${tokens.accessToken}`,
        });
    }

    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        await this.http.delete(`/tasks/${sourceId}`, {
            Authorization: `Bearer ${tokens.accessToken}`,
        });
    }

    private toRemoteTask(task: TodoistTask): RemoteTask {
        return {
            sourceId: task.id,
            title: task.content,
            description: task.description || null,
            status: task.is_completed ? 'done' : 'open',
            priority: task.priority,
            dueDate: task.due ? new Date(task.due.date) : null,
            tags: task.labels,
        };
    }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm --filter @ctm/connectors test
```

Expected: `8 passed`

- [ ] **Step 5: Export from barrel**

Update `packages/connectors/src/index.ts`:

```ts
export type { RemoteTask, OAuthTokens, CreateTaskDto, UpdateTaskDto, TaskConnector } from './types.js';
export { ConnectorRegistry } from './registry.js';
export { TodoistConnector } from './todoist/todoist.connector.js';
export type { TodoistConnectorConfig } from './todoist/todoist.connector.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/connectors/src/todoist packages/connectors/src/index.ts
git commit -m "feat(connectors): add TodoistConnector"
```

---

## Task 9: GoogleTasksConnector

**Files:**
- Create: `packages/connectors/src/google-tasks/google-tasks.connector.ts`
- Create: `packages/connectors/src/google-tasks/google-tasks.connector.spec.ts`
- Modify: `packages/connectors/src/index.ts`

Google Tasks API reference:
- Auth URL: `https://accounts.google.com/o/oauth2/v2/auth`
- Token URL: `https://oauth2.googleapis.com/token`
- Task lists: `GET https://tasks.googleapis.com/tasks/v1/users/@me/lists`
- Tasks: `GET https://tasks.googleapis.com/tasks/v1/lists/{listId}/tasks`
- Create: `POST https://tasks.googleapis.com/tasks/v1/lists/{listId}/tasks`
- Update: `PATCH https://tasks.googleapis.com/tasks/v1/lists/{listId}/tasks/{taskId}`
- Delete: `DELETE https://tasks.googleapis.com/tasks/v1/lists/{listId}/tasks/{taskId}`

Google Tasks shape:
```
{ id, title, notes, status: 'needsAction'|'completed', due, deleted, hidden }
```

`sourceId` encodes both list and task: `{listId}:{taskId}` — needed to know which list to call.

- [ ] **Step 1: Write failing tests**

Create `packages/connectors/src/google-tasks/google-tasks.connector.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleTasksConnector } from './google-tasks.connector.js';
import type { OAuthTokens } from '../types.js';

const config = {
    clientId: 'google_client_id',
    clientSecret: 'google_secret',
    redirectUri: 'http://localhost:3000/connectors/oauth/callback/google_tasks',
};

const tokens: OAuthTokens = {
    accessToken: 'google_access_token',
    refreshToken: 'google_refresh_token',
    expiresAt: new Date(Date.now() + 3_600_000),
};

describe('GoogleTasksConnector', () => {
    let connector: GoogleTasksConnector;

    beforeEach(() => {
        connector = new GoogleTasksConnector(config);
        vi.restoreAllMocks();
    });

    describe('getAuthUrl', () => {
        it('includes client_id, redirect_uri, scope, and state', () => {
            const url = connector.getAuthUrl('user-456');
            expect(url).toContain('client_id=google_client_id');
            expect(url).toContain('state=user-456');
            expect(url).toContain('scope=');
            expect(url).toContain('tasks');
            expect(url).toContain('code_challenge');
        });
    });

    describe('fetchTasks', () => {
        it('fetches task lists then tasks, maps to RemoteTask', async () => {
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ items: [{ id: 'list-1', title: 'My Tasks' }] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        items: [{
                            id: 'gtask-1',
                            title: 'Read a book',
                            notes: 'Fiction',
                            status: 'needsAction',
                            due: '2026-06-15T00:00:00.000Z',
                        }],
                    }),
                }),
            );

            const tasks = await connector.fetchTasks(tokens);

            expect(tasks).toHaveLength(1);
            expect(tasks[0]).toMatchObject({
                sourceId: 'list-1:gtask-1',
                title: 'Read a book',
                description: 'Fiction',
                status: 'open',
                dueDate: expect.any(Date),
            });
        });

        it('maps completed tasks to status "done"', async () => {
            vi.stubGlobal('fetch', vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ items: [{ id: 'list-1', title: 'My Tasks' }] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        items: [{ id: 'gtask-2', title: 'Done', notes: '', status: 'completed', due: null }],
                    }),
                }),
            );

            const tasks = await connector.fetchTasks(tokens);
            expect(tasks[0].status).toBe('done');
        });
    });

    describe('completeTask', () => {
        it('PATCHes status to completed using list:task sourceId', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }));
            await connector.completeTask(tokens, 'list-1:gtask-1');
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/lists/list-1/tasks/gtask-1'),
                expect.objectContaining({ method: 'PATCH' }),
            );
        });
    });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @ctm/connectors test
```

Expected: `Cannot find module './google-tasks.connector.js'`

- [ ] **Step 3: Implement `packages/connectors/src/google-tasks/google-tasks.connector.ts`**

```ts
import crypto from 'crypto';
import { HttpClient } from '@ctm/http';
import type { CreateTaskDto, OAuthTokens, RemoteTask, TaskConnector, UpdateTaskDto } from '../types.js';

export interface GoogleTasksConnectorConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}

interface GoogleTaskList {
    id: string;
    title: string;
}

interface GoogleTask {
    id: string;
    title: string;
    notes?: string;
    status: 'needsAction' | 'completed';
    due?: string;
    deleted?: boolean;
    hidden?: boolean;
}

interface GoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

export class GoogleTasksConnector implements TaskConnector {
    readonly source = 'google_tasks';

    private readonly http = new HttpClient({ baseUrl: 'https://tasks.googleapis.com/tasks/v1' });

    private readonly authHttp = new HttpClient({ baseUrl: 'https://oauth2.googleapis.com' });

    constructor(private readonly config: GoogleTasksConnectorConfig) {}

    getAuthUrl(userId: string): string {
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/tasks',
            access_type: 'offline',
            state: userId,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const response = await this.authHttp.post<GoogleTokenResponse>('/token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.redirectUri,
            grant_type: 'authorization_code',
        });

        return {
            accessToken: response.access_token,
            refreshToken: response.refresh_token ?? '',
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }

    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const response = await this.authHttp.post<GoogleTokenResponse>('/token', {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            refresh_token: tokens.refreshToken,
            grant_type: 'refresh_token',
        });

        return {
            accessToken: response.access_token,
            refreshToken: tokens.refreshToken,
            expiresAt: new Date(Date.now() + response.expires_in * 1000),
        };
    }

    async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
        const authHeader = { Authorization: `Bearer ${tokens.accessToken}` };
        const { items: lists } = await this.http.get<{ items: GoogleTaskList[] }>(
            '/users/@me/lists',
            authHeader,
        );

        const taskArrays = await Promise.all(
            lists.map(async list => {
                const { items = [] } = await this.http.get<{ items?: GoogleTask[] }>(
                    `/lists/${list.id}/tasks?showCompleted=true&showHidden=false`,
                    authHeader,
                );

                return items
                    .filter(t => !t.deleted && !t.hidden)
                    .map(t => this.toRemoteTask(list.id, t));
            }),
        );

        return taskArrays.flat();
    }

    async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
        const listId = await this.getFirstListId(tokens);
        const created = await this.http.post<GoogleTask>(
            `/lists/${listId}/tasks`,
            {
                title: task.title,
                notes: task.description ?? '',
                due: task.dueDate?.toISOString(),
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(lists, created);
    }

    async updateTask(tokens: OAuthTokens, sourceId: string, patch: UpdateTaskDto): Promise<RemoteTask> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        const updated = await this.http.patch<GoogleTask>(
            `/lists/${listId}/tasks/${taskId}`,
            {
                title: patch.title,
                notes: patch.description,
                due: patch.dueDate?.toISOString(),
            },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        return this.toRemoteTask(listId, updated);
    }

    async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.http.patch<GoogleTask>(
            `/lists/${listId}/tasks/${taskId}`,
            { status: 'completed' },
            { Authorization: `Bearer ${tokens.accessToken}` },
        );
    }

    async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
        const [listId, taskId] = this.splitSourceId(sourceId);
        await this.http.delete(`/lists/${listId}/tasks/${taskId}`, {
            Authorization: `Bearer ${tokens.accessToken}`,
        });
    }

    private async getFirstListId(tokens: OAuthTokens): Promise<string> {
        const { items } = await this.http.get<{ items: GoogleTaskList[] }>(
            '/users/@me/lists',
            { Authorization: `Bearer ${tokens.accessToken}` },
        );

        if (!items.length) throw new Error('No Google Task lists found');
        return items[0].id;
    }

    private splitSourceId(sourceId: string): [string, string] {
        const idx = sourceId.indexOf(':');
        return [sourceId.slice(0, idx), sourceId.slice(idx + 1)];
    }

    private toRemoteTask(listId: string, task: GoogleTask): RemoteTask {
        return {
            sourceId: `${listId}:${task.id}`,
            title: task.title,
            description: task.notes ?? null,
            status: task.status === 'completed' ? 'done' : 'open',
            priority: null,
            dueDate: task.due ? new Date(task.due) : null,
            tags: [],
        };
    }
}
```

- [ ] **Step 4: Run all connector tests — expect PASS**

```bash
pnpm --filter @ctm/connectors test
```

Expected: `12 passed` (4 registry + 5 todoist + 3 google-tasks)

- [ ] **Step 5: Update barrel exports**

Update `packages/connectors/src/index.ts`:

```ts
export type { RemoteTask, OAuthTokens, CreateTaskDto, UpdateTaskDto, TaskConnector } from './types.js';
export { ConnectorRegistry } from './registry.js';
export { TodoistConnector } from './todoist/todoist.connector.js';
export type { TodoistConnectorConfig } from './todoist/todoist.connector.js';
export { GoogleTasksConnector } from './google-tasks/google-tasks.connector.js';
export type { GoogleTasksConnectorConfig } from './google-tasks/google-tasks.connector.js';
```

- [ ] **Step 6: Build connectors package**

```bash
pnpm --filter @ctm/connectors build
```

Expected: `dist/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/connectors/src/google-tasks packages/connectors/src/index.ts
git commit -m "feat(connectors): add GoogleTasksConnector"
```

---

## Task 10: Full build verification

- [ ] **Step 1: Install all workspace dependencies**

```bash
pnpm install
```

- [ ] **Step 2: Build all packages from root**

```bash
pnpm build
```

Expected: all packages build in dependency order (`tsconfig` → `config` → `logger`/`errors` → `http` → `connectors`), no errors.

- [ ] **Step 3: Run all tests from root**

```bash
pnpm test
```

Expected: all tests pass across `logger`, `errors`, `http`, `connectors`. Output shows something like:

```
@ctm/logger    2 passed
@ctm/errors    5 passed
@ctm/http      5 passed
@ctm/connectors 12 passed
```

- [ ] **Step 4: Update CLAUDE.md** — replace oxlint/oxfmt references with ESLint + Prettier, and add `@ctm/` package scope

In `CLAUDE.md`, update the lint/format row in the Tech Stack table:

```
| Lint / Format | ESLint + typescript-eslint, Prettier (via `@ctm/config`) |
```

Also update Common Commands to add the package scope:

```bash
# Scoped to a single package
pnpm --filter @ctm/main dev
pnpm --filter @ctm/main test
```

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "chore: update CLAUDE.md — ESLint/Prettier, @ctm scope"
```

---

## Next Plans

- **Plan 2:** `apps/main` — NestJS REST API (auth, users, connectors CRUD, tasks CRUD, API tokens, reminders)
- **Plan 3:** `apps/sync` — polling worker, token refresh, upsert loop
- **Plan 4:** `apps/cli` + `apps/mcp` — commander CLI and MCP server
- **Plan 5:** `apps/web` — Vite + React dashboard
