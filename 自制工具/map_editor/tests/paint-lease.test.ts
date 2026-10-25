import { test } from "node:test";
import assert from "node:assert/strict";
import { CanvasSession } from "../core/workshop-canvases.ts";
import { createAsset } from "../core/workshop-documents.ts";
import { PaintLeaseAuthority } from "../desktop/paint-session-contract.ts";
function setup() {
  const a = createAsset("paint-lease");
  a.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 2, y: 0, z: 0, color: 0 },
  ];
  const s = new CanvasSession(a),
    o = s.model.objects![0];
  s.setEditObject(o.objectId);
  let saved = 0;
  const authority = new PaintLeaseAuthority(s, "session", o.objectId, () => {
    saved++;
  });
  return {
    s,
    authority,
    get saved() {
      return saved;
    },
  };
}
test("paint writer scopes owner/revision and de-duplicates a committed command", async () => {
  const f = setup(),
    a = f.authority,
    snapshot = a.snapshot(),
    command = {
      leaseId: a.leaseId,
      commandId: "one",
      baseRevision: snapshot.model.revision,
      kind: "paint",
      source: {
        schema: "xinghai-surface-paint-1",
        density: 64,
        faces: { "0,0,0,0": { "0": "#abcdef" } },
      },
    };
  await a.dispatch(command);
  assert.equal(f.s.past.length, 1);
  await a.dispatch(command);
  assert.equal(f.s.past.length, 1);
  assert.equal(f.s.active.paintSource!.faces["0,0,0,0"]["0"], "#abcdef");
  await assert.rejects(
    () => a.dispatch({ ...command, commandId: "stale" }),
    /过期/,
  );
  await assert.rejects(
    () =>
      a.dispatch({
        ...command,
        commandId: "outside",
        baseRevision: f.s.model.revision,
        source: { ...command.source, faces: { "2,0,0,0": { "0": "#ffffff" } } },
      }),
    /范围|物体/,
  );
});
test("main geometry and history are locked, client undo/save use the same authority, release restores writes", async () => {
  const f = setup(),
    a = f.authority;
  assert.throws(() => f.s.metadata({ name: "bad" }), /绘画/);
  await a.dispatch({
    leaseId: a.leaseId,
    commandId: "paint",
    baseRevision: f.s.model.revision,
    kind: "paint",
    source: {
      schema: "xinghai-surface-paint-1",
      density: 64,
      faces: { "0,0,0,0": { "0": "#123456" } },
    },
  });
  assert.throws(() => f.s.undo(), /绘画/);
  await a.dispatch({
    leaseId: a.leaseId,
    commandId: "undo",
    baseRevision: f.s.model.revision,
    kind: "undo",
  });
  assert.equal(Object.keys(f.s.active.paintSource?.faces ?? {}).length, 0);
  await a.dispatch({
    leaseId: a.leaseId,
    commandId: "save",
    baseRevision: f.s.model.revision,
    kind: "save",
  });
  assert.equal(f.saved, 1);
  a.release();
  f.s.metadata({ name: "allowed" });
  assert.equal(f.s.model.name, "allowed");
  await assert.rejects(
    () =>
      a.dispatch({
        leaseId: a.leaseId,
        commandId: "late",
        kind: "undo",
        baseRevision: 0,
      }),
    /失效/,
  );
});

test("client cannot redo pre-lease geometry or switch canvas, release invalidates queued digest", async () => {
  const f = setup(),
    a = f.authority;
  assert.throws(() => f.s.select(f.s.activeId), /绘画/);
  await assert.rejects(
    () =>
      a.dispatch({
        leaseId: a.leaseId,
        commandId: "redo-before",
        baseRevision: f.s.model.revision,
        kind: "redo",
      }),
    /重做/,
  );
  const pending = a.dispatch({
    leaseId: a.leaseId,
    commandId: "pending-save",
    baseRevision: f.s.model.revision,
    kind: "save",
  });
  a.release();
  await assert.rejects(() => pending, /失效/);
  assert.equal(f.saved, 0);
});

test("paint history boundary survives bounded main history eviction", async () => {
  const f = setup();
  f.authority.release();
  for (let i = 0; i < 45; i++) f.s.metadata({ name: "step" + i });
  const a = new PaintLeaseAuthority(
    f.s,
    "bounded",
    f.s.editObjectId!,
    () => {},
  );
  const count = f.s.past.length;
  await a.dispatch({
    leaseId: a.leaseId,
    commandId: "bounded-paint",
    baseRevision: f.s.model.revision,
    kind: "paint",
    source: {
      schema: "xinghai-surface-paint-1",
      density: 64,
      faces: { "0,0,0,0": { "0": "#abcdef" } },
    },
  });
  assert.equal(f.s.past.length, count);
  await a.dispatch({
    leaseId: a.leaseId,
    commandId: "bounded-undo",
    baseRevision: f.s.model.revision,
    kind: "undo",
  });
  assert.equal(Object.keys(f.s.active.paintSource?.faces ?? {}).length, 0);
  await assert.rejects(
    () =>
      a.dispatch({
        leaseId: a.leaseId,
        commandId: "old-undo",
        baseRevision: f.s.model.revision,
        kind: "undo",
      }),
    /进入绘画前/,
  );
});

test('versioned sparse paint validates the entire command before committing and preserves geometry',async()=>{
 const f=setup(),a=f.authority,start=a.snapshot(),canvas=f.s.active,cells=canvas.cells,root=structuredClone(f.s.model.anchorM);
 const input={leaseId:a.leaseId,commandId:'delta',baseRevision:f.s.model.revision,kind:'paint',paintProtocol:1,delta:[{key:'0,0,0,4',index:'0',color:'#123456'}]};
 await a.dispatch(input);assert.equal(f.s.active.cells,cells);assert.deepEqual(f.s.model.anchorM,root);assert.equal(f.s.active.paintSource!.faces['0,0,0,4']['0'],'#123456');await a.dispatch(input);assert.equal(f.s.past.length,1);
 for(const patch of [{key:'2,0,0,4',index:'0',color:'#123456'},{key:'0,0,0,4',index:'256',color:'#123456'},{key:'0,0,0,4',index:'0',color:'bad'}]){await assert.rejects(a.dispatch({...input,commandId:crypto.randomUUID(),baseRevision:f.s.model.revision,delta:[input.delta[0],patch]}));assert.equal(f.s.past.length,1);}
 a.release();f.s.setEditObject(null);const before=structuredClone(f.s.model);f.s.patch({originTicks:[8,0,0]});f.s.undo();assert.deepEqual(f.s.active.paintSource,before.canvases![0].paintSource);f.s.redo();assert.deepEqual(f.s.active.paintSource,before.canvases![0].paintSource);
});
