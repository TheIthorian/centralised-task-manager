# Notification Preferences UI

**Date:** 2026-05-26

## Overview

Add a Notifications settings page where users can manage per-type, per-channel notification preferences via a checkbox grid. Changes auto-save on toggle.

## Routing & Navigation

- New route: `/settings/notifications` → `NotificationsPage`
- Add "Notifications" tab to `SettingsLayout` alongside Sources and Profile
- Default `/settings` redirect remains `/settings/sources`

## Data

**Fetch:** `api.getNotificationPreferences()` → `NotificationPreferencesDto`

```ts
type NotificationPreferencesDto = {
    connectorReconnect: ChannelPrefsDto;
    dailySummary: ChannelPrefsDto;
    reminder: ChannelPrefsDto;
    upcomingDeadline: ChannelPrefsDto;
};

type ChannelPrefsDto = { inApp: boolean; discord: boolean; email: boolean };
```

**Discord status:** `api.getDiscordStatus()` → `{ connected: boolean }` — determines whether Discord column is interactive.

**Update:** `api.updateNotificationPreferences({ dto })` — PATCH with partial `UpdateNotificationPreferencesDto`. Called on each individual toggle with optimistic update.

## UI Layout

Single `NotificationsPage` component. No sub-components needed.

### Grid

```
                  | In-App | Discord       | Email
------------------+--------+---------------+-------
Connector Reconnect| [ ]   | [ ]           | [ ]
Daily Summary      | [ ]   | [ ]           | [ ]
Reminder           | [ ]   | [ ]           | [ ]
Upcoming Deadline  | [ ]   | [ ]           | [ ]
```

- Rows: notification types (`connectorReconnect` → "Connector Reconnect", `dailySummary` → "Daily Summary", `reminder` → "Reminder", `upcomingDeadline` → "Upcoming Deadline")
- Columns: channels (`inApp`, `discord`, `email`)
- Each cell: existing `<Checkbox>` component

### Discord Column (not connected)

- Column header shows grayed label + "Connect →" link to `/settings/sources`
- All Discord checkboxes disabled and visually grayed out (`opacity-50`)
- Email column always active (users always have a registered email)

## Behaviour

**Auto-save:** Each toggle fires `updateNotificationPreferences` immediately. Optimistic update applied first; on mutation error, revert to previous value and show error toast.

**Loading state:** While initial query is loading, render the grid skeleton (checkboxes disabled).

## Error Handling

| Scenario              | Behaviour                                                         |
| --------------------- | ----------------------------------------------------------------- |
| Query error           | Inline error message below heading                                |
| Mutation error        | Revert optimistic toggle; show toast "Failed to save preferences" |
| Discord not connected | Discord checkboxes disabled; header link to connect               |

## Files Changed

| File                                       | Change                              |
| ------------------------------------------ | ----------------------------------- |
| `apps/web/src/pages/NotificationsPage.tsx` | New page component                  |
| `apps/web/src/pages/SettingsLayout.tsx`    | Add "Notifications" tab             |
| `apps/web/src/App.tsx`                     | Add `/settings/notifications` route |

## Out of Scope

- Test notification send ("Send test" button)
- Per-row enable/disable toggle
- Email address management
