# Timezone correctness

Closes #46.

## Problem

Due dates are stored as UTC instants, but every "which day is this?" decision is made with the
local clock of whichever machine is asking. The browser buckets and paints the calendar with
`Date#getFullYear/getMonth/getDate`; `apps/main` runs its reminder crons against the server's own
clock. A task due 09:00 in London is a different calendar day in Auckland, and the two disagree
about whether it is late.

## Answers to the open questions

**Is a due date an instant or a wall-clock date?** Both, stored distinctly.

- A **timed** due date is an instant. `due.date` is the UTC instant, `due.timezone` names the IANA
  zone whose wall clock the instant was written in (already on the schema, previously unused).
- An **all-day** due date is a wall-clock date with no instant. It is stored as the UTC midnight of
  that calendar date with `due.allDay = true`, and is read back in UTC, so it names the same
  calendar day for every reader. Both Todoist (`due.date` without a time part) and Google Tasks
  (which only ever sends a date) produce all-day dates today, and both were silently turned into
  instants at the syncing machine's offset.

**Do we store an IANA timezone on the user?** Yes. `user.timezone`, an IANA identifier validated at
the edge. It defaults to `UTC` so existing rows stay valid, and `apps/web` writes the browser's
resolved zone on sign-in whenever it differs from the stored value. Server-side day arithmetic
(reminder crons, the `today`/`upcoming` list filters, the `surfaced` weekday check) reads that zone
instead of the server's clock.

**What happens when a user changes timezone?** Instants are preserved; wall-clock renderings move.
A task due at a specific instant keeps that instant, because the world it was agreed with did not
move. All-day dates keep their calendar date, because they never had an instant to preserve. This
means a traveller sees a timed task shift its clock face and possibly its calendar cell, and sees
an all-day task stay put. No migration of task rows is needed.

## Semantics, pinned

- The date key for a task is computed in UTC for all-day tasks and in the viewer's zone for timed
  ones.
- "Overdue" is measured against the start of today in the viewer's zone, in whole days.
- Snooze lands at 09:00 wall clock in the viewer's zone, resolved to an instant at the moment of
  the write.
- The daily reminder cron fires at 09:00 in each user's own zone, not 09:00 on the server.
- Due-date reminders for all-day tasks fire at 09:00 in the owner's zone, because UTC midnight is
  the middle of the previous evening for a large part of the world.

## Scope

New `@ctm/time` package: Intl-backed zone arithmetic, shared by `apps/main` and `apps/web` so the
two cannot drift. It has no dependencies and makes no local-clock calls.

Tests run under a fixed non-UTC `TZ` so a reintroduced local-clock assumption fails rather than
passes on the developer's machine.

Out of scope, tracked separately: writing all-day dates back out to connectors as all-day, and a
manual timezone picker in settings beyond the automatic browser detection.
