import { test } from "node:test";
import assert from "node:assert/strict";
import {
  displayDefaults,
  normalizeDisplay,
  effectiveDisplay,
  readDisplayPreferences,
} from "../desktop/viewport-display-state.ts";

test("view defaults are independent and four presets have real contracts", () => {
  const edit = displayDefaults("edit"),
    preview = displayDefaults("preview");
  assert.equal(edit.preset, "studio-gray");
  assert.equal(preview.preset, "studio-color");
  assert.equal(displayDefaults("assembly").preset, "studio-color");
  assert.equal(
    normalizeDisplay({ preset: "raking-gray" }, "edit").followCamera,
    false,
  );
  edit.brightness = 2;
  assert.equal(preview.brightness, 1);
});
test("albedo bypasses lighting, cavity and exposure without losing user choices", () => {
  const state = normalizeDisplay(
    { preset: "albedo", brightness: 2, cavity: "medium" },
    "edit",
  );
  const effective = effectiveDisplay(state);
  assert.equal(effective.brightness, 1);
  assert.equal(effective.cavity, "off");
  assert.equal(state.cavity, "medium");
});
test("corrupt preferences and invalid ranges have deterministic safe defaults", () => {
  assert.deepEqual(
    readDisplayPreferences("{broken").views.edit,
    displayDefaults("edit"),
  );
  const s = normalizeDisplay(
    {
      preset: "unknown",
      rotation: Infinity,
      brightness: -10,
      cavity: "bad",
      grid: "true",
    },
    "edit",
  );
  assert.equal(s.preset, "studio-gray");
  assert.equal(s.rotation, 0);
  assert.equal(s.brightness, 0.25);
  assert.equal(s.grid, true);
  const p = readDisplayPreferences(
    JSON.stringify({
      version: 1,
      sync: true,
      views: { edit: { preset: "albedo" }, preview: { preset: "raking-gray" } },
    }),
  );
  assert.equal(p.sync, true);
  assert.equal(p.views.edit.preset, "albedo");
  assert.equal(p.views.preview.preset, "raking-gray");
});
