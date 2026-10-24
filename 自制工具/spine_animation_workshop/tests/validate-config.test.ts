import assert from "node:assert/strict";
import test from "node:test";
import { validateConfig } from "../src/config/validate-config.ts";
import { config } from "./transfer-fixtures.ts";

test("browser-side validation rejects version 1 config without source range", () => {
  const malformed = JSON.parse(JSON.stringify(config())) as { source: Record<string, unknown> };
  delete malformed.source.rangeSeconds;
  assert.throws(() => validateConfig(malformed), /rangeSeconds|时间范围/);
});

test("browser-side validation returns a valid config unchanged", () => {
  const saved = JSON.stringify(config());
  const parsed: unknown = JSON.parse(saved);
  assert.deepEqual(validateConfig(parsed), JSON.parse(saved));
  assert.equal(JSON.stringify(validateConfig(parsed)), saved);
});
