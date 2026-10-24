import { test } from "node:test";
import assert from "node:assert/strict";
import { createAsset, validateAsset } from "../core/workshop-documents.ts";
import {
  ensureModelObjects,
  CanvasSession,
} from "../core/workshop-canvases.ts";
import { planAppearance } from "../core/appearance-asset.ts";
import { regionalDefaults } from "../core/regional-color.ts";
function fixture() {
  const a = createAsset("a");
  a.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 0 },
    { x: 2, y: 0, z: 0, color: 1 },
  ];
  return ensureModelObjects(a);
}
test("face tones validate, commit atomically, are idempotent, clear, undo and reject stale plans", () => {
  const m = fixture(),
    s = new CanvasSession(m),
    id = s.activeId,
    keys = new Set(["0,0,0"]);
  const source = JSON.stringify(s.model);
  const p = planAppearance(s.model, id, keys, {
    kind: "tone",
    preset: "up-down",
    strength: 0.4,
    light: [0, 0, 1],
    bands: 3,
    affectPaint: false,
  });
  assert.equal(JSON.stringify(s.model), source);
  assert.equal(p.nextModel.canvases![0].cells[0].color, 0);
  s.applyAppearance(p);
  assert.equal(s.past.length, 1);
  assert(s.active.faceTone?.faces["0,0,0,5"]);
  assert.equal(s.active.faceTone?.faces["0,0,0,4"], undefined);
  assert.equal(s.active.faceTone?.faces["1,0,0,5"], undefined);
  assert.throws(() => s.applyAppearance(p), /变化|过期/);
  const again = planAppearance(s.model, id, keys, p.options);
  s.applyAppearance(again);
  assert.equal(s.past.length, 1);
  s.applyAppearance(planAppearance(s.model, id, keys, { kind: "clear" }));
  assert.equal(Object.keys(s.active.faceTone?.faces ?? {}).length, 0);
  s.undo();
  assert(s.active.faceTone?.faces["0,0,0,5"]);
  s.redo();
  assert.equal(Object.keys(s.active.faceTone?.faces ?? {}).length, 0);
  assert.throws(() =>
    validateAsset({
      ...m,
      faceTone: { schema: "xinghai-face-tone-1", faces: {} },
    }),
  );
});
test("regional color preserves material identity, layered sources and explicit scope", () => {
  const m = fixture(),
    c = m.canvases![0];
  c.baseCells = structuredClone(c.cells);
  c.voxelCopies = [];
  const options = {
    ...regionalDefaults(),
    mode: "brick" as const,
    ratio: 1,
    amount: 0.3,
    width: 8,
  };
  const p = planAppearance(m, c.canvasId, new Set(["0,0,0", "1,0,0"]), {
    kind: "region",
    regional: options,
  });
  const out = p.nextModel.canvases![0];
  assert.equal(out.cells[0].color, out.cells[1].color);
  assert.notEqual(out.cells[0].color, 0);
  assert.deepEqual(out.cells, out.baseCells);
  assert.deepEqual(out.cells[2], c.cells[2]);
  assert.equal(
    p.nextModel.materialProfile.colors[out.cells[0].color].roughness,
    m.materialProfile.colors[0].roughness,
  );
  assert.throws(
    () =>
      planAppearance(m, c.canvasId, new Set(), {
        kind: "region",
        regional: options,
      }),
    /选择/,
  );
  const reversed = structuredClone(m);
  reversed.canvases![0].cells.reverse();
  reversed.canvases![0].baseCells?.reverse();
  assert.deepEqual(
    planAppearance(reversed, c.canvasId, new Set(["0,0,0", "1,0,0"]), {
      kind: "region",
      regional: options,
    }).nextModel.palette,
    p.nextModel.palette,
  );
});
