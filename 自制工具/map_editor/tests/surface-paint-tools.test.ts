import { PaintSurfaceDomain } from "../core/paint-surface-domain.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  surfaceBrushPixels,
  surfaceStrokePixels,
} from "../desktop/surface-paint-tools.ts";
const hit = (u: number, v: number, key = "0,0,0,4") => ({
  key,
  index: v * 16 + u,
  u,
  v,
  x: 0,
  y: 0,
  z: 0,
  face: 4,
});
test("texture brush footprint is clipped to its real face at every precision", () => {
  for (const step of [0.25, 0.125, 0.0625]) {
    const n = step * 64;
    const pixels = surfaceBrushPixels({ ...hit(0, 0), index: 0 }, 3, step);
    assert.equal(pixels.length, 4);
    assert.ok(pixels.every((p) => p.index >= 0 && p.index < n * n));
  }
  assert.equal(surfaceBrushPixels(hit(6, 6), 1, 0.25).length, 1);
});
test("texture interpolation stays on one face and fills short pointer gaps", () => {
  const pixels = surfaceStrokePixels(hit(1, 1), hit(6, 1), 1, 0.25);
  assert.deepEqual(
    pixels.map((p) => p.index),
    [17, 18, 19, 20, 21, 22],
  );
  assert.equal(
    surfaceStrokePixels(hit(1, 1), hit(6, 1, "1,0,0,4"), 1, 0.25).length,
    1,
  );
  assert.equal(surfaceStrokePixels(null, hit(6, 1), 1, 0.25).length, 1);
});

class Control extends EventTarget {
  hidden = false;
  get parentElement() {
    return this;
  }
  checked = false;
  setAttribute() {}
  add(c: Control) {
    this.append(c);
  }
  querySelectorAll() {
    return [];
  }
  style: any = {};
  dataset: Record<string, string> = {};
  value = "";
  id = "";
  tabIndex = 0;
  children: Control[] = [];
  controls = new Map<string, Control>();
  captures = new Set<number>();
  set innerHTML(_html: string) {
    for (const [id, value] of [
      ["paint-size-number", "1"],
      ["paint-brush-shape", "square"],
      ["paint-plane", "visible"],
      ["paint-pixel-perfect", ""],
      ["paint-shape-filled", ""],
      ["paint-fill-range", "face"],
      ["paint-tolerance", "0"],
      ["paint-sample-source", "raw"],
      ["paint-perfect-status", ""],
      ["paint-size-voxel", ""],
      ["surface-paint-mode", "model"],
      ["surface-paint-tool", "brush"],
      ["surface-paint-size", "1"],
      ["surface-paint-size-value", "1 px"],
    ]) {
      const c = new Control();
      c.value = value;
      this.controls.set("#" + id, c);
      if (id === "surface-paint-size-value") this.controls.set("output", c);
    }
  }
  append(c: Control) {
    this.children.push(c);
  }
  querySelector(selector: string) {
    if (!this.controls.has(selector))
      this.controls.set(selector, new Control());
    return this.controls.get(selector);
  }
  setPointerCapture(i: number) {
    this.captures.add(i);
  }
  hasPointerCapture(i: number) {
    return this.captures.has(i);
  }
  releasePointerCapture(i: number) {
    this.captures.delete(i);
  }
  focus() {}
  closest() {
    return null;
  }
  remove() {}
}
import { SurfacePaintTools } from "../desktop/surface-paint-tools.ts";
import type { SurfacePaint } from "../core/surface-paint.ts";
function harness(domain?: PaintSurfaceDomain) {
  const document = new Control(),
    window = new Control();
  (document as any).createElement = () => new Control();
  Object.assign(globalThis, {
    document,
    window,
    Element: Control,
    Option: class extends Control {
      constructor(label: string, value: string) {
        super();
        this.value = value;
      }
    },
  });
  let source: SurfacePaint | undefined,
    valid = true,
    context = "canvas:owner",
    color = "#ff0000",
    commits = 0,
    previews = 0,
    picked = "",
    history = "",
    saved = 0,
    prepared = 0;
  let guidePixels:any[]=[],selectedPixels:any[]=[];
  const host = new Control(),
    canvas = new Control(),
    toolbar = new Control();
  const tools = new SurfacePaintTools({
    host,
    canvas,
    toolbar,
    state: () => (valid ? { source, step: 0.25, context, domain } : null),
    hit: (e: any) =>
      e.clientX < 0
        ? null
        : hit(
            Math.min(15, Math.floor(e.clientX)),
            Math.min(15, Math.floor(e.clientY)),
          ),
    preview: () => previews++,
    guides:(p:any[],s:any[])=>{guidePixels=p;selectedPixels=s;},
    color: () => color,
    baseColor: () => "#222222",
    pick: (c) => (picked = c),
    commit: (s) => {
      source = structuredClone(s);
      commits++;
    },
    prepare: () => prepared++,
    changed: () => {},
    history: (c) => (history = c),
    save: () => saved++,
    message: () => {},
  } as any);
  tools.mode.value = "paint";
  (tools.mode as any).onchange();
  const event = (target: EventTarget, type: string, props: any) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, props);
    target.dispatchEvent(e);
    return e;
  };
  const down = (x = 1, y = 1, button = 0) =>
    event(canvas, "pointerdown", {
      clientX: x,
      clientY: y,
      button,
      buttons: button === 0 ? 1 : 2,
      pointerId: 1,
    });
  const move = (x: number, y: number) =>
    event(canvas, "pointermove", {
      clientX: x,
      clientY: y,
      buttons: 1,
      pointerId: 1,
    });
  const up = () => event(canvas, "pointerup", { button: 0, pointerId: 1 });
  return {
    tools,
    get guidePixels(){return guidePixels;},
    get selectedPixels(){return selectedPixels;},
    down,
    move,
    up,
    event,
    window,
    document,
    canvas,
    get source() {
      return source;
    },
    get commits() {
      return commits;
    },
    get previews() {
      return previews;
    },
    get picked() {
      return picked;
    },
    get history() {
      return history;
    },
    get saved() {
      return saved;
    },
    set valid(v: boolean) {
      valid = v;
    },
    set context(v: string) {
      context = v;
    },
    set color(v: string) {
      color = v;
    },
  };
}
test("texture pointer gesture commits once and never changes saved source during hold", () => {
  const h = harness();
  assert.equal(h.tools.active, true);
  h.down();
  h.move(6, 1);
  assert.equal(h.commits, 0);
  assert.equal(h.source, undefined);
  assert.ok(h.previews > 0);
  h.up();
  assert.equal(h.commits, 1);
  assert.equal(Object.keys(h.source!.faces["0,0,0,4"]).length, 6);
  h.up();
  assert.equal(h.commits, 1);
  h.tools.dispose();
});
test("texture pending stroke cancels on Escape, blur, context switch and loss of permission", () => {
  for (const action of ["escape", "blur", "context", "permission"]) {
    const h = harness();
    h.down();
    if (action === "escape") h.event(h.document, "keydown", { key: "Escape" });
    if (action === "blur") h.event(h.window, "blur", {});
    if (action === "context") {
      h.context = "other";
      h.tools.sync();
    }
    if (action === "permission") {
      h.valid = false;
      h.tools.sync();
    }
    h.up();
    assert.equal(h.commits, 0, action);
    assert.equal(h.tools.pending, false);
    h.tools.dispose();
  }
});
test("texture fill/pick/erase use texels and background, with no-op pick outside history", () => {
  const h = harness();
  h.tools.tool.value = "fill";
  h.down();
  h.up();
  assert.equal(Object.keys(h.source!.faces["0,0,0,4"]).length, 256);
  h.tools.tool.value = "pick";
  h.down();
  assert.equal(h.picked, "#ff0000");
  assert.equal(h.commits, 1);
  h.tools.tool.value = "erase";
  h.down();
  h.up();
  assert.equal(h.source!.faces["0,0,0,4"]["17"], undefined);
  h.tools.tool.value = "pick";
  h.down();
  assert.equal(h.picked, "#222222");
  assert.equal(h.commits, 2);
  h.tools.dispose();
});
test("texture mode preserves right mouse and routes undo/redo/save before geometry handlers", () => {
  const h = harness();
  assert.equal(h.down(1, 1, 2).defaultPrevented, false);
  assert.equal(h.commits, 0);
  h.down();
  h.event(h.document, "keydown", { key: "s", ctrlKey: true });
  assert.equal(
    h.saved,
    0,
    "active draft must be finished or explicitly cancelled before saving",
  );
  assert.equal(h.tools.pending, true);
  h.event(h.document, "keydown", { key: "Escape" });
  h.up();
  h.event(h.document, "keydown", { key: "s", ctrlKey: true });
  assert.equal(h.saved, 1);
  assert.equal(h.commits, 0);
  h.event(h.document, "keydown", { key: "z", ctrlKey: true });
  assert.equal(h.history, "undo");
  h.event(h.document, "keydown", { key: "z", ctrlKey: true, shiftKey: true });
  assert.equal(h.history, "redo");
  assert.equal(
    h.event(h.document, "keydown", { key: "Delete" }).defaultPrevented,
    true,
  );
  h.tools.dispose();
});
test("an unsynchronized owner switch cannot commit the old draft onto the new object", () => {
  const h = harness();
  h.down();
  h.context = "new-owner";
  h.up();
  assert.equal(h.commits, 0);
  h.tools.dispose();
});

test("Shift adds a rectangular texture selection without imposing a line angle constraint", () => {
  const h = harness(
    new PaintSurfaceDomain([{ x: 0, y: 0, z: 0 }], new Set(["0,0,0"]), 0.25),
  );
  h.tools.tool.value = "select";
  h.event(h.canvas, "pointerdown", {
    clientX: 1,
    clientY: 1,
    button: 0,
    buttons: 1,
    pointerId: 1,
    shiftKey: true,
  });
  h.event(h.canvas, "pointermove", {
    clientX: 5,
    clientY: 3,
    buttons: 1,
    pointerId: 1,
    shiftKey: true,
  });
  h.up();
  assert.equal(h.tools.selection.keys.size, 15);
  assert.equal(h.commits, 0);
  h.tools.dispose();
});

test('one pointer event does not publish a preview per two screen pixels', () => {
 const h=harness();h.down(1,1);const before=h.previews;const start=performance.now();h.move(700,1);const elapsed=performance.now()-start;
 console.log(JSON.stringify({scenario:'long-pointer-segment',elapsed,previews:h.previews-before}));
 assert.ok(h.previews-before<=1, 'one move should publish at most one preview');h.up();h.tools.dispose();
});

import {perfectPath} from '../core/paint-raster.ts';
import {applyPaintDelta,emptyPaint} from '../desktop/paint-command-queue.ts';
test('sparse draft restores prior painted pixels when a perfect path retracts its elbow',()=>{
 const domain=new PaintSurfaceDomain([{x:0,y:0,z:0}],new Set(['0,0,0']),.25);const h=harness(domain);h.down(2,2);h.move(12,2);h.up();const base=structuredClone(h.source!);h.color='#abcdef';h.tools.perfect.checked=true;h.down(2,2);for(const [x,y] of [[3,2],[3,3],[4,3],[4,4],[3,4],[3,3],[4,3],[5,3],[5,4]])h.move(x,y);const path=(h.tools as any).stroke.path,expected=applyPaintDelta(base,perfectPath(path).map(([u,v])=>({key:'0,0,0,4',index:String(v*16+u),color:'#abcdef'})));h.up();assert.deepEqual(h.source,expected);h.tools.dispose();
});

test('yellow guides are optional while actual paint and selected mask remain intact',()=>{
 const d=new PaintSurfaceDomain([{x:0,y:0,z:0}],new Set(['0,0,0']),.25),h=harness(d);
 h.down(1,1);h.move(5,1);assert.equal(h.guidePixels.length,0);
 h.tools.outline.checked=true;(h.tools.outline as any).onchange();assert.ok(h.guidePixels.length>0);
 h.tools.outline.checked=false;(h.tools.outline as any).onchange();assert.equal(h.guidePixels.length,0);
 h.up();assert.equal(h.source!.faces['0,0,0,4']['17'],'#ff0000');
 h.tools.selection.change('4:1',[d.pixel({face:4,plane:1},1,1)!],'replace');h.tools.cancel();assert.equal(h.selectedPixels.length,1);
 h.tools.dispose();
});

test('paste lands with one left click and never needs Enter',()=>{
 const d=new PaintSurfaceDomain([{x:0,y:0,z:0}],new Set(['0,0,0']),.25),h=harness(d);
 h.down(1,1);h.up();h.tools.selection.change('4:1',[d.pixel({face:4,plane:1},1,1)!],'replace');
 h.event(h.document,'keydown',{key:'c',ctrlKey:true});
 h.tools.element.querySelector<HTMLInputElement>('#paint-paste-scale')!.value='100';
 h.event(h.document,'keydown',{key:'v',ctrlKey:true});h.move(8,8);h.down(8,8);h.up();
 assert.equal(h.commits,2);assert.equal(h.tools.pending,false);assert.equal(h.source!.faces['0,0,0,4']['136'],'#ff0000');
 h.event(h.document,'keydown',{key:'Enter'});assert.equal(h.commits,2);h.tools.dispose();
});

test('copy resolves only selected texels, never enumerates the whole model plane',()=>{
 const d=new PaintSurfaceDomain([{x:0,y:0,z:0}],new Set(['0,0,0']),.25),h=harness(d);
 h.down(1,1);h.up();h.tools.selection.change('4:1',[d.pixel({face:4,plane:1},1,1)!],'replace');
 let scans=0;const original=d.chartPixels.bind(d);d.chartPixels=(chart)=>{scans++;return original(chart);};
 h.event(h.document,'keydown',{key:'c',ctrlKey:true});assert.equal(scans,0);h.tools.dispose();
});

test('paste bursts coalesce, unchanged hits skip preview, click flushes latest position',()=>{
 const d=new PaintSurfaceDomain([{x:0,y:0,z:0}],new Set(['0,0,0']),.25),h=harness(d);
 h.down(1,1);h.up();h.tools.selection.change('4:1',[d.pixel({face:4,plane:1},1,1)!],'replace');h.event(h.document,'keydown',{key:'c',ctrlKey:true});
 h.tools.element.querySelector<HTMLInputElement>('#paint-paste-scale')!.value='100';h.event(h.document,'keydown',{key:'v',ctrlKey:true});
 const frames=new Map<number,FrameRequestCallback>();let id=0;
 const oldRequest=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
 Object.assign(globalThis,{requestAnimationFrame:(f:FrameRequestCallback)=>{frames.set(++id,f);return id;},cancelAnimationFrame:(i:number)=>frames.delete(i)});
 try{
  const before=h.previews;for(let i=0;i<50;i++)h.move(8,8);assert.equal(h.previews,before);assert.equal(frames.size,1);
  const callback=[...frames.values()][0];frames.clear();callback(0);assert.equal(h.previews,before+1);
  h.move(8,8);const same=[...frames.values()][0];frames.clear();same(1);assert.equal(h.previews,before+1);
  h.move(10,10);h.down(11,11);h.up();assert.equal(frames.size,0);assert.equal(h.source!.faces['0,0,0,4']['187'],'#ff0000');assert.equal(h.commits,2);
 }finally{h.tools.dispose();Object.assign(globalThis,{requestAnimationFrame:oldRequest,cancelAnimationFrame:oldCancel});}
});

test('selection preview coalesces and mouse release retains the final rectangle',()=>{
 const d=new PaintSurfaceDomain([{x:0,y:0,z:0}],new Set(['0,0,0']),.25),h=harness(d),frames=new Map<number,FrameRequestCallback>();let id=0;
 const oldRequest=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
 Object.assign(globalThis,{requestAnimationFrame:(f:FrameRequestCallback)=>{frames.set(++id,f);return id;},cancelAnimationFrame:(i:number)=>frames.delete(i)});
 try{h.tools.tool.value='select';h.down(1,1);h.move(3,2);h.move(5,3);assert.equal(frames.size,1);h.up();assert.equal(frames.size,0);assert.equal(h.tools.selection.keys.size,15);h.down(1,1);h.move(8,8);h.event(h.document,'keydown',{key:'Escape'});assert.equal(frames.size,0);assert.equal(h.tools.selection.keys.size,15);}
 finally{h.tools.dispose();Object.assign(globalThis,{requestAnimationFrame:oldRequest,cancelAnimationFrame:oldCancel});}
});
