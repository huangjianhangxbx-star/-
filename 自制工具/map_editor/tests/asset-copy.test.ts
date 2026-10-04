import { test } from "node:test";
import assert from "node:assert/strict";
import { plannedModule, fn, asset } from "./workshop-test-support.ts";
const copies = await plannedModule("asset-copy");
test("independent local copy has fresh source and palette identities, preserving provenance", () => {
  const source = asset();
  source.revision = 7;
  const copy = fn(copies, "cloneAsset")(source, "local-a");
  assert.equal(copy.assetId, "local-a");
  assert.equal(copy.revision, 0);
  assert.deepEqual(copy.provenance, { assetId: "library-a", revision: 7 });
  assert.notEqual(
    copy.materialProfile.paletteId,
    source.materialProfile.paletteId,
  );
  assert.equal(copy.materialProfile.paletteRevision, 1);
  assert.equal(
    copy.materialProfile.profileId,
    source.materialProfile.profileId,
  );
  assert.deepEqual(
    copy.materialProfile.colors.map((x) => x.colorId),
    source.materialProfile.colors.map((x) => x.colorId),
  );
  assert.deepEqual(copy.anchorM, source.anchorM);
});
test("copy geometry, PNG, Root and material edits never mutate the public source", () => {
  const source = asset(),
    before = structuredClone(source),
    copy = fn(copies, "cloneAsset")(source, "local-a");
  copy.cells[0].x = 7;
  copy.palette[0] = "#ffffff";
  copy.anchorM[0] = 1;
  copy.editor.reference.x = 3;
  copy.materialProfile.colors[0].baseColor_sRGB[0] = 1;
  copy.protectedColumns.push("3,3");
  assert.deepEqual(source, before);
});
test("copy rejects reused or invalid fresh asset identity", () => {
  const clone = fn(copies, "cloneAsset");
  for (const id of ["library-a", "", "../x", "new.with.dot"])
    assert.throws(() => clone(asset(), id));
});
