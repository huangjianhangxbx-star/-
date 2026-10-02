import test from "node:test";
import assert from "node:assert/strict";
import { createMap } from "../core/document.ts";
import { inspectLegacyTags, migrateLegacyTags } from "../core/migration.ts";

test("legacy deploy top becomes standable ground in a new document", () => {
  const old = createMap();
  old.cells = [{ x: 0, y: 0, z: -1, color: 0, owner: "height" }];
  old.surfaces = [{ x: 0, y: 0, z: 0, face: 4, tag: "deploy" }];
  const result = migrateLegacyTags(old);
  assert.equal(result.report.converted, 1);
  assert.equal(result.doc.surfaces[0].tag, "walk");
  assert.equal(result.doc.revision, old.revision + 1);
  assert.equal(old.surfaces[0].tag, "deploy");
});

test("illegal old walk label on a vertical face is reported rather than silently converted", () => {
  const old = createMap();
  old.cells = [{ x: 0, y: 0, z: -1, color: 0, owner: "height" }];
  old.surfaces = [{ x: 1, y: 0, z: -1, face: 0, tag: "walk" }];
  assert.equal(inspectLegacyTags(old).issues.length, 1);
  assert.throws(() => migrateLegacyTags(old), /人工修正/);
});
