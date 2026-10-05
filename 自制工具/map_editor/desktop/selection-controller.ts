import {
  VoxelSelection,
  voxelKey,
  type SelectionCell,
} from "../core/voxel-selection.ts";
import { ScreenSelectionQuery, type ScreenRect } from "./selection-query.ts";
import { interpolateScreen } from "../core/creative-build.ts";
import type { MapView } from "./view.ts";
import type { EditorDocument } from "../core/document.ts";
export class SelectionController {
  readonly selection = new VoxelSelection();
  tool: "brush" | "box" = "box";
  depth = 1;
  private view: MapView;
  private document: () => EditorDocument;
  private changed: () => void;
  private abort: AbortController | null = null;
  private frame = 0;
  private pending: Promise<void> = Promise.resolve();
  private gesture: {
    base: SelectionCell[];
    hits: Map<string, SelectionCell>;
    modifier: "replace" | "add" | "subtract";
    start: PointerEvent;
    last: PointerEvent;
    query: ScreenSelectionQuery;
    rect: ScreenRect;
  } | null = null;
  private confirmed: NonNullable<SelectionController["gesture"]> | null = null;
  private box: HTMLDivElement;
  private off: (() => void)[] = [];
  constructor(
    view: MapView,
    document: () => EditorDocument,
    active: () => boolean,
    changed: () => void,
  ) {
    this.view = view;
    this.document = document;
    this.changed = changed;
    this.box = window.document.createElement("div");
    this.box.className = "selection-screen-box";
    this.box.hidden = true;
    view.host.append(this.box);
    const canvas = view.renderer.domElement;
    const on = (
      target: EventTarget,
      type: string,
      fn: any,
      options: any = true,
    ) => {
      target.addEventListener(type, fn, options);
      this.off.push(() => target.removeEventListener(type, fn, options));
    };
    on(canvas, "pointerdown", (e: PointerEvent) => {
      if (!active() || e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.cancel();
      const point = this.ndc(e);
      this.gesture = {
        base: [...this.selection.snapshot.values()],
        hits: new Map(),
        modifier: e.ctrlKey ? "subtract" : e.shiftKey ? "add" : "replace",
        start: e,
        last: e,
        query: new ScreenSelectionQuery(
          view.camera,
          document().cells,
          view.section,
        ),
        rect: { x0: point.x, y0: point.y, x1: point.x, y1: point.y },
      };
      canvas.setPointerCapture(e.pointerId);
      if (this.tool === "brush") this.brush(e);
      else this.schedule();
    });
    on(canvas, "pointermove", (e: PointerEvent) => {
      if (!this.gesture) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (this.tool === "brush") {
        for (const p of interpolateScreen(this.gesture.last, e))
          this.brush(p as PointerEvent);
        this.gesture.last = e;
      } else {
        const p = this.ndc(e);
        this.gesture.rect.x1 = p.x;
        this.gesture.rect.y1 = p.y;
        this.gesture.last = e;
        this.schedule();
      }
    });
    on(canvas, "pointerup", (e: PointerEvent) => {
      if (!this.gesture || e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      void this.finish();
    });
    on(canvas, "pointercancel", () => this.cancel());
    on(window, "blur", () => this.cancel());
    on(window.document, "keydown", (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (this.gesture || this.view.host.dataset.selectionBusy === "true")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.cancel();
      }
    });
    on(
      canvas,
      "wheel",
      (e: WheelEvent) => {
        if (!active() || !e.altKey) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.setDepth(
          (Number.isFinite(this.depth) ? this.depth : 1) +
            (e.deltaY < 0 ? 1 : -1),
        );
      },
      { capture: true, passive: false },
    );
  }
  private ndc(e: { clientX: number; clientY: number }) {
    const r = this.view.host.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: 1 - ((e.clientY - r.top) / r.height) * 2,
    };
  }
  private merge(
    g: NonNullable<SelectionController["gesture"]>,
    hits: SelectionCell[],
  ) {
    const result = new VoxelSelection();
    if (g.modifier !== "replace") result.add(g.base);
    if (g.modifier === "subtract") result.subtract(hits.map(voxelKey));
    else result.add(hits);
    return result;
  }
  private brush(e: PointerEvent) {
    const g = this.gesture;
    if (!g) return;
    const ray = this.view.ray(e).ray,
      o = ray.origin,
      d = ray.direction,
      doc = this.document();
    const h = g.query.hit(
      [o.x * 4, -o.z * 4, o.y * 4],
      [d.x * 4, -d.z * 4, d.y * 4],
    );
    if (h) g.hits.set(voxelKey(h.cell), h.cell);
    this.display(
      this.merge(g, [...g.hits.values()]),
      true,
      g.modifier === "subtract",
    );
  }
  private display(
    selection: VoxelSelection,
    preview = false,
    subtract = false,
  ) {
    this.view.selectionOverlay(selection.snapshot.values(), preview, subtract);
    this.view.host.dataset.selectionCount = String(selection.count);
    this.view.host.dataset.selectionBounds = JSON.stringify(selection.bounds);
    this.changed();
  }
  private schedule() {
    this.view.host.dataset.selectionBusy = "true";
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.pending = this.compute();
    });
  }
  private async compute() {
    const g = this.gesture ?? this.confirmed;
    if (!g) return;
    this.abort?.abort();
    const abort = (this.abort = new AbortController());
    const r = g.rect;
    this.box.hidden = !this.gesture;
    Object.assign(this.box.style, {
      left: `${(Math.min(r.x0, r.x1) + 1) * 50}%`,
      top: `${(1 - Math.max(r.y0, r.y1)) * 50}%`,
      width: `${Math.abs(r.x1 - r.x0) * 50}%`,
      height: `${Math.abs(r.y1 - r.y0) * 50}%`,
    });
    this.view.host.dataset.selectionBusy = "true";
    try {
      const hits = await g.query.select({ ...r }, this.depth, abort.signal);
      if (abort.signal.aborted) return;
      g.hits = new Map(hits.map((c) => [voxelKey(c), c]));
      const result = this.merge(g, hits);
      if (!this.gesture) this.selection.replace(result.snapshot.values());
      this.display(result, !!this.gesture, g.modifier === "subtract");
    } catch (e) {
      if (!abort.signal.aborted) console.error(e);
    } finally {
      if (this.abort === abort) {
        this.view.host.dataset.selectionBusy = "false";
        this.changed();
      }
    }
  }
  private async finish() {
    const g = this.gesture;
    if (!g) return;
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.pending = this.compute();
    }
    await this.pending;
    if (this.gesture !== g) return;
    this.selection.replace(
      this.merge(g, [...g.hits.values()]).snapshot.values(),
    );
    this.confirmed = this.tool === "box" ? g : null;
    this.gesture = null;
    this.box.hidden = true;
    this.display(this.selection);
  }
  setDepth(depth: number) {
    this.depth =
      depth === Infinity ? Infinity : Math.max(1, Math.min(250000, depth));
    if (this.tool === "box" && (this.gesture || this.confirmed))
      this.schedule();
    this.changed();
  }
  cancel() {
    this.abort?.abort();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.gesture = null;
    this.box.hidden = true;
    this.view.host.dataset.selectionBusy = "false";
    this.display(this.selection);
  }
  invalidate() {
    this.cancel();
    this.confirmed = null;
  }
  clear() {
    this.invalidate();
    this.selection.clear();
    this.display(this.selection);
  }
  all() {
    this.invalidate();
    this.selection.replace(
      [...this.document().cells.values()].filter(
        (c) => this.view.section === null || c.z + 1 <= this.view.section,
      ),
    );
    this.display(this.selection);
  }
  refresh() {
    this.display(this.selection);
  }
  dispose() {
    this.abort?.abort();
    cancelAnimationFrame(this.frame);
    this.off.forEach((f) => f());
    this.box.remove();
  }
}
