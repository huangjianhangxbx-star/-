import {paintCount,paintInput} from "./paint-performance.ts";
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
import {
  PaintSurfaceDomain,
  pixelKey,
  type SurfacePixel,
  type Chart,
} from "../core/paint-surface-domain.ts";
import {
  rasterLine,
  rasterBrush,
  rasterStroke,
  rasterShape,
  perfectPath,
  constrain,
  type UV,
} from "../core/paint-raster.ts";
import { PaintSelection, fillPixels, fillPixelsChunked } from "../core/paint-selection.ts";
import { mirrorPixel, type SymmetrySpec } from "../core/symmetry-space.ts";
import {
  emptyPaint,
  applyPaintDelta,
  paintDelta,
} from "./paint-command-queue.ts";
type PaintState = {
  source?: SurfacePaint;
  step: number;
  context: string;
  domain?: PaintSurfaceDomain;
  origin?: [number, number, number];
  symmetry?: SymmetrySpec;
  hiddenMirror?: boolean;
};
type Dependencies = {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  toolbar: HTMLElement;
  state: () => PaintState | null;
  hit: (e: PointerEvent) => SurfacePaintHit | null;
  project?: (e: PointerEvent, c: Chart) => UV | null;
  visible?: (p: SurfacePixel) => boolean;
  guides?: (p: SurfacePixel[], selection: SurfacePixel[]) => void;
  beginQuery?:()=>void;
  canStart?: () => boolean;
  preview: (source?: SurfacePaint) => void;
  color: () => string;
  baseColor: (hit: SurfacePaintHit) => string;
  pick: (color: string) => void;
  authorColor?: (hit: SurfacePaintHit, paint: string | undefined) => string;
  commit: (source: SurfacePaint, before?: SurfacePaint) => void | Promise<void>;
  prepare: () => void;
  changed: () => void;
  history: (kind: "undo" | "redo") => void;
  save: () => void;
  message: (s: string, error?: boolean) => void;
};
type Stroke = {
  source: SurfacePaint;
  base: SurfacePaint;
  pointer: number;
  start: SurfacePaintHit;
  chart: Chart;
  last: SurfacePaintHit | null;
  path: UV[];
  nodes: UV[];
  end: UV;
  screen: UV;
  color: string | null;
  context: string;
  pixels: Map<string, SurfacePixel>;
  fixed: Map<string, SurfacePixel>;
  expanded: Map<string, SurfacePixel>;
  computing?:boolean;
  released?:boolean;
  modifier: "replace" | "add" | "subtract";
};
/** One target, one author plane per shape. Drafts never edit geometry. */
export class SurfacePaintTools {
  private deps: Dependencies;
  private enabled = false;
  private context = "";
  private stroke: Stroke | null = null;
  private off: (() => void)[] = [];
  private previewFrame = 0;
  private previewPixels: SurfacePixel[] | Map<string,SurfacePixel> = [];
  private batching = false;
  private selectionJob=0;
  private selecting=false;
  private selectedCache: {revision:number;domain:PaintSurfaceDomain|undefined;pixels:SurfacePixel[]}|null=null;
  private lastHit: SurfacePaintHit | null = null;
  readonly selection = new PaintSelection();
  readonly element: HTMLSpanElement;
  readonly mode: HTMLSelectElement;
  readonly tool: HTMLSelectElement;
  readonly size: HTMLInputElement;
  readonly shape: HTMLSelectElement;
  readonly plane: HTMLSelectElement;
  readonly perfect: HTMLInputElement;
  readonly filled: HTMLInputElement;
  readonly range: HTMLSelectElement;
  readonly tolerance: HTMLInputElement;
  readonly sample: HTMLSelectElement;
  constructor(deps: Dependencies) {
    this.deps = deps;
    this.element = document.createElement("span");
    this.element.id = "surface-paint-controls";
    this.element.innerHTML = `<select id="surface-paint-mode" aria-label="编辑内容"><option value="model">建模</option><option value="paint">材质绘制</option></select><select id="surface-paint-tool" aria-label="材质绘制工具"></select><div class="paint-tool-buttons"></div><div class="paint-context"><label>尺寸 <input id="surface-paint-size" type="range" min="1" max="32" value="1"><input id="paint-size-number" type="number" min="1" max="32" value="1"></label><output id="surface-paint-size-value">1 px</output><button id="paint-size-voxel">一体素大小</button><select id="paint-brush-shape"><option value="square">方形硬边</option><option value="circle">圆形硬边</option></select><select id="paint-plane"><option value="visible">沿可见表面</option><option value="locked">锁起笔平面</option></select><label><input id="paint-pixel-perfect" type="checkbox">像素完美</label><label><input id="paint-shape-filled" type="checkbox">填充形状</label><select id="paint-fill-range"><option value="face">当前体素面</option><option value="plane">共面连通区域</option><option value="selection">当前选区填色</option></select><label>容差 <input id="paint-tolerance" type="number" min="0" max="255" value="0"></label><select id="paint-sample-source"><option value="raw">笔触／底色</option><option value="author">作者最终色</option></select><span id="paint-perfect-status"></span><span id="paint-mirror-status"></span></div><div class="paint-selection-actions"><button data-selection="connected">共面连通面</button><button data-selection="invert">反选</button><button data-selection="clear">清除选区</button><button data-selection="erase">擦除选区笔触</button></div>`;
    deps.toolbar.append(this.element);
    const get = <T extends HTMLElement>(id: string) =>
      this.element.querySelector<T>("#" + id)!;
    this.mode = get("surface-paint-mode");
    this.tool = get("surface-paint-tool");
    this.size = get("surface-paint-size");
    this.shape = get("paint-brush-shape");
    this.plane = get("paint-plane");
    this.perfect = get("paint-pixel-perfect");
    this.filled = get("paint-shape-filled");
    this.range = get("paint-fill-range");
    this.tolerance = get("paint-tolerance");
    this.sample = get("paint-sample-source");
    for (const [value, label] of Object.entries({
      brush: "画笔",
      erase: "擦除",
      line: "直线",
      polyline: "折线",
      rectangle: "矩形",
      ellipse: "椭圆",
      fill: "填充",
      select: "选区",
      pick: "原始笔触吸色",
      "pick-author": "作者最终色吸色",
    })) {
      this.tool.add(new Option(label, value));
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.paintTool = value;
      b.onclick = () => {
        this.tool.value = value;
        this.tool.dispatchEvent(new Event("change"));
      };
      this.element.querySelector(".paint-tool-buttons")!.append(b);
    }
    this.mode.onchange = () => {
      this.cancel();
      deps.prepare();
      this.enabled = this.mode.value === "paint" && !!deps.state();
      this.sync();
      deps.changed();
    };
    this.tool.onchange = () => {
      this.cancel();
      this.syncParameters();
    };
    const sizeNumber = get<HTMLInputElement>("paint-size-number");
    const resize = (value: string) => {
      const n = Math.max(1, Math.min(32, Math.round(Number(value) || 1)));
      this.size.value = sizeNumber.value = String(n);
      this.syncParameters();
    };
    this.size.oninput = () => resize(this.size.value);
    sizeNumber.oninput = () => resize(sizeNumber.value);
    get("paint-size-voxel").onclick = () =>
      resize(String(paintResolution(deps.state()!.step)));
    for (const control of [
      this.shape,
      this.plane,
      this.perfect,
      this.filled,
      this.range,
      this.tolerance,
    ])
      control.addEventListener("change", () => {
        if (this.stroke) this.rebuild();
        this.syncParameters();
      });
    this.element
      .querySelectorAll<HTMLButtonElement>("[data-selection]")
      .forEach(
        (b) => (b.onclick = () => this.selectionCommand(b.dataset.selection!)),
      );
    const on = (t: EventTarget, k: string, f: EventListener) => {
      t.addEventListener(k, f, true);
      this.off.push(() => t.removeEventListener(k, f, true));
    };
    on(deps.canvas, "pointerdown", ((e: PointerEvent) =>
      this.down(e)) as EventListener);
    on(deps.canvas, "pointermove", ((e: PointerEvent) =>
      this.move(e)) as EventListener);
    on(deps.canvas, "pointerup", ((e: PointerEvent) =>
      this.up(e)) as EventListener);
    on(deps.canvas, "pointercancel", () => this.cancel());
    on(window, "blur", (event) => {
      if (event.target === window) this.cancel();
    });
    on(deps.canvas, "dblclick", ((e: PointerEvent) => {
      if (
        this.stroke &&
        this.stroke.nodes.length >= 2 &&
        this.tool.value === "polyline"
      ) {
        this.stop(e);
        void this.finish();
      }
    }) as EventListener);
    on(document, "keydown", ((e: KeyboardEvent) =>
      this.key(e)) as EventListener);
    this.sync();
  }
  get active() {
    return this.enabled && !!this.deps.state();
  }
  get pending() {
    return !!this.stroke||this.selecting;
  }
  sync() {
    const s = this.deps.state();
    if (!s || s.context !== this.context) {
      this.cancel();
      this.selection.clear();
      this.context = s?.context ?? "";
      if (!s) this.enabled = false;
    }
    this.element.hidden = !s;
    this.mode.value = this.enabled ? "paint" : "model";
    this.deps.host.dataset.surfacePaintMode = this.active ? "paint" : "model";
    this.syncParameters();
  }
  private syncParameters() {
    const tool = this.tool.value;
    this.element
      .querySelectorAll<HTMLElement>("[data-paint-tool]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.paintTool === tool)),
      );
    const shape = ["rectangle", "ellipse"].includes(tool),
      fill = tool === "fill";
    const drawing = [
      "brush",
      "erase",
      "line",
      "polyline",
      "rectangle",
      "ellipse",
    ].includes(tool);
    this.size.parentElement!.hidden = !drawing;
    this.element.querySelector<HTMLElement>("output")!.hidden = !drawing;
    this.element.querySelector<HTMLElement>("#paint-size-voxel")!.hidden =
      !drawing;
    this.shape.hidden = !drawing;
    this.plane.hidden = !["brush", "erase"].includes(tool);
    this.filled.parentElement!.hidden = !shape;
    this.range.hidden = !fill;
    this.tolerance.parentElement!.hidden = !fill;
    this.sample.hidden = !fill && !tool.startsWith("pick");
    this.perfect.parentElement!.hidden = tool !== "brush";
    this.element.querySelector("#paint-perfect-status")!.textContent =
      this.perfect.checked &&
      (tool !== "brush" || Number(this.size.value) !== 1)
        ? "像素完美仅适用于1px画笔"
        : "";
    this.element.querySelector("output")!.textContent =
      this.size.value +
      " px · " +
      (Number(this.size.value) / 64).toFixed(4) +
      " m";
  }
  exit() {
    this.cancel();
    this.enabled = false;
    this.sync();
    this.deps.changed();
  }
  cancel() {
    this.selectionJob++;this.selecting=false;delete this.deps.host.dataset.paintComputing;
    if(this.previewFrame && typeof cancelAnimationFrame!=="undefined")cancelAnimationFrame(this.previewFrame);this.previewFrame=0;
    const s = this.stroke;
    this.stroke = null;
    if (s && this.deps.canvas.hasPointerCapture(s.pointer))
      this.deps.canvas.releasePointerCapture(s.pointer);
    this.deps.preview();
    delete this.deps.host.dataset.paintPreviewPixels;
    this.guides([]);
  }
  refreshPreview() {
    if (this.stroke) this.deps.preview(this.stroke.source);
  }
  private stop(e: Event) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  private chart(hit: SurfacePaintHit): Chart {
    return {
      face: hit.face,
      plane:
        [hit.x, hit.y, hit.z][Math.floor(hit.face / 2)] +
        (hit.face % 2 ? 0 : 1),
    };
  }
  private uv(hit: SurfacePaintHit, state: PaintState): UV {
    const t = [0, 1, 2].filter((a) => a !== Math.floor(hit.face / 2)),
      c = [hit.x, hit.y, hit.z],
      n = paintResolution(state.step);
    return [c[t[0]] * n + hit.u, c[t[1]] * n + hit.v];
  }
  private same(a: Chart, b: Chart) {
    return a.face === b.face && a.plane === b.plane;
  }
  private visible(p: SurfacePixel) {
    return this.deps.visible?.(p) ?? true;
  }
  private candidates(uvs: UV[], chart: Chart, state: PaintState) {
    const pixels: SurfacePixel[] = [];
    for (const uv of uvs) {
      const p = state.domain?.pixel(chart, ...uv);
      if (p && this.visible(p)) pixels.push(p);
    }
    return pixels;
  }
  private expand(pixels: SurfacePixel[], state: PaintState) {
    const out = new Map<string, SurfacePixel>();
    let skipped = 0;
    for (const original of pixels) {
      const variants = state.symmetry
        ? mirrorPixel(
            original,
            state.symmetry,
            state.origin ?? [0, 0, 0],
            state.step,
          )
        : [original];
      for (const p of variants) {
        const valid = state.domain
          ? state.domain.pixel(this.chart(p), ...this.uv(p, state))
          : p;
        if (
          !valid ||
          !this.selection.allows(p) ||
          ((!state.hiddenMirror || pixelKey(p) === pixelKey(original)) &&
            !this.visible(p))
        ) {
          skipped++;
          continue;
        }
        out.set(pixelKey(p), p);
      }
    }
    this.deps.host.dataset.paintSkipped = String(skipped);
    this.element.querySelector("#paint-mirror-status")!.textContent = skipped
      ? "范围跳过 " + skipped + " 像素"
      : "";
    return [...out.values()];
  }
  private guides(p: SurfacePixel[]) {
 const state=this.deps.state();if(!this.selectedCache||this.selectedCache.revision!==this.selection.revision||this.selectedCache.domain!==state?.domain){this.selectedCache={revision:this.selection.revision,domain:state?.domain,pixels:state?.domain&&this.selection.active?state.domain.chartPixels(this.parseChart()).filter(p=>this.selection.allows(p)):[]};}
 this.deps.guides?.(p,this.selectedCache.pixels);
 }
 private flushPreview(){paintCount("previewFlush");if(this.previewFrame&&typeof cancelAnimationFrame!=='undefined')cancelAnimationFrame(this.previewFrame);this.previewFrame=0;if(this.stroke){this.deps.preview(this.stroke.source);this.guides(this.previewPixels instanceof Map?[...this.previewPixels.values()]:this.previewPixels);}}
 private schedulePreview(pixels:SurfacePixel[]|Map<string,SurfacePixel>){this.previewPixels=pixels;if(this.batching)return;if(typeof requestAnimationFrame==='undefined'){this.flushPreview();return;}if(!this.previewFrame)this.previewFrame=requestAnimationFrame(()=>this.flushPreview());}
  private parseChart(): Chart {
    const [face, plane] = this.selection.chart!.split(":").map(Number);
    return { face, plane };
  }
  private down(e: PointerEvent) {
    paintInput();this.deps.beginQuery?.();
    if (!this.active || e.button !== 0) return;
    this.stop(e);
    const state = this.deps.state()!,
      hit = this.deps.hit(e);
    if (!hit) return;
    this.lastHit = hit;
    this.deps.canvas.tabIndex = -1;
    this.deps.canvas.focus({ preventScroll: true });
    if (e.altKey || this.tool.value.startsWith("pick")) {
      const raw = state.source?.faces[hit.key]?.[hit.index];
      this.deps.pick(
        (this.tool.value === "pick-author" ||
          (e.altKey && this.sample.value === "author")) &&
          this.deps.authorColor
          ? this.deps.authorColor(hit, raw)
          : (raw ?? this.deps.baseColor(hit)),
      );
      return;
    }
    if (this.deps.canStart && !this.deps.canStart()) {
      this.deps.message("队列已满或提交失败，请等待、重试或放弃", true);
      return;
    }
    if (this.stroke && this.tool.value === "polyline") {
      const uv = this.deps.project?.(e, this.stroke.chart);
      if (uv) {
        if (this.stroke.nodes.length >= 128) {
          this.deps.message("折线节点已达128个，请先完成当前折线", true);
          return;
        }
        this.stroke.nodes.push(
          e.shiftKey ? constrain(this.stroke.nodes.at(-1)!, uv) : uv,
        );
        this.stroke.end = uv;
        this.rebuild();
      }
      return;
    }
    this.cancel();
    const source = state.source ?? emptyPaint(),
      uv = this.uv(hit, state);
    this.stroke = {
      source,
      base: source,
      pointer: e.pointerId,
      start: hit,
      chart: this.chart(hit),
      last: null,
      path: [],
      nodes: [uv],
      end: uv,
      screen: [e.clientX, e.clientY],
      color: this.tool.value === "erase" ? null : this.deps.color(),
      context: state.context,
      pixels: new Map(),
      fixed: new Map(),
      expanded: new Map(),
      modifier: e.shiftKey ? "add" : e.ctrlKey ? "subtract" : "replace",
    };
    this.deps.canvas.setPointerCapture(e.pointerId);
    try {
      if (this.tool.value === "fill") {
        const d = state.domain;
        if (d) {
          const sample = (p: SurfacePixel) => {
            const raw = source.faces[p.key]?.[p.index];
            return this.sample.value === "author" && this.deps.authorColor
              ? this.deps.authorColor(p, raw)
              : (raw ?? this.deps.baseColor(p));
          };
          if(this.range.value!=='face'&&typeof requestAnimationFrame!=='undefined'){
            const stroke=this.stroke!;stroke.computing=true;this.deps.host.dataset.paintComputing='true';this.deps.message('正在计算填充 · Esc取消');
            void fillPixelsChunked(d,hit,this.range.value,this.selection,sample,Math.max(0,Math.min(255,Number(this.tolerance.value))),p=>this.visible(p),()=>this.stroke!==stroke||this.deps.state()?.context!==stroke.context,()=>new Promise(r=>setTimeout(r,0)),n=>this.deps.message('正在计算填充 '+n+' 像素 · Esc取消')).then(pixels=>{if(!pixels||this.stroke!==stroke)return;stroke.computing=false;delete this.deps.host.dataset.paintComputing;this.setPixels(pixels,state);if(stroke.released)void this.finish();}).catch(error=>{if(this.stroke===stroke)this.fail(error);});
            return;
          }
          this.setPixels(
            fillPixels(
              d,
              hit,
              this.range.value,
              this.selection,
              sample,
              Math.max(0, Math.min(255, Number(this.tolerance.value))),
              (p) => this.visible(p),
            ),
            state,
          );
        } else
          this.setPixels(
            surfaceBrushPixels(hit, 32, state.step) as SurfacePixel[],
            state,
          );
      } else if (["brush", "erase"].includes(this.tool.value))
        this.apply(hit, state);
      else this.rebuild();
    } catch (error) {
      this.fail(error);
    }
  }
  private apply(hit: SurfacePaintHit, state: PaintState) {
    const s = this.stroke!;
    const chart = this.chart(hit);
    if (this.plane.value === "locked" && !this.same(chart, s.chart)) {
      s.last = null;
      return;
    }
    if (!state.domain) {
      this.setPixels(
        surfaceStrokePixels(
          s.last,
          hit,
          Number(this.size.value),
          state.step,
        ).map((p) => ({ ...hit, ...p })),
        state,
        true,
      );
      s.last = hit;
      return;
    }
    const previous =
        s.last && this.same(this.chart(s.last), chart)
          ? this.uv(s.last, state)
          : null,
      uv = this.uv(hit, state),
      path = previous ? rasterLine(previous, uv) : [uv];
    if (!s.last || !this.same(chart, s.chart)) {
      for (const [k, p] of s.pixels) s.fixed.set(k, p);
      s.path = [];
      s.chart = chart;
    }
    s.path.push(...path);
    if (
      this.tool.value === "brush" &&
      Number(this.size.value) === 1 &&
      this.perfect.checked
    ) {
      const kept = perfectPath(s.path);
      s.pixels = new Map(s.fixed);
      for (const p of this.candidates(kept, chart, state))
        s.pixels.set(pixelKey(p), p);
      this.setPixels([...s.pixels.values()], state);
    } else {
      const footprint = rasterStroke(
        path,
        Number(this.size.value),
        this.shape.value,
      );
      this.setPixels(this.candidates(footprint, chart, state), state, true);
    }
    s.last = hit;
  }
  private setPixels(pixels: SurfacePixel[], state: PaintState, append = false) {
 const s=this.stroke!;
 const fresh=append?pixels.filter(p=>!s.pixels.has(pixelKey(p))):pixels;
 if(append&&!fresh.length)return;
 if(!append)s.pixels.clear();for(const p of fresh)s.pixels.set(pixelKey(p),p);
 const added=this.expand(fresh,state), final=append?s.expanded:new Map<string,SurfacePixel>();
 const prior=new Set(added.filter(p=>s.expanded.has(pixelKey(p))).map(pixelKey));
 for(const p of added)final.set(pixelKey(p),p);
 const delta: {key:string;index:string;color:string|null}[]=[];
 if(!append)for(const [key,p] of s.expanded)if(!final.has(key))delta.push({key:p.key,index:String(p.index),color:s.base.faces[p.key]?.[p.index]??null});
 for(const p of added)if(!prior.has(pixelKey(p)))delta.push({key:p.key,index:String(p.index),color:s.color});
 if(delta.length)s.source=applyPaintDelta(s.source,delta);
 s.expanded=final;
 this.deps.host.dataset.paintPreviewPixels=String(final.size);
 this.schedulePreview(final);
 }
  private rebuild() {
    const s = this.stroke,
      state = this.deps.state();
    if (!s || !state) return;
    try {
      const tool = this.tool.value;
      let uvs: UV[] = [];
      if (["line", "polyline"].includes(tool)) {
        const nodes =
          tool === "line" ? [s.nodes[0], s.end] : [...s.nodes, s.end];
        const unique = new Map<string, UV>();
        for (let i = 1; i < nodes.length; i++) {
          for (const uv of rasterStroke(
            rasterLine(nodes[i - 1], nodes[i]),
            Number(this.size.value),
            this.shape.value,
          )) {
            unique.set(uv.join(","), uv);
            if (unique.size > 262144) throw Error("图形超过像素预算");
          }
        }
        uvs = [...unique.values()];
      } else if (["rectangle", "ellipse", "select"].includes(tool))
        uvs = rasterShape(
          tool === "select" ? "rectangle" : tool,
          s.nodes[0],
          s.end,
          Number(this.size.value),
          tool === "select" || this.filled.checked,
        );
      else return;
      const pixels = this.candidates(uvs, s.chart, state);
      if (tool === "select") {
        s.pixels = new Map(pixels.map((p) => [pixelKey(p), p]));
        this.guides(pixels);
      } else this.setPixels(pixels, state);
    } catch (error) {
      this.fail(error);
    }
  }
  private move(e: PointerEvent) {
    this.deps.beginQuery?.();
    if (!this.active) return;
    const state = this.deps.state()!;
    if (!this.stroke) {
      if (e.buttons) return;
      const hit = this.deps.hit(e);
      if (hit) {
        this.lastHit = hit;
        const p = state.domain
          ? this.candidates(
              rasterBrush(
                this.uv(hit, state),
                Number(this.size.value),
                this.shape.value,
              ),
              this.chart(hit),
              state,
            )
          : [{ ...hit }];
        try {
          this.guides(this.expand(p, state));
        } catch (error) {
          this.deps.message((error as Error).message, true);
        }
      } else this.guides([]);
      return;
    }
    const s = this.stroke;
    if (e.buttons & 6) return;
    if (s.context !== state.context) {
      this.cancel();
      return;
    }
    if (
      ["line", "polyline", "rectangle", "ellipse", "select"].includes(
        this.tool.value,
      )
    ) {
      const uv =
        this.deps.project?.(e, s.chart) ??
        (this.deps.hit(e) ? this.uv(this.deps.hit(e)!, state) : null);
      if (uv) {
        s.end =
          e.shiftKey && this.tool.value !== "select"
            ? constrain(
                s.nodes.at(-1)!,
                uv,
                ["rectangle", "ellipse"].includes(this.tool.value),
              )
            : uv;
        this.rebuild();
      }
      return;
    }
    if (
      !(e.buttons & 1) ||
      e.pointerId !== s.pointer ||
      this.tool.value === "fill"
    )
      return;
    this.stop(e);
    try {
      const dx = e.clientX - s.screen[0],
        dy = e.clientY - s.screen[1],
        count = Math.ceil(Math.hypot(dx, dy) / 2);
      if (count > 4096) {
        s.last = null;
        return;
      }
      this.batching=true;
      for (let i = 1; i <= count; i++) {
        const hit = this.deps.hit({
          clientX: s.screen[0] + (dx * i) / count,
          clientY: s.screen[1] + (dy * i) / count,
        } as PointerEvent);
        if (hit) this.apply(hit, state);
        else s.last = null;
      }
      this.batching=false;
      this.schedulePreview(this.previewPixels);
      s.screen = [e.clientX, e.clientY];
    } catch (error) {
      this.batching=false;
      this.fail(error);
    }
  }
  private up(e: PointerEvent) {
    if (!this.stroke || e.pointerId !== this.stroke.pointer || e.button !== 0)
      return;
    this.stop(e);
    if (this.deps.canvas.hasPointerCapture(e.pointerId))
      this.deps.canvas.releasePointerCapture(e.pointerId);
    if(this.stroke.computing){this.stroke.released=true;return;}
    if (this.tool.value === "polyline") return;
    void this.finish();
  }
  private async finish() {
    if(this.stroke?.computing){this.stroke.released=true;return;}
    this.flushPreview();
    const s = this.stroke;
    if (!s) return;
    this.stroke = null;
    delete this.deps.host.dataset.paintPreviewPixels;
    if (this.tool.value === "select") {
      try {
        this.selection.change(
          s.chart.face + ":" + s.chart.plane,
          [...s.pixels.values()],
          s.modifier,
        );
        this.guides([]);
        this.deps.message(
          "贴图选区 " + this.selection.keys.size + " 像素 · 只约束绘画",
        );
      } catch (e) {
        this.deps.message((e as Error).message, true);
      }
      return;
    }
    try {
      if (
        this.deps.state()?.context === s.context &&
        paintDelta(s.base, s.source).length
      )
        await this.deps.commit(s.source, s.base);
      this.deps.preview();
      this.refreshPreview();
    } catch (error) {
      this.deps.preview();
      this.deps.message((error as Error).message, true);
    }
    this.guides([]);
  }
  private async selectionCommand(action: string) {
    try {
      const state = this.deps.state(),
        d = state?.domain;
      if (!state || !d) return;
      if (action === "clear") {
        this.selection.clear();
        this.guides([]);
        return;
      }
      if (!this.lastHit) throw Error("请先在目标表面定位");
      const chart = d.chart(this.lastHit),
        id = chart.face + ":" + chart.plane;
      if(action==='connected'||action==='invert'){
        if(action==='invert'&&this.selection.active&&this.selection.chart!==id)throw Error('请先清除其他平面选区');
        const generation=++this.selectionJob;this.selecting=true;this.deps.host.dataset.paintComputing='true';this.deps.message('正在计算选区 · Esc取消');
        const pixels=await fillPixelsChunked(d,this.lastHit,'plane',new PaintSelection(),()=> '#000000',0,p=>this.visible(p),()=>generation!==this.selectionJob||this.deps.state()?.context!==state.context,()=>new Promise(r=>setTimeout(r,0)));
        if(generation!==this.selectionJob||!pixels)return;
        this.selecting=false;delete this.deps.host.dataset.paintComputing;
        if(action==='connected')this.selection.change(id,pixels,'replace');else{this.selection.chart=id;this.selection.invert(pixels);}
        this.deps.message('贴图选区 '+this.selection.keys.size+' 像素');
      } else if (action === "erase") {
        if (!this.selection.active || !this.selection.keys.size)
          throw Error("贴图选区为空");
        const before = structuredClone(state.source ?? emptyPaint()),
          pixels = d
            .chartPixels(this.parseChart())
            .filter((p) => this.selection.allows(p));
        void Promise.resolve(
          this.deps.commit(
            applyPaintDelta(
              before,
              pixels.map((p) => ({
                key: p.key,
                index: String(p.index),
                color: null,
              })),
            ),
            before,
          ),
        ).catch((e) => this.deps.message(e.message, true));
      }
      this.guides([]);
    } catch (error) {
      this.selecting=false;delete this.deps.host.dataset.paintComputing;
      this.deps.message((error as Error).message, true);
    }
  }
  private key(e: KeyboardEvent) {
    if (
      !this.active ||
      (e.target instanceof Element &&
        e.target.closest("input,textarea,select,dialog"))
    )
      return;
    const key = e.key.toLowerCase();
    if (key === "alt") {
      this.stop(e);
      return;
    }
    if (key === "escape") {
      this.stop(e);
      if (this.pending) this.cancel();
      else {
        this.selection.clear();
        this.guides([]);
      }
      return;
    }
    if (key === "enter" && this.pending && this.tool.value === "polyline") {
      this.stop(e);
      void this.finish();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && ["z", "y", "s"].includes(key)) {
      this.stop(e);
      if (this.pending) {
        this.deps.message("请先结束当前笔画（折线Enter完成）或按Esc取消", true);
        return;
      }
      if (key === "s") this.deps.save();
      else this.deps.history(key === "y" || e.shiftKey ? "redo" : "undo");
      return;
    }
    if (key === "delete") {
      this.stop(e);
      this.selectionCommand("erase");
      return;
    }
    if (key === "[" || key === "]") {
      this.stop(e);
      this.size.value = String(
        Math.max(
          1,
          Math.min(32, Number(this.size.value) + (key === "]" ? 1 : -1)),
        ),
      );
      this.size.dispatchEvent(new Event("input"));
      return;
    }
    const tool = (
      {
        b: "brush",
        e: "erase",
        l: "line",
        r: "rectangle",
        o: "ellipse",
        g: "fill",
        m: "select",
      } as Record<string, string>
    )[key];
    if (tool && !e.ctrlKey && !e.metaKey) {
      this.stop(e);
      this.tool.value = tool;
      this.tool.dispatchEvent(new Event("change"));
    } else if (!["control", "shift", "alt", "meta", "tab"].includes(key)) {
      e.stopImmediatePropagation();
    }
  }
  private fail(error: unknown) {
    this.cancel();
    this.deps.message((error as Error).message, true);
  }
  dispose() {
    this.cancel();
    for (const f of this.off) f();
    this.element.remove();
  }
}
