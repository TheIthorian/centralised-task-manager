# reminders

Scheduled reminder module for `apps/main`.

## Responsibilities

- **Task reminders** — surfaces tasks the user has flagged for recurring attention (daily or weekly), so they're not buried in the full task list.
- **Upcoming deadlines** — proactively alerts users to tasks due this week, even if they haven't set an explicit reminder.
- **Connector reconnect** — notifies users when a connector has a persistent error so broken syncs don't go unnoticed.

The cron runs daily at 09:00. `getSurfacedTaskIds` is also used by `TasksService` to support filtering by `surfaced=true`.

## Daily cron flow

```mermaid
flowchart TD
    Cron["@Cron 09:00"] --> Reminders & Connectors

    Reminders["sendTaskReminders()"]
    Reminders --> R1["Query open tasks\nwhere remindEvery=daily\n(+ weekly on Mondays)"]
    R1 --> R2["Group by user\n→ send reminder notification"]
    R2 --> R3["sendUpcomingDeadlines()"]
    R3 --> R4["Query open tasks\nwhere fuzzyDeadline.type=this_week"]
    R4 --> R5["Group by user\n→ send upcoming_deadline notification"]

    Connectors["sendConnectorReconnectAlerts()"]
    Connectors --> C1["Query enabled connectors\nwhere lastError ≠ null"]
    C1 --> C2["Group by user\n→ send connector_reconnect notification"]
```
