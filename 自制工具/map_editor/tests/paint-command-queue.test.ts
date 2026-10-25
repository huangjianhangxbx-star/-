import test from "node:test";
import assert from "node:assert/strict";
import { PaintCommandQueue, emptyPaint, applyPaintDelta } from "../desktop/paint-command-queue.ts";
const source = () => ({
  schema: "xinghai-surface-paint-1" as const,
  density: 64 as const,
  faces: { "9,0,0,4": { "0": "#112233" } },
});
test("queued deltas rebase sequentially and keep unrelated object pixels, save drains last", async () => {
  let snapshot = { leaseId: "L", model: { revision: 0 }, source: source() },
    active = 0;
  const calls: any[] = [];
  const q = new PaintCommandQueue(
    snapshot,
    async (input) => {
      assert.equal(++active, 1);
      calls.push(input);
      await new Promise((r) => setTimeout(r, 3));
      snapshot = {
        ...snapshot,
        model: { revision: snapshot.model.revision + 1 },
        source: input.source ?? snapshot.source,
      };
      active--;
      return snapshot;
    },
    () => {},
  );
  const waits = [];
  for (let i = 0; i < 4; i++) {
    const before = q.source(),
      next = structuredClone(before);
    next.faces["0,0,0,4"] = { ...next.faces["0,0,0,4"], [i]: "#ffffff" };
    waits.push(q.paint(before, next));
  }
  await assert.rejects(q.paint(q.source(), source()), /队列/);
  await Promise.all(waits);
  await q.command("save");
  assert.equal(calls.length, 5);
  assert.deepEqual(Object.keys(q.source().faces["0,0,0,4"]), [
    "0",
    "1",
    "2",
    "3",
  ]);
  assert.equal(q.source().faces["9,0,0,4"]["0"], "#112233");
  assert.equal(calls[4].baseRevision, 4);
});
test("failure freezes descendants, preserves confirmed source and retries identical command", async () => {
  let calls: any[] = [],
    reject = true;
  const initial = { leaseId: "L", model: { revision: 0 }, source: source() };
  const q = new PaintCommandQueue(
    initial,
    async (input) => {
      calls.push(structuredClone(input));
      if (reject) throw Error("写入失败");
      return { ...initial, model: { revision: 1 }, source: input.source };
    },
    () => {},
  );
  const next = source();
  next.faces["0,0,0,4"] = { "0": "#ffffff" };
  await assert.rejects(q.paint(q.source(), next), /写入失败/);
  assert.equal(q.failed, true);
  assert.deepEqual(q.source(), source());
  reject = false;
  await q.retry();
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(q.source().faces["0,0,0,4"]["0"], "#ffffff");
});

test("twenty sequential paint receipts retain exact final pixels and authority revisions", async () => {
  let snapshot: any = {
    leaseId: "L",
    model: { revision: 0 },
    source: source(),
  };
  const q = new PaintCommandQueue(
    snapshot,
    async (input) => {
      assert.equal(input.baseRevision, snapshot.model.revision);
      snapshot = {
        ...snapshot,
        model: { revision: snapshot.model.revision + 1 },
        source: input.source,
      };
      return snapshot;
    },
    () => {},
  );
  for (let i = 0; i < 20; i++) {
    const before = q.source(),
      next = structuredClone(before);
    (next.faces["0,0,0,4"] ??= {})[i] = i % 2 ? "#334455" : "#445566";
    await q.paint(before, next);
  }
  await q.drain();
  assert.equal(snapshot.model.revision, 20);
  assert.equal(Object.keys(q.source().faces["0,0,0,4"]).length, 20);
  assert.equal(q.source().faces["9,0,0,4"]["0"], "#112233");
});

test('read-only queue queries reuse an isolated optimistic source', () => {
 const source=emptyPaint();source.faces['0,0,0,4']={'0':'#123456'};
 const q=new PaintCommandQueue({source},async()=>{},()=>{});
 assert.equal(q.source(),q.source());
 const next=applyPaintDelta(source,[{key:'1,0,0,4',index:'0',color:'#abcdef'}]);
 assert.equal(next.faces['0,0,0,4'],source.faces['0,0,0,4']);
 assert.deepEqual(source.faces,{'0,0,0,4':{'0':'#123456'}});
});

test('stale and foreign receipts freeze the queue without replacing its confirmed source',async()=>{
 for(const mode of ['lease','revision','sequence']){const initial={leaseId:'L',sequence:4,model:{revision:8},source:source()};const q=new PaintCommandQueue(initial,async()=>({...initial,leaseId:mode==='lease'?'foreign':'L',sequence:mode==='sequence'?3:5,model:{revision:mode==='revision'?7:9}}),()=>{});const before=q.source();await assert.rejects(q.paint(before,applyPaintDelta(before,[{key:'0,0,0,4',index:'0',color:'#ffffff'}])),/过期|租约/);assert.equal(q.failed,true);assert.deepEqual(q.source(),initial.source);}
});
