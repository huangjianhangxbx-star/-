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
  assert.equal(applied.length, 0);
  assert.deepEqual(new Set(jobs[1].chunks), new Set(["a", "b"]));
  q.receive({ revision: 2, faces: ["new"] });
  assert.equal(applied[0].d.id, "new");
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
  q.receive({ revision: 1 });
  assert.equal(jobs[1].chunks, null);
  q.receive({ revision: 2 });
  assert.equal(applied[0], undefined);
});
