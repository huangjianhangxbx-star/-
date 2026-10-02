import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToHsv, hsvToHex } from "../desktop/color-wheel.ts";

test("wheel HSV and RGB HEX preserve primary, neutral and mixed colors", () => {
  for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#777777", "#59737a"])
    assert.equal(hsvToHex(...hexToHsv(hex)), hex);
  assert.equal(hsvToHex(0, 1, 1), "#ff0000");
});
