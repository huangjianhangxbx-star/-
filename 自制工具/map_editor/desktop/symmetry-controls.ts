import { symmetryK, type SymmetrySpec } from "../core/symmetry-space.ts";
export type SymmetryTarget = {
  key: string;
  origin: [number, number, number];
  step: number;
  cells: readonly { x: number; y: number; z: number }[];
};
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
      const centre = target.origin.map((o, a) => {
        const axis = ["x", "y", "z"][a] as "x" | "y" | "z";
        return target.cells.length
          ? o +
              ((target.cells.reduce((m, c) => Math.min(m, c[axis]), Infinity) +
                target.cells.reduce((m, c) => Math.max(m, c[axis]), -Infinity) +
                1) *
                target.step) /
                2
          : o;
      }) as [number, number, number];
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
  private key = "";
  picking = false;
  constructor(
    host: HTMLElement,
    getTarget: () => SymmetryTarget | null,
    changed: (s: SymmetrySpec) => void,
    message: (s: string) => void,
  ) {
    this.getTarget = getTarget;
    this.changed = changed;
    this.message = message;
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
      '</div><label>固定中心（米）<input class="symmetry-center" aria-label="对称中心米坐标"></label><div class="actions"><button data-symmetry="apply">应用中心</button><button data-symmetry="snap">吸附半格</button><button data-symmetry="reset">重置到当前中心</button><button data-symmetry="pick">从模型选点</button></div><label><input type="checkbox" class="symmetry-hidden">镜像到不可见外表面（仅贴图）</label><p class="symmetry-hint">关闭 · 中心固定，Z向上</p>';
    host.append(this.element);
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          e.key === "Escape" &&
          this.picking &&
          !document.querySelector(":popover-open")
        ) {
          this.picking = false;
          e.preventDefault();
          e.stopImmediatePropagation();
          message("已取消对称中心选点");
        }
      },
      true,
    );
    this.element
      .querySelectorAll<HTMLInputElement>("[data-axis]")
      .forEach((input) => (input.onchange = () => this.store()));
    this.element.querySelectorAll<HTMLButtonElement>("[data-symmetry]").forEach(
      (b) =>
        (b.onclick = () => {
          const target = this.getTarget();
          if (!target) return;
          const action = b.dataset.symmetry;
          if (action === "pick") {
            this.picking = true;
            message("请点模型表面，设置固定对称中心");
            return;
          }
          if (action === "reset") {
            const axes=[...this.element.querySelectorAll<HTMLInputElement>("[data-axis]")].map(c=>c.checked);
            values.delete(target.key);
            localStorage.removeItem("xh.symmetry." + target.key);
            this.sync(true);
            this.element.querySelectorAll<HTMLInputElement>("[data-axis]").forEach((c,i)=>c.checked=axes[i]);
            this.store();
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
    if (!target) return;
    if (this.key === target.key && !force) return;
    this.key = target.key;
    const s = symmetryValue(target);
    this.input.value = s.center.join(",");
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
      (s.axes.some(Boolean)
        ? s.axes.map((v, i) => (v ? "XYZ"[i] : "")).join("") + " 对称"
        : "关闭") + " · 中心固定，Z向上";
  }
  private store() {
    try {
      const t = this.getTarget();
      if (!t) return;
      const s: SymmetrySpec = {
        axes: [
          ...this.element.querySelectorAll<HTMLInputElement>("[data-axis]"),
        ].map((c) => c.checked) as [boolean, boolean, boolean],
        center: this.center(),
      };
      if (s.center.length !== 3 || s.center.some((n) => !Number.isFinite(n)))
        throw Error("请输入三个有效米坐标");
      symmetryK(s, t.origin, t.step);
      values.set(t.key, s);
      localStorage.setItem("xh.symmetry." + t.key, JSON.stringify(s));
      this.changed(s);
      this.hint(s);
    } catch (e) {
      this.message((e as Error).message);
      this.sync(true);
    }
  }
}
