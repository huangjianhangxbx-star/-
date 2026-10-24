import {
  MAX_PAINT_PIXELS,
  MAX_PAINT_FACES,
  paintResolution,
  sampleFace,
  type SurfacePaint,
} from "../core/surface-paint.ts";
export type SurfacePaintHit = {
  key: string;
  index: number;
  x: number;
  y: number;
  z: number;
  face: number;
  u: number;
  v: number;
};
type Pixel = { key: string; index: number };
export function surfaceBrushPixels(
  hit: SurfacePaintHit,
  size: number,
  step: number,
): Pixel[] {
  const n = paintResolution(step),
    out: Pixel[] = [],
    low = -Math.floor((size - 1) / 2),
    high = Math.ceil((size - 1) / 2);
  for (let y = low; y <= high; y++)
    for (let x = low; x <= high; x++) {
      const u = hit.u + x,
        v = hit.v + y;
      if (u >= 0 && u < n && v >= 0 && v < n)
        out.push({ key: hit.key, index: v * n + u });
    }
  return out;
}
export function surfaceStrokePixels(
  previous: SurfacePaintHit | null,
  hit: SurfacePaintHit,
  size: number,
  step: number,
): Pixel[] {
  if (!previous || previous.key !== hit.key)
    return surfaceBrushPixels(hit, size, step);
  const count = Math.max(
      Math.abs(hit.u - previous.u),
      Math.abs(hit.v - previous.v),
    ),
    pixels = new Map<string, Pixel>();
  for (let i = 0; i <= count; i++) {
    const t = count ? i / count : 0,
      u = Math.round(previous.u + (hit.u - previous.u) * t),
      v = Math.round(previous.v + (hit.v - previous.v) * t);
    for (const p of surfaceBrushPixels({ ...hit, u, v }, size, step))
      pixels.set(p.key + ":" + p.index, p);
  }
  return [...pixels.values()];
}
type PaintState = { source?: SurfacePaint; step: number; context: string };
type Dependencies = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  toolbar: HTMLElement;
  state: () => PaintState | null;
  hit: (event: PointerEvent) => SurfacePaintHit | null;
  preview: (source?: SurfacePaint) => void;
  color: () => string;
  baseColor: (hit: SurfacePaintHit) => string;
  pick: (color: string) => void;
  authorColor?:(hit:SurfacePaintHit,paint:string|undefined)=>string;
  commit: (source: SurfacePaint) => void;
  prepare: () => void;
  changed: () => void;
  history: (command: "undo" | "redo") => void;
  save: () => void;
  message: (text: string, error?: boolean) => void;
};
/** A texture gesture owns no geometry. Its draft is discarded until pointer-up. */
export class SurfacePaintTools {
  private deps: Dependencies;
  private enabled = false;
  private context = "";
  private stroke: {
    source: SurfacePaint;
    before: string;
    pointer: number;
    last: SurfacePaintHit | null;
    screen: { x: number; y: number };
    color: string | null;
    texels: number;
    faces: number;
    context: string;
  } | null = null;
  readonly element: HTMLSpanElement;
  readonly mode: HTMLSelectElement;
  readonly tool: HTMLSelectElement;
  readonly size: HTMLInputElement;
  private off: (() => void)[] = [];
  constructor(deps: Dependencies) {
    this.deps = deps;
    this.element = document.createElement("span");
    this.element.id = "surface-paint-controls";
    this.element.style.cssText =
      "display:inline-flex;align-items:center;gap:4px";
    this.element.innerHTML =
      '<select id="surface-paint-mode" aria-label="编辑内容"><option value="model">建模</option><option value="paint">材质绘制</option></select><select id="surface-paint-tool" aria-label="材质绘制工具"><option value="brush">画笔</option><option value="erase">擦除</option><option value="pick">原始笔触吸色</option><option value="pick-author">作者最终色吸色</option><option value="fill">填充</option></select><input id="surface-paint-size" aria-label="画笔像素大小" title="画笔大小（贴图像素）" type="range" min="1" max="32" step="1" value="1" style="width:72px"><output id="surface-paint-size-value" title="贴图像素">1 px</output>';
    deps.toolbar.append(this.element);
    this.mode = this.element.querySelector("#surface-paint-mode")!;
    this.tool = this.element.querySelector("#surface-paint-tool")!;
    this.size = this.element.querySelector("#surface-paint-size")!;
    this.mode.onchange = () => {
      this.cancel();
      deps.prepare();
      this.enabled = this.mode.value === "paint" && !!deps.state();
      this.sync();
      deps.changed();
    };
    this.tool.onchange = () => this.cancel();
    this.size.oninput = () => {
      this.cancel();
      this.element.querySelector("output")!.value = this.size.value + " px";
    };
    const on = (target: EventTarget, event: string, fn: EventListener) => {
      target.addEventListener(event, fn, true);
      this.off.push(() => target.removeEventListener(event, fn, true));
    };
    on(deps.canvas, "pointerdown", ((e: PointerEvent) =>
      this.down(e)) as EventListener);
    on(deps.canvas, "pointermove", ((e: PointerEvent) =>
      this.move(e)) as EventListener);
    on(deps.canvas, "pointerup", ((e: PointerEvent) =>
      this.up(e)) as EventListener);
    on(deps.canvas, "pointercancel", (() => this.cancel()) as EventListener);
    on(window, "blur", (() => this.cancel()) as EventListener);
    on(document, "keydown", ((e: KeyboardEvent) => {
      if (
        !this.active ||
        (e.target instanceof Element &&
          e.target.closest("input,textarea,select,dialog"))
      )
        return;
      const key = e.key.toLowerCase();
      if (key === "escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.cancel();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ["z", "y", "s"].includes(key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.cancel();
        if (key === "s") deps.save();
        else deps.history(key === "y" || e.shiftKey ? "redo" : "undo");
        return;
      }
      // Geometry shortcuts cannot affect the selected object's structure while painting.
      if (
        ![
          "control",
          "shift",
          "alt",
          "meta",
          "tab",
          "f1",
          "f2",
          "f3",
          "f4",
          "f5",
          "f6",
          "f7",
          "f8",
          "f9",
          "f10",
          "f11",
          "f12",
        ].includes(key)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }) as EventListener);
    this.sync();
  }
  get active() {
    return this.enabled && !!this.deps.state();
  }
  get pending() {
    return !!this.stroke;
  }
  exit() {
    this.cancel();
    this.enabled = false;
    this.sync();
    this.deps.changed();
  }
  sync() {
    const state = this.deps.state();
    if (!state || state.context !== this.context) {
      this.cancel();
      if (!state) this.enabled = false;
      this.context = state?.context ?? "";
    }
    this.element.hidden = !state;
    this.element.style.display = state ? "inline-flex" : "none";
    this.mode.value = this.enabled ? "paint" : "model";
    for (const control of [
      this.tool,
      this.size,
      this.element.querySelector("output")!,
    ])
      control.hidden = !this.active;
    this.deps.host.dataset.surfacePaintMode = this.active ? "paint" : "model";
  }
  cancel() {
    const stroke = this.stroke;
    this.stroke = null;
    if (stroke) {
      if (this.deps.canvas.hasPointerCapture(stroke.pointer))
        this.deps.canvas.releasePointerCapture(stroke.pointer);
      this.deps.preview();
    }
    delete this.deps.host.dataset.paintPreviewPixels;
  }
  private stop(e: PointerEvent) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  private hit(e: PointerEvent) {
    const hit = this.deps.hit(e);
    if (!hit) delete this.deps.host.dataset.paintHit;
    return hit;
  }
  private down(e: PointerEvent) {
    if (!this.active || e.button !== 0) return;
    this.stop(e);
    this.cancel();
    this.deps.canvas.tabIndex = -1;
    this.deps.canvas.focus({ preventScroll: true });
    const state = this.deps.state(),
      hit = this.hit(e);
    if (!state || !hit) return;
    if (this.tool.value === "pick"||this.tool.value === "pick-author") {
      this.deps.pick(
        this.tool.value==='pick-author'&&this.deps.authorColor?this.deps.authorColor(hit,state.source?.faces[hit.key]?.[String(hit.index)]):sampleFace(state.source, hit.key, hit.index, this.deps.baseColor(hit)),
      );
      return;
    }
    const source: SurfacePaint = state.source
      ? structuredClone(state.source)
      : { schema: "xinghai-surface-paint-1", density: 64, faces: {} };
    this.stroke = {
      source,
      before: JSON.stringify(source),
      pointer: e.pointerId,
      last: null,
      screen: { x: e.clientX, y: e.clientY },
      color: this.tool.value === "erase" ? null : this.deps.color(),
      texels: Object.values(source.faces).reduce(
        (n, p) => n + Object.keys(p).length,
        0,
      ),
      faces: Object.keys(source.faces).length,
      context: state.context,
    };
    this.deps.canvas.setPointerCapture(e.pointerId);
    try {
      if (this.tool.value === "fill") this.fill(hit, state);
      else this.apply(hit, state);
      this.show();
    } catch (error) {
      this.fail(error);
    }
  }
  private apply(hit: SurfacePaintHit, state: PaintState) {
    const s = this.stroke!;
    for (const p of surfaceStrokePixels(
      s.last,
      hit,
      Number(this.size.value),
      state.step,
    ))
      this.write(p);
    s.last = hit;
  }
  private write(pixel: Pixel) {
    const s = this.stroke!;
    let face = s.source.faces[pixel.key];
    if (s.color === null) {
      if (face && Object.hasOwn(face, pixel.index)) {
        delete face[pixel.index];
        s.texels--;
        if (!Object.keys(face).length) {
          delete s.source.faces[pixel.key];
          s.faces--;
        }
      }
    } else {
      if (!face) {
        face = s.source.faces[pixel.key] = {};
        s.faces++;
      }
      if (!Object.hasOwn(face, pixel.index)) s.texels++;
      face[pixel.index] = s.color;
    }
  }
  private fill(hit: SurfacePaintHit, state: PaintState) {
    const n = paintResolution(state.step),
      base = this.deps.baseColor(hit),
      target = sampleFace(state.source, hit.key, hit.index, base),
      queue = [hit.index],
      seen = new Set<number>();
    while (queue.length) {
      const i = queue.pop()!;
      if (seen.has(i)) continue;
      seen.add(i);
      if (
        sampleFace(state.source, hit.key, i, base).toLowerCase() !==
        target.toLowerCase()
      )
        continue;
      this.write({ key: hit.key, index: i });
      const u = i % n,
        v = Math.floor(i / n);
      if (u > 0) queue.push(i - 1);
      if (u < n - 1) queue.push(i + 1);
      if (v > 0) queue.push(i - n);
      if (v < n - 1) queue.push(i + n);
    }
  }
  private show() {
    const s = this.stroke;
    if (!s || !this.deps.state()) return;
    if (s.texels > MAX_PAINT_PIXELS || s.faces > MAX_PAINT_FACES)
      throw Error("绘画像素预算超限");
    this.deps.preview(s.source);
    this.deps.host.dataset.paintPreviewPixels = String(s.texels);
  }
  private move(e: PointerEvent) {
    if (!this.active) return;
    if (e.buttons === 0) {
      this.hit(e);
      return;
    }
    if (!this.stroke || e.pointerId !== this.stroke.pointer) return;
    this.stop(e);
    if (this.tool.value === "fill") return;
    const state = this.deps.state();
    if (!state || state.context !== this.stroke.context) {
      this.cancel();
      return;
    }
    try {
      const s = this.stroke,
        dx = e.clientX - s.screen.x,
        dy = e.clientY - s.screen.y,
        count = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
      // A miss or a different face breaks the path. Never paint through occlusion.
      if (count > 4096) {
        s.last = null;
        s.screen = { x: e.clientX, y: e.clientY };
        return;
      }
      for (let i = 1; i <= count; i++) {
        const hit = this.hit({
          clientX: s.screen.x + (dx * i) / count,
          clientY: s.screen.y + (dy * i) / count,
        } as PointerEvent);
        if (hit) this.apply(hit, state);
        else s.last = null;
      }
      s.screen = { x: e.clientX, y: e.clientY };
      this.show();
    } catch (error) {
      this.fail(error);
    }
  }
  private up(e: PointerEvent) {
    if (!this.stroke || e.pointerId !== this.stroke.pointer) return;
    this.stop(e);
    const s = this.stroke;
    this.stroke = null;
    if (this.deps.canvas.hasPointerCapture(e.pointerId))
      this.deps.canvas.releasePointerCapture(e.pointerId);
    delete this.deps.host.dataset.paintPreviewPixels;
    try {
      if (
        this.deps.state()?.context === s.context &&
        JSON.stringify(s.source) !== s.before
      )
        this.deps.commit(s.source);
      this.deps.preview();
    } catch (error) {
      this.deps.preview();
      this.deps.message((error as Error).message, true);
    }
  }
  private fail(error: unknown) {
    this.cancel();
    this.deps.message((error as Error).message, true);
  }
  dispose() {
    this.cancel();
    for (const off of this.off) off();
    this.element.remove();
  }
}
