#!/usr/bin/env bash
# Boots an iPhone simulator, installs the Debug build, runs a Smart Sync (live Livcheers prices)
# and screenshots every tab, plus the app's console output (Capacitor logs the JS console there
# in Debug builds). Tabs are opened by relaunching with LC_OPEN_URL=liquorcabinet://tab/<tab>
# (see ios/App/App/MainViewController.swift) — `simctl openurl` stops at an "Open in…?" prompt.
# Usage: ios-screenshots.sh <App.app> <out-dir>
set -euo pipefail
APP="$1"; OUT="$2"; BUNDLE=com.shadowslayer.liquorcabinet
mkdir -p "$OUT"

# The newest iOS runtime's first plain iPhone (device names change with every Xcode).
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
d = json.load(sys.stdin)["devices"]
ios = sorted((k for k in d if "iOS" in k), key=lambda k: [int(x) for x in k.split("iOS-")[-1].split("-")])
for rt in reversed(ios):
    phones = [x for x in d[rt] if x["name"].startswith("iPhone") and "Plus" not in x["name"] and "Max" not in x["name"]]
    if phones: print(phones[0]["udid"]); break')
echo "Simulator: $(xcrun simctl list devices | grep "$UDID")"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl ui "$UDID" appearance dark || true
xcrun simctl install "$UDID" "$APP"

launch() { # [url] — (re)start the app, optionally opening a liquorcabinet:// link
  xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
  sleep 1
  echo "── launch ${1:-(plain)} ──" >> "$OUT/console.log"
  if [ -n "${1:-}" ]; then
    SIMCTL_CHILD_LC_OPEN_URL="$1" xcrun simctl launch --console-pty "$UDID" "$BUNDLE" >> "$OUT/console.log" 2>&1 &
  else
    xcrun simctl launch --console-pty "$UDID" "$BUNDLE" >> "$OUT/console.log" 2>&1 &
  fi
}
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" >/dev/null; echo "shot $1"; }

launch; sleep 30; shot 0-welcome
launch "liquorcabinet://sync"; sleep 60; shot 1-sync
i=2
for tab in cabinet bar food "cart?view=liquor" "cart?view=food" plan; do
  launch "liquorcabinet://tab/$tab"; sleep 8; shot "$i-${tab//[?=]/-}"
  i=$((i + 1))
done
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
echo "── console: errors / warnings ──"
grep -iE "error|warn|exception|unhandled" "$OUT/console.log" | head -60 || true
