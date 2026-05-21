# CTM Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured neobrutalist React SPA (`apps/web`) with task management, source connections, and profile management, plus the backend prerequisites (refresh tokens, delete account) needed to support it.

**Architecture:** Vite 8 + React 19 + React Router v7 + Tailwind CSS v4 in `apps/web`. A new `@ctm/api-client` package wraps axios with typed endpoint functions and JWT access/refresh token interceptors. `apps/main` gets `POST /auth/refresh` and `DELETE /users/me` endpoints.

**Tech Stack:** React 19.2, Vite 8, Tailwind CSS v4, React Router v7, Axios 1.16, TypeScript 6, Vitest 3, @testing-library/react 16, pnpm workspaces + Turborepo

---

## File Map

### New: `packages/api-client/`

| File                  | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `package.json`        | Package config, axios dep                                       |
| `tsconfig.json`       | Extends `@ctm/tsconfig/base.json`                               |
| `tsconfig.build.json` | Excludes spec files                                             |
| `vitest.config.ts`    | Unit test config                                                |
| `src/types.ts`        | Shared DTO types (UserDto, TaskDto, etc.)                       |
| `src/client.ts`       | Axios instance factory with auth interceptors                   |
| `src/auth.ts`         | login, register, refresh functions                              |
| `src/tasks.ts`        | listTasks, createTask, updateTask, deleteTask, setFuzzyDeadline |
| `src/connectors.ts`   | listConnectors, getConnectorAuthUrl, disconnectConnector        |
| `src/users.ts`        | getMe, updateMe, deleteMe                                       |
| `src/index.ts`        | Re-exports everything                                           |
| `src/auth.spec.ts`    | Unit tests for auth functions                                   |
| `src/tasks.spec.ts`   | Unit tests for task functions                                   |

### New: `apps/web/`

| File                                     | Purpose                                        |
| ---------------------------------------- | ---------------------------------------------- |
| `package.json`                           | App config, all deps                           |
| `index.html`                             | Vite entry point                               |
| `vite.config.ts`                         | Vite + React + Tailwind plugins                |
| `tsconfig.json`                          | Extends `@ctm/tsconfig/react.json`             |
| `vitest.config.ts`                       | jsdom test environment                         |
| `src/test-setup.ts`                      | jest-dom matchers                              |
| `src/main.tsx`                           | React root, router init, api-client init       |
| `src/index.css`                          | Tailwind v4 import + `@theme` custom colours   |
| `src/App.tsx`                            | Route tree                                     |
| `src/auth/AuthContext.tsx`               | Provides user, login, logout, isLoading        |
| `src/auth/ProtectedRoute.tsx`            | Redirects to /login if unauthenticated         |
| `src/pages/LoginPage.tsx`                | Email + password login form                    |
| `src/pages/RegisterPage.tsx`             | Name + email + password registration           |
| `src/pages/TasksPage.tsx`                | Task list with filters and add/edit            |
| `src/pages/SettingsLayout.tsx`           | Settings shell with sub-nav (desktop)          |
| `src/pages/SourcesPage.tsx`              | Connector connect/disconnect cards             |
| `src/pages/ProfilePage.tsx`              | Email/password update + delete account         |
| `src/pages/NotFoundPage.tsx`             | 404 page                                       |
| `src/components/layout/Sidebar.tsx`      | Desktop black left nav                         |
| `src/components/layout/BottomTabs.tsx`   | Mobile bottom tab bar (3 tabs)                 |
| `src/components/layout/AppShell.tsx`     | Responsive wrapper combining both              |
| `src/components/ui/Button.tsx`           | Neobrutalist button (primary/secondary/danger) |
| `src/components/ui/Input.tsx`            | Neobrutalist text input                        |
| `src/components/ui/Badge.tsx`            | Priority and source badges                     |
| `src/components/ui/Checkbox.tsx`         | Square checkbox                                |
| `src/components/ui/Modal.tsx`            | Portal-based modal with backdrop               |
| `src/components/ui/index.ts`             | Barrel export                                  |
| `src/components/tasks/TaskCard.tsx`      | Single task row                                |
| `src/components/tasks/TaskFilters.tsx`   | ALL/TODAY/UPCOMING/DONE pill filters           |
| `src/components/tasks/AddTaskInline.tsx` | Expandable inline add-task form                |
| `src/components/tasks/TaskModal.tsx`     | Create/edit task modal                         |
| `src/components/tasks/TaskList.tsx`      | Renders list of TaskCards                      |
| `src/components/sources/SourceCard.tsx`  | Single connector card                          |
| `.env`                                   | `VITE_API_URL=http://localhost:3000`           |
| `.env.example`                           | Same, committed to repo                        |

### Modified: `apps/main/`

| File                                       | Change                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `src/auth/schemas/refresh-token.schema.ts` | New — RefreshToken Mongoose schema                             |
| `src/auth/dto/refresh.dto.ts`              | New — `{ refreshToken: string }` DTO                           |
| `src/auth/auth.service.ts`                 | Add `issueTokens()`, `refreshTokens()`, `revokeRefreshToken()` |
| `src/auth/auth.controller.ts`              | Add `POST /auth/refresh`, update login/register responses      |
| `src/auth/auth.module.ts`                  | Register RefreshToken schema                                   |
| `src/users/users.service.ts`               | Add `delete(id)` method                                        |
| `src/users/users.controller.ts`            | Add `DELETE /users/me` endpoint                                |

---

### Task 0: Backend — refresh tokens + delete account

**Files:**

- Create: `apps/main/src/auth/schemas/refresh-token.schema.ts`
- Create: `apps/main/src/auth/dto/refresh.dto.ts`
- Modify: `apps/main/src/auth/auth.service.ts`
- Modify: `apps/main/src/auth/auth.controller.ts`
- Modify: `apps/main/src/auth/auth.module.ts`
- Modify: `apps/main/src/users/users.service.ts`
- Modify: `apps/main/src/users/users.controller.ts`
- Test: `apps/main/src/auth/auth.controller.spec.ts` (existing file — add refresh tests)

**Context:** Currently `auth.service.ts` has `signToken(user)` returning `{ accessToken }`. Login and register both return only an access token. We need to also return a refresh token. Refresh tokens are stored hashed in MongoDB (same pattern as API tokens in `api-token.service.ts`). The current access token TTL is 7 days (configured in `auth.module.ts`); we will reduce it to 15 minutes via a new env var `JWT_ACCESS_EXPIRES`.

- [ ] **Step 1: Add `JWT_ACCESS_EXPIRES` to env schema**

In `apps/main/src/config/env.schema.ts`, add after the RSA key validations:

```typescript
JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().integer().min(1).default(30),
```

In `apps/main/src/auth/auth.module.ts`, update `signOptions`:

```typescript
signOptions: {
    algorithm: 'RS256' as const,
    expiresIn: config.get<string>('JWT_ACCESS_EXPIRES', '15m'),
},
```

- [ ] **Step 2: Create the RefreshToken schema**

Create `apps/main/src/auth/schemas/refresh-token.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

@Schema({ timestamps: true })
export class RefreshToken {
    @Prop({ required: true, index: true })
    tokenHash!: string;

    @Prop({ required: true, index: true })
    userId!: string;

    @Prop({ required: true })
    expiresAt!: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

- [ ] **Step 3: Create the refresh DTO**

Create `apps/main/src/auth/dto/refresh.dto.ts`:

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshDto {
    @IsString()
    @IsNotEmpty()
    refreshToken!: string;
}
```

- [ ] **Step 4: Update AuthModule to register RefreshToken schema**

In `apps/main/src/auth/auth.module.ts`, add to the MongooseModule.forFeature array:

```typescript
{ name: RefreshToken.name, schema: RefreshTokenSchema }
```

Import `RefreshToken` and `RefreshTokenSchema` from `./schemas/refresh-token.schema.js`.

- [ ] **Step 5: Update AuthService to issue and validate refresh tokens**

Replace the full content of `apps/main/src/auth/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import { RefreshToken, type RefreshTokenDocument } from './schemas/refresh-token.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly users: UsersService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    ) {}

    /** Register a new user and return a token pair. */
    async register({
        email,
        password,
    }: {
        email: string;
        password: string;
    }): Promise<TokenPair & { user: { id: string; email: string } }> {
        const user = await this.users.create({ email, password });

        return this.issueTokens(user);
    }

    /** Issue a new access + refresh token pair for a validated user. */
    async issueTokens(user: UserDocument): Promise<TokenPair & { user: { id: string; email: string } }> {
        const payload: JwtPayload = { sub: String(user._id), email: user.email };
        const accessToken = this.jwt.sign(payload);

        const rawRefresh = `rt_${randomBytes(32).toString('hex')}`;
        const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
        const expiresInDays = this.config.get<number>('REFRESH_TOKEN_EXPIRES_DAYS', 30);
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

        await this.refreshTokenModel.create({ tokenHash, userId: String(user._id), expiresAt });

        return {
            accessToken,
            refreshToken: rawRefresh,
            user: { id: String(user._id), email: user.email },
        };
    }

    /** Validate a refresh token and issue a new token pair. Old token is deleted (rotation). */
    async refreshTokens(rawRefreshToken: string): Promise<TokenPair & { user: { id: string; email: string } }> {
        const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
        const record = await this.refreshTokenModel.findOneAndDelete({ tokenHash });

        if (!record || record.expiresAt < new Date()) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const user = await this.users.findById(record.userId);

        if (!user) throw new UnauthorizedException('User not found');

        return this.issueTokens(user);
    }

    /** Delete all refresh tokens for a user (logout everywhere). */
    async revokeAllRefreshTokens(userId: string): Promise<void> {
        await this.refreshTokenModel.deleteMany({ userId });
    }
}
```

- [ ] **Step 6: Update AuthController**

Replace the full content of `apps/main/src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService, type TokenPair } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { CreateTokenDto } from './dto/create-token.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CombinedAuthGuard } from './guards/combined-auth.guard.js';
import { ApiTokenService } from './api-token.service.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

interface AuthRequest {
    user: UserDocument;
}

interface JwtRequest {
    user: JwtPayload;
}

type TokenResponse = TokenPair & { user: { id: string; email: string } };

@Controller('auth')
export class AuthController {
    constructor(
        private readonly auth: AuthService,
        private readonly apiTokens: ApiTokenService,
    ) {}

    /** Register a new account. Returns token pair + user. */
    @Post('register')
    async register(@Body() dto: RegisterDto): Promise<TokenResponse> {
        return this.auth.register({ email: dto.email, password: dto.password });
    }

    /** Login with email + password. Returns token pair + user. */
    @Post('login')
    @HttpCode(200)
    @UseGuards(AuthGuard('local'))
    async login(@Request() req: AuthRequest): Promise<TokenResponse> {
        return this.auth.issueTokens(req.user);
    }

    /** Exchange a refresh token for a new token pair. */
    @Post('refresh')
    @HttpCode(200)
    async refresh(@Body() dto: RefreshDto): Promise<TokenResponse> {
        return this.auth.refreshTokens(dto.refreshToken);
    }

    /** Issue a new long-lived API token (for CLI/MCP). Raw token shown once. */
    @Post('tokens')
    @UseGuards(JwtAuthGuard)
    async createToken(
        @Request() req: JwtRequest,
        @Body() dto: CreateTokenDto,
    ): Promise<{ token: string; id: string; label: string }> {
        const { rawToken, record } = await this.apiTokens.create({ userId: req.user.sub, label: dto.label });

        return { token: rawToken, id: String(record._id), label: record.label };
    }

    /** List all API tokens for the current user (no raw values). */
    @Get('tokens')
    @UseGuards(CombinedAuthGuard)
    async listTokens(@Request() req: JwtRequest): Promise<{ id: string; label: string; lastUsedAt: Date | null }[]> {
        const tokens = await this.apiTokens.list(req.user.sub);

        return tokens.map((t) => ({ id: String(t._id), label: t.label, lastUsedAt: t.lastUsedAt }));
    }

    /** Revoke an API token by id. */
    @Delete('tokens/:id')
    @HttpCode(204)
    @UseGuards(CombinedAuthGuard)
    async revokeToken(@Request() req: JwtRequest, @Param('id') id: string): Promise<void> {
        await this.apiTokens.revoke({ tokenId: id, userId: req.user.sub });
    }
}
```

- [ ] **Step 7: Add `delete` to UsersService**

In `apps/main/src/users/users.service.ts`, add after the `update` method:

```typescript
/** Permanently delete a user by id. */
async delete(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id);
}
```

- [ ] **Step 8: Add `DELETE /users/me` to UsersController**

In `apps/main/src/users/users.controller.ts`, add imports `Delete, HttpCode` to the `@nestjs/common` import, then add after the `update` method:

```typescript
/** Delete the current user's account permanently. */
@Delete('me')
@HttpCode(204)
async deleteMe(@Request() req: AuthRequest): Promise<void> {
    await this.users.delete(req.user.sub);
}
```

- [ ] **Step 9: Write tests for the new refresh endpoint**

In `apps/main/src/auth/auth.controller.spec.ts`, add a describe block for the refresh endpoint. The test should verify that a valid refresh token returns a new token pair, and an invalid token returns 401. Follow the existing test patterns in that file (the spec uses the real MongoDB from `.env.test`).

- [ ] **Step 10: Run the tests**

```bash
pnpm --filter @ctm/main test
```

Expected: all existing tests pass plus new refresh tests pass.

- [ ] **Step 11: Also add `JWT_ACCESS_EXPIRES=15m` and `REFRESH_TOKEN_EXPIRES_DAYS=30` to `apps/main/.env` and `apps/main/.env.test`**

In `.env`, add:

```
JWT_ACCESS_EXPIRES=15m
REFRESH_TOKEN_EXPIRES_DAYS=30
```

In `.env.test`, add the same two lines.

- [ ] **Step 12: Add `name` field to `RegisterDto` and `User` schema**

The web app sends a `name` on registration. The backend needs to accept and store it.

In `apps/main/src/auth/dto/register.dto.ts`, add a `name` field:

```typescript
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8)
    password!: string;
}
```

In `apps/main/src/users/schemas/user.schema.ts`, add an optional `name` prop:

```typescript
@Prop({ default: '' })
name!: string;
```

(Add it between the `email` and `passwordHash` props.)

In `apps/main/src/users/users.service.ts`, update `create()` to accept and pass `name`:

```typescript
async create({ email, password, name = '' }: { email: string; password: string; name?: string }): Promise<UserDocument> {
    const passwordHash = await bcrypt.hash(password, 12);
    try {
        return await this.userModel.create({ email, passwordHash, name });
    } catch (err: unknown) {
        if (isMongooseDuplicateError(err)) throw new ConflictException('Email already registered');
        throw err;
    }
}
```

In `apps/main/src/auth/auth.service.ts`, update `register()` to pass `name`:

```typescript
async register({ email, password, name }: { email: string; password: string; name?: string }): Promise<TokenPair & { user: { id: string; email: string } }> {
    const user = await this.users.create({ email, password, name });
    return this.issueTokens(user);
}
```

Update `auth.controller.ts` `register()` to pass `dto.name`:

```typescript
async register(@Body() dto: RegisterDto): Promise<TokenResponse> {
    return this.auth.register({ email: dto.email, password: dto.password, name: dto.name });
}
```

Also update `UserDto` in `packages/api-client/src/types.ts` to include optional name:

```typescript
export interface UserDto {
    id: string;
    email: string;
    name?: string;
}
```

- [ ] **Step 13: Commit**

```bash
git add apps/main/src/auth/ apps/main/src/users/ apps/main/.env apps/main/.env.example apps/main/.env.test
git commit -m "feat(main): add refresh token support, delete-account endpoint, and name field"
```

---

### Task 1: `@ctm/api-client` package

**Files:**

- Create: `packages/api-client/package.json`
- Create: `packages/api-client/tsconfig.json`
- Create: `packages/api-client/tsconfig.build.json`
- Create: `packages/api-client/vitest.config.ts`
- Create: `packages/api-client/src/types.ts`
- Create: `packages/api-client/src/client.ts`
- Create: `packages/api-client/src/auth.ts`
- Create: `packages/api-client/src/tasks.ts`
- Create: `packages/api-client/src/connectors.ts`
- Create: `packages/api-client/src/users.ts`
- Create: `packages/api-client/src/index.ts`
- Create: `packages/api-client/src/auth.spec.ts`
- Create: `packages/api-client/src/tasks.spec.ts`

**Context:** Follows the same package pattern as `packages/errors` (build to `dist/`, extend `@ctm/tsconfig/base.json`). The axios instance is created via a factory function `createClient(baseURL, onAuthFailure)` — this keeps the package testable and environment-agnostic. The web app will call `initClient(baseURL)` at startup; all API functions use the shared singleton via `getClient()`.

- [ ] **Step 1: Create `package.json`**

Create `packages/api-client/package.json`:

```json
{
    "name": "@ctm/api-client",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "import": "./dist/index.js",
            "types": "./dist/index.d.ts"
        }
    },
    "scripts": {
        "build": "tsc -p tsconfig.build.json",
        "dev": "tsc -p tsconfig.build.json --watch",
        "test": "vitest run",
        "lint": "oxlint src",
        "format": "oxfmt --config ../../oxfmt.json src"
    },
    "dependencies": {
        "axios": "^1.16.1"
    },
    "devDependencies": {
        "@ctm/tsconfig": "workspace:*",
        "typescript": "^6.0.3",
        "vitest": "^3.2.0"
    }
}
```

- [ ] **Step 2: Create `tsconfig.json` and `tsconfig.build.json`**

Create `packages/api-client/tsconfig.json`:

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

Create `packages/api-client/tsconfig.build.json`:

```json
{
    "extends": "./tsconfig.json",
    "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `packages/api-client/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
    },
});
```

- [ ] **Step 4: Create `src/types.ts`**

Create `packages/api-client/src/types.ts`:

```typescript
export interface UserDto {
    id: string;
    email: string;
}

export interface TaskDto {
    id: string;
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    fuzzyDeadline?: string;
    completed: boolean;
    source: string;
    sourceId: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTaskDto {
    title: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    source: string;
}

export interface UpdateTaskDto {
    title?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    dueDate?: string;
    completed?: boolean;
}

export interface SetFuzzyDeadlineDto {
    fuzzyDeadline: string;
}

export interface ConnectorStatusDto {
    source: string;
    connected: boolean;
    lastSynced?: string;
}

export interface UpdateUserDto {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    user: UserDto;
}

export type TaskFilter = 'all' | 'today' | 'upcoming' | 'done';
```

- [ ] **Step 5: Create `src/client.ts`**

Create `packages/api-client/src/client.ts`:

```typescript
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

interface ExtendedConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

let _client: AxiosInstance | null = null;
let _baseURL = 'http://localhost:3000';
let _onAuthFailure: () => void = () => {
    if (typeof window !== 'undefined') window.location.href = '/login';
};

/**
 * Initialise the shared API client. Call once at app startup before any API calls.
 */
export function initClient(baseURL: string, onAuthFailure?: () => void): void {
    _baseURL = baseURL;

    if (onAuthFailure) _onAuthFailure = onAuthFailure;

    _client = createClient(_baseURL, _onAuthFailure);
}

/** Return the shared client, initialising with defaults if not yet set up. */
export function getClient(): AxiosInstance {
    if (!_client) _client = createClient(_baseURL, _onAuthFailure);

    return _client;
}

function createClient(baseURL: string, onAuthFailure: () => void): AxiosInstance {
    const instance = axios.create({ baseURL });

    instance.interceptors.request.use((config) => {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ctm_access_token') : null;

        if (token) config.headers.Authorization = `Bearer ${token}`;

        return config;
    });

    instance.interceptors.response.use(
        (res) => res,
        async (error: unknown) => {
            if (!axios.isAxiosError(error)) return Promise.reject(error);

            const config = error.config as ExtendedConfig | undefined;

            if (error.response?.status === 401 && config && !config._retry) {
                config._retry = true;
                const refreshToken =
                    typeof localStorage !== 'undefined' ? localStorage.getItem('ctm_refresh_token') : null;

                if (refreshToken) {
                    try {
                        const { data } = await axios.post<{
                            accessToken: string;
                            refreshToken: string;
                        }>(`${baseURL}/auth/refresh`, { refreshToken });

                        localStorage.setItem('ctm_access_token', data.accessToken);
                        localStorage.setItem('ctm_refresh_token', data.refreshToken);
                        config.headers.Authorization = `Bearer ${data.accessToken}`;

                        return instance(config);
                    } catch {
                        localStorage.removeItem('ctm_access_token');
                        localStorage.removeItem('ctm_refresh_token');
                        localStorage.removeItem('ctm_user');
                        onAuthFailure();
                    }
                }
            }

            return Promise.reject(error);
        },
    );

    return instance;
}
```

- [ ] **Step 6: Create `src/auth.ts`**

Create `packages/api-client/src/auth.ts`:

```typescript
import { getClient } from './client.js';
import type { TokenPair } from './types.js';

/** Login with email and password. Returns token pair + user. */
export async function login(email: string, password: string): Promise<TokenPair> {
    const { data } = await getClient().post<TokenPair>('/auth/login', { email, password });

    return data;
}

/** Register a new account. Returns token pair + user. */
export async function register(name: string, email: string, password: string): Promise<TokenPair> {
    const { data } = await getClient().post<TokenPair>('/auth/register', { name, email, password });

    return data;
}

/** Exchange a refresh token for a new token pair. */
export async function refresh(refreshToken: string): Promise<TokenPair> {
    const { data } = await getClient().post<TokenPair>('/auth/refresh', { refreshToken });

    return data;
}
```

- [ ] **Step 7: Create `src/tasks.ts`**

Create `packages/api-client/src/tasks.ts`:

```typescript
import { getClient } from './client.js';
import type { TaskDto, CreateTaskDto, UpdateTaskDto, SetFuzzyDeadlineDto, TaskFilter } from './types.js';

/** List tasks, optionally filtered by status. */
export async function listTasks(filter: TaskFilter = 'all'): Promise<TaskDto[]> {
    const { data } = await getClient().get<TaskDto[]>('/tasks', { params: { filter } });

    return data;
}

/** Create a new task. */
export async function createTask(dto: CreateTaskDto): Promise<TaskDto> {
    const { data } = await getClient().post<TaskDto>('/tasks', dto);

    return data;
}

/** Update an existing task. */
export async function updateTask(id: string, dto: UpdateTaskDto): Promise<TaskDto> {
    const { data } = await getClient().patch<TaskDto>(`/tasks/${id}`, dto);

    return data;
}

/** Delete a task permanently. */
export async function deleteTask(id: string): Promise<void> {
    await getClient().delete(`/tasks/${id}`);
}

/** Set (or clear) a fuzzy deadline on a task. */
export async function setFuzzyDeadline(id: string, dto: SetFuzzyDeadlineDto): Promise<TaskDto> {
    const { data } = await getClient().patch<TaskDto>(`/tasks/${id}/fuzzy-deadline`, dto);

    return data;
}
```

- [ ] **Step 8: Create `src/connectors.ts`**

Create `packages/api-client/src/connectors.ts`:

```typescript
import { getClient } from './client.js';
import type { ConnectorStatusDto } from './types.js';

/** List all connectors and their connection status. */
export async function listConnectors(): Promise<ConnectorStatusDto[]> {
    const { data } = await getClient().get<ConnectorStatusDto[]>('/connectors');

    return data;
}

/** Get the OAuth authorisation URL for a connector source. */
export async function getConnectorAuthUrl(source: string): Promise<string> {
    const { data } = await getClient().get<{ url: string }>(`/connectors/${source}/auth`);

    return data.url;
}

/** Disconnect (delete) a connector. */
export async function disconnectConnector(source: string): Promise<void> {
    await getClient().delete(`/connectors/${source}`);
}
```

- [ ] **Step 9: Create `src/users.ts`**

Create `packages/api-client/src/users.ts`:

```typescript
import { getClient } from './client.js';
import type { UserDto, UpdateUserDto } from './types.js';

/** Get the current user's profile. */
export async function getMe(): Promise<UserDto> {
    const { data } = await getClient().get<UserDto>('/users/me');

    return data;
}

/** Update email and/or password. */
export async function updateMe(dto: UpdateUserDto): Promise<UserDto> {
    const { data } = await getClient().patch<UserDto>('/users/me', dto);

    return data;
}

/** Permanently delete the current user's account. */
export async function deleteMe(): Promise<void> {
    await getClient().delete('/users/me');
}
```

- [ ] **Step 10: Create `src/index.ts`**

Create `packages/api-client/src/index.ts`:

```typescript
export { initClient, getClient } from './client.js';
export { login, register, refresh } from './auth.js';
export { listTasks, createTask, updateTask, deleteTask, setFuzzyDeadline } from './tasks.js';
export { listConnectors, getConnectorAuthUrl, disconnectConnector } from './connectors.js';
export { getMe, updateMe, deleteMe } from './users.js';
export type {
    UserDto,
    TaskDto,
    CreateTaskDto,
    UpdateTaskDto,
    SetFuzzyDeadlineDto,
    ConnectorStatusDto,
    UpdateUserDto,
    TokenPair,
    TaskFilter,
} from './types.js';
```

- [ ] **Step 11: Write tests for auth functions**

Create `packages/api-client/src/auth.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { login, register } from './auth.js';
import { initClient } from './client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('auth', () => {
    const mockInstance = {
        post: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
        defaults: { headers: { common: {} } },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
        initClient('http://localhost:3000');
    });

    describe('login', () => {
        it('posts credentials and returns token pair', async () => {
            const payload = {
                accessToken: 'acc',
                refreshToken: 'ref',
                user: { id: '1', email: 'a@b.com' },
            };

            mockInstance.post.mockResolvedValueOnce({ data: payload });

            const result = await login('a@b.com', 'pass');

            expect(mockInstance.post).toHaveBeenCalledWith('/auth/login', {
                email: 'a@b.com',
                password: 'pass',
            });
            expect(result).toEqual(payload);
        });
    });

    describe('register', () => {
        it('posts registration data and returns token pair', async () => {
            const payload = {
                accessToken: 'acc',
                refreshToken: 'ref',
                user: { id: '2', email: 'b@c.com' },
            };

            mockInstance.post.mockResolvedValueOnce({ data: payload });

            const result = await register('Bob', 'b@c.com', 'pass123');

            expect(mockInstance.post).toHaveBeenCalledWith('/auth/register', {
                name: 'Bob',
                email: 'b@c.com',
                password: 'pass123',
            });
            expect(result).toEqual(payload);
        });
    });
});
```

- [ ] **Step 12: Write tests for tasks functions**

Create `packages/api-client/src/tasks.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { listTasks, createTask, updateTask, deleteTask } from './tasks.js';
import { initClient } from './client.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('tasks', () => {
    const mockInstance = {
        post: vi.fn(),
        get: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
        defaults: { headers: { common: {} } },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockInstance as never);
        initClient('http://localhost:3000');
    });

    it('listTasks calls GET /tasks with filter param', async () => {
        mockInstance.get.mockResolvedValueOnce({ data: [] });

        await listTasks('today');

        expect(mockInstance.get).toHaveBeenCalledWith('/tasks', { params: { filter: 'today' } });
    });

    it('createTask posts to /tasks', async () => {
        const task = {
            id: '1',
            title: 'Test',
            completed: false,
            source: 'local',
            sourceId: 'x',
            createdAt: '',
            updatedAt: '',
        };

        mockInstance.post.mockResolvedValueOnce({ data: task });

        const result = await createTask({ title: 'Test', source: 'local' });

        expect(mockInstance.post).toHaveBeenCalledWith('/tasks', { title: 'Test', source: 'local' });
        expect(result).toEqual(task);
    });

    it('updateTask patches /tasks/:id', async () => {
        const task = {
            id: '1',
            title: 'Updated',
            completed: true,
            source: 'local',
            sourceId: 'x',
            createdAt: '',
            updatedAt: '',
        };

        mockInstance.patch.mockResolvedValueOnce({ data: task });

        const result = await updateTask('1', { completed: true });

        expect(mockInstance.patch).toHaveBeenCalledWith('/tasks/1', { completed: true });
        expect(result).toEqual(task);
    });

    it('deleteTask calls DELETE /tasks/:id', async () => {
        mockInstance.delete.mockResolvedValueOnce({});

        await deleteTask('1');

        expect(mockInstance.delete).toHaveBeenCalledWith('/tasks/1');
    });
});
```

- [ ] **Step 13: Install dependencies and build**

```bash
pnpm install
pnpm --filter @ctm/api-client build
```

Expected: `packages/api-client/dist/` is created with `.js` and `.d.ts` files.

- [ ] **Step 14: Run tests**

```bash
pnpm --filter @ctm/api-client test
```

Expected: all 5 tests pass.

- [ ] **Step 15: Commit**

```bash
git add packages/api-client/
git commit -m "feat(api-client): add typed axios wrapper with auth interceptors"
```

---

### Task 2: `apps/web` scaffold

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test-setup.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/.env`
- Create: `apps/web/.env.example`

**Context:** Tailwind v4 does not use a `tailwind.config.js` — configuration is in CSS via `@import "tailwindcss"` and a `@theme {}` block. The Vite plugin is `@tailwindcss/vite`. React Router v7 is just `react-router` (not `react-router-dom`). This task produces a working dev server showing a placeholder page.

- [ ] **Step 1: Create `package.json`**

Create `apps/web/package.json`:

```json
{
    "name": "@ctm/web",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "scripts": {
        "dev": "vite",
        "build": "tsc && vite build",
        "preview": "vite preview",
        "test": "vitest run",
        "lint": "oxlint src",
        "format": "oxfmt --config ../../oxfmt.json src"
    },
    "dependencies": {
        "@ctm/api-client": "workspace:*",
        "clsx": "^2.1.1",
        "react": "^19.2.6",
        "react-dom": "^19.2.6",
        "react-router": "^7.15.1"
    },
    "devDependencies": {
        "@tailwindcss/vite": "^4.3.0",
        "@testing-library/jest-dom": "^6.6.3",
        "@testing-library/react": "^16.3.0",
        "@testing-library/user-event": "^14.6.1",
        "@types/react": "^19.2.15",
        "@types/react-dom": "^19.2.3",
        "@vitejs/plugin-react": "^6.0.2",
        "jsdom": "^25.0.1",
        "tailwindcss": "^4.3.0",
        "typescript": "^6.0.3",
        "vite": "^8.0.13",
        "vitest": "^3.2.0"
    }
}
```

- [ ] **Step 2: Create `index.html`**

Create `apps/web/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>CTM — Centralised Task Manager</title>
    </head>
    <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
```

- [ ] **Step 3: Create `vite.config.ts`**

Create `apps/web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
    },
});
```

- [ ] **Step 4: Create `tsconfig.json`**

Create `apps/web/tsconfig.json`:

```json
{
    "extends": "@ctm/tsconfig/react.json",
    "include": ["src"]
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

Create `apps/web/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test-setup.ts'],
    },
});
```

- [ ] **Step 6: Create `src/test-setup.ts`**

Create `apps/web/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 7: Create `src/index.css`**

Create `apps/web/src/index.css`:

```css
@import 'tailwindcss';

@theme {
    --color-nb-yellow: #ffde59;
    --color-nb-black: #111111;
    --color-nb-red: #ff3b30;
    --color-nb-green: #34c759;
    --color-nb-grey: #888888;

    --shadow-nb: 3px 3px 0px var(--color-nb-black);
    --shadow-nb-lg: 5px 5px 0px var(--color-nb-black);
}

* {
    box-sizing: border-box;
}

body {
    font-family: 'Arial Black', 'Arial Bold', Gadget, sans-serif;
    background-color: #ffde59;
    margin: 0;
}
```

- [ ] **Step 8: Create `src/App.tsx` (placeholder)**

Create `apps/web/src/App.tsx`:

```typescript
export default function App(): React.JSX.Element {
    return (
        <div className="min-h-screen bg-nb-yellow flex items-center justify-center">
            <div className="bg-white border-4 border-nb-black shadow-nb-lg p-8">
                <h1 className="text-4xl font-black uppercase tracking-tight text-nb-black">CTM</h1>
                <p className="text-nb-black font-bold mt-2">Scaffold OK ✓</p>
            </div>
        </div>
    );
}
```

- [ ] **Step 9: Create `src/main.tsx`**

Create `apps/web/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initClient } from '@ctm/api-client';
import './index.css';
import App from './App.js';

initClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000');

const root = document.getElementById('root');

if (!root) throw new Error('Root element not found');

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
```

- [ ] **Step 10: Create `.env` and `.env.example`**

Create `apps/web/.env`:

```
VITE_API_URL=http://localhost:3000
```

Create `apps/web/.env.example`:

```
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 11: Install and verify**

```bash
pnpm install
pnpm --filter @ctm/web dev
```

Open `http://localhost:5173`. Expected: black-bordered white card with "CTM" and "Scaffold OK ✓" on a yellow background.

- [ ] **Step 12: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold Vite + React 19 + Tailwind v4 app"
```

---

### Task 3: Neobrutalist UI primitives

**Files:**

- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/Input.tsx`
- Create: `apps/web/src/components/ui/Badge.tsx`
- Create: `apps/web/src/components/ui/Checkbox.tsx`
- Create: `apps/web/src/components/ui/Modal.tsx`
- Create: `apps/web/src/components/ui/index.ts`
- Create: `apps/web/src/components/ui/Button.spec.tsx`

**Context:** All components use Tailwind v4 classes only — no inline styles, no raw CSS. The neobrutalism pattern is: thick black borders (`border-2 border-nb-black`), hard drop shadows (`shadow-[3px_3px_0px_#111]`), bold uppercase text, and a hover/active state that removes the shadow and translates the element by 3px (simulating the press). Use `clsx` for conditional classes.

- [ ] **Step 1: Write a failing test for Button**

Create `apps/web/src/components/ui/Button.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
    it('renders children', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        render(<Button onClick={onClick}>Go</Button>);
        await user.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledOnce();
    });

    it('is disabled when disabled prop is true', () => {
        render(<Button disabled>Nope</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
pnpm --filter @ctm/web test
```

Expected: FAIL — `Button` not found.

- [ ] **Step 3: Create `Button.tsx`**

Create `apps/web/src/components/ui/Button.tsx`:

```typescript
import { type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

/** Neobrutalist button. Shifts on hover to simulate a press. */
export function Button({ variant = 'primary', className, children, ...props }: ButtonProps): React.JSX.Element {
    return (
        <button
            className={clsx(
                'inline-flex items-center justify-center gap-2',
                'border-2 border-nb-black font-black uppercase tracking-wide text-sm px-4 py-2',
                'transition-all duration-100 cursor-pointer',
                'hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none',
                'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0',
                variant === 'primary' && 'bg-nb-black text-white shadow-[3px_3px_0px_#111]',
                variant === 'secondary' && 'bg-white text-nb-black shadow-[3px_3px_0px_#111]',
                variant === 'danger' && 'bg-nb-red text-white shadow-[3px_3px_0px_#111]',
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}
```

- [ ] **Step 4: Run the test — expect it to pass**

```bash
pnpm --filter @ctm/web test
```

Expected: 3/3 passing.

- [ ] **Step 5: Create `Input.tsx`**

Create `apps/web/src/components/ui/Input.tsx`:

```typescript
import { type InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

/** Neobrutalist text input with optional label and error message. */
export function Input({ label, error, className, id, ...props }: InputProps): React.JSX.Element {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label htmlFor={inputId} className="font-black uppercase text-xs tracking-wide text-nb-black">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={clsx(
                    'w-full border-2 border-nb-black bg-white font-bold p-2 text-nb-black',
                    'focus:outline-none focus:shadow-[3px_3px_0px_#111]',
                    'placeholder:text-nb-grey placeholder:font-bold',
                    error && 'border-nb-red',
                    className,
                )}
                {...props}
            />
            {error && <p className="text-nb-red font-bold text-xs">{error}</p>}
        </div>
    );
}
```

- [ ] **Step 6: Create `Badge.tsx`**

Create `apps/web/src/components/ui/Badge.tsx`:

```typescript
import clsx from 'clsx';

type BadgeVariant = 'p1' | 'p2' | 'p3' | 'source';

interface BadgeProps {
    variant: BadgeVariant;
    children: React.ReactNode;
}

/** Small neobrutalist badge for priority or source labels. */
export function Badge({ variant, children }: BadgeProps): React.JSX.Element {
    return (
        <span
            className={clsx(
                'inline-block border-2 border-nb-black text-xs font-black uppercase tracking-wide px-1.5 py-0.5',
                variant === 'p1' && 'bg-nb-red text-white',
                variant === 'p2' && 'bg-nb-yellow text-nb-black',
                variant === 'p3' && 'bg-nb-green text-nb-black',
                variant === 'source' && 'bg-white text-nb-black',
            )}
        >
            {children}
        </span>
    );
}
```

- [ ] **Step 7: Create `Checkbox.tsx`**

Create `apps/web/src/components/ui/Checkbox.tsx`:

```typescript
import clsx from 'clsx';

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
}

/** Square neobrutalist checkbox. */
export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps): React.JSX.Element {
    return (
        <button
            role="checkbox"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={clsx(
                'w-5 h-5 border-2 border-nb-black flex-shrink-0',
                'flex items-center justify-center',
                'transition-colors duration-100 cursor-pointer',
                checked ? 'bg-nb-black' : 'bg-white',
                disabled && 'opacity-50 cursor-not-allowed',
            )}
        >
            {checked && (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </button>
    );
}
```

- [ ] **Step 8: Create `Modal.tsx`**

Create `apps/web/src/components/ui/Modal.tsx`:

```typescript
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

/**
 * Portal-based modal. On mobile slides up from the bottom; on desktop is centred.
 * Closes on Escape key or backdrop click.
 */
export function Modal({ open, onClose, title, children }: ModalProps): React.JSX.Element | null {
    useEffect(() => {
        if (!open) return;

        const handler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handler);

        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-nb-black/60"
                onClick={onClose}
                aria-hidden="true"
            />
            {/* Panel */}
            <div
                className={clsx(
                    'relative z-10 w-full md:max-w-md',
                    'bg-white border-t-4 md:border-4 border-nb-black',
                    'md:shadow-[5px_5px_0px_#111]',
                    'p-6',
                )}
                role="dialog"
                aria-modal="true"
            >
                {title && (
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black uppercase tracking-tight text-nb-black">{title}</h2>
                        <button
                            onClick={onClose}
                            className="font-black text-nb-black hover:text-nb-red text-lg leading-none"
                            aria-label="Close"
                        >
                            ✕
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>,
        document.body,
    );
}
```

- [ ] **Step 9: Create barrel `index.ts`**

Create `apps/web/src/components/ui/index.ts`:

```typescript
export { Button } from './Button.js';
export { Input } from './Input.js';
export { Badge } from './Badge.js';
export { Checkbox } from './Checkbox.js';
export { Modal } from './Modal.js';
```

- [ ] **Step 10: Run all tests**

```bash
pnpm --filter @ctm/web test
```

Expected: 3/3 Button tests pass. (Other components have no tests — they are verified visually in Task 5+.)

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat(web): add neobrutalist UI primitives (Button, Input, Badge, Checkbox, Modal)"
```

---

### Task 4: Auth context + login/register pages

**Files:**

- Create: `apps/web/src/auth/AuthContext.tsx`
- Create: `apps/web/src/auth/ProtectedRoute.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/pages/RegisterPage.tsx`
- Create: `apps/web/src/auth/AuthContext.spec.tsx`

**Context:** `AuthContext` is the single source of truth for auth state. It reads from `localStorage` on mount. `login()` calls the api-client, stores tokens, and updates state. `logout()` clears storage and resets state. `ProtectedRoute` is a thin wrapper that redirects to `/login` if `user` is null.

- [ ] **Step 1: Write a failing test for AuthContext**

Create `apps/web/src/auth/AuthContext.spec.tsx`:

```typescript
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.js';

vi.mock('@ctm/api-client', () => ({
    login: vi.fn(),
    initClient: vi.fn(),
}));

import * as apiClient from '@ctm/api-client';

function TestConsumer(): React.JSX.Element {
    const { user, login, logout } = useAuth();

    return (
        <div>
            <span data-testid="user">{user ? user.email : 'none'}</span>
            <button onClick={() => login('a@b.com', 'pass')}>Login</button>
            <button onClick={logout}>Logout</button>
        </div>
    );
}

describe('AuthContext', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('starts with no user when localStorage is empty', () => {
        render(<AuthProvider><TestConsumer /></AuthProvider>);
        expect(screen.getByTestId('user').textContent).toBe('none');
    });

    it('sets user after successful login', async () => {
        const user = userEvent.setup();
        vi.mocked(apiClient.login).mockResolvedValueOnce({
            accessToken: 'acc',
            refreshToken: 'ref',
            user: { id: '1', email: 'a@b.com' },
        });

        render(<AuthProvider><TestConsumer /></AuthProvider>);
        await user.click(screen.getByText('Login'));

        expect(screen.getByTestId('user').textContent).toBe('a@b.com');
        expect(localStorage.getItem('ctm_access_token')).toBe('acc');
    });

    it('clears user after logout', async () => {
        const user = userEvent.setup();
        vi.mocked(apiClient.login).mockResolvedValueOnce({
            accessToken: 'acc',
            refreshToken: 'ref',
            user: { id: '1', email: 'a@b.com' },
        });

        render(<AuthProvider><TestConsumer /></AuthProvider>);
        await user.click(screen.getByText('Login'));
        await user.click(screen.getByText('Logout'));

        expect(screen.getByTestId('user').textContent).toBe('none');
        expect(localStorage.getItem('ctm_access_token')).toBeNull();
    });
});
```

- [ ] **Step 2: Run test — expect it to fail**

```bash
pnpm --filter @ctm/web test
```

Expected: FAIL — `AuthContext` not found.

- [ ] **Step 3: Create `AuthContext.tsx`**

Create `apps/web/src/auth/AuthContext.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { login as apiLogin, register as apiRegister } from '@ctm/api-client';
import type { UserDto } from '@ctm/api-client';

interface AuthContextValue {
    user: UserDto | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Provides auth state. Wrap your router tree with this. */
export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
    const [user, setUser] = useState<UserDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('ctm_user');

        if (stored) {
            try {
                setUser(JSON.parse(stored) as UserDto);
            } catch {
                localStorage.removeItem('ctm_user');
            }
        }

        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string): Promise<void> => {
        const result = await apiLogin(email, password);

        localStorage.setItem('ctm_access_token', result.accessToken);
        localStorage.setItem('ctm_refresh_token', result.refreshToken);
        localStorage.setItem('ctm_user', JSON.stringify(result.user));
        setUser(result.user);
    };

    const logout = (): void => {
        localStorage.removeItem('ctm_access_token');
        localStorage.removeItem('ctm_refresh_token');
        localStorage.removeItem('ctm_user');
        setUser(null);
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        const result = await apiRegister(name, email, password);

        localStorage.setItem('ctm_access_token', result.accessToken);
        localStorage.setItem('ctm_refresh_token', result.refreshToken);
        localStorage.setItem('ctm_user', JSON.stringify(result.user));
        setUser(result.user);
    };

    return <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}

/** Returns auth context. Must be used inside AuthProvider. */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);

    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');

    return ctx;
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
pnpm --filter @ctm/web test
```

Expected: 3 AuthContext tests + 3 Button tests = 6 passing.

- [ ] **Step 5: Create `ProtectedRoute.tsx`**

Create `apps/web/src/auth/ProtectedRoute.tsx`:

```typescript
import { Navigate } from 'react-router';
import { useAuth } from './AuthContext.js';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/** Redirects to /login if user is not authenticated. Shows nothing while loading. */
export function ProtectedRoute({ children }: ProtectedRouteProps): React.JSX.Element | null {
    const { user, isLoading } = useAuth();

    if (isLoading) return null;

    if (!user) return <Navigate to="/login" replace />;

    return <>{children}</>;
}
```

- [ ] **Step 6: Create `LoginPage.tsx`**

Create `apps/web/src/pages/LoginPage.tsx`:

```typescript
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.js';
import { Button } from '../components/ui/index.js';
import { Input } from '../components/ui/index.js';

/** Full-page login form on yellow background. */
export function LoginPage(): React.JSX.Element {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            await navigate('/tasks');
        } catch {
            setError('Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-nb-yellow flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white border-4 border-nb-black shadow-[6px_6px_0px_#111] p-8">
                <h1 className="text-3xl font-black uppercase tracking-tight text-nb-black mb-6">CTM Login</h1>

                {error && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3 mb-4">
                        <p className="text-nb-red font-bold text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                    <Button type="submit" disabled={loading} className="w-full mt-2">
                        {loading ? 'Logging in...' : 'Login'}
                    </Button>
                </form>

                <p className="mt-4 text-center text-sm font-bold text-nb-black">
                    No account?{' '}
                    <Link to="/register" className="underline font-black">
                        Register →
                    </Link>
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 7: Create `RegisterPage.tsx`**

Create `apps/web/src/pages/RegisterPage.tsx`:

```typescript
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.js';
import { Button, Input } from '../components/ui/index.js';

/** Full-page registration form. Auto-logs in on success. */
export function RegisterPage(): React.JSX.Element {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match.');

            return;
        }

        setLoading(true);

        try {
            await register(name, email, password);
            await navigate('/tasks');
        } catch {
            setError('Registration failed. Email may already be taken.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-nb-yellow flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white border-4 border-nb-black shadow-[6px_6px_0px_#111] p-8">
                <h1 className="text-3xl font-black uppercase tracking-tight text-nb-black mb-6">Create Account</h1>

                {error && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3 mb-4">
                        <p className="text-nb-red font-bold text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                    <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
                    <Input label="Confirm Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
                    <Button type="submit" disabled={loading} className="w-full mt-2">
                        {loading ? 'Creating...' : 'Create Account'}
                    </Button>
                </form>

                <p className="mt-4 text-center text-sm font-bold text-nb-black">
                    Have an account?{' '}
                    <Link to="/login" className="underline font-black">
                        Login →
                    </Link>
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 8: Run all tests**

```bash
pnpm --filter @ctm/web test
```

Expected: 6 passing.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/auth/ apps/web/src/pages/LoginPage.tsx apps/web/src/pages/RegisterPage.tsx
git commit -m "feat(web): add AuthContext, ProtectedRoute, login and register pages"
```

---

### Task 5: App shell + routing

**Files:**

- Create: `apps/web/src/components/layout/Sidebar.tsx`
- Create: `apps/web/src/components/layout/BottomTabs.tsx`
- Create: `apps/web/src/components/layout/AppShell.tsx`
- Create: `apps/web/src/pages/NotFoundPage.tsx`
- Modify: `apps/web/src/App.tsx` (add full route tree)
- Modify: `apps/web/src/main.tsx` (wrap with AuthProvider + RouterProvider)

**Context:** The route tree uses React Router v7 `createBrowserRouter`. `AppShell` uses CSS `md:` breakpoint: sidebar visible on ≥768px, hidden on mobile; bottom tabs visible on <768px, hidden on desktop. Active nav link detection uses `useLocation` to compare against the current path prefix.

- [ ] **Step 1: Create `Sidebar.tsx`**

Create `apps/web/src/components/layout/Sidebar.tsx`:

```typescript
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../auth/AuthContext.js';
import { Button } from '../ui/index.js';
import clsx from 'clsx';

const navItems = [
    { label: 'Tasks', path: '/tasks', icon: '☑' },
    { label: 'Settings', path: '/settings', icon: '⚙' },
];

/** Desktop left sidebar. Hidden on mobile via parent's md: class. */
export function Sidebar(): React.JSX.Element {
    const { user, logout } = useAuth();
    const { pathname } = useLocation();

    return (
        <aside className="hidden md:flex flex-col w-36 min-h-screen bg-nb-black border-r-4 border-nb-black flex-shrink-0">
            <div className="p-4 border-b-2 border-white/10">
                <span className="text-nb-yellow font-black text-lg uppercase tracking-tight">CTM</span>
            </div>

            <nav className="flex flex-col gap-1 p-2 flex-1">
                {navItems.map(({ label, path, icon }) => {
                    const active = pathname.startsWith(path);

                    return (
                        <Link
                            key={path}
                            to={path}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-2 font-black text-xs uppercase tracking-wide',
                                'transition-colors duration-100',
                                active
                                    ? 'bg-nb-yellow text-nb-black'
                                    : 'text-white hover:bg-white/10',
                            )}
                        >
                            <span>{icon}</span>
                            {label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-3 border-t-2 border-white/10 flex flex-col gap-2">
                <p className="text-white/50 font-bold text-xs truncate">{user?.email}</p>
                <Button variant="secondary" onClick={logout} className="w-full text-xs py-1">
                    Logout
                </Button>
            </div>
        </aside>
    );
}
```

- [ ] **Step 2: Create `BottomTabs.tsx`**

Create `apps/web/src/components/layout/BottomTabs.tsx`:

```typescript
import { Link, useLocation } from 'react-router';
import clsx from 'clsx';

const tabs = [
    { label: 'Tasks', path: '/tasks', icon: '☑' },
    { label: 'Sources', path: '/settings/sources', icon: '🔌' },
    { label: 'Profile', path: '/settings/profile', icon: '👤' },
];

/** Mobile bottom tab bar. Hidden on desktop via md:hidden. */
export function BottomTabs(): React.JSX.Element {
    const { pathname } = useLocation();

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-nb-black border-t-4 border-nb-black flex z-40">
            {tabs.map(({ label, path, icon }) => {
                const active = pathname.startsWith(path);

                return (
                    <Link
                        key={path}
                        to={path}
                        className={clsx(
                            'flex-1 flex flex-col items-center justify-center gap-0.5 py-2',
                            'font-black text-xs uppercase tracking-wide',
                            'transition-colors duration-100',
                            active ? 'bg-nb-yellow text-nb-black' : 'text-white/70 hover:bg-white/10',
                        )}
                    >
                        <span className="text-base leading-none">{icon}</span>
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
```

- [ ] **Step 3: Create `AppShell.tsx`**

Create `apps/web/src/components/layout/AppShell.tsx`:

```typescript
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar.js';
import { BottomTabs } from './BottomTabs.js';

/** Responsive app layout: sidebar on desktop, bottom tabs on mobile. */
export function AppShell(): React.JSX.Element {
    return (
        <div className="flex min-h-screen bg-nb-yellow">
            <Sidebar />
            <main className="flex-1 pb-16 md:pb-0 overflow-y-auto">
                <Outlet />
            </main>
            <BottomTabs />
        </div>
    );
}
```

- [ ] **Step 4: Create `NotFoundPage.tsx`**

Create `apps/web/src/pages/NotFoundPage.tsx`:

```typescript
import { Link } from 'react-router';
import { Button } from '../components/ui/index.js';

/** 404 page. */
export function NotFoundPage(): React.JSX.Element {
    return (
        <div className="min-h-screen bg-nb-yellow flex items-center justify-center p-4">
            <div className="bg-white border-4 border-nb-black shadow-[6px_6px_0px_#111] p-8 text-center max-w-sm">
                <h1 className="text-6xl font-black text-nb-black mb-2">404</h1>
                <p className="font-black uppercase text-nb-black mb-6">Page not found.</p>
                <Link to="/tasks">
                    <Button>← Back to Tasks</Button>
                </Link>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Rewrite `App.tsx` with full route tree**

Replace `apps/web/src/App.tsx` with:

```typescript
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { AuthProvider } from './auth/AuthContext.js';
import { ProtectedRoute } from './auth/ProtectedRoute.js';
import { AppShell } from './components/layout/AppShell.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { SettingsLayout } from './pages/SettingsLayout.js';
import { SourcesPage } from './pages/SourcesPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    { path: '/register', element: <RegisterPage /> },
    {
        path: '/',
        element: (
            <ProtectedRoute>
                <AppShell />
            </ProtectedRoute>
        ),
        children: [
            { index: true, element: <Navigate to="/tasks" replace /> },
            { path: 'tasks', element: <TasksPage /> },
            {
                path: 'settings',
                element: <SettingsLayout />,
                children: [
                    { index: true, element: <Navigate to="/settings/sources" replace /> },
                    { path: 'sources', element: <SourcesPage /> },
                    { path: 'profile', element: <ProfilePage /> },
                ],
            },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
]);

export default function App(): React.JSX.Element {
    return (
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>
    );
}
```

- [ ] **Step 6: Update `main.tsx` to just render App**

Replace `apps/web/src/main.tsx` with:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initClient } from '@ctm/api-client';
import './index.css';
import App from './App.js';

initClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000');

const root = document.getElementById('root');

if (!root) throw new Error('Root element not found');

createRoot(root).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
```

- [ ] **Step 7: Add placeholder page stubs for pages not yet implemented**

The `App.tsx` references `TasksPage`, `SettingsLayout`, `SourcesPage`, `ProfilePage`. Create stubs so the app compiles:

Create `apps/web/src/pages/TasksPage.tsx`:

```typescript
export function TasksPage(): React.JSX.Element {
    return <div className="p-6"><h1 className="text-2xl font-black uppercase">Tasks</h1><p className="font-bold mt-2">Coming in next task.</p></div>;
}
```

Create `apps/web/src/pages/SettingsLayout.tsx`:

```typescript
import { Outlet, Link, useLocation } from 'react-router';
import clsx from 'clsx';

const tabs = [
    { label: 'Sources', path: '/settings/sources' },
    { label: 'Profile', path: '/settings/profile' },
];

export function SettingsLayout(): React.JSX.Element {
    const { pathname } = useLocation();

    return (
        <div className="p-6">
            <h1 className="text-2xl font-black uppercase text-nb-black mb-4">Settings</h1>
            <div className="hidden md:flex gap-2 mb-6 border-b-2 border-nb-black pb-2">
                {tabs.map(({ label, path }) => (
                    <Link
                        key={path}
                        to={path}
                        className={clsx(
                            'px-4 py-1.5 font-black uppercase text-sm border-2 border-nb-black',
                            pathname === path ? 'bg-nb-black text-white' : 'bg-white text-nb-black',
                        )}
                    >
                        {label}
                    </Link>
                ))}
            </div>
            <Outlet />
        </div>
    );
}
```

Create `apps/web/src/pages/SourcesPage.tsx`:

```typescript
export function SourcesPage(): React.JSX.Element {
    return <div><p className="font-bold">Sources — coming soon.</p></div>;
}
```

Create `apps/web/src/pages/ProfilePage.tsx`:

```typescript
export function ProfilePage(): React.JSX.Element {
    return <div><p className="font-bold">Profile — coming soon.</p></div>;
}
```

- [ ] **Step 8: Install and verify the dev server**

```bash
pnpm install
pnpm --filter @ctm/api-client build
pnpm --filter @ctm/web dev
```

Navigate to `http://localhost:5173`. Expected: redirects to `/login` (unauthenticated). Login and register pages render. After logging in with a running `apps/main`, you reach the tasks stub page with the sidebar visible on desktop.

- [ ] **Step 9: Run tests**

```bash
pnpm --filter @ctm/web test
```

Expected: 6 passing.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add app shell layout, routing, sidebar, and bottom tabs"
```

---

### Task 6: Tasks page

**Files:**

- Create: `apps/web/src/components/tasks/TaskCard.tsx`
- Create: `apps/web/src/components/tasks/TaskFilters.tsx`
- Create: `apps/web/src/components/tasks/AddTaskInline.tsx`
- Create: `apps/web/src/components/tasks/TaskModal.tsx`
- Create: `apps/web/src/components/tasks/TaskList.tsx`
- Create: `apps/web/src/components/tasks/TaskCard.spec.tsx`
- Replace: `apps/web/src/pages/TasksPage.tsx`

**Context:** Tasks are fetched from `GET /tasks?filter=<value>`. Optimistic updates: clicking the checkbox immediately toggles the UI, then calls the API in the background — on error, it reverts. The filter state lives in the URL as a query param `?filter=all` so the page is bookmarkable. The active filter reads from `useSearchParams`.

- [ ] **Step 1: Write a failing test for TaskCard**

Create `apps/web/src/components/tasks/TaskCard.spec.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from './TaskCard.js';
import type { TaskDto } from '@ctm/api-client';

const baseTask: TaskDto = {
    id: '1',
    title: 'Write tests',
    completed: false,
    source: 'todoist',
    sourceId: 'x1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    priority: 1,
};

describe('TaskCard', () => {
    it('renders task title', () => {
        render(<TaskCard task={baseTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('Write tests')).toBeInTheDocument();
    });

    it('shows source badge', () => {
        render(<TaskCard task={baseTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('TODOIST')).toBeInTheDocument();
    });

    it('shows P1 priority badge', () => {
        render(<TaskCard task={baseTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('P1')).toBeInTheDocument();
    });

    it('calls onToggle when checkbox clicked', async () => {
        const user = userEvent.setup();
        const onToggle = vi.fn();

        render(<TaskCard task={baseTask} onToggle={onToggle} onEdit={vi.fn()} />);
        await user.click(screen.getByRole('checkbox'));

        expect(onToggle).toHaveBeenCalledWith('1', true);
    });

    it('renders completed task with strikethrough', () => {
        const completedTask = { ...baseTask, completed: true };

        render(<TaskCard task={completedTask} onToggle={vi.fn()} onEdit={vi.fn()} />);
        expect(screen.getByText('Write tests')).toHaveClass('line-through');
    });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
pnpm --filter @ctm/web test
```

Expected: FAIL — `TaskCard` not found.

- [ ] **Step 3: Create `TaskCard.tsx`**

Create `apps/web/src/components/tasks/TaskCard.tsx`:

```typescript
import clsx from 'clsx';
import { Badge, Checkbox } from '../ui/index.js';
import type { TaskDto } from '@ctm/api-client';

interface TaskCardProps {
    task: TaskDto;
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
}

const priorityVariant = {
    1: 'p1',
    2: 'p2',
    3: 'p3',
    4: 'p3',
} as const;

/** A single task row card in neobrutalist style. */
export function TaskCard({ task, onToggle, onEdit }: TaskCardProps): React.JSX.Element {
    return (
        <div className="bg-white border-2 border-nb-black shadow-[3px_3px_0px_#111] flex items-center gap-3 px-3 py-2.5">
            <Checkbox
                checked={task.completed}
                onChange={(checked) => onToggle(task.id, checked)}
                label={`Toggle ${task.title}`}
            />

            <button
                className="flex-1 text-left min-w-0"
                onClick={() => onEdit(task)}
            >
                <span
                    className={clsx(
                        'font-bold text-sm text-nb-black block truncate',
                        task.completed && 'line-through text-nb-grey',
                    )}
                >
                    {task.title}
                </span>
                {task.dueDate && (
                    <span className="text-nb-grey text-xs font-bold block">
                        {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                )}
            </button>

            <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="source">{task.source.toUpperCase()}</Badge>
                {task.priority && (
                    <Badge variant={priorityVariant[task.priority as 1 | 2 | 3 | 4]}>
                        P{task.priority}
                    </Badge>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm --filter @ctm/web test
```

Expected: 5 TaskCard + 6 previous = 11 passing.

- [ ] **Step 5: Create `TaskFilters.tsx`**

Create `apps/web/src/components/tasks/TaskFilters.tsx`:

```typescript
import clsx from 'clsx';
import type { TaskFilter } from '@ctm/api-client';

const filters: { value: TaskFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'done', label: 'Done' },
];

interface TaskFiltersProps {
    active: TaskFilter;
    onChange: (filter: TaskFilter) => void;
}

/** Pill-button filter row. Active pill has yellow background. */
export function TaskFilters({ active, onChange }: TaskFiltersProps): React.JSX.Element {
    return (
        <div className="flex gap-2 flex-wrap">
            {filters.map(({ value, label }) => (
                <button
                    key={value}
                    onClick={() => onChange(value)}
                    className={clsx(
                        'px-3 py-1 border-2 border-nb-black font-black uppercase text-xs tracking-wide',
                        'transition-colors duration-100',
                        active === value
                            ? 'bg-nb-yellow text-nb-black'
                            : 'bg-white text-nb-black hover:bg-nb-yellow/40',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 6: Create `AddTaskInline.tsx`**

Create `apps/web/src/components/tasks/AddTaskInline.tsx`:

```typescript
import { useState, type FormEvent } from 'react';
import { Button, Input } from '../ui/index.js';
import type { CreateTaskDto } from '@ctm/api-client';

interface AddTaskInlineProps {
    onAdd: (dto: CreateTaskDto) => Promise<void>;
}

/** Expandable inline form for quickly adding a task. */
export function AddTaskInline({ onAdd }: AddTaskInlineProps): React.JSX.Element {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<1 | 2 | 3>(2);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent): Promise<void> => {
        e.preventDefault();

        if (!title.trim()) return;

        setLoading(true);

        try {
            await onAdd({ title: title.trim(), priority, source: 'local' });
            setTitle('');
            setOpen(false);
        } finally {
            setLoading(false);
        }
    };

    if (!open) {
        return (
            <Button variant="danger" onClick={() => setOpen(true)}>
                ＋ Add Task
            </Button>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-nb-black shadow-[3px_3px_0px_#111] p-4 flex flex-col gap-3">
            <Input
                label="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs doing?"
                autoFocus
                required
            />
            <div className="flex items-center gap-2">
                <label className="font-black uppercase text-xs tracking-wide text-nb-black">Priority:</label>
                {([1, 2, 3] as const).map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`border-2 border-nb-black px-2 py-0.5 font-black text-xs ${
                            priority === p ? 'bg-nb-black text-white' : 'bg-white text-nb-black'
                        }`}
                    >
                        P{p}
                    </button>
                ))}
            </div>
            <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                    {loading ? 'Adding...' : 'Add'}
                </Button>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="font-black uppercase text-xs text-nb-black underline"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
```

- [ ] **Step 7: Create `TaskModal.tsx`**

Create `apps/web/src/components/tasks/TaskModal.tsx`:

```typescript
import { useState, useEffect, type FormEvent } from 'react';
import { Modal, Button, Input } from '../ui/index.js';
import type { TaskDto, UpdateTaskDto } from '@ctm/api-client';

interface TaskModalProps {
    task: TaskDto | null;
    open: boolean;
    onClose: () => void;
    onSave: (id: string, dto: UpdateTaskDto) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

/** Modal for editing an existing task's details. */
export function TaskModal({ task, open, onClose, onSave, onDelete }: TaskModalProps): React.JSX.Element | null {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<1 | 2 | 3 | 4>(2);
    const [dueDate, setDueDate] = useState('');
    const [fuzzyDeadline, setFuzzyDeadline] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description ?? '');
            setPriority((task.priority ?? 2) as 1 | 2 | 3 | 4);
            setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
            setFuzzyDeadline(task.fuzzyDeadline ? task.fuzzyDeadline.slice(0, 10) : '');
            setConfirmDelete(false);
        }
    }, [task]);

    if (!task) return null;

    const handleSave = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setLoading(true);

        try {
            await onSave(task.id, {
                title,
                description: description || undefined,
                priority,
                dueDate: dueDate || undefined,
            });

            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!confirmDelete) {
            setConfirmDelete(true);

            return;
        }

        setLoading(true);

        try {
            await onDelete(task.id);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} title="Edit Task">
            <form onSubmit={handleSave} className="flex flex-col gap-4">
                <Input
                    label="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                <Input
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div>
                    <label className="font-black uppercase text-xs tracking-wide text-nb-black block mb-1">
                        Priority
                    </label>
                    <div className="flex gap-2">
                        {([1, 2, 3, 4] as const).map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPriority(p)}
                                className={`border-2 border-nb-black px-3 py-1 font-black text-xs ${
                                    priority === p ? 'bg-nb-black text-white' : 'bg-white text-nb-black'
                                }`}
                            >
                                P{p}
                            </button>
                        ))}
                    </div>
                </div>
                <Input
                    label="Due Date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                />
                <Input
                    label="Fuzzy Deadline"
                    type="date"
                    value={fuzzyDeadline}
                    onChange={(e) => setFuzzyDeadline(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save'}
                    </Button>
                    <button type="button" onClick={onClose} className="font-black uppercase text-xs text-nb-black underline">
                        Cancel
                    </button>
                </div>
            </form>

            <div className="mt-6 pt-4 border-t-2 border-nb-black">
                <Button
                    variant="danger"
                    onClick={handleDelete}
                    disabled={loading}
                    className="w-full"
                >
                    {confirmDelete ? 'Confirm Delete?' : 'Delete Task'}
                </Button>
                {confirmDelete && (
                    <p className="text-xs font-bold text-nb-red mt-1">Click again to confirm permanent deletion.</p>
                )}
            </div>
        </Modal>
    );
}
```

- [ ] **Step 8: Create `TaskList.tsx`**

Create `apps/web/src/components/tasks/TaskList.tsx`:

```typescript
import { TaskCard } from './TaskCard.js';
import type { TaskDto } from '@ctm/api-client';

interface TaskListProps {
    tasks: TaskDto[];
    onToggle: (id: string, completed: boolean) => void;
    onEdit: (task: TaskDto) => void;
}

/** Renders a vertical list of task cards, or an empty state. */
export function TaskList({ tasks, onToggle, onEdit }: TaskListProps): React.JSX.Element {
    if (tasks.length === 0) {
        return (
            <div className="bg-nb-yellow border-2 border-nb-black shadow-[3px_3px_0px_#111] p-6 text-center">
                <p className="font-black uppercase text-nb-black text-lg">No Tasks Here.</p>
                <p className="font-bold text-nb-black/60 text-sm mt-1">Add one above or change the filter.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />
            ))}
        </div>
    );
}
```

- [ ] **Step 9: Replace `TasksPage.tsx` with the full implementation**

Replace `apps/web/src/pages/TasksPage.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { listTasks, createTask, updateTask, deleteTask } from '@ctm/api-client';
import type { TaskDto, TaskFilter, CreateTaskDto, UpdateTaskDto } from '@ctm/api-client';
import { TaskFilters } from '../components/tasks/TaskFilters.js';
import { TaskList } from '../components/tasks/TaskList.js';
import { AddTaskInline } from '../components/tasks/AddTaskInline.js';
import { TaskModal } from '../components/tasks/TaskModal.js';

/** Main task management page. Filter state is stored in the URL (?filter=today). */
export function TasksPage(): React.JSX.Element {
    const [searchParams, setSearchParams] = useSearchParams();
    const filter = (searchParams.get('filter') ?? 'all') as TaskFilter;

    const [tasks, setTasks] = useState<TaskDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editTask, setEditTask] = useState<TaskDto | null>(null);

    const fetchTasks = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError('');

        try {
            const data = await listTasks(filter);

            setTasks(data);
        } catch {
            setError('Failed to load tasks. Is the API running?');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        void fetchTasks();
    }, [fetchTasks]);

    const handleToggle = async (id: string, completed: boolean): Promise<void> => {
        // Optimistic update
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)));

        try {
            await updateTask(id, { completed });
        } catch {
            // Revert on error
            setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
        }
    };

    const handleAdd = async (dto: CreateTaskDto): Promise<void> => {
        const created = await createTask(dto);

        setTasks((prev) => [created, ...prev]);
    };

    const handleSave = async (id: string, dto: UpdateTaskDto): Promise<void> => {
        const updated = await updateTask(id, dto);

        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    };

    const handleDelete = async (id: string): Promise<void> => {
        await deleteTask(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <div className="p-4 md:p-6 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-nb-black">My Tasks</h1>
                    {!loading && (
                        <p className="text-nb-black/60 font-bold text-sm">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <TaskFilters
                    active={filter}
                    onChange={(f) => setSearchParams({ filter: f })}
                />

                <AddTaskInline onAdd={handleAdd} />

                {loading && (
                    <p className="font-bold text-nb-black/60 uppercase text-sm tracking-wide">Loading...</p>
                )}

                {error && (
                    <div className="border-2 border-nb-red bg-nb-red/10 p-3">
                        <p className="text-nb-red font-bold text-sm">{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <TaskList tasks={tasks} onToggle={handleToggle} onEdit={setEditTask} />
                )}
            </div>

            <TaskModal
                task={editTask}
                open={editTask !== null}
                onClose={() => setEditTask(null)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </div>
    );
}
```

- [ ] **Step 10: Run tests**

```bash
pnpm --filter @ctm/web test
```

Expected: 11 passing (5 TaskCard + 3 AuthContext + 3 Button).

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/tasks/ apps/web/src/pages/TasksPage.tsx
git commit -m "feat(web): implement tasks page with add, edit, delete, and filter"
```

---

### Task 7: Sources page

**Files:**

- Create: `apps/web/src/components/sources/SourceCard.tsx`
- Replace: `apps/web/src/pages/SourcesPage.tsx`

**Context:** The sources page displays a card for each supported connector (Todoist, Google Tasks). Connecting a source navigates to the connector OAuth URL returned by `GET /connectors/:source/auth`. After the OAuth callback, the user returns to `/settings/sources` and the page re-fetches. Disconnecting calls `DELETE /connectors/:source`. The connector status comes from `GET /connectors`.

- [ ] **Step 1: Create `SourceCard.tsx`**

Create `apps/web/src/components/sources/SourceCard.tsx`:

```typescript
import clsx from 'clsx';
import { Button } from '../ui/index.js';
import type { ConnectorStatusDto } from '@ctm/api-client';

const CONNECTOR_META: Record<string, { label: string; icon: string }> = {
    todoist: { label: 'Todoist', icon: '🔴' },
    'google-tasks': { label: 'Google Tasks', icon: '🔵' },
};

interface SourceCardProps {
    connector: ConnectorStatusDto;
    onConnect: (source: string) => void;
    onDisconnect: (source: string) => Promise<void>;
}

/** Card showing a single connector's status with connect/disconnect actions. */
export function SourceCard({ connector, onConnect, onDisconnect }: SourceCardProps): React.JSX.Element {
    const meta = CONNECTOR_META[connector.source] ?? { label: connector.source, icon: '🔗' };

    return (
        <div className="bg-white border-2 border-nb-black shadow-[3px_3px_0px_#111] p-4 flex items-center gap-4">
            <span className="text-2xl">{meta.icon}</span>

            <div className="flex-1 min-w-0">
                <p className="font-black text-nb-black uppercase">{meta.label}</p>
                <p
                    className={clsx(
                        'font-bold text-xs uppercase tracking-wide',
                        connector.connected ? 'text-nb-green' : 'text-nb-grey',
                    )}
                >
                    {connector.connected ? '✓ Connected' : 'Not connected'}
                </p>
                {connector.connected && connector.lastSynced && (
                    <p className="text-nb-grey text-xs font-bold">
                        Last synced: {new Date(connector.lastSynced).toLocaleString()}
                    </p>
                )}
            </div>

            {connector.connected ? (
                <Button variant="secondary" onClick={() => void onDisconnect(connector.source)}>
                    Disconnect
                </Button>
            ) : (
                <Button variant="primary" onClick={() => onConnect(connector.source)}>
                    Connect
                </Button>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Replace `SourcesPage.tsx` with full implementation**

Replace `apps/web/src/pages/SourcesPage.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { listConnectors, getConnectorAuthUrl, disconnectConnector } from '@ctm/api-client';
import type { ConnectorStatusDto } from '@ctm/api-client';
import { SourceCard } from '../components/sources/SourceCard.js';

const SUPPORTED_SOURCES = ['todoist', 'google-tasks'];

/** Lists all supported connectors and their connection status. */
export function SourcesPage(): React.JSX.Element {
    const [connectors, setConnectors] = useState<ConnectorStatusDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        void load();
    }, []);

    const load = async (): Promise<void> => {
        setLoading(true);
        setError('');

        try {
            const data = await listConnectors();
            // Ensure all supported sources appear, even if not yet connected
            const withDefaults = SUPPORTED_SOURCES.map(
                (source) => data.find((c) => c.source === source) ?? { source, connected: false },
            );

            setConnectors(withDefaults);
        } catch {
            setError('Failed to load sources.');
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (source: string): Promise<void> => {
        try {
            const url = await getConnectorAuthUrl(source);

            window.location.href = url;
        } catch {
            setError(`Failed to start ${source} OAuth flow.`);
        }
    };

    const handleDisconnect = async (source: string): Promise<void> => {
        await disconnectConnector(source);
        await load();
    };

    return (
        <div>
            <h2 className="text-lg font-black uppercase text-nb-black mb-4">Connected Sources</h2>

            {loading && <p className="font-bold text-nb-black/60 uppercase text-sm">Loading...</p>}

            {error && (
                <div className="border-2 border-nb-red bg-nb-red/10 p-3 mb-4">
                    <p className="text-nb-red font-bold text-sm">{error}</p>
                </div>
            )}

            {!loading && (
                <div className="flex flex-col gap-3">
                    {connectors.map((c) => (
                        <SourceCard
                            key={c.source}
                            connector={c}
                            onConnect={(source) => { void handleConnect(source); }}
                            onDisconnect={handleDisconnect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @ctm/web test
```

Expected: 11 passing (no new tests needed — SourceCard is covered by manual testing via the dev server).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sources/ apps/web/src/pages/SourcesPage.tsx
git commit -m "feat(web): implement sources page with connect/disconnect flow"
```

---

### Task 8: Profile page

**Files:**

- Replace: `apps/web/src/pages/ProfilePage.tsx`

**Context:** The profile page has two forms: update email and change password. They are separate forms so submitting one doesn't require filling the other. Below both forms is a danger zone with account deletion. Deletion requires the user to type their email to confirm before calling `DELETE /users/me`.

- [ ] **Step 1: Replace `ProfilePage.tsx` with full implementation**

Replace `apps/web/src/pages/ProfilePage.tsx`:

```typescript
import { useState, type FormEvent } from 'react';
import { updateMe, deleteMe } from '@ctm/api-client';
import { useAuth } from '../auth/AuthContext.js';
import { Button, Input } from '../components/ui/index.js';

/** Profile settings: update email, change password, delete account. */
export function ProfilePage(): React.JSX.Element {
    const { user, logout } = useAuth();

    const [email, setEmail] = useState(user?.email ?? '');
    const [emailSuccess, setEmailSuccess] = useState('');
    const [emailError, setEmailError] = useState('');
    const [emailLoading, setEmailLoading] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    const [deleteInput, setDeleteInput] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handleEmailSave = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setEmailSuccess('');
        setEmailError('');
        setEmailLoading(true);

        try {
            await updateMe({ email });
            setEmailSuccess('Email updated.');
        } catch {
            setEmailError('Failed to update email.');
        } finally {
            setEmailLoading(false);
        }
    };

    const handlePasswordSave = async (e: FormEvent): Promise<void> => {
        e.preventDefault();
        setPasswordSuccess('');
        setPasswordError('');

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');

            return;
        }

        setPasswordLoading(true);

        try {
            await updateMe({ currentPassword, newPassword });
            setPasswordSuccess('Password updated.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            setPasswordError('Failed to update password. Check your current password.');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (deleteInput !== user?.email) {
            setDeleteError('Email does not match.');

            return;
        }

        setDeleteLoading(true);

        try {
            await deleteMe();
            logout();
        } catch {
            setDeleteError('Failed to delete account.');
            setDeleteLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-md">
            {/* Email */}
            <section className="bg-white border-2 border-nb-black shadow-[3px_3px_0px_#111] p-5">
                <h2 className="font-black uppercase text-nb-black mb-4">Account Details</h2>
                <form onSubmit={handleEmailSave} className="flex flex-col gap-3">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    {emailSuccess && <p className="text-nb-green font-bold text-xs">{emailSuccess}</p>}
                    {emailError && <p className="text-nb-red font-bold text-xs">{emailError}</p>}
                    <Button type="submit" disabled={emailLoading}>
                        {emailLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </form>
            </section>

            {/* Password */}
            <section className="bg-white border-2 border-nb-black shadow-[3px_3px_0px_#111] p-5">
                <h2 className="font-black uppercase text-nb-black mb-4">Change Password</h2>
                <form onSubmit={handlePasswordSave} className="flex flex-col gap-3">
                    <Input
                        label="Current Password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                    <Input
                        label="New Password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                    />
                    {passwordSuccess && <p className="text-nb-green font-bold text-xs">{passwordSuccess}</p>}
                    {passwordError && <p className="text-nb-red font-bold text-xs">{passwordError}</p>}
                    <Button type="submit" disabled={passwordLoading}>
                        {passwordLoading ? 'Saving...' : 'Change Password'}
                    </Button>
                </form>
            </section>

            {/* Danger zone */}
            <section className="border-2 border-nb-red shadow-[3px_3px_0px_#FF3B30] p-5">
                <h2 className="font-black uppercase text-nb-red mb-2">Danger Zone</h2>
                <p className="font-bold text-sm text-nb-black mb-4">
                    Permanently delete your account and all data. This cannot be undone.
                </p>
                <div className="flex flex-col gap-2">
                    <Input
                        label={`Type your email to confirm: ${user?.email}`}
                        type="email"
                        value={deleteInput}
                        onChange={(e) => setDeleteInput(e.target.value)}
                        placeholder={user?.email}
                    />
                    {deleteError && <p className="text-nb-red font-bold text-xs">{deleteError}</p>}
                    <Button
                        variant="danger"
                        onClick={handleDelete}
                        disabled={deleteLoading || deleteInput !== user?.email}
                    >
                        {deleteLoading ? 'Deleting...' : 'Delete Account'}
                    </Button>
                </div>
            </section>
        </div>
    );
}
```

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @ctm/web test && pnpm --filter @ctm/api-client test && pnpm --filter @ctm/main test
```

Expected: all tests pass across the three packages.

- [ ] **Step 3: Build all packages**

```bash
pnpm build
```

Expected: all packages build without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ProfilePage.tsx
git commit -m "feat(web): implement profile page with email, password, and delete account"
```

---

### Final: Integration smoke test

- [ ] **Step 1: Start the stack**

Terminal 1 — API:

```bash
pnpm --filter @ctm/main dev
```

Terminal 2 — Web:

```bash
pnpm --filter @ctm/api-client build && pnpm --filter @ctm/web dev
```

- [ ] **Step 2: Smoke test checklist**

1. Open `http://localhost:5173` → redirects to `/login` ✓
2. Click Register → fill form → account created → redirected to `/tasks` ✓
3. Tasks page loads (empty state "No Tasks Here.") ✓
4. Click "+ Add Task" → add a task → appears in list ✓
5. Click checkbox → task marked complete, title struck through ✓
6. Click task title → edit modal opens → save changes ✓
7. Click delete in modal → two-click confirm → task removed ✓
8. Switch filter to "Done" → completed task shown ✓
9. Navigate to Settings → Sources → both Todoist and Google Tasks cards shown ✓
10. Navigate to Settings → Profile → both forms render, danger zone shown ✓
11. Logout from sidebar → redirected to `/login` ✓
12. On mobile viewport (375px): sidebar hidden, bottom tabs visible ✓

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat(web): complete neobrutalist web app with tasks, sources, and profile"
```
