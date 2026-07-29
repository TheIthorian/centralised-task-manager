# Quiet Slate Redesign, Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the visual layer to Quiet Slate inside `packages/ui`, give that package tests and a Storybook, and ship the three new capabilities the design calls for: saved filter views, a command palette, and a server-truth write model.

**Architecture:** `packages/ui` owns tokens, primitives and presentational composites. `apps/web` owns routing, queries, URL state and side effects. A new `apps/storybook` renders the package in both themes so components are built and judged before wiring. Tokens land as Tailwind v4 `@theme` custom properties in `packages/ui/src/styles/tokens.css`, imported by both consumers.

**Tech Stack:** React 19, TypeScript 6 (strict, `moduleResolution: bundler`), Tailwind CSS v4 via `@tailwindcss/vite`, TanStack Query 5, vitest 4 + jsdom + Testing Library, Storybook (`@storybook/react-vite`), pnpm workspaces + Turborepo.

Spec: `.claude/specs/2026-07-29-ui-redesign-quiet-slate-design.md`
Visual reference: https://claude.ai/code/artifact/fad267df-da0d-4616-8e6c-68d461aa7df2

## Global Constraints

- Never use `any`, in source or tests. No `eslint-disable` for it. Where a cast is unavoidable use `as unknown as X`.
- Prefer `type` over `interface`. `interface` only when a class implements it.
- Every function and method has an explicit return type annotation. React components return `React.JSX.Element` (or `| null`).
- Functions with two or more parameters take a single object argument.
- JSDoc on every exported component and module-level function. Concise.
- Comments explain why, not how. Blank line before and after log statements, and after a closing scope brace.
- Trailing commas on multi-line objects, arrays and parameter lists. 4-space indent, single quotes, matching the existing files.
- Never `throw new Error(...)`. Use typed errors from `@ctm/errors`.
- Dependencies are pinned to exact versions. After any `pnpm add`, strip the `^` from the entries it wrote.
- Conventional Commits: `<type>(<scope>): <description>`, scopes used here are `ui`, `web`, `storybook`, `docs`.
- Tests are co-located: `src/Name.spec.tsx` next to `src/Name.tsx`.
- Tests must not assert Tailwind class strings, DOM snapshots, or colour values. Assert roles, accessible names, ARIA state, keyboard behaviour and callback contracts.
- Every new component in `packages/ui` ships `Name.tsx`, `Name.spec.tsx` and `Name.stories.tsx`.
- No `outline: none` anywhere. Focus is a 2px accent ring.
- Motion uses only `--duration-press` (120ms), `--duration-surface` (180ms), `--duration-leave` (240ms), and is dropped under `prefers-reduced-motion`.
- Do not delete the `nb-*` tokens until Task 13. Both palettes coexist during the migration.
- All user-visible text in `apps/web` comes from `t('key')`. No string literals in JSX, and no
  literals passed as copy props to `@ctm/ui`. New keys go in `apps/web/src/i18n/en.json`.
- `packages/ui` never imports i18next. Components receive copy as props.
- Accessibility floor for every component: real interactive elements (no click handlers on
  `div`), a visible 2px accent focus ring, `aria-label` on icon-only controls,
  `aria-hidden="true"` on decorative marks, correct ARIA state (`aria-pressed`,
  `aria-checked`, `aria-current`, `aria-selected`, `aria-disabled`), `aria-live="polite"` on
  counts and status that change asynchronously, 44px minimum touch targets below 768px.
- Every `@ctm/ui` spec ends with an axe assertion: `expect(await axe(container)).toHaveNoViolations()`.

---

### Task 1: Test harness for `packages/ui`

**Files:**

- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/test-setup.ts`
- Create: `packages/ui/src/Button.spec.tsx`
- Modify: `packages/ui/package.json`

**Interfaces:**

- Consumes: nothing.
- Produces: `pnpm --filter @ctm/ui test` runs vitest in jsdom with `@testing-library/jest-dom` matchers loaded. Every later task relies on this.

- [ ] **Step 1: Add the dev dependencies, pinned to the same versions `apps/web` uses**

```bash
pnpm --filter @ctm/ui add -D vitest@4.1.10 jsdom@29.1.1 @testing-library/react@16.3.2 @testing-library/jest-dom@7.0.0 @testing-library/user-event@14.6.1 @vitejs/plugin-react@6.0.4
```

Then open `packages/ui/package.json` and remove any `^` that pnpm added, including on the pre-existing `clsx`, `react` and `react-dom` devDependencies (leave the `peerDependencies` ranges alone, those are deliberate).

- [ ] **Step 2: Add the test script**

In `packages/ui/package.json`, add to `scripts` (the package has no `scripts` block yet, create it above `devDependencies`):

```json
"scripts": {
    "test": "vitest run",
    "lint": "oxlint .",
    "format": "oxfmt --config ../../.oxfmtrc.json . '**/*.md'"
}
```

- [ ] **Step 3: Write the vitest config**

`packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

Tailwind is deliberately absent: these tests never assert styling, so compiling CSS would only slow them down.

- [ ] **Step 4: Write the setup file**

`packages/ui/src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Write the failing test**

`packages/ui/src/Button.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders its label as an accessible button", () => {
    render(<Button>Save view</Button>);

    expect(
      screen.getByRole("button", { name: "Save view" }),
    ).toBeInTheDocument();
  });

  it("calls onClick once per click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Sync now</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Sync now" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disconnect
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @ctm/ui test`
Expected: 3 passing. If the run fails with "jsdom environment not found", the dependency install in Step 1 did not complete.

- [ ] **Step 7: Confirm the workspace runner picks it up**

Run: `pnpm test`
Expected: Turbo reports a `@ctm/ui#test` task alongside the existing ones. No change to `turbo.json` is needed, the `test` task already matches any package with that script.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/package.json packages/ui/vitest.config.ts packages/ui/src/test-setup.ts packages/ui/src/Button.spec.tsx pnpm-lock.yaml
git commit -m "test(ui): add vitest harness to the ui package"
```

---

### Task 2: Quiet Slate tokens

**Files:**

- Create: `packages/ui/src/styles/tokens.css`
- Modify: `apps/web/src/index.css:1-16`

**Interfaces:**

- Produces: Tailwind utility names available to every later task: `bg-bg`, `bg-panel`, `text-fg`, `text-muted`, `border-line`, `border-hair`, `bg-accent`, `text-accent`, `text-accent-fg`, `text-warn`, `bg-warn-bg`, `bg-nav-bg`, `text-nav-fg`, `bg-nav-on-bg`, `text-nav-on-fg`, `rounded-ctm`, `shadow-overlay`, `duration-press`, `duration-surface`, `duration-leave`.

- [ ] **Step 1: Write the token file**

`packages/ui/src/styles/tokens.css`:

```css
/*
 * Quiet Slate. Green-biased neutrals so the greys read as chosen rather than inherited,
 * one pine accent, hairline borders, and no offset shadows. The only shadow in the system
 * is for overlays, which sit above blurred content and have to detach from it.
 */
@theme {
  --color-bg: #fbfbfa;
  --color-panel: #ffffff;
  --color-fg: #1c1f1e;
  --color-muted: #7b817e;
  --color-line: #e2e4e1;
  --color-hair: #eceeeb;
  --color-accent: #2f5d50;
  --color-accent-fg: #ffffff;
  --color-warn: #a2442f;
  --color-warn-bg: #faeeeb;
  --color-nav-bg: #f1f2f0;
  --color-nav-fg: #5c625f;
  --color-nav-on-bg: #e2e7e4;
  --color-nav-on-fg: #1c1f1e;

  --radius-ctm: 8px;
  --radius-overlay: 12px;
  --shadow-overlay: 0 18px 40px rgb(0 0 0 / 0.22);

  --duration-press: 120ms;
  --duration-surface: 180ms;
  --duration-leave: 240ms;
}

/*
 * Dark keeps the same hue family; only colour moves. The accent lifts to a paler pine
 * because the light accent is unreadable on the dark ground.
 */
:where(.dark) {
  --color-bg: #121614;
  --color-panel: #191e1b;
  --color-fg: #e4e8e5;
  --color-muted: #8b938e;
  --color-line: #262c29;
  --color-hair: #1f2522;
  --color-accent: #7fbfa9;
  --color-accent-fg: #0f1412;
  --color-warn: #e8917a;
  --color-warn-bg: #2a1c19;
  --color-nav-bg: #0d100f;
  --color-nav-fg: #8b938e;
  --color-nav-on-bg: #1f2724;
  --color-nav-on-fg: #e4e8e5;
}

/* Row density is a user setting; mobile pins rows to 44px whatever it says. */
:root {
  --ctm-row-y: 10px;
}

:root[data-density="compact"] {
  --ctm-row-y: 6px;
}

:root[data-density="spacious"] {
  --ctm-row-y: 16px;
}
```

- [ ] **Step 2: Import it from the web app**

In `apps/web/src/index.css`, directly under the existing `@import 'tailwindcss';` and `@source` lines, add:

```css
@import "../../../packages/ui/src/styles/tokens.css";
```

Leave the existing `@theme` block with the `nb-*` tokens in place. Both palettes coexist until Task 13.

- [ ] **Step 3: Prove the tokens compile**

Run: `pnpm --filter @ctm/web build`
Expected: build succeeds. Then temporarily add `<div className="bg-panel text-fg rounded-ctm shadow-overlay">probe</div>` to `apps/web/src/pages/TasksPage.tsx`, run `pnpm --filter @ctm/web dev`, confirm in the browser that the element has a white ground, dark text and a soft shadow, then remove the probe. Kill the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/styles/tokens.css apps/web/src/index.css
git commit -m "feat(ui): add Quiet Slate design tokens"
```

---

### Task 2b: Translation catalogue

**Files:**
- Create: `apps/web/src/i18n/en.json`
- Create: `apps/web/src/i18n/index.ts`
- Create: `apps/web/src/i18n/i18next.d.ts`
- Create: `apps/web/src/i18n/i18n.spec.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/test-setup.ts`

**Interfaces:**
- Produces: `useTranslation()` from `react-i18next` with typed keys. Every later task that
  adds copy to `apps/web` adds its keys to `en.json` and reads them through `t()`.

- [ ] **Step 1: Install, pinned**

```bash
pnpm --filter @ctm/web add i18next react-i18next
```

Strip the `^` from both entries afterwards.

- [ ] **Step 2: Write the catalogue**

`apps/web/src/i18n/en.json`, seeded with the keys phase 1 needs. Keys are namespaced by
surface and named for meaning:

```json
{
    "common": {
        "cancel": "Cancel",
        "save": "Save",
        "undo": "Undo",
        "syncNow": "Sync now",
        "reconnect": "Reconnect",
        "skipToContent": "Skip to content"
    },
    "tasks": {
        "title": "Tasks",
        "openCount_one": "{{count}} open",
        "openCount_other": "{{count}} open",
        "syncedAgo": "synced {{ago}}",
        "newTask": "New task",
        "searchOrRun": "Search or run",
        "shownCount": "{{count}} shown",
        "groups": {
            "overdue": "Overdue",
            "today": "Today",
            "thisWeek": "This week",
            "upcoming": "Upcoming",
            "noDate": "No date"
        },
        "empty": {
            "overdue": "Nothing overdue. Everything with a due date is still ahead of you.",
            "today": "Nothing due today.",
            "thisWeek": "Nothing due this week.",
            "upcoming": "Nothing scheduled beyond this week.",
            "noDate": "Every task has a date."
        },
        "filters": {
            "none": "No conditions, showing everything.",
            "saveAsView": "Save as view",
            "remove": "Remove {{kind}} {{value}}",
            "due": { "overdue": "Overdue", "today": "Due today", "week": "This week", "none": "No date" },
            "field": { "noDate": "No due date", "noDuration": "No duration", "hasReminder": "Has a reminder" }
        },
        "priority": "Priority {{level}}",
        "completedToast": "Task completed",
        "reopenedToast": "Task reopened"
    },
    "palette": {
        "label": "Command palette",
        "placeholder": "Search tasks, jump, or run a command",
        "noMatch": "Nothing matches. Press Enter to hand it to your agent instead.",
        "groups": {
            "jump": "Jump to",
            "views": "Views",
            "task": "Tasks",
            "acct": "Accounts",
            "do": "Actions",
            "ask": "Ask"
        },
        "hints": { "move": "move", "run": "run", "close": "close", "prefixes": "> actions · # views · @ accounts" },
        "askAgent": "Ask your agent",
        "handedToAgent": "Handed to your agent"
    },
    "settings": {
        "appearance": {
            "title": "Appearance",
            "theme": "Theme",
            "density": "Density",
            "densityHelp": "How much breathing room each row gets. Touch targets stay the same size on a phone.",
            "compact": "Compact",
            "comfortable": "Comfortable",
            "spacious": "Spacious"
        }
    }
}
```

- [ ] **Step 3: Initialise i18next**

`apps/web/src/i18n/index.ts`:

```ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

/**
 * English only for now. `fallbackLng` is off on purpose: a missing key should be a visible
 * bug during development rather than a key path rendered as if it were copy.
 */
export async function initI18n(): Promise<void> {
    await i18next.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: false,
        defaultNS: 'app',
        resources: { en: { app: en } },
        interpolation: { escapeValue: false },
    });
}
```

`apps/web/src/i18n/i18next.d.ts`:

```ts
import type en from './en.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'app';
        resources: { app: typeof en };
    }
}
```

- [ ] **Step 4: Call it before the app renders**

In `apps/web/src/main.tsx`, `await initI18n()` before `createRoot(...).render(...)`, or
render inside the promise's `then`. The app must never render with an empty catalogue,
because every screen would flash key paths.

Add the same call to `apps/web/src/test-setup.ts` so component tests see real strings:

```ts
import { initI18n } from './i18n/index.js';

await initI18n();
```

- [ ] **Step 5: Write the test**

`apps/web/src/i18n/i18n.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';

function Probe(): React.JSX.Element {
    const { t } = useTranslation();

    return (
        <>
            <span>{t('tasks.title')}</span>
            <span>{t('tasks.shownCount', { count: 6 })}</span>
        </>
    );
}

describe('translations', () => {
    it('resolves keys and interpolates counts', () => {
        render(<Probe />);

        expect(screen.getByText('Tasks')).toBeInTheDocument();
        expect(screen.getByText('6 shown')).toBeInTheDocument();
    });
});
```

- [ ] **Step 6: Run it**

Run: `pnpm --filter @ctm/web test i18n`
Expected: PASS. If the strings come back as `tasks.title`, `initI18n` is not being awaited
in the setup file.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/i18n apps/web/src/main.tsx apps/web/src/test-setup.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add an english translation catalogue"
```

---

### Task 3: Storybook app

**Files:**

- Create: `apps/storybook/package.json`
- Create: `apps/storybook/.storybook/main.ts`
- Create: `apps/storybook/.storybook/preview.ts`
- Create: `apps/storybook/.storybook/preview.css`
- Create: `apps/storybook/tsconfig.json`
- Create: `packages/ui/src/Button.stories.tsx`
- Modify: `packages/ui/package.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: tokens from Task 2.
- Produces: `pnpm --filter @ctm/storybook dev` serves Storybook on port 6006 with a light/dark toolbar toggle. Story files live in `packages/ui/src` and use `Meta` and `StoryObj` from `@storybook/react-vite`.

- [ ] **Step 1: Create the app package**

`apps/storybook/package.json`:

```json
{
  "name": "@ctm/storybook",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "storybook dev -p 6006 --no-open",
    "lint": "oxlint .",
    "format": "oxfmt --config ../../.oxfmtrc.json . '**/*.md'"
  }
}
```

There is deliberately no `build` script. Storybook is a development tool, not a deployment target, so it stays out of the production build graph.

- [ ] **Step 2: Install Storybook and the Vite plugins it needs**

```bash
pnpm --filter @ctm/storybook add -D storybook @storybook/react-vite @vitejs/plugin-react@6.0.4 @tailwindcss/vite@4.3.3 tailwindcss@4.3.3 vite-plugin-svgr@5.2.0 vite@8.1.5 react@19.2.8 react-dom@19.2.8 typescript@6.0.3
pnpm --filter @ctm/storybook add @ctm/ui@workspace:*
```

Then strip every `^` pnpm wrote into `apps/storybook/package.json`, including on `storybook` and `@storybook/react-vite`. Record the resolved versions exactly.

- [ ] **Step 3: Configure Storybook**

`apps/storybook/.storybook/main.ts`:

```ts
import type { StorybookConfig } from "@storybook/react-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// Stories live beside their component in packages/ui, so a component and its examples
// change in the same commit. This app is only the harness.
const config: StorybookConfig = {
  stories: ["../../../packages/ui/src/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), react(), tailwindcss(), svgr()],
  }),
};

export default config;
```

`apps/storybook/.storybook/preview.css`:

```css
@import "tailwindcss";
@source "../../../packages/ui/src";
@import "../../../packages/ui/src/styles/tokens.css";

@custom-variant dark (&:where(.dark, .dark *));

body {
  background: var(--color-bg);
  color: var(--color-fg);
  font-family:
    ui-sans-serif,
    -apple-system,
    "Segoe UI",
    sans-serif;
}
```

`apps/storybook/.storybook/preview.ts`:

```ts
import type { Preview } from "@storybook/react-vite";
import "./preview.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description:
        "Quiet Slate ships two themes; every story is reviewed in both.",
      toolbar: {
        title: "Theme",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [
    (Story, context) => {
      const dark = context.globals["theme"] === "dark";
      document.documentElement.classList.toggle("dark", dark);

      return Story();
    },
  ],
};

export default preview;
```

`apps/storybook/tsconfig.json`:

```json
{
  "extends": "@ctm/tsconfig/react.json",
  "include": [".storybook"]
}
```

- [ ] **Step 4: Let the package hold story files**

`packages/ui` needs the story types, so add the dev dependency there too:

```bash
pnpm --filter @ctm/ui add -D @storybook/react-vite
```

Strip the `^` it writes.

- [ ] **Step 5: Write the first story**

`packages/ui/src/Button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button.js";

const meta = {
  title: "Primitives/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { children: "Sync now" } };
export const Secondary: Story = {
  args: { variant: "secondary", children: "Change what syncs" },
};
export const Danger: Story = {
  args: { variant: "danger", children: "Disconnect" },
};
export const Disabled: Story = {
  args: { disabled: true, children: "Sync now" },
};
```

- [ ] **Step 6: Ignore Storybook's build output**

Append to `.gitignore`:

```
apps/storybook/storybook-static
```

- [ ] **Step 7: Run it**

Run: `pnpm --filter @ctm/storybook dev`
Expected: Storybook serves on http://localhost:6006 with four Button stories under "Primitives/Button", and the Theme toolbar switches the ground between `#fbfbfa` and `#121614`. Kill the server before finishing the task.

- [ ] **Step 8: Commit**

```bash
git add apps/storybook packages/ui/package.json packages/ui/src/Button.stories.tsx .gitignore pnpm-lock.yaml
git commit -m "build(storybook): add a storybook app for the ui package"
```

---

### Task 4: Reskin the existing primitives

**Files:**

- Modify: `packages/ui/src/Button.tsx`
- Modify: `packages/ui/src/Input.tsx`
- Modify: `packages/ui/src/Checkbox.tsx`
- Modify: `packages/ui/src/Badge.tsx`
- Modify: `packages/ui/src/Modal.tsx`
- Create: `packages/ui/src/Input.spec.tsx`, `Checkbox.spec.tsx`, `Badge.spec.tsx`
- Create: `packages/ui/src/Input.stories.tsx`, `Checkbox.stories.tsx`, `Badge.stories.tsx`, `Modal.stories.tsx`

**Interfaces:**

- Produces: `Button` gains a `ghost` variant, so its variant union is `'primary' | 'secondary' | 'ghost' | 'danger'`. `Badge`'s variant union becomes `'priority' | 'source' | 'neutral' | 'warn'` and it takes `{ variant, children }`. Task 8 and Task 9 depend on both.

- [ ] **Step 1: Restyle `Button`**

Replace the `clsx` block in `packages/ui/src/Button.tsx`, and widen the variant type:

```tsx
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
```

```tsx
            className={clsx(
                'inline-flex items-center justify-center gap-2 rounded-ctm',
                'border px-3.5 py-1.5 text-sm font-semibold',
                'transition-colors duration-press cursor-pointer',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                variant === 'primary' && 'border-transparent bg-accent text-accent-fg hover:opacity-90',
                variant === 'secondary' && 'border-line bg-panel text-fg hover:bg-nav-on-bg',
                variant === 'ghost' && 'border-transparent bg-transparent text-muted hover:text-fg',
                variant === 'danger' && 'border-transparent bg-warn text-accent-fg hover:opacity-90',
                className,
            )}
```

- [ ] **Step 2: Restyle `Input`**

Label classes become `text-[11px] uppercase tracking-[0.12em] text-muted`. Input classes become:

```tsx
                className={clsx(
                    'w-full rounded-ctm border border-line bg-panel px-3 py-2 text-sm text-fg',
                    'placeholder:text-muted',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    error && 'border-warn',
                    className,
                )}
```

The error paragraph becomes `text-warn text-xs`.

- [ ] **Step 3: Restyle `Checkbox`**

```tsx
            className={clsx(
                'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px]',
                'transition-colors duration-press cursor-pointer',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                checked ? 'border-accent bg-accent' : 'border-muted bg-panel',
                disabled && 'opacity-50 cursor-not-allowed',
            )}
```

The tick `svg` keeps its geometry and takes `className="text-accent-fg"`.

- [ ] **Step 4: Rewrite `Badge`**

```tsx
type BadgeVariant = "priority" | "source" | "neutral" | "warn";

type BadgeProps = {
  variant: BadgeVariant;
  children: React.ReactNode;
};

/** Small pill for priority, provenance or status. Priority is always named, never a bare number. */
export function Badge({ variant, children }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
        variant === "priority" && "bg-warn-bg text-warn",
        variant === "source" && "bg-nav-on-bg text-muted",
        variant === "neutral" && "bg-nav-on-bg text-muted",
        variant === "warn" && "bg-warn-bg text-warn",
      )}
    >
      {children}
    </span>
  );
}
```

`priority` and `warn` share a ground today. They stay separate variants because they mean different things and will diverge.

- [ ] **Step 5: Restyle `Modal`**

Backdrop becomes `bg-black/35 backdrop-blur-[3px]`. The dialog surface becomes `rounded-ctm border border-line bg-panel shadow-overlay`, dropping every `border-2` and `shadow-[3px_3px_0px_#111]`. Behaviour is untouched.

- [ ] **Step 6: Write the failing tests**

`packages/ui/src/Checkbox.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox.js";

describe("Checkbox", () => {
  it("exposes its checked state to assistive technology", () => {
    render(
      <Checkbox checked onChange={vi.fn()} label="Renew home insurance" />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Renew home insurance" }),
    ).toBeChecked();
  });

  it("reports the toggled value", async () => {
    const onChange = vi.fn();
    render(
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Call the dentist back"
      />,
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Call the dentist back" }),
    );

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

`packages/ui/src/Input.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "./Input.js";

describe("Input", () => {
  it("associates the label with the field", () => {
    render(<Input label="View name" />);

    expect(screen.getByLabelText("View name")).toBeInTheDocument();
  });

  it("shows the error message", () => {
    render(<Input label="View name" error="Give the view a name" />);

    expect(screen.getByText("Give the view a name")).toBeInTheDocument();
  });

  it("accepts typing", async () => {
    render(<Input label="View name" />);

    await userEvent.type(screen.getByLabelText("View name"), "Deep work");

    expect(screen.getByLabelText("View name")).toHaveValue("Deep work");
  });
});
```

`packages/ui/src/Badge.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.js";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge variant="priority">Priority 1</Badge>);

    expect(screen.getByText("Priority 1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @ctm/ui test`
Expected: PASS. If `Badge` still expects `p1`, the rewrite in Step 4 was not applied.

- [ ] **Step 8: Fix the callers the type change breaks**

Run: `pnpm --filter @ctm/web build`
Expected: TypeScript errors in `apps/web/src/components/tasks/TaskCard.tsx` where `priorityVariant` maps to `p1` / `p2` / `p3`. Replace that map with a name lookup:

```tsx
const priorityLabel: Record<number, string> = {
  1: "Priority 1",
  2: "Priority 2",
  3: "Priority 3",
  4: "Priority 4",
};
```

and render `<Badge variant="priority">{priorityLabel[task.priority]}</Badge>`. Fix any other `Badge variant="source"` callers, which keep working unchanged. Re-run the build until clean, then run `pnpm --filter @ctm/web test`.

- [ ] **Step 9: Write the stories**

One story per state, following the `Button.stories.tsx` shape: `Input` (default, with error), `Checkbox` (checked, unchecked, disabled), `Badge` (all four variants), `Modal` (open, with a title and body copy).

- [ ] **Step 10: Review both themes**

Run: `pnpm --filter @ctm/storybook dev`, flip the Theme toolbar, and confirm the accent stays legible on the dark ground and no offset shadow survives. Kill the server.

- [ ] **Step 11: Commit**

```bash
git add packages/ui/src apps/web/src/components/tasks/TaskCard.tsx
git commit -m "feat(ui): reskin the primitives to Quiet Slate"
```

---

### Task 5: Chip, Kbd, StatusPill, OwnershipBadge

**Files:**

- Create: `packages/ui/src/Chip.tsx`, `Chip.spec.tsx`, `Chip.stories.tsx`
- Create: `packages/ui/src/Kbd.tsx`, `Kbd.stories.tsx`
- Create: `packages/ui/src/StatusPill.tsx`, `StatusPill.stories.tsx`
- Create: `packages/ui/src/OwnershipBadge.tsx`, `OwnershipBadge.spec.tsx`, `OwnershipBadge.stories.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Produces:
  - `Chip({ label, selected, onToggle, icon }: { label: string; selected?: boolean; onToggle?: () => void; icon?: React.ReactNode })`
  - `Kbd({ children }: { children: React.ReactNode })`
  - `StatusPill({ status, children }: { status: 'ok' | 'warn' | 'neutral'; children: React.ReactNode })`
  - `OwnershipBadge({ ownership }: { ownership: 'synced' | 'local' | 'read-only' })`
  - Tasks 8, 9, 10 and 11 all consume `Chip`.

- [ ] **Step 1: Write the failing test**

`packages/ui/src/Chip.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Chip } from "./Chip.js";

describe("Chip", () => {
  it("reports its pressed state", () => {
    render(<Chip label="Overdue" selected onToggle={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Overdue" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<Chip label="Today" onToggle={onToggle} />);

    await userEvent.click(screen.getByRole("button", { name: "Today" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders as static text when it has no handler", () => {
    render(<Chip label="6 shown" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("6 shown")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @ctm/ui test Chip`
Expected: FAIL, cannot resolve `./Chip.js`.

- [ ] **Step 3: Implement `Chip`**

```tsx
import clsx from "clsx";

type ChipProps = {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  icon?: React.ReactNode;
};

/** Pill-shaped filter or range toggle. Renders as static text when no handler is given. */
export function Chip({
  label,
  selected = false,
  onToggle,
  icon,
}: ChipProps): React.JSX.Element {
  const shape = clsx(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
    "transition-colors duration-press",
    selected
      ? "border-accent bg-accent text-accent-fg"
      : "border-line bg-panel text-muted",
  );

  if (!onToggle) {
    return (
      <span className={shape}>
        {icon}
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={clsx(
        shape,
        "cursor-pointer hover:border-accent",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @ctm/ui test Chip`
Expected: PASS.

- [ ] **Step 5: Implement `Kbd`**

```tsx
/** A single keycap, for shortcut hints. */
export function Kbd({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <kbd className="rounded-[4px] border border-line bg-nav-on-bg px-1.5 py-0.5 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}
```

- [ ] **Step 6: Implement `StatusPill`**

```tsx
import clsx from "clsx";

type StatusPillProps = {
  status: "ok" | "warn" | "neutral";
  children: React.ReactNode;
};

/** Connector health, encoded in form as well as words so it reads at a glance. */
export function StatusPill({
  status,
  children,
}: StatusPillProps): React.JSX.Element {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px]",
        status === "ok" && "bg-accent/15 text-accent",
        status === "warn" && "bg-warn-bg text-warn",
        status === "neutral" && "bg-nav-on-bg text-muted",
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 7: Implement `OwnershipBadge` with its test**

`packages/ui/src/OwnershipBadge.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OwnershipBadge } from "./OwnershipBadge.js";

describe("OwnershipBadge", () => {
  it("names the ownership in words the user can read", () => {
    render(<OwnershipBadge ownership="read-only" />);

    expect(screen.getByText("read-only")).toBeInTheDocument();
  });
});
```

```tsx
import clsx from "clsx";

type Ownership = "synced" | "local" | "read-only";

/**
 * Says who owns a field: synced writes back to the source, local lives only here because
 * the connector has no such concept, read-only cannot be changed from our side. Without
 * this, editing duration on a Google Tasks item looks broken rather than deliberate.
 */
export function OwnershipBadge({
  ownership,
}: {
  ownership: Ownership;
}): React.JSX.Element {
  return (
    <span
      className={clsx(
        "rounded-[3px] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em]",
        ownership === "synced" && "bg-accent/15 text-accent",
        ownership === "local" && "bg-nav-on-bg text-muted",
        ownership === "read-only" && "border border-line text-muted",
      )}
    >
      {ownership}
    </span>
  );
}
```

- [ ] **Step 8: Export everything**

Add to `packages/ui/src/index.ts`, keeping the existing export style:

```ts
export { Chip } from "./Chip.js";
export { Kbd } from "./Kbd.js";
export { StatusPill } from "./StatusPill.js";
export { OwnershipBadge } from "./OwnershipBadge.js";
```

- [ ] **Step 9: Write the stories**

`Chip` (unselected, selected, with a brand icon, static), `Kbd` (a row reading `⌘` `K`), `StatusPill` (all three), `OwnershipBadge` (all three side by side).

- [ ] **Step 10: Run everything and commit**

Run: `pnpm --filter @ctm/ui test`
Expected: PASS.

```bash
git add packages/ui/src
git commit -m "feat(ui): add chip, keycap, status pill and ownership badge"
```

---

### Task 6: Skeleton, EmptyState, Banner, Toast

**Files:**

- Create: `packages/ui/src/Skeleton.tsx`, `Skeleton.stories.tsx`
- Create: `packages/ui/src/EmptyState.tsx`, `EmptyState.spec.tsx`, `EmptyState.stories.tsx`
- Create: `packages/ui/src/Banner.tsx`, `Banner.spec.tsx`, `Banner.stories.tsx`
- Create: `packages/ui/src/Toast.tsx`, `Toast.spec.tsx`, `Toast.stories.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Produces:
  - `Skeleton({ rows }: { rows?: number })`
  - `EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode })`
  - `Banner({ tone, title, body, action }: { tone: 'warn' | 'info'; title: string; body: string; action?: React.ReactNode })`
  - `Toast({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void })`
  - Task 12 consumes `Toast`.

- [ ] **Step 1: Write the failing tests**

`packages/ui/src/Banner.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner } from "./Banner.js";

describe("Banner", () => {
  it("announces itself as a status region", () => {
    render(
      <Banner
        tone="warn"
        title="Google Tasks needs reconnecting"
        body="Its token expired 2 days ago. Tasks from this account are stale until you sign in again."
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Google Tasks needs reconnecting",
    );
  });
});
```

`packages/ui/src/EmptyState.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("renders the caller-supplied copy", () => {
    render(
      <EmptyState
        title="Nothing overdue"
        body="Everything with a due date is still ahead of you."
      />,
    );

    expect(screen.getByText("Nothing overdue")).toBeInTheDocument();
    expect(
      screen.getByText("Everything with a due date is still ahead of you."),
    ).toBeInTheDocument();
  });
});
```

`packages/ui/src/Toast.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast.js";

describe("Toast", () => {
  it("runs its action", async () => {
    const onAction = vi.fn();
    render(
      <Toast message="Task completed" actionLabel="Undo" onAction={onAction} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter @ctm/ui test`
Expected: FAIL on the three new files, module not found.

- [ ] **Step 3: Implement the four components**

```tsx
/** Placeholder rows shaped like the list they replace, so nothing jumps when data lands. */
export function Skeleton({ rows = 3 }: { rows?: number }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={i}
          className="h-4 rounded-ctm bg-hair"
          style={{ width: `${88 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
```

```tsx
type EmptyStateProps = {
  title: string;
  body: string;
  action?: React.ReactNode;
};

/** Empty copy is written per filter, never shared, so both lines are always passed in. */
export function EmptyState({
  title,
  body,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-ctm border border-line bg-panel px-4 py-5">
      <strong className="text-sm text-fg">{title}</strong>
      <span className="text-xs text-muted">{body}</span>
      {action}
    </div>
  );
}
```

```tsx
import clsx from "clsx";

type BannerProps = {
  tone: "warn" | "info";
  title: string;
  body: string;
  action?: React.ReactNode;
};

/**
 * Inline notice above the affected list. System failures use this rather than a toast,
 * because a toast disappears before it can be acted on.
 */
export function Banner({
  tone,
  title,
  body,
  action,
}: BannerProps): React.JSX.Element {
  return (
    <div
      role="status"
      className={clsx(
        "flex flex-col gap-1 rounded-ctm border px-3.5 py-3",
        tone === "warn" ? "border-warn bg-warn-bg" : "border-line bg-panel",
      )}
    >
      <strong
        className={clsx(
          "text-[13px]",
          tone === "warn" ? "text-warn" : "text-fg",
        )}
      >
        {title}
      </strong>
      <span className="text-xs text-fg">{body}</span>
      {action}
    </div>
  );
}
```

```tsx
type ToastProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Confirms something the user did, with an optional undo. Never used for system failures. */
export function Toast({
  message,
  actionLabel,
  onAction,
}: ToastProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-4 rounded-ctm border border-line bg-panel px-3.5 py-2.5 text-[13px] text-fg shadow-overlay"
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="cursor-pointer text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @ctm/ui test`
Expected: PASS.

- [ ] **Step 5: Export and write stories**

Add the four exports to `index.ts`. Stories: `Skeleton` (3 and 6 rows), `EmptyState` (with and without an action `Button`), `Banner` (both tones), `Toast` (with and without undo).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src
git commit -m "feat(ui): add skeleton, empty state, banner and toast"
```

---

### Task 6b: SegmentedControl and the density setting

**Files:**
- Create: `packages/ui/src/SegmentedControl.tsx`, `SegmentedControl.spec.tsx`, `SegmentedControl.stories.tsx`
- Create: `packages/ui/src/DensityPreview.tsx`, `DensityPreview.stories.tsx`
- Create: `apps/web/src/theme/DensityContext.tsx`, `DensityContext.spec.tsx`
- Create: `apps/web/src/components/settings/AppearanceSection.tsx`, `AppearanceSection.spec.tsx`
- Modify: `packages/ui/src/index.ts`, `apps/web/src/main.tsx`, `apps/web/src/pages/ProfilePage.tsx`

**Interfaces:**
- Produces:

```ts
type Density = 'compact' | 'comfortable' | 'spacious';

// packages/ui
function SegmentedControl<T extends string>(props: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}): React.JSX.Element;

// apps/web
function useDensity(): { density: Density; setDensity: (density: Density) => void };
```

- [ ] **Step 1: Write the failing test for `SegmentedControl`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl.js';

const options = [
    { value: 'compact', label: 'Compact' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'spacious', label: 'Spacious' },
];

describe('SegmentedControl', () => {
    it('is a labelled radio group with the current value checked', () => {
        render(<SegmentedControl label="Density" options={options} value="comfortable" onChange={vi.fn()} />);

        expect(screen.getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Comfortable' })).toBeChecked();
    });

    it('reports the chosen value', async () => {
        const onChange = vi.fn();
        render(<SegmentedControl label="Density" options={options} value="comfortable" onChange={onChange} />);

        await userEvent.click(screen.getByRole('radio', { name: 'Spacious' }));

        expect(onChange).toHaveBeenCalledWith('spacious');
    });

    it('moves between options with the arrow keys', async () => {
        const onChange = vi.fn();
        render(<SegmentedControl label="Density" options={options} value="comfortable" onChange={onChange} />);

        screen.getByRole('radio', { name: 'Comfortable' }).focus();
        await userEvent.keyboard('{ArrowRight}');

        expect(onChange).toHaveBeenCalledWith('spacious');
    });

    it('has no axe violations', async () => {
        const { container } = render(
            <SegmentedControl label="Density" options={options} value="compact" onChange={vi.fn()} />,
        );

        expect(await axe(container)).toHaveNoViolations();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @ctm/ui test SegmentedControl`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `SegmentedControl`**

Native radio inputs inside a `fieldset` give keyboard behaviour, grouping and the
accessible name for free, so the visual strip is styling over real controls rather than a
`div` pretending to be one.

```tsx
import clsx from 'clsx';

type Option<T extends string> = {
    value: T;
    label: string;
};

type SegmentedControlProps<T extends string> = {
    label: string;
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
};

/** Single-select strip built on radio inputs, so arrow keys and grouping come for free. */
export function SegmentedControl<T extends string>({
    label,
    options,
    value,
    onChange,
}: SegmentedControlProps<T>): React.JSX.Element {
    return (
        <fieldset
            role="radiogroup"
            aria-label={label}
            className="inline-flex overflow-hidden rounded-ctm border border-line"
        >
            {options.map((option) => (
                <label
                    key={option.value}
                    className={clsx(
                        'cursor-pointer px-3 py-1.5 text-[11px] border-r border-line last:border-r-0',
                        'transition-colors duration-press',
                        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-accent',
                        option.value === value ? 'bg-accent text-accent-fg' : 'bg-panel text-muted hover:text-fg',
                    )}
                >
                    <input
                        type="radio"
                        name={label}
                        value={option.value}
                        checked={option.value === value}
                        onChange={() => onChange(option.value)}
                        className="sr-only"
                    />
                    {option.label}
                </label>
            ))}
        </fieldset>
    );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @ctm/ui test SegmentedControl`
Expected: PASS, including the arrow-key case, which works because native radios in one
group handle it.

- [ ] **Step 5: Build `DensityPreview`**

Three `TaskRow`-shaped rows with fixed sample copy passed in as props, so Settings can show
what the choice does instead of describing it:

```tsx
type DensityPreviewProps = {
    rows: { title: string; meta: string }[];
};

/** Three sample rows at the current density. The choice is easier to see than to read about. */
export function DensityPreview({ rows }: DensityPreviewProps): React.JSX.Element {
    return (
        <div aria-hidden="true" className="overflow-hidden rounded-ctm border border-line bg-panel">
            {rows.map((row) => (
                <div
                    key={row.title}
                    className="flex items-center justify-between gap-3 border-b border-hair px-3 py-[var(--ctm-row-y)] text-[13px] text-fg last:border-b-0"
                >
                    <span className="truncate">{row.title}</span>
                    <span className="text-[11px] tabular-nums text-muted">{row.meta}</span>
                </div>
            ))}
        </div>
    );
}
```

It is `aria-hidden` because it is a sample, not content: a screen reader user gets the
setting, not three fake tasks.

- [ ] **Step 6: Write the failing test for `useDensity`**

`apps/web/src/theme/DensityContext.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DensityProvider, useDensity } from './DensityContext.js';

function Probe(): React.JSX.Element {
    const { density, setDensity } = useDensity();

    return (
        <>
            <span>{density}</span>
            <button type="button" onClick={() => setDensity('compact')}>
                make it compact
            </button>
        </>
    );
}

function renderProbe(): void {
    render(
        <DensityProvider>
            <Probe />
        </DensityProvider>,
    );
}

describe('useDensity', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-density');
    });

    it('defaults to comfortable', () => {
        renderProbe();

        expect(screen.getByText('comfortable')).toBeInTheDocument();
        expect(document.documentElement).toHaveAttribute('data-density', 'comfortable');
    });

    it('restores the stored preference', () => {
        localStorage.setItem('ctm.density', 'spacious');

        renderProbe();

        expect(document.documentElement).toHaveAttribute('data-density', 'spacious');
    });

    it('ignores a value it does not recognise rather than rendering nothing', () => {
        localStorage.setItem('ctm.density', 'enormous');

        renderProbe();

        expect(screen.getByText('comfortable')).toBeInTheDocument();
    });

    it('persists a change', async () => {
        renderProbe();

        await userEvent.click(screen.getByRole('button', { name: 'make it compact' }));

        expect(localStorage.getItem('ctm.density')).toBe('compact');
        expect(document.documentElement).toHaveAttribute('data-density', 'compact');
    });
});
```

- [ ] **Step 7: Run it and watch it fail**

Run: `pnpm --filter @ctm/web test DensityContext`
Expected: FAIL, module not found.

- [ ] **Step 8: Implement the context**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Density = 'compact' | 'comfortable' | 'spacious';

const STORAGE_KEY = 'ctm.density';
const DENSITIES: Density[] = ['compact', 'comfortable', 'spacious'];

type DensityContextValue = {
    density: Density;
    setDensity: (density: Density) => void;
};

const DensityContext = createContext<DensityContextValue | null>(null);

/**
 * A display preference, so it lives in local storage rather than on the account. An
 * unrecognised stored value falls back to comfortable: bad local state is not a reason to
 * fail a render.
 */
function readStored(): Density {
    const stored = localStorage.getItem(STORAGE_KEY);
    const match = DENSITIES.find((d) => d === stored);

    return match ?? 'comfortable';
}

/** Provides the row density and mirrors it onto the document element as `data-density`. */
export function DensityProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
    const [density, setDensityState] = useState<Density>(readStored);

    useEffect(() => {
        document.documentElement.dataset['density'] = density;
    }, [density]);

    const setDensity = useCallback((next: Density): void => {
        localStorage.setItem(STORAGE_KEY, next);
        setDensityState(next);
    }, []);

    const value = useMemo(() => ({ density, setDensity }), [density, setDensity]);

    return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

/** Reads the current density. Throws if used outside the provider, which is a wiring bug. */
export function useDensity(): DensityContextValue {
    const value = useContext(DensityContext);

    if (!value) throw new ConfigurationError('useDensity must be used inside DensityProvider');

    return value;
}
```

Import `ConfigurationError` from `@ctm/errors`. If that class does not exist, use the
closest existing subclass rather than `new Error`, per the repo's error rule.

- [ ] **Step 9: Build the Appearance section**

`apps/web/src/components/settings/AppearanceSection.tsx` renders the theme control that
already exists plus:

```tsx
<SegmentedControl
    label={t('settings.appearance.density')}
    value={density}
    onChange={setDensity}
    options={[
        { value: 'compact', label: t('settings.appearance.compact') },
        { value: 'comfortable', label: t('settings.appearance.comfortable') },
        { value: 'spacious', label: t('settings.appearance.spacious') },
    ]}
/>
```

with `t('settings.appearance.densityHelp')` under it and a `DensityPreview` fed three
sample rows. Its spec asserts that clicking Spacious sets `data-density` on the document
element, which is the only user-visible effect worth testing here.

- [ ] **Step 10: Mount the provider**

Wrap the app in `DensityProvider` in `apps/web/src/main.tsx`, next to the existing theme
provider. Add the section to `ProfilePage.tsx` (or wherever the theme control currently
lives) so the two display preferences sit together.

- [ ] **Step 11: Verify**

Run: `pnpm --filter @ctm/ui test && pnpm --filter @ctm/web test`
Then `pnpm --filter @ctm/web dev`: switch density, confirm every list reflows at once,
reload and confirm the choice survived. Kill the dev server.

- [ ] **Step 12: Commit**

```bash
git add packages/ui/src apps/web/src
git commit -m "feat(web): make row density a saved preference"
```

---

### Task 7: Brand icons and source pills move into the package

**Files:**

- Create: `packages/ui/src/assets/brands/` (moved SVGs)
- Create: `packages/ui/src/brand-icons.ts`
- Create: `packages/ui/src/BrandIcon.tsx`, `BrandIcon.spec.tsx`, `BrandIcon.stories.tsx`
- Create: `packages/ui/src/SourcePill.tsx`, `SourcePill.spec.tsx`, `SourcePill.stories.tsx`
- Create: `packages/ui/src/svg.d.ts`
- Delete: `apps/web/src/components/BrandIcon.tsx`, `apps/web/src/lib/brand-icons.ts`, `apps/web/src/assets/brands/*`
- Modify: `packages/ui/vitest.config.ts`, `packages/ui/package.json`, `packages/ui/src/index.ts`
- Modify: every `apps/web` file importing `BrandIcon` or `BRAND_ICONS`

**Interfaces:**

- Produces: `BrandIcon({ brand, size, className })` and `type BrandKey`, both re-exported from `@ctm/ui`. `SourcePill({ brand, label }: { brand: BrandKey; label: string })`. Task 8 consumes `SourcePill`.

- [ ] **Step 1: Move the files**

```bash
mkdir -p packages/ui/src/assets/brands
git mv apps/web/src/assets/brands/*.svg packages/ui/src/assets/brands/
git mv apps/web/src/lib/brand-icons.ts packages/ui/src/brand-icons.ts
git mv apps/web/src/components/BrandIcon.tsx packages/ui/src/BrandIcon.tsx
```

In `packages/ui/src/brand-icons.ts` fix the import paths from `../assets/brands/...` to `./assets/brands/...`. In `packages/ui/src/BrandIcon.tsx` change the two imports to `./brand-icons.js`.

- [ ] **Step 2: Give the package the svgr types and plugin**

`packages/ui/src/svg.d.ts`:

```ts
declare module "*.svg?react" {
  const Svg: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default Svg;
}
```

Add svgr to the test config, because the specs render components that import SVGs:

```bash
pnpm --filter @ctm/ui add -D vite-plugin-svgr@5.2.0
```

`packages/ui/vitest.config.ts` gains `import svgr from 'vite-plugin-svgr';` and `plugins: [react(), svgr()]`.

- [ ] **Step 3: Write the failing tests**

`packages/ui/src/BrandIcon.spec.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandIcon } from "./BrandIcon.js";

describe("BrandIcon", () => {
  it("is decorative, so it exposes no accessible name", () => {
    const { container } = render(<BrandIcon brand="todoist" />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("falls back to a bitmap for brands without vector paths", () => {
    const { container } = render(<BrandIcon brand="chatgpt" />);

    expect(container.querySelector("img")).not.toBeNull();
  });
});
```

`packages/ui/src/SourcePill.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourcePill } from "./SourcePill.js";

describe("SourcePill", () => {
  it("names the account it came from", () => {
    render(<SourcePill brand="google_tasks" label="Google Tasks" />);

    expect(screen.getByText("Google Tasks")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run and watch them fail**

Run: `pnpm --filter @ctm/ui test`
Expected: FAIL on `SourcePill`, module not found. `BrandIcon` should already pass; if it fails on the `?react` import, svgr was not added to the vitest config.

- [ ] **Step 5: Implement `SourcePill`**

```tsx
import { BrandIcon } from "./BrandIcon.js";
import type { BrandKey } from "./brand-icons.js";

type SourcePillProps = {
  brand: BrandKey;
  label: string;
};

/** Where a task came from. The mark carries the identity, so provenance reads before the words. */
export function SourcePill({
  brand,
  label,
}: SourcePillProps): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-nav-on-bg px-2 py-0.5 text-[10px] text-muted">
      <BrandIcon brand={brand} size={11} />
      {label}
    </span>
  );
}
```

- [ ] **Step 6: Export from the package**

```ts
export { BrandIcon } from "./BrandIcon.js";
export { BRAND_ICONS } from "./brand-icons.js";
export type { BrandKey } from "./brand-icons.js";
export { SourcePill } from "./SourcePill.js";
```

- [ ] **Step 7: Re-point the web app**

Run `grep -rln "BrandIcon\|brand-icons" apps/web/src` and change each import to `@ctm/ui`. The bitmap brands still resolve from `apps/web/public/favicons/`, which is unchanged, so no asset moves are needed for them.

- [ ] **Step 8: Verify both packages**

Run: `pnpm --filter @ctm/ui test && pnpm --filter @ctm/web test && pnpm --filter @ctm/web build`
Expected: all PASS. `apps/web` must have no remaining reference to `src/assets/brands`.

- [ ] **Step 9: Story and commit**

`BrandIcon.stories.tsx` renders every `BrandKey` in a row at 16px and 24px. `SourcePill.stories.tsx` shows Todoist and Google Tasks.

```bash
git add -A packages/ui apps/web
git commit -m "refactor(ui): move brand icons into the ui package and add source pills"
```

---

### Task 8: TaskRow and GroupedTaskList

**Files:**

- Create: `packages/ui/src/TaskRow.tsx`, `TaskRow.spec.tsx`, `TaskRow.stories.tsx`
- Create: `packages/ui/src/TaskGroup.tsx`, `TaskGroup.spec.tsx`, `TaskGroup.stories.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `apps/web/src/components/tasks/TaskCard.tsx`
- Modify: `apps/web/src/components/tasks/GroupedTaskList.tsx`

**Interfaces:**

- Consumes: `Checkbox`, `SourcePill`, `Badge`, `EmptyState`.
- Produces:

```ts
type TaskRowProps = {
  title: string;
  source: { brand: BrandKey; label: string };
  due?: { label: string; overdue?: boolean };
  priorityLabel?: string;
  completed: boolean;
  pending?: boolean;
  onToggle: (completed: boolean) => void;
  onOpen?: () => void;
};

type TaskGroupProps = {
  heading: string;
  count: number;
  emptyBody: string;
  children: React.ReactNode;
};
```

- [ ] **Step 1: Write the failing test**

`packages/ui/src/TaskRow.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskRow } from "./TaskRow.js";

const base = {
  title: "Renew home insurance",
  source: { brand: "todoist" as const, label: "Todoist" },
  completed: false,
  onToggle: vi.fn(),
};

describe("TaskRow", () => {
  it("shows title, source and due state", () => {
    render(<TaskRow {...base} due={{ label: "2 days late", overdue: true }} />);

    expect(screen.getByText("Renew home insurance")).toBeInTheDocument();
    expect(screen.getByText("Todoist")).toBeInTheDocument();
    expect(screen.getByText("2 days late")).toBeInTheDocument();
  });

  it("reports the toggled completion state", async () => {
    const onToggle = vi.fn();
    render(<TaskRow {...base} onToggle={onToggle} />);

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Renew home insurance" }),
    );

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("blocks interaction while a write is in flight", async () => {
    const onToggle = vi.fn();
    render(<TaskRow {...base} pending onToggle={onToggle} />);

    const box = screen.getByRole("checkbox", { name: "Renew home insurance" });

    expect(box).toBeDisabled();

    await userEvent.click(box);

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not pre-strike the title while pending, since the server has not confirmed", () => {
    render(<TaskRow {...base} pending />);

    expect(screen.getByText("Renew home insurance")).not.toHaveClass(
      "line-through",
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @ctm/ui test TaskRow`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `TaskRow`**

```tsx
import clsx from "clsx";
import { Badge } from "./Badge.js";
import { Checkbox } from "./Checkbox.js";
import { SourcePill } from "./SourcePill.js";
import type { BrandKey } from "./brand-icons.js";

type TaskRowProps = {
  title: string;
  source: { brand: BrandKey; label: string };
  due?: { label: string; overdue?: boolean };
  priorityLabel?: string;
  completed: boolean;
  /** A write is in flight. The row dims and holds still; it never guesses the outcome. */
  pending?: boolean;
  onToggle: (completed: boolean) => void;
  onOpen?: () => void;
};

/** One task in a list. Presentational: it knows nothing about the API or the query cache. */
export function TaskRow({
  title,
  source,
  due,
  priorityLabel,
  completed,
  pending = false,
  onToggle,
  onOpen,
}: TaskRowProps): React.JSX.Element {
  return (
    <div
      className={clsx(
        "grid grid-cols-[18px_1fr_auto] items-center gap-3 border-b border-hair px-3 last:border-b-0",
        "py-[var(--ctm-row-y)] transition-opacity duration-press",
        pending && "opacity-55",
      )}
    >
      <Checkbox
        checked={completed}
        onChange={onToggle}
        label={title}
        disabled={pending}
      />
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={clsx(
          "truncate text-left text-[13.5px] text-fg",
          onOpen && "cursor-pointer hover:underline",
          completed && "line-through text-muted",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        )}
      >
        {title}
      </button>
      <span className="flex items-center gap-2 whitespace-nowrap text-[11px] tabular-nums">
        {priorityLabel && <Badge variant="priority">{priorityLabel}</Badge>}
        <SourcePill brand={source.brand} label={source.label} />
        {due && (
          <span
            className={clsx(
              due.overdue
                ? "rounded-[4px] bg-warn-bg px-2 py-0.5 text-warn"
                : "text-muted",
            )}
          >
            {due.label}
          </span>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @ctm/ui test TaskRow`
Expected: PASS.

- [ ] **Step 5: Write `TaskGroup` with its test**

Test asserts the heading, the count, and that `emptyBody` shows when there are no children:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskGroup } from "./TaskGroup.js";

describe("TaskGroup", () => {
  it("shows the heading and count", () => {
    render(
      <TaskGroup heading="Overdue" count={2} emptyBody="Nothing overdue.">
        <div>a row</div>
      </TaskGroup>,
    );

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows the per-group empty copy when it has no rows", () => {
    render(
      <TaskGroup heading="Overdue" count={0} emptyBody="Nothing overdue." />,
    );

    expect(screen.getByText("Nothing overdue.")).toBeInTheDocument();
  });
});
```

```tsx
/** A due-state group: heading, count, and its own empty sentence. */
export function TaskGroup({
  heading,
  count,
  emptyBody,
  children,
}: {
  heading: string;
  count: number;
  emptyBody: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-1.5">
      <header className="flex items-center gap-2 pt-1 text-[11px] uppercase tracking-[0.1em] text-muted">
        <span>{heading}</span>
        <span className="tabular-nums">{count}</span>
      </header>
      {count === 0 ? (
        <p className="rounded-ctm border border-line bg-panel px-3 py-3.5 text-xs text-muted">
          {emptyBody}
        </p>
      ) : (
        <div className="overflow-hidden rounded-ctm border border-line bg-panel">
          {children}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Rewire the web app**

`apps/web/src/components/tasks/TaskCard.tsx` becomes a thin adapter: it maps `TaskDto` to `TaskRowProps` (source brand from `task.source`, due label from the existing formatting helpers, `priorityLabel` from the map added in Task 4) and renders `TaskRow`. Keep the `highlighted` scroll-into-view effect there, since it is app behaviour, not presentation. `GroupedTaskList.tsx` renders `TaskGroup` per bucket, passing the bucket's own empty sentence.

- [ ] **Step 7: Verify**

Run: `pnpm --filter @ctm/ui test && pnpm --filter @ctm/web test`
Expected: PASS. Existing `TaskCard.spec.tsx` and `GroupedTaskList.spec.tsx` assertions about text content should still hold; if one asserted a neobrutalist class, delete that assertion rather than preserving it, per the testing policy.

- [ ] **Step 8: Stories and commit**

`TaskRow.stories.tsx`: default, overdue, pending, completed, with priority. `TaskGroup.stories.tsx`: populated and empty.

```bash
git add packages/ui/src apps/web/src/components/tasks
git commit -m "feat(ui): add task row and task group components"
```

---

### Task 9: Filters and saved views

**Files:**

- Create: `packages/ui/src/filters.ts`, `filters.spec.ts`
- Create: `packages/ui/src/FilterChipBar.tsx`, `FilterChipBar.spec.tsx`, `FilterChipBar.stories.tsx`
- Create: `packages/ui/src/FilterBuilder.tsx`, `FilterBuilder.spec.tsx`, `FilterBuilder.stories.tsx`
- Create: `packages/ui/src/SavedViewPills.tsx`, `SavedViewPills.spec.tsx`, `SavedViewPills.stories.tsx`
- Create: `apps/web/src/hooks/useFilterParams.ts`, `useFilterParams.spec.tsx`
- Modify: `packages/ui/src/index.ts`, `apps/web/src/pages/TasksPage.tsx`

**Interfaces:**

- Produces:

```ts
type FilterCondition =
  | { kind: "source"; value: string }
  | { kind: "due"; value: "overdue" | "today" | "week" | "none" }
  | { kind: "tag"; value: string }
  | { kind: "field"; value: "noDate" | "noDuration" | "hasReminder" };

function conditionKey(condition: FilterCondition): string;
function conditionLabel(condition: FilterCondition): {
  kind: string;
  value: string;
};
function encodeConditions(conditions: FilterCondition[]): URLSearchParams;
function decodeConditions(params: URLSearchParams): FilterCondition[];
```

`useFilterParams()` returns `{ conditions, toggle, clear }` backed by `useSearchParams` from `react-router`.

- [ ] **Step 1: Write the failing test for the codec**

`packages/ui/src/filters.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { conditionKey, decodeConditions, encodeConditions } from "./filters.js";
import type { FilterCondition } from "./filters.js";

describe("filter conditions", () => {
  it("round-trips through the query string", () => {
    const conditions: FilterCondition[] = [
      { kind: "source", value: "todoist" },
      { kind: "due", value: "overdue" },
      { kind: "tag", value: "admin" },
    ];

    expect(decodeConditions(encodeConditions(conditions))).toEqual(conditions);
  });

  it("drops unknown values rather than throwing, so a stale link still opens", () => {
    expect(
      decodeConditions(new URLSearchParams("due=someday&source=todoist")),
    ).toEqual([{ kind: "source", value: "todoist" }]);
  });

  it("keys a condition by kind and value", () => {
    expect(conditionKey({ kind: "field", value: "noDate" })).toBe(
      "field:noDate",
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @ctm/ui test filters`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `filters.ts`**

```ts
export type FilterCondition =
  | { kind: "source"; value: string }
  | { kind: "due"; value: "overdue" | "today" | "week" | "none" }
  | { kind: "tag"; value: string }
  | { kind: "field"; value: "noDate" | "noDuration" | "hasReminder" };

const DUE_VALUES = ["overdue", "today", "week", "none"] as const;
const FIELD_VALUES = ["noDate", "noDuration", "hasReminder"] as const;

/** Stable identity for a condition, used as a React key and for set membership. */
export function conditionKey(condition: FilterCondition): string {
  return `${condition.kind}:${condition.value}`;
}

/** Human labels for the builder tokens: the kind is the caption, the value is the content. */
export function conditionLabel(condition: FilterCondition): {
  kind: string;
  value: string;
} {
  if (condition.kind === "source")
    return { kind: "source", value: condition.value };
  if (condition.kind === "due") return { kind: "due", value: condition.value };
  if (condition.kind === "tag") return { kind: "tag", value: condition.value };

  return { kind: "field", value: condition.value };
}

/** Conditions are AND-ed, so each kind may appear more than once. */
export function encodeConditions(
  conditions: FilterCondition[],
): URLSearchParams {
  const params = new URLSearchParams();

  for (const condition of conditions)
    params.append(condition.kind, condition.value);

  return params;
}

/**
 * Unknown values are dropped rather than rejected: a link shared six months ago should
 * still open on something sensible instead of an error page.
 */
export function decodeConditions(params: URLSearchParams): FilterCondition[] {
  const out: FilterCondition[] = [];

  for (const value of params.getAll("source"))
    out.push({ kind: "source", value });
  for (const value of params.getAll("tag")) out.push({ kind: "tag", value });

  for (const value of params.getAll("due")) {
    const match = DUE_VALUES.find((v) => v === value);

    if (match) out.push({ kind: "due", value: match });
  }

  for (const value of params.getAll("field")) {
    const match = FIELD_VALUES.find((v) => v === value);

    if (match) out.push({ kind: "field", value: match });
  }

  return out;
}
```

Note the decode order returns source, tag, due, field. The round-trip test above lists source, due, tag, so make the test's expectation match the implementation order or sort both sides. Sort both sides by `conditionKey` in the test to keep it order-independent.

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @ctm/ui test filters`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `FilterBuilder`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterBuilder } from "./FilterBuilder.js";

describe("FilterBuilder", () => {
  it("explains itself when nothing is selected", () => {
    render(
      <FilterBuilder
        conditions={[]}
        onRemove={vi.fn()}
        onSave={vi.fn()}
        matchCount={14}
      />,
    );

    expect(
      screen.getByText("No conditions, showing everything."),
    ).toBeInTheDocument();
  });

  it("removes the condition whose token is clicked", async () => {
    const onRemove = vi.fn();
    render(
      <FilterBuilder
        conditions={[{ kind: "tag", value: "admin" }]}
        onRemove={onRemove}
        onSave={vi.fn()}
        matchCount={2}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Remove tag admin" }),
    );

    expect(onRemove).toHaveBeenCalledWith({ kind: "tag", value: "admin" });
  });

  it("cannot save an empty filter", () => {
    render(
      <FilterBuilder
        conditions={[]}
        onRemove={vi.fn()}
        onSave={vi.fn()}
        matchCount={14}
      />,
    );

    expect(screen.getByRole("button", { name: "Save as view" })).toBeDisabled();
  });
});
```

- [ ] **Step 6: Implement `FilterChipBar`, `FilterBuilder` and `SavedViewPills`**

```tsx
import { Chip } from "./Chip.js";
import { conditionKey } from "./filters.js";
import type { FilterCondition } from "./filters.js";

type FilterChipBarProps = {
  available: {
    condition: FilterCondition;
    label: string;
    icon?: React.ReactNode;
  }[];
  selected: FilterCondition[];
  onToggle: (condition: FilterCondition) => void;
};

/** The chip row. Chips compose AND-ed conditions; there is no query language to learn. */
export function FilterChipBar({
  available,
  selected,
  onToggle,
}: FilterChipBarProps): React.JSX.Element {
  const keys = new Set(selected.map(conditionKey));

  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map(({ condition, label, icon }) => (
        <Chip
          key={conditionKey(condition)}
          label={label}
          icon={icon}
          selected={keys.has(conditionKey(condition))}
          onToggle={() => onToggle(condition)}
        />
      ))}
    </div>
  );
}
```

```tsx
import { Button } from "./Button.js";
import { conditionKey, conditionLabel } from "./filters.js";
import type { FilterCondition } from "./filters.js";

type FilterBuilderProps = {
  conditions: FilterCondition[];
  matchCount: number;
  onRemove: (condition: FilterCondition) => void;
  onSave: () => void;
};

/** The active conditions as removable tokens, plus the affordance that turns them into a view. */
export function FilterBuilder({
  conditions,
  matchCount,
  onRemove,
  onSave,
}: FilterBuilderProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
      {conditions.length === 0 && (
        <span>No conditions, showing everything.</span>
      )}
      {conditions.map((condition) => {
        const label = conditionLabel(condition);

        return (
          <button
            key={conditionKey(condition)}
            type="button"
            aria-label={`Remove ${label.kind} ${label.value}`}
            onClick={() => onRemove(condition)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-accent bg-accent/10 px-2.5 py-1 text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="text-[9.5px] uppercase tracking-[0.08em] text-muted">
              {label.kind}
            </span>
            {label.value}
            <span aria-hidden="true">✕</span>
          </button>
        );
      })}
      <span className="tabular-nums">{matchCount} shown</span>
      <Button
        variant="secondary"
        disabled={conditions.length === 0}
        onClick={onSave}
      >
        Save as view
      </Button>
    </div>
  );
}
```

```tsx
import clsx from "clsx";

type SavedView = {
  id: string;
  name: string;
  count: number;
};

type SavedViewPillsProps = {
  views: SavedView[];
  activeId?: string;
  onSelect: (id: string) => void;
};

/** A saved view is a name plus a query string, so selecting one is just navigation. */
export function SavedViewPills({
  views,
  activeId,
  onSelect,
}: SavedViewPillsProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          aria-current={view.id === activeId ? "true" : undefined}
          onClick={() => onSelect(view.id)}
          className={clsx(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            view.id === activeId
              ? "border-accent text-accent"
              : "border-line bg-panel text-fg",
          )}
        >
          {view.name}
          <span className="tabular-nums text-muted">{view.count}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @ctm/ui test`
Expected: PASS. Export all three components plus the filter helpers and `FilterCondition` type from `index.ts`.

- [ ] **Step 8: Write the web hook, test first**

`apps/web/src/hooks/useFilterParams.spec.tsx` renders a probe component inside a `MemoryRouter` at `/tasks?tag=admin`, asserts `conditions` decodes to one tag condition, clicks a button that calls `toggle({ kind: 'due', value: 'overdue' })`, and asserts the location search now contains both. Then:

```ts
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { conditionKey, decodeConditions, encodeConditions } from "@ctm/ui";
import type { FilterCondition } from "@ctm/ui";

type UseFilterParams = {
  conditions: FilterCondition[];
  toggle: (condition: FilterCondition) => void;
  clear: () => void;
};

/** Filter state lives in the URL so a view can be bookmarked, shared and restored. */
export function useFilterParams(): UseFilterParams {
  const [params, setParams] = useSearchParams();
  const conditions = decodeConditions(params);

  const toggle = useCallback(
    (condition: FilterCondition): void => {
      const key = conditionKey(condition);
      const next = conditions.some((c) => conditionKey(c) === key)
        ? conditions.filter((c) => conditionKey(c) !== key)
        : [...conditions, condition];

      setParams(encodeConditions(next), { replace: true });
    },
    [conditions, setParams],
  );

  const clear = useCallback(
    (): void => setParams(new URLSearchParams(), { replace: true }),
    [setParams],
  );

  return { conditions, toggle, clear };
}
```

- [ ] **Step 9: Wire the Tasks page**

Replace the existing `filter` string state in `apps/web/src/pages/TasksPage.tsx` with `useFilterParams`, render `FilterChipBar` and `FilterBuilder` above the list, and pass the decoded conditions to the task queries. Saved views are read-only for now: render `SavedViewPills` from a static list and leave `onSave` raising a toast that says "Saved views are coming with the API endpoint", so the UI is honest about what exists.

- [ ] **Step 10: Verify and commit**

Run: `pnpm --filter @ctm/ui test && pnpm --filter @ctm/web test && pnpm --filter @ctm/web build`

```bash
git add packages/ui/src apps/web/src
git commit -m "feat(web): filter chips, condition builder and URL-backed filter state"
```

---

### Task 10: The command palette component

**Files:**

- Create: `packages/ui/src/CommandPalette.tsx`, `CommandPalette.spec.tsx`, `CommandPalette.stories.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Produces:

```ts
type CommandItem = {
  id: string;
  group: "jump" | "views" | "task" | "acct" | "do" | "ask";
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  keywords?: string;
};

type CommandPaletteProps = {
  open: boolean;
  items: CommandItem[];
  onClose: () => void;
  onRun: (item: CommandItem) => void;
  onAsk: (query: string) => void;
};
```

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette.js";
import type { CommandItem } from "./CommandPalette.js";

const items: CommandItem[] = [
  { id: "jump-cal", group: "jump", label: "Calendar", hint: "G C" },
  { id: "view-today", group: "views", label: "Today", hint: "5 tasks" },
  { id: "do-sync", group: "do", label: "Sync all accounts" },
  { id: "acct-harlow", group: "acct", label: "Todoist, Harlow Studio" },
];

function setup(
  overrides: Partial<React.ComponentProps<typeof CommandPalette>> = {},
) {
  const props = {
    open: true,
    items,
    onClose: vi.fn(),
    onRun: vi.fn(),
    onAsk: vi.fn(),
    ...overrides,
  };
  render(<CommandPalette {...props} />);

  return props;
}

describe("CommandPalette", () => {
  it("is a modal dialog when open", () => {
    setup();

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("renders nothing when closed", () => {
    setup({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters on the typed query", async () => {
    setup();

    await userEvent.type(screen.getByRole("combobox"), "cal");

    expect(
      screen.getByRole("option", { name: /Calendar/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Sync all accounts/ }),
    ).not.toBeInTheDocument();
  });

  it("narrows to actions on the > prefix", async () => {
    setup();

    await userEvent.type(screen.getByRole("combobox"), ">");

    expect(
      screen.getByRole("option", { name: /Sync all accounts/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Calendar/ }),
    ).not.toBeInTheDocument();
  });

  it("narrows to accounts on the @ prefix", async () => {
    setup();

    await userEvent.type(screen.getByRole("combobox"), "@harlow");

    expect(
      screen.getByRole("option", { name: /Harlow Studio/ }),
    ).toBeInTheDocument();
  });

  it("runs the selected item on Enter", async () => {
    const props = setup();

    await userEvent.type(screen.getByRole("combobox"), "cal{Enter}");

    expect(props.onRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: "jump-cal" }),
    );
  });

  it("moves the selection with the arrow keys", async () => {
    const props = setup();

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(props.onRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: "view-today" }),
    );
  });

  it("hands a query that matches nothing to the agent", async () => {
    const props = setup();

    await userEvent.type(
      screen.getByRole("combobox"),
      "what should i do first{Enter}",
    );

    expect(props.onAsk).toHaveBeenCalledWith("what should i do first");
    expect(props.onRun).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const props = setup();

    await userEvent.keyboard("{Escape}");

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @ctm/ui test CommandPalette`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `CommandPalette`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Kbd } from "./Kbd.js";

export type CommandGroup = "jump" | "views" | "task" | "acct" | "do" | "ask";

export type CommandItem = {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  /** Extra text to match against, for terms that are not in the label. */
  keywords?: string;
};

type CommandPaletteProps = {
  open: boolean;
  items: CommandItem[];
  onClose: () => void;
  onRun: (item: CommandItem) => void;
  /** Called when the query matches nothing. The string goes to the agent unchanged. */
  onAsk: (query: string) => void;
};

const GROUP_LABELS: Record<CommandGroup, string> = {
  jump: "Jump to",
  views: "Views",
  task: "Tasks",
  acct: "Accounts",
  do: "Actions",
  ask: "Ask",
};

const GROUP_ORDER: CommandGroup[] = [
  "views",
  "task",
  "acct",
  "jump",
  "do",
  "ask",
];

const PREFIXES: Record<string, CommandGroup> = {
  ">": "do",
  "#": "views",
  "@": "acct",
};

/**
 * One keystroke for search, navigation, actions and questions. Replaces an always-on
 * command bar, which costs vertical space on every screen and invites typing where nobody
 * is looking.
 */
export function CommandPalette({
  open,
  items,
  onClose,
  onRun,
  onAsk,
}: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setSelected(0);
    inputRef.current?.focus();
  }, [open]);

  const matches = useMemo((): CommandItem[] => {
    const prefix = PREFIXES[query.slice(0, 1)];
    const term = (prefix ? query.slice(1) : query).trim().toLowerCase();
    const scoped = prefix ? items.filter((i) => i.group === prefix) : items;
    const hit = (item: CommandItem): boolean =>
      !term ||
      `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(term);

    return [...scoped.filter(hit)].sort(
      (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
    );
  }, [items, query]);

  if (!open) return null;

  const askQuery = query.replace(/^[>#@]/, "").trim();

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();

      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, matches.length - 1));

      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));

      return;
    }

    if (e.key !== "Enter") return;

    e.preventDefault();
    const item = matches[selected];

    if (item) onRun(item);
    else if (askQuery) onAsk(askQuery);
  };

  let lastGroup: CommandGroup | undefined;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
      className={clsx(
        "fixed inset-0 z-50 grid justify-items-center pt-[12vh]",
        // The blur is the point: the dialog floats above the app rather than being
        // pasted onto it, and the app stays recognisable underneath.
        "bg-bg/50 backdrop-blur-[7px] backdrop-saturate-150",
        "motion-safe:animate-[fade_140ms_ease-out]",
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={clsx(
          "w-[min(520px,90vw)] overflow-hidden rounded-[12px] border border-fg/15",
          "bg-panel/90 shadow-overlay",
          "motion-safe:animate-[rise_180ms_cubic-bezier(.2,.8,.3,1)]",
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-hair bg-fg/3 px-3.5 py-3">
          <Kbd>⌘K</Kbd>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="ctm-palette-list"
            aria-label="Search tasks, jump, or run a command"
            placeholder="Search tasks, jump, or run a command"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
        </div>
        <div
          id="ctm-palette-list"
          role="listbox"
          className="max-h-[300px] overflow-y-auto"
        >
          {matches.map((item, index) => {
            const heading =
              item.group === lastGroup ? null : GROUP_LABELS[item.group];
            lastGroup = item.group;

            return (
              <div key={item.id}>
                {heading && (
                  <div className="px-3.5 pb-1 pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted">
                    {heading}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={index === selected}
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => onRun(item)}
                  className={clsx(
                    "grid grid-cols-[16px_1fr_auto] items-center gap-2.5 px-3.5 py-2 text-[13px] text-fg",
                    index === selected && "bg-accent/12",
                  )}
                >
                  <span className="text-center text-[11px] text-muted">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                  <span className="font-mono text-[10px] text-muted">
                    {item.hint}
                  </span>
                </div>
              </div>
            );
          })}
          {matches.length === 0 && (
            <p className="px-3.5 py-4 text-xs text-muted">
              Nothing matches. Press Enter to hand it to your agent instead.
            </p>
          )}
        </div>
        <div className="flex gap-3 border-t border-hair px-3.5 py-2 font-mono text-[10px] text-muted">
          <span>↑↓ move</span>
          <span>↵ run</span>
          <span>esc close</span>
          <span>&gt; actions · # views · @ accounts</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the two keyframes to the token file**

Append to `packages/ui/src/styles/tokens.css`:

```css
@keyframes fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

`motion-safe:` already gates both, so `prefers-reduced-motion` gets the blur without the movement.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @ctm/ui test CommandPalette`
Expected: PASS, 9 tests. If the arrow-key test fails, the scrim's `onKeyDown` is not receiving the event: keep the handler on the outer element so it catches keys from the input by bubbling.

- [ ] **Step 6: Story**

`CommandPalette.stories.tsx`: a story with the palette open over a static task list, using the same items as the spec plus two task rows, so the blur can be judged against real content. Include a `Dark` story note in the description telling the reviewer to flip the toolbar.

- [ ] **Step 7: Export and commit**

```ts
export { CommandPalette } from "./CommandPalette.js";
export type { CommandItem, CommandGroup } from "./CommandPalette.js";
```

```bash
git add packages/ui/src
git commit -m "feat(ui): add the command palette"
```

---

### Task 11: Wire the palette into the web app

**Files:**

- Create: `apps/web/src/hooks/useCommandPalette.ts`, `useCommandPalette.spec.tsx`
- Create: `apps/web/src/components/layout/AppCommandPalette.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/components/layout/TopBar.tsx`

**Interfaces:**

- Consumes: `CommandPalette`, `CommandItem` from `@ctm/ui`.
- Produces: `useCommandPalette()` returning `{ open, setOpen }`, bound to `Cmd+K` and `Ctrl+K`. `AppCommandPalette` renders the palette with items built from the current queries and navigates with `useNavigate`.

- [ ] **Step 1: Write the failing hook test**

`apps/web/src/hooks/useCommandPalette.spec.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useCommandPalette } from "./useCommandPalette.js";

function Probe(): React.JSX.Element {
  const { open } = useCommandPalette();

  return <span>{open ? "open" : "closed"}</span>;
}

describe("useCommandPalette", () => {
  it("opens on Cmd+K", async () => {
    render(<Probe />);

    await userEvent.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("opens on Ctrl+K for Windows and Linux", async () => {
    render(<Probe />);

    await userEvent.keyboard("{Control>}k{/Control}");

    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("ignores the shortcut while a text field has focus", async () => {
    render(
      <>
        <input aria-label="search" />
        <Probe />
      </>,
    );

    await userEvent.click(screen.getByLabelText("search"));
    await userEvent.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByText("closed")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @ctm/web test useCommandPalette`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the hook**

```ts
import { useEffect, useState } from "react";

type UseCommandPalette = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

/** Binds Cmd+K and Ctrl+K. Typing in a field always wins, so the shortcut never steals a keystroke. */
export function useCommandPalette(): UseCommandPalette {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;

      const el = e.target;

      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      setOpen((v) => !v);
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
```

The third test passes because the guard returns early when the event target is a field. That is deliberate: the palette's own input is a field too, so the same guard stops `Cmd+K` toggling the palette shut while typing in it.

- [ ] **Step 4: Build the item list**

`apps/web/src/components/layout/AppCommandPalette.tsx` composes items in this order and renders `CommandPalette`:

- `views`: the saved views list from Task 9.
- `task`: up to 20 open tasks from the existing grouped task queries, `icon` a `BrandIcon` for the task's source, `keywords` the source label.
- `acct`: connected accounts from the connectors query, `hint` the staleness line.
- `jump`: Tasks, Calendar, Timeline, Reminders, Settings, each running `navigate(path)`.
- `do`: New task, Reschedule, Sync all accounts, Connect an account.
- `ask`: one item whose label is "Ask your agent", `hint` `↵`.

`onRun` switches on `item.group` and either navigates or fires the matching mutation. `onAsk` shows a toast reading "Handed to your agent" for now, because the MCP round trip from the web UI is a later phase. Say that in a comment so the stub is not mistaken for a bug.

- [ ] **Step 5: Mount it**

`AppShell.tsx` renders `<AppCommandPalette />` once, outside the routed content. `TopBar.tsx` gains a button reading "Search or run" with a `Kbd` showing `⌘K` that calls `setOpen(true)`, so the shortcut is discoverable without a permanent command bar.

- [ ] **Step 6: Verify**

Run: `pnpm --filter @ctm/web test && pnpm --filter @ctm/web build`
Then `pnpm --filter @ctm/web dev`, press `Cmd+K`, check that typing `>` shows only actions, that Escape restores focus to the page, and that `Cmd+K` inside the palette input does not close it. Kill the dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): open the command palette with cmd+k"
```

---

### Task 12: Remove the optimistic writes

**Files:**

- Modify: `apps/web/src/pages/TasksPage.tsx:134-200` (the `statusMutation`)
- Modify: `apps/web/src/pages/NotificationsPage.tsx:40-70` (the `onMutate` block)
- Modify: `apps/web/src/pages/TasksPage.spec.tsx` or create it if absent
- Modify: `apps/main` task status endpoint only if it does not already return the updated task

**Interfaces:**

- Consumes: `TaskRow`'s `pending` prop from Task 8, `Toast` from Task 6.
- Produces: a mutation shape reused by every later write: `mutationFn` posts, `onSuccess` invalidates, no `onMutate`, no `setQueryData` reordering.

- [ ] **Step 1: Confirm what the endpoint returns**

Run: `grep -rn "setTaskStatus" packages/api-client/src apps/main/src | head`
Expected: the client method and the controller handler. If the handler returns the updated `TaskDto`, nothing changes on the server. If it returns `void`, change it to return the updated task and update the api-client type, because the UI now renders from the response.

- [ ] **Step 2: Write the failing test**

In `apps/web/src/pages/TasksPage.spec.tsx`, with the api client stubbed so `setTaskStatus` returns a promise you resolve by hand:

```tsx
it("holds the row in a pending state until the server confirms, then re-renders from the response", async () => {
  let resolve: (task: TaskDto) => void = () => {};
  const setTaskStatus = vi.fn(
    () =>
      new Promise<TaskDto>((r) => {
        resolve = r;
      }),
  );

  renderTasksPage({ setTaskStatus });

  await userEvent.click(
    await screen.findByRole("checkbox", { name: "Renew home insurance" }),
  );

  expect(
    screen.getByRole("checkbox", { name: "Renew home insurance" }),
  ).toBeDisabled();

  resolve({ ...taskFixture, completed: true });

  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: "Renew home insurance" }),
    ).toBeChecked(),
  );
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @ctm/web test TasksPage`
Expected: FAIL, because the current `onMutate` checks the box immediately, so the checkbox is checked before `resolve` is called and never disabled.

- [ ] **Step 4: Delete the optimistic block**

Replace the whole `statusMutation` with:

```ts
const statusMutation = useMutation({
  mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
    api.setTaskStatus({ id, dto: { status: completed ? "done" : "open" } }),
  // No onMutate. TanStack Query offers optimistic updates, and we decline them: the
  // moment the client patches its own cache it can show a state the backend never
  // agreed to. Our API answers in one short hop, and the connector push is reported on
  // the connector row rather than faked in the list.
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
  },
});
```

Delete the `doneTasks` local state and its setters if the optimistic block was their only writer. Pass `pending={statusMutation.isPending && statusMutation.variables?.id === task.id}` down to each row so only the affected row dims.

- [ ] **Step 5: Do the same in `NotificationsPage.tsx`**

Remove its `onMutate` and snapshot logic, invalidate on success, and use the component's own pending state for the control that was being optimistically flipped.

- [ ] **Step 6: Add the undo toast**

On success of a completion, show `Toast` with "Task completed" and an "Undo" action that calls the same mutation with the opposite value. The toast lives for five seconds. Undo is a real call, not a cache rollback.

- [ ] **Step 7: Run everything**

Run: `pnpm --filter @ctm/web test && pnpm --filter @ctm/web build`
Expected: PASS. Then `pnpm --filter @ctm/web dev` and tick a task with the network throttled in devtools: the row should dim and hold still, then settle when the response lands. Kill the dev server.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "refactor(web): render task writes from the server response"
```

---

### Task 12b: Accessibility pass

**Files:**
- Modify: `packages/ui/src/*.spec.tsx` (axe assertion where missing)
- Modify: `packages/ui/src/test-setup.ts`
- Modify: `packages/ui/package.json`
- Create: `apps/web/src/components/layout/SkipLink.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add jest-axe to the package harness**

```bash
pnpm --filter @ctm/ui add -D jest-axe @types/jest-axe
```

Strip the carets. `packages/ui/src/test-setup.ts` becomes:

```ts
import '@testing-library/jest-dom/vitest';
import { toHaveNoViolations } from 'jest-axe';
import { expect } from 'vitest';

expect.extend(toHaveNoViolations);
```

- [ ] **Step 2: Add the assertion to every component spec**

For each spec written in Tasks 1 through 10, add:

```tsx
it('has no axe violations', async () => {
    const { container } = render(/* the component in its default state */);

    expect(await axe(container)).toHaveNoViolations();
});
```

Run: `pnpm --filter @ctm/ui test`
Expected: PASS. Real failures to expect and fix: `CommandPalette`'s listbox needs its
options to be direct children of the element with `role="listbox"`, so move the group
heading out of the option wrapper and render headings as siblings with
`role="presentation"`. `Chip`'s icon needs `aria-hidden`.

- [ ] **Step 3: Add the skip link**

```tsx
/** First tab stop on every page. The sidebar is long, and nobody should walk it twice. */
export function SkipLink({ label }: { label: string }): React.JSX.Element {
    return (
        <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-ctm focus:border focus:border-line focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:text-fg"
        >
            {label}
        </a>
    );
}
```

In `AppShell.tsx`, render `<SkipLink label={t('common.skipToContent')} />` as the first
child and give the main region `id="main"` and `tabIndex={-1}`.

- [ ] **Step 4: Keyboard-only pass**

With the dev server running and the mouse unplugged, do this on Tasks and Settings, in both
themes: Tab from the top and confirm the skip link appears first; confirm every chip, row,
checkbox and button is reachable with a visible ring; open the palette with `Cmd+K`, move
with arrows, run with Enter, close with Escape and confirm focus returns to where it was;
open a modal and confirm Tab cannot leave it. Fix what fails before continuing.

- [ ] **Step 5: Contrast check**

In devtools, sample `--color-muted` on `--color-panel` and on `--color-nav-bg`, the accent
foreground on accent, and `--color-warn` on `--color-warn-bg`, in both themes. Each pair
must clear 4.5:1 for body text and 3:1 for large text and control boundaries. If a pair
fails, darken or lighten the token in `tokens.css` rather than special-casing the component,
and note the new value in the spec's token table.

- [ ] **Step 6: Zoom and reduced motion**

At 200% browser zoom and at a 320px viewport, confirm nothing scrolls sideways except
containers that are meant to. With `prefers-reduced-motion: reduce` forced in devtools,
confirm the palette still opens (blur intact, movement gone) and no row animates.

- [ ] **Step 7: Commit**

```bash
git add -A packages/ui apps/web
git commit -m "test(ui): assert accessibility with axe and add a skip link"
```

---

### Task 13: Retire the neobrutalist tokens

**Files:**

- Modify: `apps/web/src/index.css`
- Modify: any file still referencing `nb-`, `shadow-nb`, `font-black`, `border-2`
- Modify: `CLAUDE.md`
- Modify: `packages/ui/README.md` (create if absent)

- [ ] **Step 1: Find what is left**

Run: `grep -rn "nb-yellow\|nb-black\|nb-red\|nb-green\|nb-grey\|shadow-nb" apps packages --include=*.tsx --include=*.ts --include=*.css | grep -v node_modules`
Expected: a list of remaining callers. Work through it file by file, replacing with the Quiet Slate equivalents: `nb-black` grounds become `bg-fg` or `bg-panel` depending on role, `nb-yellow` accents become `bg-accent`, `nb-red` becomes `text-warn` or `bg-warn`, `shadow-nb` is deleted rather than replaced.

- [ ] **Step 2: Delete the old tokens**

Remove the `nb-*` and `--shadow-nb*` entries from the `@theme` block in `apps/web/src/index.css`. Keep the keyframes that are still used; delete `pulse-ring` and `neon-pulse` if nothing references them after Step 1.

- [ ] **Step 3: Verify nothing broke**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: all PASS. A Tailwind build does not fail on an unknown class, so also run `grep -rn "nb-" apps packages --include=*.tsx | grep -v node_modules` and confirm it returns nothing.

- [ ] **Step 4: Walk the app in both themes**

Run `pnpm --filter @ctm/web dev`, then check Tasks, Calendar, Timeline, Settings and the palette in light and dark at 1440px and 390px. Look for: leftover 2px borders, any offset shadow, text on accent that fails to read, and focus rings that vanish. Fix what you find. Kill the dev server.

- [ ] **Step 5: Write the package README**

`packages/ui/README.md`: what belongs in the package versus the app, the token list from the spec, the rule that every component has a spec and a story, the testing policy (behaviour not classes), and how to run Storybook.

- [ ] **Step 6: Update `CLAUDE.md`**

Add `apps/storybook` to the monorepo tree with the note that it is a development tool with no deploy. Add a `packages/ui` line stating that components and design tokens live there and that `apps/web` holds routing, queries and side effects. Add the two rules that will otherwise be lost: no optimistic writes, and UI tests assert behaviour rather than class names. Add `pnpm --filter @ctm/storybook dev` to the commands table.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(web): retire the neobrutalist tokens"
```

---

## Definition of done for phase 1

- `pnpm test` passes, including a `@ctm/ui` project with a spec for every component it exports.
- `pnpm --filter @ctm/storybook dev` renders every `@ctm/ui` component in both themes.
- No `nb-*` token or offset shadow survives anywhere in `apps` or `packages`.
- Filter state and the calendar range live in the query string.
- `Cmd+K` opens the palette from any screen; Escape restores focus.
- No `onMutate` anywhere in `apps/web`.
- `CLAUDE.md` and `packages/ui/README.md` describe the new boundaries.
- Density is switchable in Settings, persists across a reload, and reflows every list.
- No user-visible string literal remains in `apps/web` JSX; every key resolves from `en.json`.
- Every `@ctm/ui` spec asserts no axe violations, and the keyboard-only pass in Task 12b is done.

## Follow-up plans, not in this one

- Phase 2: calendar ranges (month, week, 3-day, day), timeline, mobile shell and sheets.
- Phase 3: task detail panel plus the per-connector capability map in the API.
- Phase 4: sync model UI, blocked on the shadow copy, origin stamps and write ledger.
- Phase 5: reminders with delivery proof, auditable sync surfaces.
