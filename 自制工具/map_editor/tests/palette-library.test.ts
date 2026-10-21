import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { parsePalette } = require("../desktop/palette-library.cjs");
test("palette formats preserve order and normalize colors", () => {
  assert.deepEqual(parsePalette('["#FF0000","#00ff00"]', "json"), [
    "#ff0000",
    "#00ff00",
  ]);
  assert.deepEqual(
    parsePalette(
      "GIMP Palette\nName: sample\nColumns: 4\n# comment\n255 0 0 red\n0 255 0 green",
      "gpl",
    ),
    ["#ff0000", "#00ff00"],
  );
});
test("invalid and oversized palettes fail explicitly", () => {
  assert.throws(() => parsePalette('["bad"]', "json"));
  assert.throws(() =>
    parsePalette(JSON.stringify(Array(257).fill("#000000")), "json"),
  );
});
