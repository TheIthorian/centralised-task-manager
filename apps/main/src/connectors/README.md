# connectors

A connector links a user's external task source (Todoist, Google Tasks, etc.) to CTM. This module handles connecting and disconnecting those sources — brokering the OAuth flow, storing encrypted credentials, and exposing the connected sources so the rest of the app can fetch and sync tasks from them.

Discord is also managed here, but as a notification channel rather than a task source — it has its own setup flow and separate credential storage.

## Responsibilities

- **Discovery** — surfaces which task sources are available to connect, so the UI can present options without knowing about the underlying connector registry.
- **OAuth flow** — brokers the redirect-and-callback dance with external providers and stores the resulting tokens encrypted at rest; callers never handle raw credentials.
- **Config lifecycle** — connectors can be enabled, disabled, and removed independently per user, allowing partial connectivity without breaking the rest of the app.
- **Discord** — Discord is a notification channel rather than a task source, so its setup flow lives here but its config is stored separately from task connector credentials.
