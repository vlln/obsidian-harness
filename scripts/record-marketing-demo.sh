#!/usr/bin/env bash
# Records a ~12s marketing demo video of Obsidian Harness by wrapping a headed
# wdio run. The spec drives the UI (open transcript → light/dark/light walk) and
# signals /tmp/harness-demo-ready once content has rendered; this script polls
# for that signal, then starts screencapture for 12s concurrently.
#
# Output: docs/public/demo.mov (whole-screen capture — see note below).
#
# Usage: bash scripts/record-marketing-demo.sh
set -euo pipefail

cd "$(dirname "$0")/.."

READY="/tmp/harness-demo-ready"
OUT="docs/public/demo.mov"

rm -f "$READY" "$OUT"

echo "[record] launching headed wdio demo spec in background..."
npx wdio run wdio.conf.mts --spec e2e/marketing-demo.spec.ts > /tmp/harness-demo-wdio.log 2>&1 &
WDIO_PID=$!

cleanup() {
  kill "$WDIO_PID" 2>/dev/null || true
  wait "$WDIO_PID" 2>/dev/null || true
  rm -f "$READY"
}
trap cleanup EXIT

echo "[record] waiting for spec to render content (up to 90s)..."
for i in $(seq 1 90); do
  if [ -f "$READY" ]; then
    echo "[record] content ready after ${i}s — starting 12s screen capture"
    break
  fi
  sleep 1
done

if [ ! -f "$READY" ]; then
  echo "[record] ERROR: spec never signaled ready. wdio log:"
  tail -30 /tmp/harness-demo-wdio.log
  exit 1
fi

# Whole-screen capture (screencapture -v records the main display).
# -V12 limits recording to 12s then exits automatically.
screencapture -v -V12 -x "$OUT"

echo "[record] done. output:"
ls -la "$OUT"
echo "[record] wdio tail:"
tail -8 /tmp/harness-demo-wdio.log
