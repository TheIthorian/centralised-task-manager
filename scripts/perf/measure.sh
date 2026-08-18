#!/usr/bin/env bash
# Measure server boot cost for a Nest app. Usage: scripts/perf/measure.sh main|mcp [runs]
set -euo pipefail

APP="${1:?usage: measure.sh main|mcp [runs]}"
RUNS="${2:-3}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/apps/$APP"

[ -f "$DIR/dist/bootstrap.js" ] || { echo "build $APP first: pnpm --filter @ctm/$APP build" >&2; exit 1; }

cd "$DIR"
set -a; . ./.env.test; set +a

echo "--- $APP: module graph ---"
node "$ROOT/scripts/perf/require-prof.cjs" "$DIR/dist/app.module.js"

echo "--- $APP: boot ($RUNS runs) ---"
for _ in $(seq "$RUNS"); do
    node "$ROOT/scripts/perf/boot-time.cjs" "$DIR/dist/bootstrap.js" 2>&1 | grep '^RESULT'
done
