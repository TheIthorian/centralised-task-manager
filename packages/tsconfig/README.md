# @ctm/tsconfig

Shared TypeScript configurations extended by all apps and packages.

## Configs

| File          | Used by                  |
| ------------- | ------------------------ |
| `base.json`   | All packages             |
| `nestjs.json` | `apps/main`, `apps/sync` |
| `react.json`  | `apps/web`               |

Reference in your `tsconfig.json`:

```json
{ "extends": "@ctm/tsconfig/base.json" }
```
