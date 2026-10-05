import test from "node:test";
import assert from "node:assert/strict";
import { EditorDocument } from "../core/document.ts";
import { EditOperationSession } from "../core/edit-operation.ts";
const config = {
  mode: "volume",
  action: "add",
  shape: "square",
  size: 1,
  thickness: 1,
  level: 0,
  direction: 1,
  color: 0,
  tag: "",
};
const hit = (x = 0, y = 0) => ({ x, y, z: 0, face: 4 });
test("frozen sampled plans preview exact changes and share one undo", () => {
  const e = new EditorDocument(),
    s = new EditOperationSession(e),
    c = { ...config };
  s.begin(c);
  c.color = 2;
  for (const x of [-2, 0, 2]) {
    const p = s.brush(hit(x));
    assert.deepEqual(
      p.candidates
        .filter((p) => p.status === "applied")
        .map((p) => `${p.x},${p.y},${p.z}`),
      [`${x},0,0`],
    );
    s.apply(p);
  }
  s.apply(s.brush(hit(0)));
  s.commit();
  assert.equal(e.past.length, 1);
  assert.equal(e.cells.size, 3);
  assert.ok([...e.cells.values()].every((c) => c.color === 0));
  e.undo();
  assert.equal(e.cells.size, 0);
  e.redo();
  assert.equal(e.cells.size, 3);
  s.begin(config);
  s.apply(s.brush(hit(0)));
  s.commit();
  assert.equal(e.past.length, 1);
});
test("height plans include removed cells and classify unchanged cells as noop", () => {
  const e = new EditorDocument();
  e.begin();
  e.height(0, 0, 3, 3, 0);
  e.commit();
  const s = new EditOperationSession(e);
  s.begin({ ...config, mode: "height", level: 1 });
  const p = s.brush(hit());
  assert.deepEqual(
    p.candidates
      .filter((p) => p.status === "applied")
      .map((p) => p.z)
      .sort(),
    [1, 2],
  );
  assert.equal(p.summary.estimatedRemoves, 2);
  s.apply(p);
  s.commit();
  assert.deepEqual([...e.cells.keys()], ["0,0,0"]);
});
test("protected column skips without cancelling neighboring columns", () => {
  const e = new EditorDocument();
  e.begin();
  e.volume(0, 0, 0, 0);
  e.commit();
  const s = new EditOperationSession(e);
  s.begin({ ...config, mode: "height", level: 1 });
  const p = s.rectangle(hit(-1), hit(1));
  assert.equal(p.summary.skipped, 1);
  s.apply(p);
  s.commit();
  assert.equal(e.cells.size, 3);
  e.undo();
  assert.equal(e.cells.size, 1);
});
test("rectangle preflight rejects volume budget before changing document", () => {
  const e = new EditorDocument(),
    s = new EditOperationSession(e);
  s.begin({ ...config, thickness: 64 });
  const before = structuredClone(e.doc);
  assert.throws(() => s.rectangle(hit(), hit(63, 63)), /预算/);
  assert.deepEqual(e.doc, before);
  s.cancel();
});
test("cancelled chunks cannot resume into a new stroke", async () => {
  const e = new EditorDocument(),
    s = new EditOperationSession(e);
  s.begin(config);
  const p = s.rectangle(hit(), hit(63, 63));
  let calls = 0;
  assert.equal(
    await s.executeChunked(p, 64, async () => {
      if (++calls === 2) {
        s.cancel();
        s.begin(config);
        s.apply(s.brush(hit(-5)));
      }
    }),
    false,
  );
  s.commit();
  assert.deepEqual([...e.cells.keys()], ["-5,0,0"]);
  assert.equal(e.past.length, 1);
});
test("execution exception rolls back the whole operation", async () => {
  const e = new EditorDocument(),
    s = new EditOperationSession(e);
  s.begin(config);
  const before = structuredClone(e.doc);
  await assert.rejects(
    s.executeChunked(s.rectangle(hit(), hit(10, 10)), 4, async () => {
      throw Error("injected scheduler failure");
    }),
  );
  assert.deepEqual(e.doc, before);
  assert.equal(s.active, false);
  assert.equal(e.past.length, 0);
});
for (const reason of ["escape", "pointercancel", "blur"])
  test(reason + " cancels all sampled plans", () => {
    const e = new EditorDocument(),
      s = new EditOperationSession(e),
      before = structuredClone(e.doc);
    s.begin(config);
    s.apply(s.brush(hit()));
    s.apply(s.brush(hit(1)));
    s.cancel();
    assert.deepEqual(e.doc, before);
    assert.equal(e.past.length, 0);
  });
test("stale plans and plans from another editor are rejected", () => {
  const e = new EditorDocument(),
    s = new EditOperationSession(e);
  s.begin(config);
  const p = s.brush(hit());
  s.apply(s.brush(hit(1)));
  assert.throws(() => s.apply(p), /过期/);
  assert.equal(e.cells.size, 0);
  const other = new EditOperationSession(new EditorDocument());
  other.begin(config);
  s.begin(config);
  assert.throws(() => s.apply(other.brush(hit())), /过期/);
});
test("late rejected scheduler cannot cancel a newer operation", async () => {
  const e = new EditorDocument(),
    s = new EditOperationSession(e);
  s.begin(config);
  const result = await s.executeChunked(
    s.rectangle(hit(), hit(2)),
    1,
    async () => {
      s.cancel();
      s.begin(config);
      s.apply(s.brush(hit(-3)));
      throw Error("late failure");
    },
  );
  assert.equal(result, false);
  s.commit();
  assert.deepEqual([...e.cells.keys()], ["-3,0,0"]);
});
test("existing cells count against rectangle budget during planning", () => {
  const e = new EditorDocument();
  e.begin();
  e.height(-100, 0, 256, 256, 0);
  e.commit();
  const s = new EditOperationSession(e);
  s.begin({ ...config, thickness: 256 });
  const before = structuredClone(e.doc);
  assert.throws(() => s.rectangle(hit(), hit(975)), /预算/);
  assert.deepEqual(e.doc, before);
  s.cancel();
});
test("full immutable configuration applies despite external control changes", () => {
  const e = new EditorDocument(),
    s = new EditOperationSession(e),
    c = {
      ...config,
      size: 3,
      thickness: 2,
      level: -2,
      direction: -1,
      color: 2,
    };
  s.begin(c);
  Object.assign(c, {
    size: 1,
    thickness: 1,
    level: 100,
    direction: 1,
    color: 0,
    action: "erase",
  });
  const p = s.brush(hit());
  assert.throws(() => {
    p.candidates[0].x = 999;
  }, TypeError);
  s.apply(p);
  s.commit();
  assert.equal(e.cells.size, 18);
  assert.ok(
    [...e.cells.values()].every((c) => [-2, -3].includes(c.z) && c.color === 2),
  );
});
