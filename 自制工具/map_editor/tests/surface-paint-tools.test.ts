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
  get parentElement(){return this;}
  checked=false;
  setAttribute(){}
  add(c:Control){this.append(c);}
  querySelectorAll(){return [];}
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
      ["paint-size-number","1"],["paint-brush-shape","square"],["paint-plane","visible"],["paint-pixel-perfect",""],["paint-shape-filled",""],["paint-fill-range","face"],["paint-tolerance","0"],["paint-sample-source","raw"],["paint-perfect-status",""],["paint-size-voxel",""],
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
    if(!this.controls.has(selector))this.controls.set(selector,new Control());
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
function harness() {
  const document = new Control(),
    window = new Control();
  (document as any).createElement = () => new Control();
  Object.assign(globalThis, { document, window, Element: Control, Option:class extends Control{constructor(label:string,value:string){super();this.value=value;}} });
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
  const host = new Control(),
    canvas = new Control(),
    toolbar = new Control();
  const tools = new SurfacePaintTools({
    host,
    canvas,
    toolbar,
    state: () => (valid ? { source, step: 0.25, context } : null),
    hit: (e: any) =>
      e.clientX < 0
        ? null
        : hit(
            Math.min(15, Math.floor(e.clientX)),
            Math.min(15, Math.floor(e.clientY)),
          ),
    preview: () => previews++,
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
  assert.equal(h.saved,0,"active draft must be finished or explicitly cancelled before saving");
  assert.equal(h.tools.pending,true);
  h.event(h.document,"keydown",{key:"Escape"});h.up();
  h.event(h.document,"keydown",{key:"s",ctrlKey:true});
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
