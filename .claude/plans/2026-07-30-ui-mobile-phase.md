# Mobile phase, Quiet Slate UI redesign

Last phase of the redesign. Everything else has shipped into `feat/ui-redesign`.

## Ground rules

Branch from `feat/ui-redesign` (not `main`), open one PR back into `feat/ui-redesign`.
`main` deploys to production, so nothing goes there directly.

Working directory is the worktree at `.claude/worktrees/ui-page-migration`. Do not cd out of it.

## References

There is no spec file in source control: the redesign spec and plan were deliberately kept out
of the repo. The binding references are:

- `CLAUDE.md`, in particular the **Accessibility**, **UI Text and Translations**, **Data
  Fetching and Writes**, **Coding Conventions** and **Testing** sections. Read it in full, it
  overrides defaults.
- The planning artifact: <https://claude.ai/code/artifact/fad267df-da0d-4616-8e6c-68d461aa7df2>
  (layout, interactions, task detail, mobile, sync model, pain points).
- The code that already shipped, which is the pattern to copy:
    - `packages/ui/src/CommandPalette.tsx` for an overlay with a scrim, focus return and
      `motion-safe` entry animation.
    - `packages/ui/src/FilterMenu.tsx` for a dismissable panel (Escape, click outside).
    - `apps/web/src/components/tasks/TaskDetailPanel.tsx` for the desktop side panel this phase
      turns into a sheet on small screens.
    - `apps/web/src/components/layout/BottomTabs.tsx` for `env(safe-area-inset-bottom)` and the
      44px row treatment.
    - `packages/ui/src/styles/tokens.css` for every colour, radius, duration and the
      `--ctm-row-y` density variable. No hardcoded colours anywhere.

## Scope

### 1. Detail panel becomes a bottom sheet below 768px

`apps/web/src/components/tasks/TaskDetailPanel.tsx` is currently `md:w-[690px]` pinned right,
and full screen below that breakpoint. Full screen loses the list behind it and gives no cheap
way out.

Make it a bottom sheet under `md`: rounded top corners, starts around 85dvh, a drag handle at
the top, dismissed by dragging down past a threshold or by tapping the scrim. Keep the desktop
behaviour exactly as it is. Keep `role="dialog"`, `aria-modal`, the labelled heading, Escape,
focus return, and `motion-safe` only.

The sheet mechanics belong in `packages/ui` as a `Sheet` component (with `Sheet.spec.tsx` and
`Sheet.stories.tsx`), since it is presentational. `TaskDetailPanel` composes it.

### 2. Swipe actions on task rows

`packages/ui/src/TaskRow.tsx`. Two tracks, revealed behind the row as it moves. Completion is
not one of them: the checkbox already owns that and stays where it is.

**Swipe right, snooze.** Past the threshold, releasing moves the due date to tomorrow at 09:00
through the existing update mutation. Below the threshold the row snaps back. A toast confirms
the new date. No undo action on that toast: undo is a separate piece of work and this phase
does not open it.

**Swipe left, delete.** The row parks open showing a Delete button on a `--warn` track. Nothing
is deleted until that button is tapped. A gesture alone cannot destroy a task while there is no
undo to catch it, which is the same reasoning behind the two-press confirm in the detail panel.
The row snaps shut on a tap elsewhere, on Escape, or when another row opens.

Constraints:

- Pointer events, not touch events, so it is testable and works with a trackpad.
- The row must stay operable without the gesture. Both actions already have a non-gesture route
  in `TaskDetailPanel`: the due date field and the two-press delete. A gesture is never the only
  route to an action.
- `prefers-reduced-motion` collapses the animation to an instant state change.
- **No optimistic writes.** Snoozing goes through the same mutation and the same `pending` prop
  the checkbox already uses: the row dims and holds still until the server answers. See the Data
  Fetching and Writes section of CLAUDE.md.
- Vertical scrolling must still work. Lock the axis once the gesture is clearly horizontal.
- Only one row is open at a time.

### 3. Touch target and layout audit below 768px

Walk every migrated screen at 375px and 414px wide:

- Tasks, Calendar (all four ranges), Timeline, Settings (all four tabs), Login, Register,
  OAuth consent, Notifications.
- Every interactive element at least 44px, whatever the density setting says. The density
  preference must not shrink targets on a phone.
- No horizontal body scroll. Wide content scrolls inside its own container.
- The fixed notification bell and the palette trigger in `apps/web/src/components/layout/TopBar.tsx`
  and `apps/web/src/palette/CommandPaletteHost.tsx` sit at `top-3` and must not cover page
  headers or the calendar controls.
- `CalendarColumns` at the week range is seven columns on a 375px screen. Decide and implement
  what happens: either it scrolls horizontally in its own container, or the week range falls
  back to the three day layout below `md`. Pick one and say why in the PR.

### 4. Command palette on a phone

`packages/ui/src/CommandPalette.tsx` opens at `pt-[12vh]` with a fixed max width. Check it with
a software keyboard raised: the list must stay reachable and the input must not be covered.

## Out of scope

Do not touch: sync model UI (#40), reminders delivery proof (#41), saved views (#43), the
landing site (#31), strike-through-then-leave (#36). All are tracked separately and blocked on
backend work or on a separate decision.

Undo on write actions is its own piece of work and is not in this phase. The swipe design above
is shaped so that nothing destructive happens without a second deliberate tap while undo is
missing. When undo lands, the delete track can fire on release instead.

## Definition of done

Run these from the worktree root and report the actual output:

- `pnpm --filter @ctm/web test`
- `pnpm --filter @ctm/ui test`
- `pnpm lint`
- `pnpm format`, then re-run both test suites
- `pnpm --filter @ctm/web build`

Tests assert behaviour only: role, accessible name, ARIA state, keyboard, callbacks, plus
`expect(await axe(container)).toHaveNoViolations()` for anything new in `packages/ui`. Never
assert Tailwind class strings or DOM snapshots. Do not weaken an existing test to make it pass.

Every new `packages/ui` component ships three files: `Name.tsx`, `Name.spec.tsx`,
`Name.stories.tsx`. No story means not finished.

All copy comes from `t()` with keys added to `apps/web/src/i18n/en.json`. `fallbackLng` is off,
so a missing key renders as the key path.

## Style

Conventional Commits. PR body is exactly three headings: What, Why, How. No em dashes anywhere,
including code comments. Comments explain why, not how, and never refer to a previous version
of the code or to this brief.
