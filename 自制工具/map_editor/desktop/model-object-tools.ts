import { moduleEditor } from "./renderer.ts";
import type { AssetSession } from "./workshop-session.ts";
import type { ModelObjectClipboard } from "../core/workshop-canvases.ts";

/** Object commands own model history; edit mode delegates to the voxel editor. */
export class ModelObjectTools {
  objectMode = false;
  private asset = "";
  private ids = new Set<string>();
  private clipboard: { asset: string; data: ModelObjectClipboard } | null =
    null;
  private collapsed = new Set<string>();
  private mode = document.createElement("select");
  private commands = document.createElement("details");
  constructor(
    private ctx: {
      session: () => AssetSession | null;
      refresh: () => Promise<void>;
      changed: () => void;
      history: (redo: boolean) => void;
      save: () => void;
      message: (s: string, error?: boolean) => void;
    },
  ) {
    this.mode.id = "model-interaction-mode";
    this.mode.setAttribute("aria-label", "物体或编辑模式");
    this.mode.title = "Tab 切换物体／编辑模式";
    this.mode.innerHTML =
      '<option value="object">物体模式</option><option value="edit">编辑模式</option>';
    this.mode.onchange = () =>
      void this.switchMode(this.mode.value === "object");
    this.commands.id = "model-object-actions";
    const summary = document.createElement("summary");
    summary.textContent = "物体";
    this.commands.append(summary);
    const menu = document.createElement("div");
    this.commands.append(menu);
    for (const [id, label, fn] of [
      ["model-join", "合并物体 · Ctrl+J", () => this.join()],
      ["model-separate", "分离所选体素", () => this.separate()],
      ["model-object-copy", "复制物体", () => this.command("copy")],
      ["model-object-paste", "粘贴物体", () => this.command("paste")],
      [
        "model-object-rotate",
        "旋转 90°",
        () => this.mutate((m) => m.rotateObjects([...this.ids], 2, 1)),
      ],
      ["model-object-delete", "删除物体", () => this.command("delete")],
    ] as const) {
      const b = document.createElement("button");
      b.id = id;
      b.textContent = label;
      b.onclick = () => void fn();
      menu.append(b);
    }
    const bar = document.createElement("div");
    bar.className = "model-mode-controls";
    bar.append(this.mode, this.commands);
    document.querySelector("#editview")!.parentElement!.append(bar);
    document.addEventListener(
      "keydown",
      (e) => {
        if (
          !this.ctx.session() ||
          !document.querySelector("#app")?.getClientRects().length ||
          (e.target instanceof Element &&
            e.target.closest(
              'input,textarea,select,dialog,[contenteditable="true"]',
            ))
        )
          return;
        if (e.key === "Tab") {
          e.preventDefault();
          e.stopImmediatePropagation();
          void this.switchMode(!this.objectMode);
        } else if (
          this.objectMode && !moduleEditor.drawingActive &&
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === "j"
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          void this.join();
        } else if (
          this.objectMode && !moduleEditor.drawingActive &&
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === "d"
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          void this.mutate((m) => {
            m.duplicateObjects([...this.ids]);
          });
        }
      },
      true,
    );
  }
  private get multi() {
    return this.ctx.session()?.canvases;
  }
  private async mutate(fn: (m: NonNullable<AssetSession["canvases"]>) => void) {
    const m = this.multi;
    if (!m) return;
    try {
      moduleEditor.cancel();
      fn(m);
      this.ctx.changed();
      await this.ctx.refresh();
    } catch (e: any) {
      this.ctx.message(e.message, true);
    }
  }
  private async switchMode(object: boolean) {
    if (!object && !this.ids.size) {
      this.ctx.message("先选择需要编辑的物体");
      this.mode.value = "object";
      return;
    }
    moduleEditor.cancel();
    this.objectMode = object;
    if (!object) {
      const m = this.multi,
        active = m?.objectForCanvas()?.objectId;
      const id = active && this.ids.has(active) ? active : [...this.ids].at(-1);
      if (id) m?.selectObject(id);
    }
    await this.ctx.refresh();
  }
  async command(command: string) {
    const m = this.multi;
    if (!m) return;
    if (command === "save") {
      this.ctx.save();
      return;
    }
    if (command === "escape") {
      m.setObjectSelection([]);
      this.update();
      return;
    }
    if (command === "all") {
      m.setObjectSelection(
        m.expandedObjectIds(
          m.model
            .objects!.filter((o) =>
              o.canvasIds.some(
                (id) =>
                  m.model.canvases!.find((c) => c.canvasId === id)?.visible,
              ),
            )
            .map((o) => o.objectId),
        ),
      );
      this.update();
      return;
    }
    if (command === "copy") {
      if (this.ids.size)
        this.clipboard = {
          asset: this.asset,
          data: m.copyObjects([...this.ids]),
        };
      this.update();
      return;
    }
    await this.mutate((m) => {
      if (command === "undo" || command === "redo") {
        this.ctx.history(command === "redo");
        moduleEditor.clearSelection();
      } else if (command === "cut") {
        if (!this.ids.size) return;
        this.clipboard = {
          asset: this.asset,
          data: m.copyObjects([...this.ids]),
        };
        m.removeObjects([...this.ids]);
      } else if (command === "paste") {
        if (this.clipboard?.asset === this.asset)
          m.pasteObjects(this.clipboard.data);
      } else if (command === "delete") {
        if (this.ids.size) m.removeObjects([...this.ids]);
      }
    });
  }
  private join() {
    if (this.ids.size < 2) return;
    return this.mutate((m) => {
      m.joinObjects([...this.ids], m.objectForCanvas()?.objectId);
    });
  }
  private separate() {
    if (this.objectMode) return;
    return this.mutate((m) => {
      m.separateCells(moduleEditor.selectionCells());
      moduleEditor.clearSelection();
    });
  }
  private async pick(
    canvasIds: string[],
    modifier: "replace" | "add" | "subtract",
  ) {
    const m = this.multi;
    if (!m) return;
    if (this.objectMode && moduleEditor.drawingActive) moduleEditor.selectMode();
    const objects = m.model.objects!;
    const direct = objects
      .filter((o) => o.canvasIds.some((id) => canvasIds.includes(id)))
      .map((o) => o.objectId);
    const picked = m.expandedObjectIds(direct),
      before = m.activeId;
    if (modifier === "replace") this.ids.clear();
    for (const id of picked)
      modifier === "subtract" ? this.ids.delete(id) : this.ids.add(id);
    m.setObjectSelection(
      [...this.ids],
      modifier !== "subtract" ? direct.at(-1) : undefined,
    );
    if (before === m.activeId) this.update();
    else await this.ctx.refresh();
  }
  useObjectMode() { this.objectMode = true; }
  canvasShown(id: string) {
    const m = this.multi;
    return !this.objectMode && !!m?.objectForCanvas()?.canvasIds.includes(id);
  }
  update() {
    const m = this.multi;
    if (!m) return;
    if (this.asset !== m.model.assetId) {
      this.asset = m.model.assetId;
      this.objectMode = true;
    }
    this.ids = new Set(m.selectedObjectIds);
    this.mode.value = this.objectMode ? "object" : "edit";
    const selectedCanvasIds = m.model
      .objects!.filter((o) => this.ids.has(o.objectId))
      .flatMap((o) => o.canvasIds);
    const pivot =
      m.model.objects!.find(
        (o) => this.ids.has(o.objectId) && o.canvasIds.includes(m.activeId),
      ) ?? m.model.objects!.find((o) => this.ids.has(o.objectId));
    moduleEditor.setObjectMode(this.objectMode, {
      selectedCanvasIds,
      pivotTicks: pivot?.originTicks,
      onSelect: (ids, modifier) => void this.pick(ids, modifier),
      onTransform: (t) =>
        void this.mutate((m) => {
          if (t.kind === "move") m.moveObjects([...this.ids], t.deltaTicks);
          else
            m.rotateObjects(
              [...this.ids],
              { x: 0, y: 1, z: 2 }[t.axis],
              t.turns,
            );
        }),
      onCommand: (c) => void this.command(c),
    });
    document
      .querySelector("#app")!
      .classList.toggle("model-object-mode", this.objectMode);
    (document.querySelector("#model-join") as HTMLButtonElement).disabled =
      !this.objectMode || this.ids.size < 2;
    (document.querySelector("#model-separate") as HTMLButtonElement).disabled =
      this.objectMode;
    for (const id of [
      "model-object-copy",
      "model-object-delete",
      "model-object-rotate",
    ])
      (document.querySelector("#" + id) as HTMLButtonElement).disabled =
        !this.objectMode || !this.ids.size;
    (
      document.querySelector("#model-object-paste") as HTMLButtonElement
    ).disabled = !this.objectMode || this.clipboard?.asset !== this.asset;
    const panel = document.querySelector("#model-object-tree");
    if (panel) this.renderTree(panel as HTMLElement);
  }
  mount(panel: HTMLElement) {
    const tree = document.createElement("div");
    tree.id = "model-object-tree";
    panel.append(tree);
    this.update();
  }
  private renderTree(tree: HTMLElement) {
    const m = this.multi!;
    tree.replaceChildren();
    const buttons = document.createElement("div");
    buttons.className = "canvas-controls";
    const add = (label: string, fn: () => void) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = fn;
      buttons.append(b);
      return b;
    };
    const create = add(
      "新建集合",
      () =>
        void this.nameDialog("集合名称", "集合").then((name) => {
          if (name)
            void this.mutate((m) => {
              m.createObjectCollection([...this.ids], name);
            });
        }),
    );
    create.id = "model-collection-create";
    create.disabled = this.ids.size < 2;
    const selectedCollections = (m.model.objectCollections ?? []).filter((c) =>
      c.memberIds.some((id) => this.ids.has(id)),
    );
    const rename = add("改名", () => {
      const c = selectedCollections[0];
      void this.nameDialog("集合名称", c.name).then((name) => {
        if (name)
          void this.mutate((m) =>
            m.renameObjectCollection(c.collectionId, name),
          );
      });
    });
    rename.disabled = selectedCollections.length !== 1;
    const dissolve = add(
      "解散",
      () =>
        void this.mutate((m) =>
          selectedCollections.forEach((c) =>
            m.dissolveObjectCollection(c.collectionId),
          ),
        ),
    );
    dissolve.id = "model-collection-dissolve";
    dissolve.disabled = !selectedCollections.length;
    tree.append(buttons);
    const hosts = new Map<string, HTMLElement>();
    for (const c of m.model.objectCollections ?? []) {
      const d = document.createElement("details");
      d.dataset.modelCollection = c.collectionId;
      d.open = !this.collapsed.has(c.collectionId);
      const summary = document.createElement("summary");
      summary.textContent = c.name;
      d.append(summary);
      d.ontoggle = () => {
        if (!d.isConnected) return;
        d.open
          ? this.collapsed.delete(c.collectionId)
          : this.collapsed.add(c.collectionId);
      };
      tree.append(d);
      for (const id of c.memberIds) hosts.set(id, d);
    }
    for (const o of m.model.objects!) {
      const b = document.createElement("button");
      b.className = "model-object-row";
      b.dataset.modelObject = o.objectId;
      b.textContent = o.name;
      b.title = o.canvasIds.length + " 张画布";
      b.classList.toggle("active", this.ids.has(o.objectId));
      b.onclick = (e) =>
        void this.pick(
          o.canvasIds,
          e.ctrlKey ? "subtract" : e.shiftKey ? "add" : "replace",
        );
      b.ondblclick = () => void this.switchMode(false);
      (hosts.get(o.objectId) ?? tree).append(b);
    }
  }
  private nameDialog(title: string, initial: string): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "assembly-name-dialog";
      const form = document.createElement("form");
      form.method = "dialog";
      const label = document.createElement("label");
      label.textContent = title;
      const input = document.createElement("input");
      input.value = initial;
      input.required = true;
      input.setAttribute("aria-label", title);
      label.append(input);
      const ok = document.createElement("button");
      ok.textContent = "确定";
      const cancel = document.createElement("button");
      cancel.textContent = "取消";
      cancel.type = "button";
      cancel.onclick = () => dialog.close();
      form.append(label, ok, cancel);
      dialog.append(form);
      let value: string | null = null;
      form.onsubmit = () => {
        value = input.value.trim() || null;
      };
      dialog.onclose = () => {
        dialog.remove();
        resolve(value);
      };
      document.body.append(dialog);
      dialog.showModal();
      input.select();
    });
  }
}
