import { test } from "node:test";
import assert from "node:assert/strict";
import { appearanceColor } from "../core/appearance-color.ts";
import {
  faceGain,
  validateFaceTone,
  remapFaceTone,
} from "../core/face-tone.ts";
import {
  regionalDefaults,
  regionalGroup,
  regionalGain,
} from "../core/regional-color.ts";
test("relative gain is linear, paint protection is independent and reversible", () => {
  assert.equal(
    appearanceColor("#808080", undefined, { gain: 0.5, affectPaint: false }),
    "#5c5c5c",
  );
  assert.equal(
    appearanceColor("#808080", "#ffffff", { gain: 0.5, affectPaint: false }),
    "#ffffff",
  );
  assert.equal(
    appearanceColor("#808080", "#ffffff", { gain: 0.5, affectPaint: true }),
    "#bcbcbc",
  );
  assert.equal(appearanceColor("#808080", "#ffffff"), "#ffffff");
});
test("source face convention, strict tone validation and rotation preserve gains", () => {
  assert.equal(faceGain(4, "up-down", 0.4, [0, 0, 1]), 1);
  assert.equal(faceGain(5, "directional", 0.4, [0, 0, 1]), 0.6);
  assert.equal(faceGain(0, "directional", 0.4, [0, 0, 1]), 0.8);
  const tone = {
    schema: "xinghai-face-tone-1" as const,
    faces: { "0,0,0,0": { gain: 0.6, affectPaint: false } },
  };
  assert.deepEqual(validateFaceTone(tone, new Set(["0,0,0"])), tone);
  for (const value of [NaN, -1, 1.1])
    assert.throws(() =>
      validateFaceTone(
        { ...tone, faces: { "0,0,0,0": { gain: value, affectPaint: false } } },
        new Set(["0,0,0"]),
      ),
    );
  assert.throws(() =>
    validateFaceTone({ ...tone, extra: true }, new Set(["0,0,0"])),
  );
  assert.deepEqual(
    remapFaceTone(tone, new Map([["0,0,0", "2,0,0"]]), 2, 1)?.faces["2,0,0,2"],
    tone.faces["0,0,0,0"],
  );
});
test("virtual bricks share stable regions across negative coordinates, seeds, holes and gain changes", () => {
  const o = {
    ...regionalDefaults(),
    mode: "brick" as const,
    width: 2,
    height: 0.75,
    depth: 0.5,
    plane: "XZ" as const,
    stagger: 0.5,
  };
  const groups = new Set<string>();
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 2; y++)
      for (let z = 0; z < 3; z++)
        groups.add(
          regionalGroup(
            [x * 0.25 + 0.125, y * 0.25 + 0.125, z * 0.25 + 0.125],
            o,
          ),
        );
  assert.equal(groups.size, 1);
  assert.notEqual(
    regionalGroup([-0.125, 0.125, 0.125], o),
    regionalGroup([0.125, 0.125, 0.125], o),
  );
  const id = regionalGroup([0.125, 0.125, 0.125], o);
  assert.equal(
    id,
    regionalGroup([0.125, 0.125, 0.125], { ...o, amount: 0.5, seed: 211 }),
  );
  for (let i = 0; i < 50; i++) {
    const group = "r" + i,
      a = regionalGain(group, { ...o, ratio: 0.2 }),
      b = regionalGain(group, { ...o, ratio: 0.7 });
    if (a !== 1) assert.equal(a, b);
  }
  assert.equal(regionalGain(id, { ...o, ratio: 0 }), 1);
  assert.equal(regionalGain(id, { ...o, amount: 0 }), 1);
});
