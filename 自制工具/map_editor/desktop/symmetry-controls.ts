import { symmetryK, type SymmetrySpec } from "../core/symmetry-space.ts";
export type SymmetryTarget = {
  key: string;
  origin: [number, number, number];
  step: number;
  cells: readonly { x: number; y: number; z: number }[];
};
type Point = [number, number, number];
type SymmetryCell = SymmetryTarget['cells'][number];
export type SymmetryControlOptions = {
  getSelection?: () => readonly SymmetryCell[] | null;
  onDragChange?: (active: boolean) => void;
};
export function symmetryBoundsCenter(target: SymmetryTarget, cells = target.cells): Point | null {
  if (!cells.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const cell of cells) [cell.x, cell.y, cell.z].forEach((n, a) => {
    min[a] = Math.min(min[a], n); max[a] = Math.max(max[a], n);
  });
  return target.origin.map((o, a) => o + (min[a] + max[a] + 1) * target.step / 2) as Point;
}
export function offsetSymmetryCenter(spec: SymmetrySpec, target: SymmetryTarget, axis: number, direction: number, stepInCells: number): SymmetrySpec {
  if (![0, 1, 2].includes(axis) || ![-1, 1].includes(direction) || ![.5, 1].includes(stepInCells))
    throw Error('步长须为半格或整格，并指定有效方向');
  if (spec.center.some(n => !Number.isFinite(n)) || !Number.isFinite(target.step) || target.step <= 0)
    throw Error('对称中心与体素尺寸须为有效有限数值');
  const next = structuredClone(spec);
  next.center[axis] += direction * stepInCells * target.step;
  symmetryK(next, target.origin, target.step);
  return next;
}
const values = new Map<string, SymmetrySpec>();
export function symmetryValue(target: SymmetryTarget): SymmetrySpec {
  let spec = values.get(target.key);
  const storage = "xh.symmetry." + target.key;
  if (!spec) {
    try {
      const saved = JSON.parse(localStorage.getItem(storage) ?? "null");
      if (
        saved &&
        saved.axes.length === 3 &&
        saved.axes.every((v: any) => typeof v === "boolean") &&
        saved.center.length === 3 &&
        saved.center.every(Number.isFinite)
      ) {
        symmetryK(saved, target.origin, target.step);
        spec = saved;
      }
    } catch {}
    if (!spec) {
      const centre = symmetryBoundsCenter(target) ?? [...target.origin];
      spec = { axes: [false, false, false], center: centre };
    }
    values.set(target.key, spec);
  }
  return structuredClone(spec);
}
export class SymmetryControls {
  readonly element = document.createElement("details");
  private getTarget: () => SymmetryTarget | null;
  private changed: (s: SymmetrySpec) => void;
  private message: (s: string) => void;
  private options: SymmetryControlOptions;
  private key = "";
  private moving = false;
  picking = false;
  constructor(
    host: HTMLElement,
    getTarget: () => SymmetryTarget | null,
    changed: (s: SymmetrySpec) => void,
    message: (s: string) => void,
    options: SymmetryControlOptions = {},
  ) {
    this.getTarget = getTarget;
    this.changed = changed;
    this.message = message;
    this.options = options;
    this.element.className = "symmetry-controls";
    this.element.innerHTML =
      '<summary>对称 · 模型空间</summary><div class="symmetry-axes">' +
      ["X", "Y", "Z"]
        .map(
          (a, i) =>
            '<label><input type="checkbox" data-axis="' +
            i +
            '">' +
            a +
            "</label>",
        )
        .join("") +
      '</div><div class="symmetry-coordinates">' +
      ['X', 'Y', 'Z'].map((axis, i) => `<div class="symmetry-coordinate-row"><label>${axis}<input type="number" data-symmetry-center-axis="${i}" aria-label="对称中心 ${axis}（米）"></label><button data-symmetry-offset-axis="${i}" data-direction="-1" title="沿 ${axis} 负方向移动中心">−</button><button data-symmetry-offset-axis="${i}" data-direction="1" title="沿 ${axis} 正方向移动中心">+</button></div>`).join('') +
      '</div><label>中心步长<select data-symmetry-step aria-label="对称中心步长"><option value="0.5">半格</option><option value="1">整格</option></select></label><div class="actions"><button data-symmetry="reset">模型中心</button><button data-symmetry="selection">选区中心</button><button data-symmetry="pick">从模型选点</button>' +
      (options.onDragChange ? '<button data-symmetry="drag" aria-pressed="false">拖动中心</button>' : '') +
      '</div><details class="symmetry-coordinates-legacy"><summary>完整坐标与吸附</summary><label>固定中心（米）<input class="symmetry-center" aria-label="对称中心米坐标"></label><div class="actions"><button data-symmetry="apply">应用中心</button><button data-symmetry="snap">吸附半格</button></div></details><label><input type="checkbox" class="symmetry-hidden">镜像到不可见外表面（仅贴图）</label><p class="symmetry-hint">关闭 · 中心固定，Z向上</p>';
    host.append(this.element);
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          e.key === "Escape" &&
          (this.picking || this.dragging) &&
          !document.querySelector(":popover-open")
        ) {
          const wasPicking = this.picking;
          this.picking = false;
          this.setDragging(false);
          e.preventDefault();
          e.stopImmediatePropagation();
          message(wasPicking ? "已取消对称中心选点" : "已完成对称中心拖动，位置已保留");
        }
      },
      true,
    );
    this.element
      .querySelectorAll<HTMLInputElement>("[data-axis]")
      .forEach((input) => (input.onchange = () => this.store()));
    this.element.querySelectorAll<HTMLInputElement>('[data-symmetry-center-axis]').forEach(input => {
      input.oninput = () => this.store(this.numericCenter(), false);
      input.onchange = () => this.store(this.numericCenter());
    });
    this.element.querySelectorAll<HTMLButtonElement>('[data-symmetry-offset-axis]').forEach(button => button.onclick = () => {
      const target = this.getTarget(), spec = this.value();
      if (!target || !spec) return;
      try {
        const next = offsetSymmetryCenter(spec, target, Number(button.dataset.symmetryOffsetAxis), Number(button.dataset.direction), Number(this.element.querySelector<HTMLSelectElement>('[data-symmetry-step]')!.value));
        this.store(next.center);
      } catch (error) { this.message((error as Error).message); }
    });
    this.element.querySelectorAll<HTMLButtonElement>("[data-symmetry]").forEach(
      (b) =>
        (b.onclick = () => {
          const target = this.getTarget();
          if (!target) return;
          const action = b.dataset.symmetry;
          if (action === 'drag') { this.setDragging(!this.dragging); return; }
          if (action === "pick") {
            this.setDragging(false);
            this.picking = true;
            message("请点模型表面，设置固定对称中心");
            return;
          }
          if (action === "reset" || action === 'selection') {
            const center = symmetryBoundsCenter(target, action === 'selection' ? this.options.getSelection?.() ?? [] : target.cells);
            if (!center && action === 'selection') { this.message('请先选择体素，再设置选区中心'); return; }
            this.store(center ?? [...target.origin]);
            return;
          }
          if (action === "snap") {
            const p = this.center();
            this.input.value = p
              .map(
                (d, a) =>
                  target.origin[a] +
                  (Math.round((2 * (d - target.origin[a])) / target.step) *
                    target.step) /
                    2,
              )
              .join(",");
          }
          this.store();
        }),
    );
    window.addEventListener("storage", (e) => {
      if (e.key === "xh.symmetry." + this.key) {
        values.delete(this.key);
        this.sync(true);
      }
    });
  }
  private get input() {
    return this.element.querySelector<HTMLInputElement>(".symmetry-center")!;
  }
  private center() {
    return this.input.value.split(",").map(Number) as [number, number, number];
  }
  private numericCenter(): Point {
    return [...this.element.querySelectorAll<HTMLInputElement>('[data-symmetry-center-axis]')].map(input => input.value === '' ? NaN : Number(input.value)) as Point;
  }
  private displayCenter(center: Point) {
    this.input.value = center.join(',');
    this.element.querySelectorAll<HTMLInputElement>('[data-symmetry-center-axis]').forEach((input, i) => input.value = String(center[i]));
  }
  get dragging() { return this.moving; }
  setDragging(active: boolean) {
    const next = !!active && !!this.getTarget() && !!this.options.onDragChange;
    this.picking = false;
    if (next === this.moving) return;
    this.moving = next;
    this.updateActions();
    const spec = this.value(); if (spec) this.hint(spec);
    this.options.onDragChange?.(next);
  }
  setDragPoint(point: Point) {
    const target = this.getTarget();
    if (!target || !this.dragging) return;
    this.store(point.map((n, i) => target.origin[i] + Math.round(2 * (n - target.origin[i]) / target.step) * target.step / 2) as Point);
  }
  private updateActions() {
    const selection = this.element.querySelector<HTMLButtonElement>('[data-symmetry="selection"]')!;
    selection.disabled = !this.options.getSelection?.()?.length;
    const drag = this.element.querySelector<HTMLButtonElement>('[data-symmetry="drag"]');
    if (drag) { drag.textContent = this.dragging ? '完成拖动' : '拖动中心'; drag.setAttribute('aria-pressed', String(this.dragging)); }
  }
  value() {
    const target = this.getTarget();
    return target ? symmetryValue(target) : undefined;
  }
  get hiddenMirror() {
    return this.element.querySelector<HTMLInputElement>(".symmetry-hidden")!
      .checked;
  }
  sync(force = false) {
    const target = this.getTarget();
    this.element.hidden = !target;
    if (!target) { this.setDragging(false); return; }
    this.updateActions();
    if (this.key === target.key && !force) return;
    if (this.key !== target.key) { this.setDragging(false); this.picking = false; }
    this.key = target.key;
    const s = symmetryValue(target);
    this.displayCenter(s.center);
    this.element.querySelectorAll<HTMLInputElement>('[data-symmetry-center-axis]').forEach(input => input.step = String(target.step / 2));
    this.element
      .querySelectorAll<HTMLInputElement>("[data-axis]")
      .forEach((c) => (c.checked = s.axes[Number(c.dataset.axis)]));
    this.changed(s);
    this.hint(s);
  }
  setPoint(p: [number, number, number]) {
    this.picking = false;
    this.input.value = p.join(",");
    this.store();
  }
  private hint(s: SymmetrySpec) {
    this.element.querySelector(".symmetry-hint")!.textContent =
      (this.dragging ? '拖动中心中 · 拖拽三维轴，Esc 完成 · ' : '') + (s.axes.some(Boolean)
        ? s.axes.map((v, i) => (v ? "XYZ"[i] : "")).join("") + " 对称"
        : "关闭") + " · 中心 " + s.center.join(', ') + " 米，Z向上";
  }
  private store(center = this.center(), reportError = true) {
    try {
      const t = this.getTarget();
      if (!t) return;
      const s: SymmetrySpec = {
        axes: [
          ...this.element.querySelectorAll<HTMLInputElement>("[data-axis]"),
        ].map((c) => c.checked) as [boolean, boolean, boolean],
        center,
      };
      if (s.center.length !== 3 || s.center.some((n) => !Number.isFinite(n)))
        throw Error("请输入三个有效米坐标");
      symmetryK(s, t.origin, t.step);
      localStorage.setItem("xh.symmetry." + t.key, JSON.stringify(s));
      values.set(t.key, s);
      this.displayCenter(s.center);
      this.changed(s);
      this.hint(s);
    } catch (e) {
      if (reportError) { this.message((e as Error).message); this.sync(true); }
    }
  }
}
