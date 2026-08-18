#!/usr/bin/env bash
# Report raw + gzip size of built browser assets, and the gzip weight of the initial load —
# the entry script plus every chunk index.html preloads. Usage: scripts/perf/bundle-size.sh [app ...]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APPS=("${@:-web landing}")

for app in ${APPS[@]}; do
    dist="$ROOT/apps/$app/dist"
    [ -d "$dist" ] || { echo "$app: no dist, build it first"; continue; }

    echo "--- $app: all assets ---"
    find "$dist" -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) \
        -exec sh -c 'printf "%9s raw %9s gz  %s\n" "$(wc -c <"$1")" "$(gzip -c "$1" | wc -c)" "${1#*/dist/}"' _ {} \; \
        | sort -rn

    echo "--- $app: initial load ---"
    js=0
    for asset in $(grep -oE '(src|href)="/[^"]+\.js"' "$dist/index.html" | sed 's/.*"\///;s/"$//'); do
        js=$((js + $(gzip -c "$dist/$asset" | wc -c)))
    done
    css=0
    for asset in $(grep -oE 'href="/[^"]+\.css"' "$dist/index.html" | sed 's/.*"\///;s/"$//'); do
        css=$((css + $(gzip -c "$dist/$asset" | wc -c)))
    done
    printf "JS %s gz, CSS %s gz, HTML %s gz\n" "$js" "$css" "$(gzip -c "$dist/index.html" | wc -c)"
done
