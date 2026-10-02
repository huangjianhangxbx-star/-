import test from "node:test";
import assert from "node:assert/strict";
import { RebuildQueue } from "../core/rebuild.ts";
test("late geometry cannot replace newer edits and all dirty chunks survive", () => {
  const jobs: any[] = [],
    applied: any[] = [];
  const q = new RebuildQueue(
    (j) => jobs.push(j),
    (r, d, c) => applied.push({ r, d, c }),
  );
  q.request({ id: "old" }, new Set(["a"]));
  q.request({ id: "new" }, new Set(["b"]));
  q.receive({ revision: 1, faces: ["old"] });
  assert.equal(applied.length, 1);
  assert.equal(applied[0].d.id, "old");
  assert.deepEqual(new Set(jobs[1].chunks), new Set(["a", "b"]));
  q.receive({ revision: 2, faces: ["new"] });
  assert.equal(applied[1].d.id, "new");
  assert.equal(q.running, false);
});
test("new document invalidates every previous chunk", () => {
  const jobs: any[] = [],
    applied: any[] = [];
  const q = new RebuildQueue(
    (j) => jobs.push(j),
    (r, d, c) => applied.push(c),
  );
  q.request({}, new Set(["a"]));
  q.request({});
  q.invalidate();
  q.receive({ revision: 1 });
  assert.equal(jobs[1].chunks, null);
  q.receive({ revision: 2 });
  assert.equal(applied[0], undefined);
});
test("continuous requests publish a completed intermediate mesh before pointer release", () => {
  const jobs: any[] = [], applied: any[] = [];
  const q = new RebuildQueue((j) => jobs.push(j), (r, d) => applied.push([r.revision, d.id]));
  q.request({ id: "a" }, new Set(["a"]));
  q.request({ id: "b" }, new Set(["b"]));
  q.receive({ revision: 1, faces: ["a"] });
  assert.deepEqual(applied, [[1, "a"]]);
  assert.equal(jobs.length, 2);
  q.receive({ revision: 2, faces: ["b"] });
  assert.deepEqual(applied, [[1, "a"], [2, "b"]]);
});
