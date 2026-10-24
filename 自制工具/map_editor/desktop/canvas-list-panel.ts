import type { CanvasSession } from "../core/workshop-canvases.ts";
import { moduleEditor } from "./renderer.ts";
import {
  selectCanvasRows,
  planCanvasMerge,
  type CanvasListSelection,
} from "./canvas-list-state.ts";
import type { ToolPopovers } from "./tool-popovers.ts";
type Context = { sessionId: string; canvases?: CanvasSession };
type Deps = {
  current: () => Context | null;
  refresh: () => Promise<void>;
  objectMode: () => boolean;
  exitEdit: () => void;
  requireClosed: () => void;
  message: (s: string, error?: boolean) => void;
  confirm: (title: string, detail: string, label?: string) => Promise<boolean>;
  menus: ToolPopovers;
};
/** View-only list selection never enters model history. Only explicit commands write. */
export class CanvasListPanel {
  readonly root = document.createElement("section");
  readonly list = document.createElement("div");
  private rows = new Map<string, HTMLElement>();
  private key = "";
  private state: CanvasListSelection = {
    selected: [],
    active: "",
    anchor: null,
  };
  private clip: { assetId: string; canvas: any } | null = null;
  private contextMenu = document.createElement("div");
  private busy = false;
  private count = document.createElement("strong");
  private target = document.createElement("p");
  private merge!: HTMLButtonElement;
  private duplicate!: HTMLButtonElement;
  private remove!: HTMLButtonElement;
  private newStep = document.createElement("select");
  private name = document.createElement("input");
  private origin = document.createElement("input");
  private opacity = document.createElement("input");
  private opacityText = document.createElement("output");
  private spec = document.createElement("p");
  constructor(private deps: Deps) {
    this.root.className = "canvas-list-panel";
    this.list.id = "canvas-list";
    this.list.className = "canvas-layer-list";
    this.list.tabIndex = 0;
    this.list.setAttribute("role", "listbox");
    this.list.setAttribute("aria-label", "建模画布列表");
    this.list.setAttribute("aria-multiselectable", "true");
    const head = document.createElement("div");
    head.className = "canvas-list-header";
    head.append(
      this.count,
      this.button("全部取景", () => this.fitAll()),
    );
    this.root.append(head, this.list);
    const actions = document.createElement("div");
    actions.className = "canvas-list-actions";
    const add = document.createElement("details");
    add.id = "canvas-create-menu";
    const summary = document.createElement("summary");
    summary.textContent = "新增";
    add.append(summary);
    const body = document.createElement("div");
    body.append(document.createTextNode("新画布格尺寸"));
    this.newStep.id = "canvas-step";
    this.newStep.setAttribute("aria-label", "新画布体素尺寸");
    for (const n of [0.25, 0.125, 0.0625])
      this.newStep.append(new Option(n + " m", String(n)));
    body.append(
      this.newStep,
      this.button("新增画布", () => this.addCanvas(), "canvas-add"),
    );
    add.append(body);
    deps.menus.register(add, body, summary, "right");
    this.duplicate = this.button("复制", () => this.copyNow());
    this.merge = this.button(
      "合并所选",
      () => this.mergeSelected(),
      "canvas-merge",
    );
    this.remove = this.button(
      "删除",
      () => this.deleteSelected(),
      "canvas-delete",
    );
    actions.append(add, this.duplicate, this.merge, this.remove);
    this.target.id = "canvas-selection-summary";
    this.root.append(actions, this.target);
    const properties = document.createElement("details");
    properties.className = "canvas-current-properties";
    properties.innerHTML = "<summary>当前画布属性</summary>";
    this.name.id = "canvas-name";
    this.name.setAttribute("aria-label", "画布名称");
    this.name.onchange = () =>
      void this.mutate((m) => m.patch({ name: this.name.value }));
    this.origin.id = "canvas-origin";
    this.origin.setAttribute("aria-label", "画布位置（米）");
    this.opacity.type = "range";
    this.opacity.min = "0";
    this.opacity.max = "100";
    this.opacity.value = "100";
    this.opacity.id = "canvas-opacity";
    this.opacity.setAttribute("aria-label", "当前画布不透明度");
    this.opacity.oninput = () => {
      moduleEditor.canvasViews[0].setOpacity(
        this.multi.activeId,
        Number(this.opacity.value) / 100,
      );
      this.opacityText.textContent = this.opacity.value + "%";
    };
    properties.append(
      this.label("名称", this.name),
      this.spec,
      this.label("编辑视图透明度", this.opacity),
      this.opacityText,
      this.label("位置 X/Y/Z（米）", this.origin),
      this.button("应用位置", () =>
        this.mutate((m) => {
          m.editable();
          const v = this.origin.value.split(",").map(Number);
          if (
            v.length !== 3 ||
            v.some(
              (n) => !Number.isFinite(n) || !Number.isSafeInteger(n / 0.03125),
            )
          )
            throw Error("位置须为0.03125 m的整数倍");
          m.patch({
            originTicks: v.map((n) => n / 0.03125) as [number, number, number],
          });
        }),
      ),
    );
    this.root.append(properties);
    this.contextMenu.className = "canvas-context-menu";
    this.root.append(this.contextMenu);
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          !(e.target instanceof Element) ||
          !e.target.closest("#canvas-list") ||
          e.target.closest("input,textarea")
        )
          return;
        const key = e.key.toLowerCase(),
          ctrl = e.ctrlKey || e.metaKey;
        if (
          !(
            (ctrl && ["a", "c", "v"].includes(key)) ||
            ["delete", "f2"].includes(key)
          )
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (ctrl && key === "a") {
          this.state.selected = this.multi.model.canvases!.map(
            (c) => c.canvasId,
          );
          this.update();
        } else if (ctrl && key === "c") {
          this.clip = {
            assetId: this.multi.model.assetId,
            canvas: structuredClone(this.multi.active),
          };
          deps.message("已复制当前画布");
        } else if (ctrl && key === "v") void this.paste();
        else if (key === "delete") void this.deleteSelected();
        else this.rename(this.multi.activeId);
      },
      true,
    );
  }
  private get multi() {
    const m = this.deps.current()?.canvases;
    if (!m) throw Error("请先打开画布资产");
    return m;
  }
  private label(text: string, node: HTMLElement) {
    const label = document.createElement("label");
    label.textContent = text;
    label.append(node);
    return label;
  }
  private button(text: string, fn: () => unknown, id?: string) {
    const b = document.createElement("button");
    b.textContent = text;
    if (id) b.id = id;
    b.onclick = () => void fn();
    return b;
  }
  private only(id: string) {
    this.state = { selected: [id], active: id, anchor: id };
  }
  private async ready() {
    this.deps.requireClosed();
    const key = this.key;
    if (!(await moduleEditor.resolveDraft("操作画布"))) return false;
    if (key !== this.key) throw Error("画布上下文已变化");
    this.deps.requireClosed();
    return true;
  }
  private async attempt(fn: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    try {
      await fn();
    } catch (e: any) {
      this.deps.message(e.message, true);
    } finally {
      this.busy = false;
      this.update();
    }
  }
  update(host?: HTMLElement) {
    if (host && this.root.parentElement !== host) host.append(this.root);
    const ctx = this.deps.current();
    if (!ctx?.canvases) return;
    const m = ctx.canvases;
    if (ctx.sessionId !== this.key) {
      this.key = ctx.sessionId;
      this.only(m.activeId);
      this.rows.clear();
      this.list.replaceChildren();
    }
    const all = m.model.canvases!,
      live = new Set(all.map((c) => c.canvasId));
    this.state.selected = this.state.selected.filter((id) => live.has(id));
    this.state.active = m.activeId;
    for (const [id, row] of this.rows)
      if (!live.has(id)) {
        row.remove();
        this.rows.delete(id);
      }
    for (const [index, c] of all.entries()) {
      let row = this.rows.get(c.canvasId);
      if (!row) {
        row = this.makeRow(c.canvasId);
        this.rows.set(c.canvasId, row);
      }
      row.classList.toggle("active", c.canvasId === m.activeId);
      row.classList.toggle(
        "selected",
        this.state.selected.includes(c.canvasId),
      );
      row.setAttribute(
        "aria-selected",
        String(this.state.selected.includes(c.canvasId)),
      );
      const choose = row.querySelector<HTMLButtonElement>(
        ".canvas-layer-select",
      )!;
      choose.title = c.name;
      choose.setAttribute("aria-pressed", String(c.canvasId === m.activeId));
      choose.querySelector("span")!.textContent = c.name;
      choose.querySelector("small")!.textContent =
        c.voxelStepM +
        " m" +
        (c.canvasId === m.activeId ? " · 当前" : "") +
        (c.visible ? "" : " · 隐藏") +
        (c.locked ? " · 锁定" : "");
      row.querySelector<HTMLElement>("[data-visible]")!.textContent = c.visible
        ? "◉"
        : "○";
      row.querySelector<HTMLElement>("[data-visible]")!.title = c.visible
        ? "隐藏 " + c.name
        : "显示 " + c.name;
      row.querySelector<HTMLElement>("[data-lock]")!.textContent = c.locked
        ? "🔒"
        : "◇";
      row.querySelector<HTMLElement>("[data-lock]")!.title = c.locked
        ? "解锁 " + c.name
        : "锁定 " + c.name;
      if (this.list.children[index] !== row)
        this.list.insertBefore(row, this.list.children[index] ?? null);
    }
    this.count.textContent = "画布 · " + all.length;
    this.target.textContent =
      "已选 " + this.state.selected.length + " 张 · 合并到：" + m.active.name;
    this.merge.disabled =
      this.state.selected.length < 2 ||
      !this.state.selected.includes(m.activeId);
    this.merge.title = this.merge.disabled
      ? "请在列表用Ctrl或Shift选择两张以上画布"
      : "保留当前目标，按来源顺序合入";
    this.remove.disabled =
      this.state.selected.length === 0 ||
      this.state.selected.length === all.length;
    this.name.value = m.active.name;
    this.origin.value = m.active.originTicks.map((n) => n * 0.03125).join(",");
    this.spec.textContent =
      "格尺寸 " +
      m.active.voxelStepM +
      " m（固定）" +
      (m.active.locked ? " · 已锁定" : !m.active.visible ? " · 已隐藏" : "");
    this.opacity.value = String(
      Math.round(moduleEditor.canvasViews[0].getOpacity(m.activeId) * 100),
    );
    this.opacityText.textContent = this.opacity.value + "%";
    this.newStep.value = String(m.active.voxelStepM);
  }
  private makeRow(id: string) {
    const row = document.createElement("div");
    row.className = "canvas-layer-row";
    row.dataset.canvasId = id;
    row.setAttribute("role", "option");
    const eye = this.button("◉", () =>
      this.mutate((m) => {
        const c = m.model.canvases!.find((c) => c.canvasId === id)!;
        m.patch({ visible: !c.visible }, id);
      }),
    );
    eye.dataset.visible = "";
    const choose = document.createElement("button");
    choose.className = "canvas-layer-select";
    choose.append(
      document.createElement("span"),
      document.createElement("small"),
    );
    choose.onclick = (e) =>
      void this.choose(
        id,
        e.shiftKey ? "shift" : e.ctrlKey || e.metaKey ? "ctrl" : "plain",
      );
    choose.ondblclick = (e) => {
      e.preventDefault();
      this.rename(id);
    };
    const lock = this.button("◇", () =>
      this.mutate((m) => {
        const c = m.model.canvases!.find((c) => c.canvasId === id)!;
        m.patch({ locked: !c.locked }, id);
      }),
    );
    lock.dataset.lock = "";
    const token = document.createElement("span");
    token.className = "canvas-token";
    token.textContent = "▦";
    token.setAttribute("aria-hidden", "true");
    row.append(eye, token, choose, lock);
    let start: { x: number; y: number } | null = null,
      dragged = false;
    choose.onpointerdown = (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
      dragged = false;
      choose.setPointerCapture(e.pointerId);
    };
    choose.onpointermove = (e) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6)
        dragged = true;
    };
    choose.onpointerup = (e) => {
      if (!start) return;
      start = null;
      if (!dragged) return;
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>(".canvas-layer-row")?.dataset.canvasId;
      if (target && target !== id)
        void this.mutate((m) => m.moveBefore(id, target));
    };
    choose.addEventListener(
      "click",
      (e) => {
        if (dragged) {
          e.preventDefault();
          e.stopImmediatePropagation();
          dragged = false;
        }
      },
      true,
    );
    row.oncontextmenu = (e) => {
      e.preventDefault();
      void this.attempt(async () => {
        if (!(await this.ready())) return;
        if (!this.state.selected.includes(id))
          await this.applySelection(
            selectCanvasRows(
              this.multi.model.canvases!.map((c) => c.canvasId),
              this.state,
              id,
              "plain",
            ),
          );
        this.contextMenu.replaceChildren(
          this.button("合并所选", () => {
            this.deps.menus.close();
            void this.mergeSelected();
          }),
          this.button("复制当前画布", () => {
            this.deps.menus.close();
            void this.copyNow();
          }),
          this.button("改名", () => {
            this.deps.menus.close();
            this.rename(id);
          }),
          this.button("删除所选", () => {
            this.deps.menus.close();
            void this.deleteSelected();
          }),
        );
        this.deps.menus.openContext(
          this.contextMenu,
          e.clientX,
          e.clientY,
          choose,
        );
      });
    };
    return row;
  }
  private async applySelection(next: CanvasListSelection) {
    const m = this.multi;
    if (next.active !== m.activeId) {
      const wasEdit = !this.deps.objectMode();
      if (wasEdit) this.deps.exitEdit();
      m.select(next.active);
      this.state = next;
      await this.deps.refresh();
      if (wasEdit) this.deps.message("已退出旧物体内部编辑，切换绘制画布");
    } else {
      this.state = next;
      this.update();
    }
    if (!this.root.querySelector(".canvas-inline-rename"))
      this.list.focus({ preventScroll: true });
  }
  private choose(id: string, modifier: "plain" | "ctrl" | "shift") {
    return this.attempt(async () => {
      if (!(await this.ready())) return;
      await this.applySelection(
        selectCanvasRows(
          this.multi.model.canvases!.map((c) => c.canvasId),
          this.state,
          id,
          modifier,
        ),
      );
    });
  }
  private mutate(fn: (m: CanvasSession) => void) {
    return this.attempt(async () => {
      if (!(await this.ready())) return;
      fn(this.multi);
      await this.deps.refresh();
      this.update();
    });
  }
  private addCanvas() {
    const step = Number(this.newStep.value);
    this.deps.menus.close();
    return this.mutate((m) => {
      this.deps.exitEdit();
      m.add("画布 " + (m.model.canvases!.length + 1), step);
      this.only(m.activeId);
    });
  }
  private copyNow() {
    return this.mutate((m) => {
      this.deps.exitEdit();
      m.duplicate();
      this.only(m.activeId);
    });
  }
  private paste() {
    return this.mutate((m) => {
      if (this.clip?.assetId !== m.model.assetId)
        throw Error("请先复制本资产中的画布");
      this.deps.exitEdit();
      m.duplicate(this.clip.canvas);
      this.only(m.activeId);
    });
  }
  private deleteSelected() {
    return this.attempt(async () => {
      if (!(await this.ready())) return;
      const m = this.multi,
        ids = [...this.state.selected],
        rev = m.model.revision;
      if (ids.length >= m.model.canvases!.length)
        throw Error("至少保留一张画布");
      for (const c of m.model.canvases!.filter((c) => ids.includes(c.canvasId)))
        if (c.locked) throw Error(c.name + "：画布已锁定");
      if (!ids.length) return;
      if (
        !(await this.deps.confirm(
          "删除所选画布",
          m.model
            .canvases!.filter((c) => ids.includes(c.canvasId))
            .map((c) => c.name)
            .join("、") + "；可整次撤销。",
          "删除",
        ))
      )
        return;
      if (m.model.revision !== rev) throw Error("画布已变化，请重新操作");
      this.deps.requireClosed();
      this.deps.exitEdit();
      m.removeCanvases(ids);
      this.only(m.activeId);
      await this.deps.refresh();
    });
  }
  private mergeSelected() {
    return this.attempt(async () => {
      if (!(await this.ready())) return;
      const m = this.multi,
        ids = [...this.state.selected],
        target = m.activeId,
        plan = planCanvasMerge(m.model, ids, target),
        names = plan.order.map(
          (id) => m.model.canvases!.find((c) => c.canvasId === id)!.name,
        );
      if (plan.overlaps || plan.hidden.length) {
        const detail =
          "合并到：" +
          m.active.name +
          "。先载入目标，再按 " +
          names.join(" → ") +
          " 合入，后合入覆盖同格；重叠 " +
          plan.overlaps +
          " 格。" +
          (plan.hidden.length
            ? "隐藏来源：" + plan.hidden.join("、") + "；结果可见性沿用目标。"
            : "");
        if (!(await this.deps.confirm("确认合并画布", detail, "合并"))) return;
      }
      if (m.model.revision !== plan.revision)
        throw Error("画布版本已变化，请重新合并");
      this.deps.requireClosed();
      this.deps.exitEdit();
      m.mergeCanvases(ids, target);
      this.only(target);
      await this.deps.refresh();
    });
  }
  private rename(id: string) {
    const row = this.rows.get(id);
    if (!row || row.querySelector("input")) return;
    const c = this.multi.model.canvases!.find((c) => c.canvasId === id)!;
    const input = document.createElement("input");
    input.className = "canvas-inline-rename";
    input.value = c.name;
    input.setAttribute("aria-label", "画布行名称");
    const choose = row.querySelector<HTMLElement>(".canvas-layer-select")!;
    choose.hidden = true;
    row.insertBefore(input, choose);
    let done = false;
    const finish = (accept: boolean) => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      input.remove();
      choose.hidden = false;
      if (accept && value && value !== c.name)
        void this.mutate((m) => m.patch({ name: value }, id));
    };
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    };
    input.onblur = () => finish(true);
    input.focus();
    input.select();
  }
  private fitAll() {
    const m = this.multi,
      active = m.active,
      cells: any[] = [];
    for (const c of m.model.canvases!) {
      if (!c.visible) continue;
      for (const v of c.cells)
        for (const corner of [0, 1]) {
          const p = [v.x, v.y, v.z].map(
            (n, i) =>
              ((n + corner) * c.voxelStepM) / active.voxelStepM +
              ((c.originTicks[i] - active.originTicks[i]) * 0.03125) /
                active.voxelStepM -
              corner,
          );
          cells.push({ x: p[0], y: p[1], z: p[2] });
        }
    }
    moduleEditor.views.forEach((v) => v.fit({ cells }));
  }
}
