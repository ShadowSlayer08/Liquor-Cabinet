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
