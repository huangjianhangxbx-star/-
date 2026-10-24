import assert from "node:assert/strict";
import test from "node:test";
import { validateConfig } from "../src/config/workshop-config.ts";
import { config } from "./transfer-fixtures.ts";

test("config validation rejects sampling below one frame per second", () => {
  assert.throws(() => validateConfig(config({ sampleHz: 0.5 })), /采样率|1–240/);
});

test("config validation rejects a range that exceeds the frame limit", () => {
  assert.throws(
    () => validateConfig(config({ source: { ...config().source, rangeSeconds: [0, 1000] }, sampleHz: 30 })),
    /采样帧数|上限/,
  );
});
