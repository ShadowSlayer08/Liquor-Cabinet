import { test } from "node:test";
import assert from "node:assert/strict";
import { bubbleLines, showBubble, hideBubble, canDrawOverlay, requestOverlay, bubbleAvailable } from "../src/lib/bubble.js";

test("checklist marks become bubble ticks", () => {
  assert.deepEqual(bubbleLines(["✅ 2 × Kinley Club Soda (750 ml)", "⬜ 1 × Ice Cubes (1 kg)", "3 × Chilli Chicken"]), {
    lines: ["2 × Kinley Club Soda (750 ml)", "1 × Ice Cubes (1 kg)", "3 × Chilli Chicken"],
    done: [true, false, false],
  });
  assert.deepEqual(bubbleLines(null), { lines: [], done: [] });
});

test("off the phone every bubble call is a harmless no-op", async () => {
  assert.equal(bubbleAvailable(), false);
  assert.equal(await canDrawOverlay(), false);
  assert.equal(await requestOverlay(), false);
  assert.equal(await showBubble("Zomato · Test", ["1 × Momos"]), false);
  assert.equal(await hideBubble(), false);
});

test("iPhone requests carry a full Mobile Safari user agent", async () => {
  const { iosSafariUA } = await import("../src/lib/http.js");
  const wk = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  assert.equal(iosSafariUA(wk), "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1");
  assert.match(iosSafariUA(""), /Version\/18\.0 .*Safari\/604\.1$/);
});
