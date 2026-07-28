#!/usr/bin/env bash
# Records a ~9s marketing demo video of Obsidian Harness by wrapping a headed
# wdio run. The spec fills the entire 9s with continuous interaction (Session
# Manager → open transcript → scroll long conversation → Turn Navigator jump →
# hold) and signals /tmp/harness-demo-ready once the first content frame is
# on screen; this script polls for that signal, then runs screencapture for 9s.
# The spec keeps Obsidian foregrounded with action for the full recording
# window — no idle trailing tail, so the capture never drifts to other windows.
#
# Output: docs/public/demo.mov (fullscreen Obsidian only).
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
    echo "[record] content ready after ${i}s — starting 9s screen capture"
    break
  fi
  sleep 1
done

if [ ! -f "$READY" ]; then
  echo "[record] ERROR: spec never signaled ready. wdio log:"
  tail -30 /tmp/harness-demo-wdio.log
  exit 1
fi

# Fullscreen Obsidian, so the full-display capture is 100% Obsidian.
# -V9 limits recording to 9s; the spec keeps Obsidian open past that.
screencapture -v -V9 -x "$OUT"

echo "[record] done. output:"
ls -la "$OUT"
echo "[record] wdio tail:"
tail -8 /tmp/harness-demo-wdio.log
