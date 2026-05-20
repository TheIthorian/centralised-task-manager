# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/landing` — a static marketing site for CTM written in React and compiled to zero-JS HTML via Astro.

**Architecture:** Astro v5 with `output: 'static'`. All UI written as React `.tsx` components imported into a single `.astro` page with no `client:*` directives, so the entire site renders to plain HTML at build time. Tailwind v4 via `@tailwindcss/vite` plugin. Design tokens match `apps/web` exactly.

**Tech Stack:** Astro 5, React 19, Tailwind CSS 4, `@tailwindcss/vite`, TypeScript (strict), oxlint, oxfmt.

---

## File Map

| File | Purpose |
|---|---|
| `apps/landing/package.json` | Package manifest, scripts |
| `apps/landing/astro.config.mjs` | Astro config: react integration, tailwind vite plugin, static output |
| `apps/landing/tsconfig.json` | TypeScript config extending shared react preset |
| `apps/landing/src/styles/global.css` | Tailwind v4 import + `@theme` token definitions |
| `apps/landing/src/layouts/BaseLayout.astro` | HTML shell, head/meta/OG tags, imports global.css |
| `apps/landing/src/pages/index.astro` | Single page — imports all React sections |
| `apps/landing/src/components/Nav.tsx` | Sticky black nav bar |
| `apps/landing/src/components/Hero.tsx` | Yellow hero section, headline, CTAs |
| `apps/landing/src/components/Features.tsx` | 4-card features grid |
| `apps/landing/src/components/HowItWorks.tsx` | 3-step numbered flow |
| `apps/landing/src/components/Integrations.tsx` | Source integration cards |
| `apps/landing/src/components/FooterCta.tsx` | Black footer with CTA |
| `apps/landing/public/favicon.svg` | SVG favicon |

---

## Task 1: Scaffold `apps/landing`

**Files:**
- Create: `apps/landing/package.json`
- Create: `apps/landing/astro.config.mjs`
- Create: `apps/landing/tsconfig.json`
- Create: `apps/landing/src/styles/global.css`
- Create: `apps/landing/public/favicon.svg`

- [ ] **Step 1: Create `apps/landing/package.json`**

```json
{
  "name": "@ctm/landing",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "oxlint src",
    "format": "oxfmt src"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/react": "^4.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/landing/astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  output: 'static',
});
```

- [ ] **Step 3: Create `apps/landing/tsconfig.json`**

```json
{
  "extends": "../../packages/tsconfig/react.json",
  "include": ["src", ".astro/types.d.ts"]
}
```

- [ ] **Step 4: Create `apps/landing/src/styles/global.css`**

```css
@import "tailwindcss";

@theme {
  --color-nb-yellow: #FFDE59;
  --color-nb-black: #111111;
  --color-nb-red: #FF3B30;
  --color-nb-green: #34C759;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}
```

- [ ] **Step 5: Create `apps/landing/public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#FFDE59"/>
  <rect width="32" height="32" fill="none" stroke="#111111" stroke-width="2"/>
  <text x="16" y="22" font-family="system-ui" font-weight="900" font-size="12" fill="#111111" text-anchor="middle">CTM</text>
</svg>
```

- [ ] **Step 6: Install dependencies**

Run from the repo root:
```bash
pnpm install
```

Expected: pnpm resolves and links `@ctm/landing` workspace package. No errors.

- [ ] **Step 7: Commit scaffold**

```bash
git add apps/landing/package.json apps/landing/astro.config.mjs apps/landing/tsconfig.json apps/landing/src/styles/global.css apps/landing/public/favicon.svg
git commit -m "feat(landing): scaffold Astro static site"
```

---

## Task 2: BaseLayout

**Files:**
- Create: `apps/landing/src/layouts/BaseLayout.astro`

- [ ] **Step 1: Create `apps/landing/src/layouts/BaseLayout.astro`**

```astro
---
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
}

const {
  title = 'CTM — Centralised Task Manager',
  description = 'Connect Todoist, Google Tasks, and more. Manage all your tasks from a single dashboard, CLI, or AI agent.',
} = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="bg-white antialiased">
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Verify the dev server starts**

```bash
pnpm --filter @ctm/landing dev
```

Expected: Astro dev server starts at `http://localhost:4321`. No errors. Visiting the URL shows a blank white page (no content yet — that's correct).

- [ ] **Step 3: Commit**

```bash
git add apps/landing/src/layouts/BaseLayout.astro
git commit -m "feat(landing): add BaseLayout with meta and global styles"
```

---

## Task 3: Nav component

**Files:**
- Create: `apps/landing/src/components/Nav.tsx`

- [ ] **Step 1: Create `apps/landing/src/components/Nav.tsx`**

```tsx
import type React from 'react';

export default function Nav(): React.ReactElement {
  return (
    <nav className="sticky top-0 z-50 bg-nb-black border-b-4 border-nb-black">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <span className="text-nb-yellow font-black text-2xl uppercase tracking-widest">CTM</span>
        <a
          href="#"
          className="border-2 border-white text-white font-black uppercase tracking-wide px-4 py-2 text-sm hover:bg-white hover:text-nb-black transition-colors"
        >
          GET STARTED →
        </a>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Wire Nav into `index.astro` temporarily to verify it renders**

Create `apps/landing/src/pages/index.astro` with just the Nav:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav';
---

<BaseLayout>
  <Nav />
</BaseLayout>
```

- [ ] **Step 3: Check dev server at `http://localhost:4321`**

Expected: Black sticky nav bar at the top, "CTM" in yellow on the left, "GET STARTED →" ghost button on the right. Page is otherwise white.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/Nav.tsx apps/landing/src/pages/index.astro
git commit -m "feat(landing): add Nav component"
```

---

## Task 4: Hero section

**Files:**
- Create: `apps/landing/src/components/Hero.tsx`

- [ ] **Step 1: Create `apps/landing/src/components/Hero.tsx`**

```tsx
import type React from 'react';

export default function Hero(): React.ReactElement {
  return (
    <section className="bg-nb-yellow border-b-4 border-nb-black py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-black text-nb-black uppercase text-6xl md:text-8xl leading-none tracking-tight mb-6">
          ALL YOUR TASKS.
          <br />
          ONE PLACE.
        </h1>
        <p className="font-bold text-nb-black text-xl md:text-2xl mb-10 max-w-xl">
          Connect Todoist, Google Tasks, and more. Manage everything from a
          single dashboard, CLI, or AI agent.
        </p>
        <div className="flex gap-4 flex-wrap">
          <a
            href="#"
            className="bg-nb-black text-white font-black uppercase tracking-wide border-2 border-nb-black px-6 py-3 shadow-[4px_4px_0px_#111111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            GET STARTED →
          </a>
          <a
            href="#"
            className="bg-white text-nb-black font-black uppercase tracking-wide border-2 border-nb-black px-6 py-3 shadow-[4px_4px_0px_#111111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            VIEW DOCS →
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add Hero to `index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
---

<BaseLayout>
  <Nav />
  <main>
    <Hero />
  </main>
</BaseLayout>
```

- [ ] **Step 3: Check dev server**

Expected: Below the black nav, a full-width yellow section with large bold headline "ALL YOUR TASKS. ONE PLACE.", descriptive tagline, and two neobrutalist buttons with hard shadows.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/Hero.tsx apps/landing/src/pages/index.astro
git commit -m "feat(landing): add Hero section"
```

---

## Task 5: Features section

**Files:**
- Create: `apps/landing/src/components/Features.tsx`

- [ ] **Step 1: Create `apps/landing/src/components/Features.tsx`**

```tsx
import type React from 'react';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: '⚡',
    title: 'Aggregate',
    description:
      'Pull tasks from Todoist, Google Tasks, and more into a single, unified view.',
  },
  {
    icon: '🎯',
    title: 'Fuzzy Deadlines',
    description:
      "Mark tasks as 'this week', 'this month', or 'someday' — without touching the source.",
  },
  {
    icon: '🤖',
    title: 'CLI + AI Agent',
    description:
      'Manage your tasks from the terminal or through Claude and other AI agents via MCP.',
  },
  {
    icon: '🔔',
    title: 'Smart Reminders',
    description:
      'Daily and weekly nudges for tasks that actually need your attention.',
  },
];

export default function Features(): React.ReactElement {
  return (
    <section className="bg-white border-b-4 border-nb-black py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-black text-nb-black uppercase text-4xl md:text-5xl mb-12">
          WHAT IT DOES
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white border-2 border-nb-black shadow-[4px_4px_0px_#111111] p-6"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="font-black text-nb-black uppercase text-lg mb-2">
                {feature.title}
              </h3>
              <p className="font-bold text-nb-black text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add Features to `index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Features from '../components/Features';
---

<BaseLayout>
  <Nav />
  <main>
    <Hero />
    <Features />
  </main>
</BaseLayout>
```

- [ ] **Step 3: Check dev server**

Expected: White section below the hero, "WHAT IT DOES" heading, then a grid of 4 neobrutalist cards (1-col on mobile, 4-col on wide desktop) each with an emoji icon, bold title, and description.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/Features.tsx apps/landing/src/pages/index.astro
git commit -m "feat(landing): add Features section"
```

---

## Task 6: How It Works section

**Files:**
- Create: `apps/landing/src/components/HowItWorks.tsx`

- [ ] **Step 1: Create `apps/landing/src/components/HowItWorks.tsx`**

```tsx
import type React from 'react';

interface Step {
  number: string;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Connect your task apps',
    description: 'Link Todoist, Google Tasks, or any supported source via OAuth in seconds.',
  },
  {
    number: '02',
    title: 'Tasks sync automatically',
    description: 'CTM polls your sources every 15 minutes and keeps everything up to date.',
  },
  {
    number: '03',
    title: 'Manage from anywhere',
    description:
      'Use the web dashboard, the CLI, or your AI agent — all backed by the same API.',
  },
];

export default function HowItWorks(): React.ReactElement {
  return (
    <section className="bg-nb-yellow border-b-4 border-nb-black py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-black text-nb-black uppercase text-4xl md:text-5xl mb-12">
          HOW IT WORKS
        </h2>
        <div className="flex flex-col gap-6">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-6 items-start">
              <div className="min-w-16 h-16 bg-nb-black text-nb-yellow font-black text-xl flex items-center justify-center border-2 border-nb-black shrink-0">
                {step.number}
              </div>
              <div className="pt-2">
                <h3 className="font-black text-nb-black uppercase text-xl mb-1">
                  {step.title}
                </h3>
                <p className="font-bold text-nb-black leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add HowItWorks to `index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
---

<BaseLayout>
  <Nav />
  <main>
    <Hero />
    <Features />
    <HowItWorks />
  </main>
</BaseLayout>
```

- [ ] **Step 3: Check dev server**

Expected: Yellow section below Features, "HOW IT WORKS" heading, then 3 rows each with a black square step number in yellow text on the left and title + description on the right.

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/HowItWorks.tsx apps/landing/src/pages/index.astro
git commit -m "feat(landing): add HowItWorks section"
```

---

## Task 7: Integrations section

**Files:**
- Create: `apps/landing/src/components/Integrations.tsx`

- [ ] **Step 1: Create `apps/landing/src/components/Integrations.tsx`**

```tsx
import type React from 'react';

interface Integration {
  name: string;
  color: string;
  initial: string;
}

const integrations: Integration[] = [
  { name: 'Todoist', color: '#DB4035', initial: 'T' },
  { name: 'Google Tasks', color: '#4285F4', initial: 'G' },
];

export default function Integrations(): React.ReactElement {
  return (
    <section className="bg-white border-b-4 border-nb-black py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-black text-nb-black uppercase text-4xl md:text-5xl mb-4">
          WORKS WITH
        </h2>
        <p className="font-bold text-nb-black text-lg mb-12">
          Connect your existing task apps. More integrations coming soon.
        </p>
        <div className="flex flex-wrap gap-6">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center gap-4 bg-white border-2 border-nb-black shadow-[4px_4px_0px_#111111] px-6 py-4"
            >
              <div
                className="w-10 h-10 flex items-center justify-center font-black text-white text-lg border-2 border-nb-black shrink-0"
                style={{ backgroundColor: integration.color }}
              >
                {integration.initial}
              </div>
              <span className="font-black text-nb-black uppercase text-lg">
                {integration.name}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-4 border-2 border-dashed border-nb-black px-6 py-4">
            <div className="w-10 h-10 flex items-center justify-center font-black text-nb-black text-xl border-2 border-dashed border-nb-black shrink-0">
              +
            </div>
            <span className="font-bold text-nb-black uppercase text-sm tracking-wide">
              MORE COMING SOON
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add Integrations to `index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import Integrations from '../components/Integrations';
---

<BaseLayout>
  <Nav />
  <main>
    <Hero />
    <Features />
    <HowItWorks />
    <Integrations />
  </main>
</BaseLayout>
```

- [ ] **Step 3: Check dev server**

Expected: White section below HowItWorks, "WORKS WITH" heading, two solid integration cards (Todoist red, Google Tasks blue) and a dashed ghost card with "+".

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/Integrations.tsx apps/landing/src/pages/index.astro
git commit -m "feat(landing): add Integrations section"
```

---

## Task 8: Footer CTA

**Files:**
- Create: `apps/landing/src/components/FooterCta.tsx`

- [ ] **Step 1: Create `apps/landing/src/components/FooterCta.tsx`**

```tsx
import type React from 'react';

export default function FooterCta(): React.ReactElement {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-nb-black py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="font-black text-nb-yellow uppercase text-4xl md:text-6xl leading-tight mb-6">
          READY TO TAKE CONTROL?
        </h2>
        <p className="font-bold text-white text-lg mb-10">
          One place for all your tasks. Connect in seconds.
        </p>
        <a
          href="#"
          className="inline-block bg-nb-yellow text-nb-black font-black uppercase tracking-wide border-2 border-nb-yellow px-8 py-4 text-lg shadow-[4px_4px_0px_#FFDE59] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
        >
          GET STARTED →
        </a>
        <p className="text-white/40 font-bold mt-16 text-sm uppercase tracking-widest">
          © {year} CTM
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Finalize `index.astro` with all sections**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import Features from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import Integrations from '../components/Integrations';
import FooterCta from '../components/FooterCta';
---

<BaseLayout>
  <Nav />
  <main>
    <Hero />
    <Features />
    <HowItWorks />
    <Integrations />
  </main>
  <FooterCta />
</BaseLayout>
```

- [ ] **Step 3: Check dev server — full page review**

Visit `http://localhost:4321`. Scroll through the entire page and verify:
- Nav: sticky, black, CTM in yellow, GET STARTED button
- Hero: yellow background, large headline, two buttons with hard shadows
- Features: white background, 4 cards in a grid
- How It Works: yellow background, 3 numbered steps
- Integrations: white background, Todoist + Google Tasks + ghost card
- Footer: black background, yellow headline, yellow CTA button, copyright

- [ ] **Step 4: Commit**

```bash
git add apps/landing/src/components/FooterCta.tsx apps/landing/src/pages/index.astro
git commit -m "feat(landing): add FooterCta and complete page"
```

---

## Task 9: Build and verify static output

**Files:** None (verification only)

- [ ] **Step 1: Run the static build**

```bash
pnpm --filter @ctm/landing build
```

Expected output (approximately):
```
▶ Building...
✓ Completed in X.XXs

 dist/index.html   X.X kB
 dist/favicon.svg
```

No errors. The `dist/` folder is created.

- [ ] **Step 2: Inspect the output HTML**

```bash
grep -c "<script" apps/landing/dist/index.html
```

Expected: `0` — no `<script>` tags (the page is pure static HTML with zero JavaScript).

```bash
grep "ALL YOUR TASKS" apps/landing/dist/index.html
```

Expected: The headline text appears directly in the HTML (not loaded client-side).

- [ ] **Step 3: Preview the built output**

```bash
pnpm --filter @ctm/landing preview
```

Visit `http://localhost:4321`. Confirm the full page renders identically to the dev server.

- [ ] **Step 4: Commit build verification note**

No files to commit — build output (`dist/`) is gitignored by default in Astro.

Verify `apps/landing/dist` is covered by the root `.gitignore` (check for `dist` or `apps/landing/dist`). If not, add it:

```bash
echo "apps/landing/dist" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore landing dist output"
```

---

## Task 10: Turbo pipeline check

**Files:** None (verification only)

- [ ] **Step 1: Verify Turbo picks up the landing app**

```bash
pnpm build --filter @ctm/landing
```

Expected: Turbo runs the `build` task for `@ctm/landing`. The `dist/` output is cached under `.turbo/`.

- [ ] **Step 2: Verify dev command works via Turbo**

```bash
pnpm dev --filter @ctm/landing
```

Expected: Astro dev server starts. This confirms `apps/landing` is a first-class workspace member.

- [ ] **Step 3: Final commit if any cleanup needed**

If you made any fixes during verification:

```bash
git add -p
git commit -m "fix(landing): address build issues found during verification"
```
