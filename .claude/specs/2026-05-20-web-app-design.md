# CTM Web App Design Spec

## Goal

A neobrutalist React SPA that provides full task management: viewing and editing tasks aggregated from connected sources, managing source connections, and managing the user's profile. Auth uses OAuth access token + refresh token. The API client lives in a shared monorepo package.

## Architecture

### Tech Stack

| Concern     | Choice                                           |
| ----------- | ------------------------------------------------ |
| Bundler     | Vite 6                                           |
| Framework   | React 19                                         |
| Routing     | React Router v6                                  |
| Styling     | Tailwind CSS v4                                  |
| HTTP client | axios (via `@ctm/api-client`)                    |
| Language    | TypeScript (strict, `moduleResolution: bundler`) |
| Lint/format | oxlint + oxfmt (shared workspace config)         |

### New Package: `@ctm/api-client`

Location: `packages/api-client/`

Responsibilities:

- Axios instance configured with `baseURL` from env var `VITE_API_URL` (default `http://localhost:3000`)
- Auth interceptor: attaches `Authorization: Bearer <access_token>` from `localStorage`
- Refresh interceptor: on 401, calls `POST /auth/refresh` with the stored `refresh_token`; on success stores the new pair and retries the original request; on failure clears storage and redirects to `/login`
- Typed async functions for every API endpoint (see API Surface below)
- Re-uses request/response types from `apps/main` DTOs — imported as type-only to avoid pulling in NestJS at runtime

### `apps/web`

Location: `apps/web/`

```
apps/web/
  src/
    main.tsx              # React root, router
    App.tsx               # Route tree
    auth/
      AuthContext.tsx     # Provides { user, login, logout, isLoading }
      ProtectedRoute.tsx  # Redirects unauthenticated users to /login
    pages/
      LoginPage.tsx
      RegisterPage.tsx
      TasksPage.tsx
      SettingsLayout.tsx  # Shell with sub-nav
      SourcesPage.tsx
      ProfilePage.tsx
      NotFoundPage.tsx
    components/
      layout/
        Sidebar.tsx       # Desktop left nav
        BottomTabs.tsx    # Mobile bottom tab bar
        AppShell.tsx      # Combines Sidebar + BottomTabs, responsive
      tasks/
        TaskList.tsx
        TaskCard.tsx
        TaskFilters.tsx
        TaskModal.tsx     # Create / edit modal
        AddTaskInline.tsx
      sources/
        SourceCard.tsx
      ui/
        Button.tsx        # Neobrutalist button variants
        Input.tsx         # Neobrutalist text input
        Badge.tsx         # Priority / source badges
        Modal.tsx         # Base modal (portal, backdrop)
        Checkbox.tsx      # Square checkbox
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
```

## Design System (Neobrutalism via Tailwind)

### Palette

| Token  | Value     | Use                                                    |
| ------ | --------- | ------------------------------------------------------ |
| Yellow | `#FFDE59` | Primary accent, active states, page background on auth |
| Black  | `#111111` | Borders, shadows, text                                 |
| White  | `#FFFFFF` | Card backgrounds                                       |
| Red    | `#FF3B30` | Danger, P1 priority, destructive actions               |
| Green  | `#34C759` | P3 priority, connected status                          |
| Grey   | `#888888` | Disabled, muted text                                   |

Tailwind v4 CSS variables defined in `tailwind.config.ts`:

```
--color-nb-yellow: #FFDE59
--color-nb-black: #111111
--color-nb-red: #FF3B30
--color-nb-green: #34C759
```

### Component Patterns

**Button (primary):** `bg-nb-black text-white font-black uppercase tracking-wide border-2 border-nb-black shadow-[3px_3px_0px_#111] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all`

**Button (danger):** Same but `bg-nb-red`

**Button (secondary):** `bg-white text-nb-black font-black uppercase border-2 border-nb-black shadow-[3px_3px_0px_#111]`

**Card:** `bg-white border-2 border-nb-black shadow-[3px_3px_0px_#111]`

**Input:** `w-full border-2 border-nb-black font-bold p-2 focus:outline-none focus:shadow-[3px_3px_0px_#111] bg-white`

**Badge (P1):** `bg-nb-red text-white border-2 border-nb-black text-xs font-black uppercase px-2 py-0.5`
**Badge (P2):** `bg-nb-yellow text-nb-black border-2 border-nb-black text-xs font-black uppercase px-2 py-0.5`
**Badge (P3):** `bg-nb-green text-nb-black border-2 border-nb-black text-xs font-black uppercase px-2 py-0.5`

**Typography:** `font-black` (900) for headings and labels, `font-bold` (700) for body, `uppercase tracking-wide` on navigation items and buttons.

## Layout

### Desktop (≥ 768px)

```
┌──────────────┬────────────────────────────────────┐
│  CTM         │                                    │
│  ──────────  │   Page content                     │
│  📋 TASKS    │                                    │
│  ⚙ SETTINGS  │                                    │
│              │                                    │
│  [user@x.com]│                                    │
│  [LOGOUT]    │                                    │
└──────────────┴────────────────────────────────────┘
```

Sidebar: `w-36 min-h-screen bg-nb-black border-r-4 border-nb-black flex flex-col`

Active nav item: `bg-nb-yellow text-nb-black font-black`
Inactive nav item: `text-white font-black hover:bg-white/10`

### Mobile (< 768px)

Full-width content above, fixed bottom tab bar with 3 flat tabs — settings is not a top-level concept on mobile, Sources and Profile are promoted directly:

```
┌────────────────────────────────────┐
│  Page content                      │
│                                    │
├──────────┬──────────┬──────────────┤
│ 📋 TASKS │ 🔌 SOURCES│  👤 PROFILE  │
└──────────┴──────────┴──────────────┘
```

Tab bar: `fixed bottom-0 left-0 right-0 bg-nb-black border-t-4 border-nb-black flex`

Active tab: `bg-nb-yellow text-nb-black`

### Settings Sub-nav (desktop only)

Horizontal tab row below the page heading: Sources · Profile

## Pages

### Login (`/login`)

- Centred single-column card on `bg-nb-yellow` full-page background
- Card: `bg-white border-4 border-nb-black shadow-[6px_6px_0px_#111] p-8 w-full max-w-sm`
- Fields: Email, Password
- Submit: "LOGIN" primary button (full width)
- Link below: "No account? REGISTER →"
- On success: store `{ access_token, refresh_token, user }` in localStorage, navigate to `/tasks`
- On error: show inline error message in a red bordered box

### Register (`/register`)

Same layout as Login. Fields: Name, Email, Password, Confirm Password.
Submit: "CREATE ACCOUNT". Link: "Have an account? LOGIN →"
On success: auto-login (store tokens) and navigate to `/tasks`.

### Task List (`/tasks`)

**Header row:** Page title "MY TASKS" + task count badge + "＋ ADD TASK" red button (right-aligned).

**Filter row:** Pill buttons — ALL · TODAY · UPCOMING · DONE. Active pill: `bg-nb-yellow border-2 border-nb-black font-black`. Each filter maps to a query param sent to `GET /tasks`.

**Add task form (inline, toggled by the button):**

- Appears above the task list when open, dismissed on submit or Escape
- Fields: Title (required), Priority (select: P1/P2/P3), Due Date (date picker)
- "ADD" button + "CANCEL" link

**Task Card:**

```
┌─────────────────────────────────────────────────┐
│ □  Finish Q3 report              TODOIST  [P1]  │
│    Due: today                                   │
└─────────────────────────────────────────────────┘
```

- Checkbox click: calls `PATCH /tasks/:id` with `{ completed: true/false }`; optimistic update, rollback on error
- Title click: opens TaskModal in edit mode
- Completed tasks: checkbox filled black, title `line-through text-gray-400`

**TaskModal (create / edit):**

- Mobile: slides up from bottom (`translate-y` transition)
- Desktop: centred overlay with backdrop
- Fields: Title, Description (textarea), Priority, Due Date, Fuzzy Deadline (date)
- "SAVE" primary button, "DELETE" danger button (edit mode only), "CANCEL" link
- Delete asks for confirmation via a `window.confirm` (or inline toggle — simple is fine)

**Empty state:** When no tasks match the filter, show a yellow card with bold message: "NO TASKS HERE." + subtext.

### Sources (`/settings/sources`)

Grid of connector cards (one per supported source: Todoist, Google Tasks).

**Connector Card:**

```
┌───────────────────────────────┐
│  🔴 TODOIST          [CONNECT]│
│  Not connected                │
└───────────────────────────────┘
```

Connected state:

```
┌─────────────────────────────────────┐
│  🔴 TODOIST            [DISCONNECT] │
│  ✓ CONNECTED                        │
└─────────────────────────────────────┘
```

- "CONNECT" button: navigates to `GET /connectors/:source/auth` which redirects to the provider OAuth flow
- After OAuth callback, the page reloads and the card shows connected
- "DISCONNECT" button: calls `DELETE /connectors/:source`, updates card optimistically

### Profile (`/settings/profile`)

Two sections:

**Account details:**

- Email field (editable), "SAVE" button → `PATCH /users/me`

**Change password:**

- Current password, New password, Confirm new password
- "CHANGE PASSWORD" button → `PATCH /users/me` with password fields

**Danger zone** (red-bordered section at the bottom):

- "DELETE ACCOUNT" button → shows inline confirmation: type email to confirm → `DELETE /users/me` → clears storage, redirect to `/login`

## Auth Flow

### Token Storage

`localStorage` keys:

- `ctm_access_token` — short-lived JWT (target: 15 minutes, currently 7 days — see backend dependency)
- `ctm_refresh_token` — long-lived token
- `ctm_user` — JSON string `{ id, email, name }`

### Axios Interceptors (in `@ctm/api-client`)

**Request interceptor:** Reads `ctm_access_token` from localStorage, sets `Authorization` header.

**Response interceptor:**

1. On 401: check if a refresh is already in progress (flag to prevent loops)
2. Call `POST /auth/refresh` with `{ refresh_token }`
3. On success: store new tokens, retry original request
4. On failure: clear all `ctm_*` keys from localStorage, `window.location.href = '/login'`

### `AuthContext`

Wraps the app. Provides:

- `user: { id, email, name } | null`
- `isLoading: boolean` (true during initial token check)
- `login(email, password): Promise<void>`
- `logout(): void`

`ProtectedRoute` renders `<Navigate to="/login" />` when `user` is null and `isLoading` is false.

## API Surface (`@ctm/api-client`)

```typescript
// Auth
login(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: UserDto }>
register(name: string, email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: UserDto }>
refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }>

// Tasks
listTasks(filter?: { status?: 'all'|'today'|'upcoming'|'done' }): Promise<TaskDto[]>
createTask(dto: CreateTaskDto): Promise<TaskDto>
updateTask(id: string, dto: UpdateTaskDto): Promise<TaskDto>
deleteTask(id: string): Promise<void>
setFuzzyDeadline(id: string, dto: SetFuzzyDeadlineDto): Promise<TaskDto>

// Connectors
listConnectors(): Promise<ConnectorStatusDto[]>
getConnectorAuthUrl(source: string): Promise<{ url: string }>
disconnectConnector(source: string): Promise<void>

// Users
getMe(): Promise<UserDto>
updateMe(dto: UpdateUserDto): Promise<UserDto>
deleteMe(): Promise<void>
```

Types (`CreateTaskDto`, `UpdateTaskDto`, etc.) are imported from `apps/main` as type-only imports.

## Backend Dependencies

The following additions are needed in `apps/main` before the web app can be fully functional:

1. **`POST /auth/refresh`** — accepts `{ refresh_token }`, returns `{ access_token, refresh_token }`. Requires issuing a refresh token on login (currently only access token is issued).
2. **`DELETE /users/me`** — delete the authenticated user's account.
3. **`GET /connectors/:source/auth`** — returns (or redirects to) the OAuth URL for the given source. (May already exist as part of the connector OAuth flow.)

## Responsive Breakpoint

Single breakpoint at `md` (768px):

- `< 768px`: bottom tabs, no sidebar
- `≥ 768px`: sidebar, no bottom tabs

Implemented via Tailwind `md:` prefix throughout. No JS-based breakpoint detection.

## Environment Variables

`apps/web/.env`:

```
VITE_API_URL=http://localhost:3000
```

`apps/web/.env.example`:

```
VITE_API_URL=http://localhost:3000
```
