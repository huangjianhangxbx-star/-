import assert from "node:assert/strict";
import { test } from "node:test";
import { appendDirectAnimation } from "../src/output/spine43-direct.ts";

test("appends under unique names without mutating target or its old animations", () => {
  const target = { skeleton: { spine: "4.3.26" }, bones: [{ name: "root" }],
    animations: { "SPW_run": { bones: { root: { rotate: [{ value: 3 }] } } } }, extra: { keep: true } };
  const original = structuredClone(target);
  const candidate = { bones: { root: { rotate: [{ value: 4 }] } } };
  const first = appendDirectAnimation(target, candidate, "SPW_run");
  assert.equal(first.name, "SPW_run_2");
  assert.deepEqual(target, original);
  assert.deepEqual(JSON.parse(first.jsonText).animations.SPW_run, original.animations.SPW_run);
  assert.deepEqual(JSON.parse(first.jsonText).animations.SPW_run_2, candidate);
  const second = appendDirectAnimation(JSON.parse(first.jsonText), candidate, "SPW_run");
  assert.equal(second.name, "SPW_run_3");
  assert.deepEqual(JSON.parse(second.jsonText).extra, original.extra);
});
