#!/usr/bin/env bash
# Boots an iPhone simulator, installs the app, opens each tab via liquorcabinet://tab/<tab>
# and saves a screenshot per tab plus the app's console output (Capacitor logs JS console
# messages there in Debug builds). Usage: ios-screenshots.sh <App.app> <out-dir>
set -euo pipefail
APP="$1"; OUT="$2"; BUNDLE=com.shadowslayer.liquorcabinet
mkdir -p "$OUT"

# The newest iOS runtime's first iPhone (names change with every Xcode).
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
xcrun simctl launch --console-pty "$UDID" "$BUNDLE" > "$OUT/console.log" 2>&1 &
sleep 12
xcrun simctl io "$UDID" screenshot "$OUT/0-welcome.png"
i=1
for tab in cabinet bar food "cart?view=liquor" "cart?view=food" plan; do
  xcrun simctl openurl "$UDID" "liquorcabinet://tab/$tab"
  sleep 4
  xcrun simctl io "$UDID" screenshot "$OUT/$i-${tab//[?=]/-}.png"
  i=$((i + 1))
done
sleep 1
echo "── console (errors/warnings) ──"
grep -iE "error|warn|exception|unhandled" "$OUT/console.log" | head -50 || true
