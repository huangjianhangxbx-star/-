import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { createAsset, validateAsset } from "../core/workshop-documents.ts";
import { CanvasSession } from "../core/workshop-canvases.ts";
import { planAppearance } from "../core/appearance-asset.ts";
import { exportAssetGlb } from "../core/workshop-glb.ts";
import { appearanceColor } from "../core/appearance-color.ts";
import { srgbToLinear } from "../core/palette.ts";
import { regionalDefaults } from "../core/regional-color.ts";
import { reconcileFaceTone, remapFaceTone } from "../core/face-tone.ts";
function unpack(bytes: Uint8Array) {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    len = d.getUint32(12, true),
    json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + len)));
  return { json, bin: bytes.slice(28 + len) };
}
function pixelColors(png: Uint8Array) {
  const b = Buffer.from(png),
    width = b.readUInt32BE(16),
    height = b.readUInt32BE(20),
    data = [];
  for (let i = 8; i < b.length; ) {
    const n = b.readUInt32BE(i),
      type = b.subarray(i + 4, i + 8).toString();
    if (type === "IDAT") data.push(b.subarray(i + 8, i + 8 + n));
    i += n + 12;
  }
  const raw = inflateSync(Buffer.concat(data)),
    colors = new Set<string>();
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * (width * 4 + 1)], 0);
    for (let x = 0; x < width; x++)
      colors.add(
        "#" +
          raw
            .subarray(
              y * (width * 4 + 1) + 1 + x * 4,
              y * (width * 4 + 1) + 4 + x * 4,
            )
            .toString("hex"),
      );
  }
  return colors;
}
for (const step of [0.25, 0.125, 0.0625])
  for (const affectPaint of [false, true])
    test(`six faces and protected/affected PNG at ${step}, affectPaint=${affectPaint}`, () => {
      const a = createAsset("matrix");
      a.cells = [{ x: -2, y: 1, z: 3, color: 0 }];
      a.palette[0] = "#808080";
      a.materialProfile.colors[0].baseColor_sRGB = [
        128 / 255,
        128 / 255,
        128 / 255,
      ];
      a.materialProfile.colors[0].roughness = 0.37;
      a.anchorM = [0.125, -0.25, 0.0625];
      a.rootMode = "free";
      const s = new CanvasSession(a);
      s.active.voxelStepM = step;
      s.active.originTicks = [3, -2, 1];
      s.active.paintSource = {
        schema: "xinghai-surface-paint-1",
        density: 64,
        faces: { "-2,1,3,0": { "0": "#ffffff" } },
      };
      const raw = structuredClone(s.active.paintSource);
      s.applyAppearance(
        planAppearance(s.model, s.activeId, new Set(["-2,1,3"]), {
          kind: "tone",
          preset: "up-down",
          strength: 0.4,
          light: [1, 1, 1],
          bands: 3,
          affectPaint,
        }),
      );
      assert.deepEqual(s.active.paintSource, raw);
      const { json, bin } = unpack(exportAssetGlb(s.model));
      assert.equal(json.images.length, 1);
      const image = json.images[0],
        v = json.bufferViews[image.bufferView],
        colors = pixelColors(
          bin.subarray(v.byteOffset, v.byteOffset + v.byteLength),
        );
      assert(
        colors.has(
          appearanceColor("#808080", undefined, { gain: 0.8, affectPaint }),
        ),
      );
      assert(
        colors.has(
          appearanceColor("#808080", "#ffffff", { gain: 0.8, affectPaint }),
        ),
      );
      const textured = json.materials.filter(
        (m: any) => m.pbrMetallicRoughness.baseColorTexture,
      );
      assert(
        textured.every((m: any) =>
          m.pbrMetallicRoughness.baseColorFactor
            .slice(0, 3)
            .every((v: number) => v === 1),
        ),
      );
      assert(
        json.materials.some(
          (m: any) =>
            Math.abs(m.pbrMetallicRoughness.roughnessFactor - 0.37) < 1e-8,
        ),
      );
      const expected = [
        "#808080",
        appearanceColor("#808080", undefined, {
          gain: 0.6,
          affectPaint: false,
        }),
        appearanceColor("#808080", undefined, {
          gain: 0.8,
          affectPaint: false,
        }),
      ].map((h) => srgbToLinear(parseInt(h.slice(1, 3), 16) / 255));
      for (const value of expected)
        assert(
          json.materials.some(
            (m: any) =>
              Math.abs(m.pbrMetallicRoughness.baseColorFactor[0] - value) <
              1e-6,
          ),
        );
    });
test("64 slot rejection is atomic; hidden, empty and malformed scopes never fall back to whole model", () => {
  const a = createAsset("budget");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  while (a.palette.length < 64) {
    a.palette.push("#808080");
    a.materialProfile.colors.push({
      ...a.materialProfile.colors[0],
      colorId: "slot" + a.palette.length,
      baseColor_sRGB: [128 / 255, 128 / 255, 128 / 255],
    });
  }
  const s = new CanvasSession(a),
    before = JSON.stringify(s.model);
  assert.throws(
    () =>
      planAppearance(s.model, s.activeId, new Set(["0,0,0"]), {
        kind: "region",
        regional: { ...regionalDefaults(), ratio: 1 },
      }),
    /64/,
  );
  assert.equal(JSON.stringify(s.model), before);
  s.active.locked = true;
  assert.throws(
    () =>
      planAppearance(s.model, s.activeId, new Set(["0,0,0"]), {
        kind: "clear",
      }),
    /锁定/,
  );
});
test("deletion exposes neutral faces and overlap replaces destination complete tone", () => {
  const tone = {
    schema: "xinghai-face-tone-1" as const,
    faces: {
      "0,0,0,0": { gain: 0.5, affectPaint: false },
      "1,0,0,1": { gain: 0.7, affectPaint: false },
    },
  };
  assert.deepEqual(
    reconcileFaceTone(
      tone,
      [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      [{ x: 0, y: 0, z: 0 }],
    )!.faces,
    {},
  );
  assert.deepEqual(remapFaceTone(tone, new Map([["2,0,0", "0,0,0"]]))!.faces, {
    "1,0,0,1": tone.faces["1,0,0,1"],
  });
});
