# CTM Landing Page — Design Spec

**Date:** 2026-05-20
**Status:** Approved

---

## Goal

A static marketing site under `apps/landing` where visitors can learn about CTM's features before signing up. Written as React components, compiled to static HTML at build time for optimal SEO and LLM parsing.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Astro v5 (static output) |
| Components | React 19 `.tsx` (no `client:*` directives — all server-rendered) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Lint/format | oxlint + oxfmt (shared workspace config) |

No JavaScript ships to the browser. All React components compile to static HTML at `astro build` time.

---

## Design System

Identical design tokens to `apps/web` — neobrutalism with hard shadows, thick borders, uppercase font-black type.

| Token | Value | Use |
|---|---|---|
| `nb-yellow` | `#FFDE59` | Hero bg, CTA accent, active states |
| `nb-black` | `#111111` | Borders, shadows, nav bg, all text |
| `nb-red` | `#FF3B30` | Danger / destructive (reserved for future use) |
| `nb-green` | `#34C759` | Integration "available" accent |

**Component patterns (identical to apps/web):**
- Button (primary): `bg-nb-black text-white font-black uppercase tracking-wide border-2 border-nb-black shadow-[4px_4px_0px_#111] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all`
- Card: `bg-white border-2 border-nb-black shadow-[4px_4px_0px_#111]`
- Typography: `font-black` (900) headings, `font-bold` (700) body, `uppercase tracking-wide` on nav and buttons

---

## File Structure

```
apps/landing/
  src/
    pages/
      index.astro              # Entry point — imports all React sections
    layouts/
      BaseLayout.astro         # HTML shell: head, meta, OG tags, global CSS import
    components/
      Nav.tsx                  # Sticky black nav bar, CTM logotype, GET STARTED button
      Hero.tsx                 # Yellow full-viewport section, headline, tagline, 2 CTAs
      Features.tsx             # 4-card grid: Aggregate, Fuzzy Deadlines, CLI+AI, Reminders
      HowItWorks.tsx           # 3 numbered steps on yellow background
      Integrations.tsx         # Todoist + Google Tasks cards + "more coming soon" ghost
      FooterCta.tsx            # Black footer, yellow headline, CTA button, copyright
    styles/
      global.css               # @import "tailwindcss" + @theme tokens
  public/
    favicon.svg
  astro.config.mjs
  tsconfig.json
  package.json
```

---

## Sections

### Nav
Sticky. Black background (`bg-nb-black`). `CTM` logotype in yellow (`font-black text-2xl uppercase`). Right-aligned "GET STARTED →" ghost button (white border, hover fills white/black).

### Hero
Full-viewport yellow background (`bg-nb-yellow`). Headline: `"ALL YOUR TASKS. ONE PLACE."` in massive `font-black` black text. Tagline beneath. Two buttons: "GET STARTED →" (black primary) + "VIEW DOCS →" (white secondary). Both are placeholder `href="#"` for now.

### Features
White background. "WHAT IT DOES" heading. 4 cards in a responsive grid (1-col mobile → 2-col md → 4-col lg):
1. **Aggregate** — Pull tasks from Todoist, Google Tasks, and more into a single unified view.
2. **Fuzzy Deadlines** — Mark tasks as 'this week', 'this month', or 'someday' without touching the source.
3. **CLI + AI Agent** — Manage from the terminal or through Claude and other AI agents via MCP.
4. **Smart Reminders** — Daily and weekly nudges for tasks that actually need your attention.

### How It Works
Yellow background. "HOW IT WORKS" heading. 3 numbered steps with large black step-number boxes:
1. Connect your task apps via OAuth in seconds.
2. Tasks sync automatically every 15 minutes.
3. Manage from the web dashboard, CLI, or AI agent.

### Integrations
White background. "WORKS WITH" heading. Cards for Todoist (red) and Google Tasks (blue), plus a dashed "MORE COMING SOON" ghost card.

### Footer CTA
Black background. Yellow headline: `"READY TO TAKE CONTROL?"`. Yellow CTA button: "GET STARTED →" (`href="#"`). Copyright line.

---

## Monorepo Integration

- `pnpm-workspace.yaml` already picks up `apps/*` — no changes needed.
- `turbo.json` task pipeline already covers `build`, `dev`, `lint`, `format` for all apps.
- `pnpm --filter @ctm/landing dev` starts the Astro dev server.
- `pnpm --filter @ctm/landing build` outputs static files to `apps/landing/dist/`.
