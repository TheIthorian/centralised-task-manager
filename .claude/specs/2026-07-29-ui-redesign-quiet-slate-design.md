# Quiet Slate UI Redesign: Design Spec

Status: agreed direction, ready to build in phases.
Working reference (mocks, live demos): https://claude.ai/code/artifact/fad267df-da0d-4616-8e6c-68d461aa7df2

## 1. Goal

Replace the neobrutalist visual layer in `apps/web` with **Quiet Slate**: green-biased
neutrals, one pine accent, hairline borders, no offset shadows. Routes and features stay
where they are for the reskin itself. Alongside the reskin, three capabilities land that
the current UI has no home for: saved filter views, a command palette, and calendar
ranges below a month.

Two structural rules govern the whole effort:

1. **Components and styling live in `packages/ui`.** `apps/web` owns routing, data
   fetching, URL state and side effects. If a component can be described without
   mentioning the API, it belongs in `@ctm/ui`.
2. **Every component in `@ctm/ui` has a test and a story.** The package gets its own
   vitest setup, and a new `apps/storybook` renders the package so components can be
   built and reviewed before any wiring.

## 2. Current state

| Area           | Today                                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui`  | 5 components (`Button`, `Input`, `Badge`, `Checkbox`, `Modal`), no tests, no story, `exports` points straight at `src/index.ts`, no build step                             |
| Design tokens  | `apps/web/src/index.css` `@theme` block: `--color-nb-yellow`, `--color-nb-black`, `--color-nb-red`, `--color-nb-green`, `--color-nb-grey`, `--shadow-nb`, `--shadow-nb-lg` |
| Tailwind       | v4 via `@tailwindcss/vite`, dark mode through `@custom-variant dark (&:where(.dark, .dark *))`, `@source "../../../packages/ui/src"` so the package's classes get compiled |
| Web components | ~30 files under `apps/web/src/components`, most with a co-located `*.spec.tsx` using `@testing-library/react` + jsdom                                                      |
| Brand icons    | `apps/web/src/lib/brand-icons.ts` plus `apps/web/src/assets/brands/*.svg`, imported through `vite-plugin-svgr` (`?react`)                                                  |
| Mutations      | `@tanstack/react-query` 5.101.4                                                                                                                                            |

## 3. Design tokens

Tokens move to `packages/ui/src/styles/tokens.css` and are imported by both consumers
(`apps/web/src/index.css` and the Storybook preview). The package owns the palette
because the package owns the components that use it.

Quiet Slate, light:

| Token               | Value     | Used for                         |
| ------------------- | --------- | -------------------------------- |
| `--color-bg`        | `#fbfbfa` | page ground                      |
| `--color-panel`     | `#ffffff` | lists, cards, sheets             |
| `--color-fg`        | `#1c1f1e` | body text                        |
| `--color-muted`     | `#6b716e` | secondary text, metadata         |
| `--color-line`      | `#e2e4e1` | container borders                |
| `--color-hair`      | `#eceeeb` | row separators                   |
| `--color-accent`    | `#2f5d50` | primary action, selection, today |
| `--color-accent-fg` | `#ffffff` | text on accent                   |
| `--color-warn`      | `#a2442f` | overdue, failure                 |
| `--color-warn-bg`   | `#faeeeb` | overdue pill ground              |
| `--color-nav-bg`    | `#f1f2f0` | sidebar                          |
| `--color-nav-fg`    | `#5c625f` | sidebar text                     |
| `--color-nav-on-bg` | `#e2e7e4` | active nav item, neutral pill    |
| `--color-nav-on-fg` | `#1c1f1e` | active nav text                  |

Quiet Slate, dark (same hue family, accent lifts so it stays legible):

| Token               | Value     |
| ------------------- | --------- |
| `--color-bg`        | `#121614` |
| `--color-panel`     | `#191e1b` |
| `--color-fg`        | `#e4e8e5` |
| `--color-muted`     | `#98a09b` |
| `--color-line`      | `#262c29` |
| `--color-hair`      | `#1f2522` |
| `--color-accent`    | `#7fbfa9` |
| `--color-accent-fg` | `#0f1412` |
| `--color-warn`      | `#e8917a` |
| `--color-warn-bg`   | `#2a1c19` |
| `--color-nav-bg`    | `#0d100f` |
| `--color-nav-fg`    | `#98a09b` |
| `--color-nav-on-bg` | `#1f2724` |
| `--color-nav-on-fg` | `#e4e8e5` |

Shape and density:

| Token                | Value                           | Note                                                      |
| -------------------- | ------------------------------- | --------------------------------------------------------- |
| `--radius-ctm`       | `8px`                           | one radius everywhere except the palette, which is `12px` |
| `--ctm-row-y`        | `10px`                          | vertical row padding, driven by the density setting       |
| `--shadow-overlay`   | `0 18px 40px rgb(0 0 0 / 0.22)` | the only shadow in the system, for overlays               |
| `--duration-press`   | `120ms`                         | hover and press                                           |
| `--duration-surface` | `180ms`                         | sheets, toasts, palette                                   |
| `--duration-leave`   | `240ms`                         | a row leaving a list                                      |

No offset shadows, no `--shadow-nb`. `--shadow-overlay` exists because an overlay sits
above blurred content and needs to detach from it.

### 3.1 Density is a user setting

Three values, using the names the category already uses: **compact**, **comfortable**
(default), **spacious**. The setting drives one custom property, `--ctm-row-y`, applied
through a `data-density` attribute on the document element:

| Density | `--ctm-row-y` | Roughly, rows above the fold at 900px |
| --- | --- | --- |
| compact | `6px` | 22 |
| comfortable | `10px` | 15 |
| spacious | `16px` | 10 |

- Stored in `localStorage` under `ctm.density`, alongside the existing theme preference.
  It is a display preference, not account data, so it does not need an endpoint.
- An unset or unrecognised stored value falls back to comfortable. Nothing throws: a bad
  value in local storage is not a reason to fail a page render.
- Applied by writing `data-density` on `document.documentElement`, the same mechanism the
  theme already uses, so a single attribute change reflows every list at once.
- Touch targets stay at 44px minimum below 768px whatever the setting says. Compact
  affects the desktop row rhythm only.
- The control lives in Settings under Appearance, next to the theme control, as a
  `SegmentedControl` with a live preview of three task rows underneath so the choice is
  made by looking rather than guessing.

Compact only pays off for people who regularly hold 20 or more open tasks, which is why
comfortable is the default rather than the densest option.

Semantic colour is separate from the accent: `--color-warn` never doubles as an accent,
and the accent never signals a problem.

## 4. Component inventory

Everything below lives in `packages/ui/src`. Each component gets `Name.tsx`,
`Name.spec.tsx` and `Name.stories.tsx` side by side.

### 4.1 Primitives (reskin of what exists)

- `Button` (`primary` | `secondary` | `ghost` | `danger`): loses `font-black uppercase`,
  the 2px border and the offset shadow. Gains a quiet `hover:bg` shift and a 2px accent
  focus ring.
- `Input`: 1px `--color-line` border, accent ring on focus, label in `--color-muted` at
  11px with `0.12em` letter spacing.
- `Checkbox`: keeps the button-with-`role="checkbox"` implementation, restyled to a
  `--radius-ctm` minus 4px square with a `--color-muted` border and an accent fill when
  checked.
- `Badge`: variants become `priority` | `source` | `neutral` | `warn`. Priority renders
  a name ("Priority 1"), never a bare number.
- `Modal`: unchanged behaviour (portal, Escape, backdrop click, mobile slide-up). New
  ground, new border, `--shadow-overlay`.

### 4.2 New primitives

- `Chip`: pill-shaped toggle, `aria-pressed`, optional leading icon. The filter bar and
  the calendar range switcher are both chip rows.
- `Kbd`: keycap for shortcut hints.
- `StatusPill`: `ok` | `warn` | `neutral`, for connector health.
- `OwnershipBadge`: `synced` | `local` | `read-only`. Sits at the end of a detail row in
  a muted weight. This is the tax an aggregator pays for aggregating, so it reads as
  information rather than apology.
- `SegmentedControl`: single-select strip for sync policies.
- `Switch`: on/off for rule and preference rows.
- `Skeleton`: shaped like the row it replaces, never a centred spinner.
- `EmptyState`: title plus one sentence plus optional action. Copy is always passed in by
  the caller, because empty copy is written per filter and never shared.
- `Banner` (`warn` | `info`): inline, above the affected list. Sync failures use this.
  They are never toasts, because a toast disappears before it can be acted on.
- `Toast` + `ToastRegion`: for things the user did, with an optional undo action.
- `Sheet`: mobile bottom sheet with focus trap, Escape, and
  `env(safe-area-inset-bottom)` padding.
- `BrandIcon`: moves from `apps/web/src/components/BrandIcon.tsx` together with
  `brand-icons.ts` and `assets/brands/*.svg`.

### 4.3 Composites

- `SourcePill`: `BrandIcon` plus account label. Provenance reads before the words do.
- `TaskRow`: checkbox, title, meta cluster (source pill, due state), optional pending
  state. Pure props, no data fetching. Pending means dimmed and pinned in place, not
  struck through.
- `TaskGroup` / `GroupedTaskList`: group heading with count, list body, empty message per
  group.
- `FilterChipBar`: chip row over a `FilterCondition[]`.
- `FilterBuilder`: the AND-ed conditions as removable tokens, plus the "save as view"
  affordance.
- `SavedViewPills`: named views with counts, one selected.
- `CommandPalette`: see section 5.
- `CalendarMonthGrid`, `CalendarTimeGrid` (week and 3-day share it), `DayAgenda`.
- `TimelineTrack`: lanes plus hour header plus now marker.
- `ConnectorRow`: brand icon, account name, staleness line, `StatusPill`, row actions.
- `DeliveryLadder`: reminder attempts with channel and outcome per step, including the
  final "stop" step. Telling the user where the system stops is what makes the rest
  believable.
- `TaskDetailPanel` with `WhenSection`, `RemindersSection`, `DetailsSection`,
  `ProvenanceSection`. A field with no value renders no row; it is offered under "add".

### 4.4 Layout

`AppShell`, `Sidebar`, `BottomTabs`, `TopBar` keep their current responsibilities and
move their presentational half into `@ctm/ui`. Navigation targets are passed in as
props, so the package never imports `react-router`.

## 5. Command palette

Opened with `Cmd+K` (`Ctrl+K` on Windows and Linux). It replaces the always-on command
bar from direction D: a bar costs vertical space on every screen and invites typing where
nobody is looking.

Appearance:

- Scrim: `--color-bg` at 52% opacity plus `backdrop-filter: blur(7px) saturate(115%)`,
  with the `-webkit-` prefix alongside. The blur is the point, so the dialog reads as
  floating above the app rather than pasted onto it.
- Dialog: ground is `--color-panel` mixed 88% with `--color-bg`, border is `--color-fg`
  at 14% over `--color-line`, radius 12px, `--shadow-overlay`, plus a 1px inset light
  line along the top edge.
- Input row carries a `--color-fg` at 3% wash so it separates from the results without
  a second border.
- Entry: 180ms, opacity plus `translateY(-8px)` and `scale(.985)`, easing
  `cubic-bezier(.2,.8,.3,1)`. Under `prefers-reduced-motion` the animation is dropped and
  the blur stays.

Grammar, one string with four prefixes:

| Prefix | Scope                                                          |
| ------ | -------------------------------------------------------------- |
| (none) | fuzzy match across views, tasks, actions, ranked in that order |
| `>`    | actions                                                        |
| `#`    | saved views                                                    |
| `@`    | accounts and sources                                           |

Behaviour:

- `ArrowUp` / `ArrowDown` move the selection, `Enter` runs it, `Escape` closes and returns
  focus to the element that opened it.
- An empty query shows the last five things run, stored locally.
- A query that matches nothing is not a dead end: `Enter` hands the raw string to the
  agent over the same MCP tools an external client uses. That is the assistant story
  without a command parser of our own.
- Groups with no visible items hide their heading.

## 6. Filters and saved views

A condition is one of four kinds, and everything users ask for reduces to these:

```ts
type FilterCondition =
    | { kind: 'source'; value: string }
    | { kind: 'due'; value: 'overdue' | 'today' | 'week' | 'none' }
    | { kind: 'tag'; value: string }
    | { kind: 'field'; value: 'noDate' | 'noDuration' | 'hasReminder' };
```

Conditions are AND-ed. Chips compose them; the palette accepts the typed equivalent.
There is no filter query language: Todoist's is powerful and almost nobody writes it
twice.

State lives in the URL query string, so a view can be bookmarked, shared and restored
after a refresh. A saved view is a name plus that query string, per user. Views appear in
the sidebar, in the palette under `#`, and as the mobile chip row. Ordering is
drag-and-drop, there is no folder tree.

## 7. Calendar ranges

Four ranges behind one switcher, with the range in the query string so a link opens on
the same view.

| Range | Shape                                                                                  |
| ----- | -------------------------------------------------------------------------------------- |
| Month | day grid, tasks as chips, today's cell accented, days outside the month recede         |
| Week  | 7 columns, hours down the side, now marker across the track                            |
| 3 day | the same time grid with 3 columns                                                      |
| Day   | agenda list, no hour grid, because a single column of hour lines is mostly empty space |

Week and 3-day render load as area rather than as a count, which is the reason to have
them at all. On mobile the month grid drops chips for dots and moves detail into an
agenda underneath.

## 8. Write model

**No optimistic writes.** TanStack Query does support them through `onMutate` plus a
rollback in `onError`, and we are deliberately not using them: the moment the client
patches its own cache, the UI can show a state the backend never agreed to.

The flow for every write:

1. Mutation posts to our API. The endpoint returns the updated task.
2. While it is in flight the row renders `pending` from `isPending`: dimmed, pinned in
   place, not struck through.
3. On success the response is written to the query cache and the task query is
   invalidated. The row re-renders from server data.
4. Undo is a real second call, offered in a toast for five seconds.

This stays fast because our API is not the connector. Our own database answers in one
short round trip; the push to Todoist or Google Tasks happens on the queue afterwards and
is reported on the connector row and in the sync ledger. It is never faked in the list.

## 9. Interaction rules

- Toasts are only for things the user did. System failures are inline banners.
- Focus is always visible: a 2px accent ring, never `outline: none`. Dialogs and sheets
  trap focus and restore it on close.
- Motion uses the three durations from section 3 and nothing else. Everything eases out.
  `prefers-reduced-motion` collapses motion to an instant state change; nothing depends
  on animation to be understood.
- Loading uses skeletons shaped like the real rows. Cached data renders immediately with
  a "syncing" note in the header.
- Keyboard: `J`/`K` move, `E` completes, `R` reschedules, `C` creates, `/` searches the
  list, `G` then `T`/`C`/`L` navigates, `Cmd+K` opens the palette.

## 10. Mobile

One breakpoint matters: 768px. Below it the sidebar becomes a bottom tab bar and every
page drops to a single column. Timeline goes vertical. Task detail opens as a `Sheet`.
Rows are 44px minimum. Destructive and frequent actions live in the bottom third, the
header holds only title, sync state and the bell.

## 11. Sync model (later phase, recorded here so the UI is not designed twice)

Four modes per account: read only, read and tick off (the default for a new connection),
two way, mirror out. Conflict resolution is per field, not per task, because whole-record
last-write-wins is what makes two-way sync feel like it eats your work.

Any change that increases write access shows a dry run first: a reviewable list of what
would change, including the rows we would skip and why.

**No circuit breaker and no "sync halted" screen.** A guard that counts changes tells the
user to expect a disaster. The dry run, queue-and-retry on write failure, and the write
ledger with undo are the guarantees instead.

Two-way sync cannot ship without three things that do not exist yet: a shadow copy of
last-synced field values, origin and revision stamps for echo suppression, and the write
ledger. That is a separate project from this redesign.

## 12. Rules as sentences: parked

"When a task is overdue by two days, text me" is the right shape and the wrong build. A
rules engine plus a sentence parser plus a token editor is a product on its own, and it is
the one thing on the plan an agent already does better. The user says the sentence to
their agent, which has the query API, the reminder endpoints and a schedule to work with.

So the work is primitives, not rules: reminders creatable at an arbitrary time on an
arbitrary channel, a task query expressive enough to answer "overdue by two days", and
connector health readable over the API. All three are on the list for other reasons.

One exception is worth building ourselves: alert me when a connector stops syncing. It has
no conditions to express, it closes the silent-staleness loop, and it is a checkbox plus a
scheduled check rather than an engine.

## 13. Accessibility

Non-negotiable, and cheaper to hold than to retrofit.

**Semantics.** Interactive things are `button`, `a`, `input` or a correct ARIA role.
No click handlers on `div`. Lists that are lists use list semantics. Every icon-only
control carries an `aria-label`; decorative marks carry `aria-hidden="true"` so a screen
reader does not read "Todoist" twice on the same row.

**Focus.** A visible 2px accent ring on every focusable element, never `outline: none`.
Dialogs, sheets and the palette trap focus, close on Escape, and return focus to the
element that opened them. The app starts with a skip link to the main region, because the
sidebar is long and keyboard users should not walk it on every navigation.

**Keyboard.** Everything reachable by mouse is reachable by keyboard: the palette
(`Cmd+K`), the list shortcuts from section 9, arrow navigation inside the palette and the
segmented controls, and Space or Enter on the row checkbox. Roving `tabindex` inside chip
rows so a long filter bar is one tab stop, not fifteen.

**State announced, not just drawn.** `aria-pressed` on chips, `aria-checked` on the row
checkbox, `aria-current` on the active nav item and the selected saved view,
`aria-selected` on palette options, `aria-live="polite"` on the filter result count, sync
status and toasts, `aria-busy` on a list that is refetching. A pending row sets
`aria-disabled` and keeps its position, so the reading order does not jump under someone
mid-sentence.

**Contrast.** WCAG 2.2 AA as the floor: 4.5:1 for body text, 3:1 for large text and for
the boundary of any control that carries meaning. Both themes are checked, not just light.
`--color-muted` on `--color-panel` was the pair most at risk, which is why muted is
`#6b716e` in light and `#98a09b` in dark rather than the first values drafted: both clear
4.5:1 on their own ground. Meaning is never carried by colour alone: overdue has a word, connector health
has a label as well as a pill.

**Motion and zoom.** `prefers-reduced-motion` collapses every transition to an instant
state change, and nothing depends on animation to be understood. Layout survives 200% zoom
and a 320px viewport without horizontal scrolling; wide content scrolls inside its own
container.

**Touch.** 44px minimum target below 768px, whatever the density setting says.

Automated checks: `jest-axe` runs against every `@ctm/ui` component in its spec, which
catches missing labels, bad roles and invalid ARIA. Axe cannot judge focus order, reading
order or contrast in context, so each phase also ends with a keyboard-only pass and a
screen-reader pass over the screens it touched.

## 14. Internationalisation

All user-visible text in `apps/web` comes from a translation catalogue. English only for
now, `apps/web/src/i18n/en.json`, no second locale and no language detector: adding a
locale later is a file, whereas hunting literals later is a rewrite.

- `i18next` plus `react-i18next`, initialised once in `apps/web/src/i18n/index.ts` with
  `lng: 'en'` and `fallbackLng: false`. A missing key is a visible bug, not a silent
  fallback to a key path that looks like copy.
- Keys are namespaced by surface, dot-separated, and named for meaning rather than for the
  string: `tasks.filters.overdue`, not `tasks.filters.overdueLabel` or `overdue_1`.
- Types come from the catalogue itself, so a typo in a key is a compile error:

```ts
// apps/web/src/i18n/i18next.d.ts
import type en from './en.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'app';
        resources: { app: typeof en };
    }
}
```

- Plurals use i18next's `_one` / `_other` suffixes, never string concatenation. Counts and
  dates are interpolated, never assembled: `t('tasks.count', { count })`.
- Dates, times and numbers are formatted with `Intl`, in the user's own locale and time
  zone, not hand-formatted.
- `packages/ui` never imports i18next. Components take their copy as props, which is
  already the rule for `EmptyState` and `Banner`. This keeps the package testable without
  a provider and keeps copy decisions in the app where the context is.

## 15. Testing policy

`packages/ui` gets its own vitest project: jsdom, `@testing-library/react`,
`@testing-library/jest-dom`, `@testing-library/user-event`, `jest-axe`, and a setup file.
Specs are co-located as `src/Name.spec.tsx`, matching the convention in `apps/web`.

What a `@ctm/ui` test asserts:

- Rendered semantics: role, accessible name, `aria-pressed` / `aria-checked` /
  `aria-selected`, `aria-modal`.
- Keyboard behaviour: arrow navigation, Enter, Escape, focus restoration.
- Prop-driven states: disabled, pending, empty, error.
- Callback contracts: the handler fires once with the expected argument.
- No axe violations, through `expect(await axe(container)).toHaveNoViolations()`. Axe is a
  floor, not a ceiling: it cannot judge focus order, reading order or contrast in context,
  so section 13's manual passes still happen.

What it must not assert: Tailwind class strings, snapshots of markup, or colour values.
Those change with every design pass and testing them makes the suite an obstacle to
design work. Token correctness is reviewed in Storybook, not in vitest.

`apps/web` tests keep their current job: routing, data fetching, URL state, and the wiring
between them. Web tests query by role and accessible name, which means they exercise the
translation catalogue: a missing key fails the test that looks for the text. When presentational logic moves into `@ctm/ui`, its test moves with it
rather than being duplicated.

## 16. Storybook

A new workspace app, `apps/storybook`, using `@storybook/react-vite` with the same Vite
plugins as `apps/web` (`react`, `tailwindcss`, `svgr`). It is a development tool: no
deploy target, no CI publish, not in the production build graph.

- Stories live next to their component in `packages/ui/src`, because files that change
  together should live together. `apps/storybook/.storybook/main.ts` points at
  `../../packages/ui/src/**/*.stories.tsx`.
- The preview imports `packages/ui/src/styles/tokens.css` and toggles the `dark` class on
  the story root, so both themes are reviewable from the toolbar.
- Every component ships a default story plus one story per meaningful state. A component
  with no story is not finished.
- Run with `pnpm --filter @ctm/storybook dev`.

Storybook is where a component is built and judged before it is wired to data. It is also
where the next round of concepts gets prototyped, which is the reason it exists rather
than a nice-to-have.

## 17. Phasing

| Phase | Contents | Plan |
| --- | --- | --- |
| 1 | Test harness, tokens, translations, Storybook, primitives, density setting, brand icons, source pills, task list, filters and saved views, command palette, accessibility pass | `.claude/plans/2026-07-29-ui-redesign-foundation.md` |
| 2 | Calendar ranges, timeline, mobile shell and sheets | follow-up plan |
| 3 | Task detail panel, connector capability map in the API | follow-up plan |
| 4 | Sync model UI, ledger, dry run | follow-up plan, blocked on backend work in section 11 |
| 5 | Reminders with delivery proof, auditable sync surfaces | follow-up plan |

The old `nb-*` tokens are deleted at the end of phase 1, once nothing references them.

## 18. Open questions

1. How strong the accent goes on dark before it starts shouting. Decide in Storybook with
   real rows on screen.
2. Whether the second nav column lists accounts and sources rather than projects.
   Provenance is the axis no competitor can copy, which argues for accounts.
3. Whether `fuzzyDeadline` and `due` can both be set. The detail panel assumes not: a task
   is either scheduled or vague, and choosing "someday" clears the date.
4. Whether long-press multi-select ships with the reskin or after it.
