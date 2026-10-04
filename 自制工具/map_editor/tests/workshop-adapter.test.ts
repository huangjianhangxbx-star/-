import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { EditorDocument } from "../core/document.ts";
import { exportNativeAssetGlb } from "../core/glb.ts";
import { plannedModule, fn, asset } from "./workshop-test-support.ts";
const bridge = await plannedModule("workshop-adapter");
test("real M1.2 native samples roundtrip without changing Root, identity or GLB bytes", async () => {
  const read = fn(bridge, "fromNativeV1"),
    write = fn(bridge, "toNativeV1");
  for (const file of [
    "../samples/m12-workflow/Wall.xhasset.json",
    "../samples/m12-exchange/axis-color.xhasset.json",
  ]) {
    const raw = await fs.readFile(new URL(file, import.meta.url));
    const native = JSON.parse(raw.toString());
    const roundtrip = write(read(native));
    assert.deepEqual(roundtrip, native);
    assert.deepEqual(
      exportNativeAssetGlb(roundtrip),
      exportNativeAssetGlb(native),
    );
    assert.deepEqual(await fs.readFile(new URL(file, import.meta.url)), raw);
  }
});
test("editing Adapter retains reference, protected columns, asset identity and Root", () => {
  const source = asset(),
    editing = fn(bridge, "toEditingMap")(source);
  const editor = new EditorDocument(editing);
  editor.begin();
  editor.volume(1, 2, -2, 1);
  editor.commit();
  const next = fn(bridge, "fromEditingMap")(source, editor.doc);
  assert.equal(next.assetId, "library-a");
  assert.equal(next.revision, 1);
  assert.deepEqual(next.anchorM, [0, 0, 0]);
  assert.deepEqual(next.editor, source.editor);
  assert.ok(next.protectedColumns.includes("-1,2"));
  assert.ok(next.cells.some((c) => c.x === 1 && c.z === -2));
  assert.equal(
    next.materialProfile.paletteId,
    source.materialProfile.paletteId,
  );
});
test("unchanged editor snapshot does not grow revision or change palette identity", () => {
  const a = asset(),
    map = fn(bridge, "toEditingMap")(a);
  assert.deepEqual(fn(bridge, "fromEditingMap")(a, map), a);
});
test("palette edit updates material color while keeping shared semantic color IDs", () => {
  const a = asset(),
    map = fn(bridge, "toEditingMap")(a);
  map.palette[0] = "#ffffff";
  const next = fn(bridge, "fromEditingMap")(a, map);
  assert.equal(next.materialProfile.paletteId, a.materialProfile.paletteId);
  assert.equal(
    next.materialProfile.paletteRevision,
    a.materialProfile.paletteRevision + 1,
  );
  assert.deepEqual(next.materialProfile.colors[0].baseColor_sRGB, [1, 1, 1]);
  assert.equal(
    next.materialProfile.colors[0].colorId,
    a.materialProfile.colors[0].colorId,
  );
});
test("removing lowest cell retains native local frame and sourceOrigin", () => {
  const a = asset();
  a.rootMode = "legacy";
  a.anchorM = [0.125, 0, 0];
  a.legacyNative = { sourceOriginM: [3, -2, 0] };
  const map = fn(bridge, "toEditingMap")(a);
  map.cells = [{ x: 4, y: 2, z: -2, color: 0, owner: "volume" }];
  const next = fn(bridge, "fromEditingMap")(a, map),
    native = fn(bridge, "toNativeV1")(next);
  assert.deepEqual(native.cells, [
    { x: 4, y: 2, z: -2, color: 0, owner: "volume" },
  ]);
  assert.deepEqual(native.sourceOrigin, [3, -2, 0]);
  assert.deepEqual(native.anchor, [0.125, 0, 0]);
});
test("empty draft cannot become native mother source; nonempty revision zero becomes one", () => {
  const a = asset(),
    write = fn(bridge, "toNativeV1");
  assert.equal(write(a).revision, 1);
  assert.equal("editor" in write(a), false);
  a.cells = [];
  assert.throws(() => write(a));
});
test("Adapter rejects gameplay data and revision overflow instead of losing it", () => {
  const a = asset(),
    map = fn(bridge, "toEditingMap")(a);
  map.surfaces = [{ x: -1, y: 2, z: 1, face: 4, tag: "walk" }];
  assert.throws(() => fn(bridge, "fromEditingMap")(a, map));
  map.surfaces = [];
  a.revision = 2147483647;
  map.cells.push({ x: 3, y: 2, z: 0, color: 0 });
  assert.throws(() => fn(bridge, "fromEditingMap")(a, map));
});
test("several real editor commits retain source transaction count across bridge", () => {
  const a = asset(),
    editor = new EditorDocument(fn(bridge, "toEditingMap")(a));
  for (let x = 1; x <= 3; x++) {
    editor.begin();
    editor.volume(x, 2, 0, 0);
    editor.commit();
  }
  const next = fn(bridge, "fromEditingMap")(a, editor.doc);
  assert.equal(next.revision, 3);
});
test("undo back to original geometry still retains actual transaction revision", () => {
  const a = asset();
  const editor = new EditorDocument(fn(bridge, "toEditingMap")(a));
  editor.begin();
  editor.volume(1, 2, 0, 0);
  editor.commit();
  editor.undo();
  const next = fn(bridge, "fromEditingMap")(a, editor.doc);
  assert.deepEqual(next.cells, a.cells);
  assert.equal(next.revision, 2);
});
test("native import rejects unsupported extra fields rather than silently stripping them", async () => {
  const native = JSON.parse(
    await fs.readFile(
      new URL("../samples/m12-workflow/Wall.xhasset.json", import.meta.url),
      "utf8",
    ),
  );
  native.customData = { important: true };
  assert.throws(() => fn(bridge, "fromNativeV1")(native));
});
