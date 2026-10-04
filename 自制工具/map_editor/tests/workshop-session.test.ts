import { test } from "node:test";
import assert from "node:assert/strict";
import { createAsset } from "../core/workshop-documents.ts";
import { asset } from "./workshop-test-support.ts";
let mod: any = {};
try {
  mod = await import("../desktop/workshop-session.ts");
} catch (e) {
  if (
    e.code !== "ERR_MODULE_NOT_FOUND" ||
    !e.url.endsWith("/desktop/workshop-session.ts")
  )
    throw e;
}
function manager() {
  assert.equal(typeof mod.WorkshopSession, "function");
  return new mod.WorkshopSession();
}
test("module switching preserves separate history, PNG and unsaved states", () => {
  const m = manager(),
    a = m.openAsset(asset(), "a".repeat(64)),
    b = m.openAsset(createAsset("b"), "b".repeat(64));
  a.editor.begin();
  a.editor.volume(0, 0, 0, 0);
  a.editor.commit();
  m.sync(a.sessionId);
  m.activate("module", "b");
  m.activate("project", "");
  m.activate("module", "library-a");
  assert.equal(m.assetSession("library-a"), a);
  assert.equal(a.editor.past.length, 1);
  assert.equal(b.editor.past.length, 0);
  assert.ok(a.asset.editor.reference);
  assert.equal(b.asset.editor, undefined);
  assert.deepEqual(m.dirtyDocuments(), ["library-a"]);
  m.undo(a.sessionId);
  assert.equal(a.asset.cells.length, 1);
  assert.equal(b.asset.cells.length, 0);
});
test("late save only acknowledges submitted revision, subsequent edits remain dirty", () => {
  const m = manager(),
    a = m.openAsset(createAsset("a"), null);
  a.editor.begin();
  a.editor.volume(0, 0, 0, 0);
  a.editor.commit();
  m.sync(a.sessionId);
  const submitted = a.asset.revision;
  a.editor.begin();
  a.editor.volume(1, 0, 0, 0);
  a.editor.commit();
  m.sync(a.sessionId);
  m.markSaved(a.sessionId, submitted, "a".repeat(64));
  assert.deepEqual(m.dirtyDocuments(), ["a"]);
  assert.equal(a.savedRevision, 1);
  assert.equal(a.asset.revision, 2);
});
test("new empty draft is dirty until actually saved and duplicate opening cannot replace edits", () => {
  const m = manager(),
    a = m.openAsset(createAsset("a"), null);
  assert.deepEqual(m.dirtyDocuments(), ["a"]);
  assert.throws(() => m.openAsset(createAsset("a"), "a".repeat(64)));
  m.markSaved(a.sessionId, 0, "a".repeat(64));
  assert.deepEqual(m.dirtyDocuments(), []);
});
test("closed session cannot accept delayed save acknowledgement", () => {
  const m = manager(),
    a = m.openAsset(createAsset("a"), null);
  assert.throws(() => m.closeAsset("a"));
  m.closeAsset("a", true);
  const replacement = m.openAsset(createAsset("a"), null);
  assert.throws(() => m.markSaved(a.sessionId, 0, "a".repeat(64)));
  assert.notEqual(replacement.sessionId, a.sessionId);
});
test("uncommitted stroke preview cannot become asset source after cancellation", () => {
  const m = manager(),
    a = m.openAsset(createAsset("a"), "a".repeat(64));
  a.editor.begin();
  a.editor.volume(0, 0, 0, 0);
  m.sync(a.sessionId);
  assert.equal(a.asset.cells.length, 0);
  a.editor.cancel();
  m.sync(a.sessionId);
  assert.deepEqual(m.dirtyDocuments(), []);
});
test("module root and name commands undo with geometry and remain local to one session", () => {
  const m = manager(),
    a = m.openAsset(createAsset("a"), null),
    b = m.openAsset(createAsset("b"), null);
  m.rename(a.sessionId, "洞壁");
  m.reanchor(a.sessionId, [0.25, 0, 0]);
  a.editor.begin();
  a.editor.volume(0, 0, 0, 0);
  a.editor.commit();
  m.sync(a.sessionId);
  m.undo(a.sessionId);
  assert.deepEqual(a.asset.anchorM, [0.25, 0, 0]);
  assert.equal(a.asset.cells.length, 0);
  m.undo(a.sessionId);
  assert.deepEqual(a.asset.anchorM, [0, 0, 0]);
  assert.equal(a.asset.name, "洞壁");
  m.redo(a.sessionId);
  assert.deepEqual(a.asset.anchorM, [0.25, 0, 0]);
  assert.deepEqual(b.asset.anchorM, [0, 0, 0]);
});
