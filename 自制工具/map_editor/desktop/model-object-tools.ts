import { moduleEditor } from "./renderer.ts";
import type { AssetSession } from "./workshop-session.ts";
import type { ModelObjectClipboard } from "../core/workshop-canvases.ts";
import { captureTemporaryObjectBrush, type TemporaryObjectBrush } from "../core/temporary-object-brush.ts";

/** Object commands own model history; edit mode delegates to the voxel editor. */
export class ModelObjectTools {
  objectMode = false;
  private asset = "";
  private ids = new Set<string>();
  private clipboard: { asset: string; data: ModelObjectClipboard } | null =
    null;
  private collapsed = new Set<string>();
  private treeLimit = 160;
  private mode = document.createElement("select");
  private commands = document.createElement("details");
  private separateSelection = document.createElement("button");
  private separating = false;
  private temporaryBrush: TemporaryObjectBrush | null = null;
  private brushStatus = document.createElement("div");
  private brushLabel = document.createElement("span");
  private brushReset = document.createElement("button");
  private contextMenu = document.createElement("div");
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
    this.separateSelection.id = "model-separate-selection";
    this.separateSelection.type = "button";
    this.separateSelection.onclick = () => void this.separate();
    bar.append(this.mode, this.commands, this.separateSelection);
    document.querySelector("#editview")!.parentElement!.append(bar);
    new MutationObserver(() => this.syncSeparateAction()).observe(document.querySelector("#editview")!, {
      attributes: true,
      attributeFilter: ["data-selection-count", "data-selection-busy"],
    });
    this.syncSeparateAction();
    this.brushStatus.id = "temporary-object-brush-status";
    this.brushLabel.setAttribute("role", "status");
    this.brushLabel.setAttribute("aria-live", "polite");
    this.brushReset.id = "temporary-object-brush-reset";
    this.brushReset.textContent = "恢复体素格";
    this.brushReset.title = "清除临时物体画笔，恢复体素格画笔";
    this.brushReset.onclick = () => this.restoreVoxelBrush();
    this.brushStatus.append(this.brushLabel, this.brushReset);
    (document.querySelector("#app > header nav") ?? bar).append(this.brushStatus);
    this.syncBrushStatus();
    this.contextMenu.id = "model-object-context-menu";
    this.contextMenu.className = "model-object-context-menu";
    this.contextMenu.setAttribute("role", "menu");
    this.contextMenu.hidden = true;
    document.body.append(this.contextMenu);
    document.addEventListener("pointerdown", e => {
      if (!this.contextMenu.contains(e.target as Node)) this.closeContextMenu();
    }, true);
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !this.contextMenu.hidden) {
        e.preventDefault(); e.stopImmediatePropagation(); this.closeContextMenu();
      }
    }, true);
    window.addEventListener("resize", () => this.closeContextMenu());
    document.addEventListener("temporary-object-brush-cleared", () => {
      this.temporaryBrush = null;
      this.syncBrushStatus();
    });
    moduleEditor.setObjectContextHandler((id, x, y) => void this.openObjectMenu(id, x, y));
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
    if (!object && this.temporaryBrush) this.restoreVoxelBrush(false);
    this.objectMode = object;
    if (!object) {
      const m = this.multi,
        active = m?.objectForCanvas()?.objectId;
      const id = active && this.ids.has(active) ? active : [...this.ids].at(-1);
      if (id) { m?.selectObject(id); m?.setEditObject(id); }
    }
    else this.multi?.setEditObject(null);
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
  private syncSeparateAction() {
    const host = document.querySelector<HTMLElement>("#editview");
    const m = this.multi;
    const count = Math.max(0, Number(host?.dataset.selectionCount) || 0);
    const disabled = this.objectMode || !m?.editObjectId || m.writeLeased ||
      !count || host?.dataset.selectionBusy === "true" || this.separating;
    this.separateSelection.hidden = this.objectMode || !m;
    this.separateSelection.disabled = !!disabled;
    this.separateSelection.textContent = "将选区分离为新物体（" + count + " 格）";
    this.separateSelection.title = "分离后继续编辑原物体；新物体可从左侧层级选择";
    this.separateSelection.setAttribute("aria-busy", String(this.separating));
    const menuAction = document.querySelector<HTMLButtonElement>("#model-separate");
    if (menuAction) menuAction.disabled = !!disabled;
  }
  private async separate() {
    this.syncSeparateAction();
    const m = this.multi, sourceId = m?.editObjectId;
    if (!m || !sourceId || this.separateSelection.disabled) return;
    const cells = moduleEditor.selectionCells();
    if (!cells.length) return;
    this.separating = true;
    this.syncSeparateAction();
    try {
      moduleEditor.cancel();
      const separatedId = m.separateCells(cells);
      if (!separatedId) return;
      m.setObjectSelection([sourceId], sourceId);
      if (m.editObjectId !== sourceId) m.setEditObject(sourceId);
      moduleEditor.clearSelection();
      this.ctx.changed();
      await this.ctx.refresh();
      const count = m.model.objects?.find(o => o.objectId === separatedId)?.cellKeys?.length ?? cells.length;
      this.ctx.message("已将 " + count + " 格分离为新物体，继续编辑原物体；可从左侧层级选择新物体");
    } catch (error: any) {
      this.ctx.message(error.message, true);
    } finally {
      this.separating = false;
      this.syncSeparateAction();
    }
  }
  private async pick(
    objectIds: string[],
    modifier: "replace" | "add" | "subtract",
  ) {
    const m = this.multi;
    if (!m) return;
    if (this.objectMode && moduleEditor.drawingActive && !this.temporaryBrush) moduleEditor.selectMode();
    const objects = m.model.objects!;
    const direct = objects
      .filter((o) => objectIds.includes(o.objectId))
      .map((o) => o.objectId);
    // Collections organize rows. Only an explicit collection-header action
    // selects all members; a member click remains a single-object selection.
    const picked = direct,
      before = m.activeId;
    if (modifier === "replace") this.ids.clear();
    for (const id of picked)
      modifier === "subtract" ? this.ids.delete(id) : this.ids.add(id);
    m.setObjectSelection(
      [...this.ids],
      modifier !== "subtract" ? direct.at(-1) : undefined,
    );
    if(!this.objectMode){const id=direct.at(-1);if(id)m.setEditObject(id);await this.ctx.refresh();}
    else if (before === m.activeId) this.update();
    else await this.ctx.refresh();
  }
  useObjectMode() { this.objectMode = true; this.multi?.setEditObject(null); }
  private reconcileScope() {
    const m=this.multi;if(!m||m.writeLeased)return;
    // History restores document scope; the visible interaction mode remains authoritative.
    if(this.objectMode){if(m.editObjectId)m.setEditObject(null);}
    else if(!m.editObjectId){
      const owner=m.model.objects!.find(o=>o.objectId===m.activeObjectId);
      if(owner)m.setEditObject(owner.objectId);
      else this.objectMode=true;
    }
  }
  prepare() {
    const m=this.multi;
    if(m&&this.asset!==m.model.assetId){this.restoreVoxelBrush(false);this.closeContextMenu();this.asset=m.model.assetId;this.objectMode=true;m.setEditObject(null);this.treeLimit=160;}
    this.reconcileScope();
  }
  canvasShown(id: string) {
    const m = this.multi;
    return !this.objectMode && !!m?.objectForCanvas()?.canvasIds.includes(id);
  }
  update() {
    const m = this.multi;
    if (!m) { this.syncSeparateAction(); return; }
    if (this.asset !== m.model.assetId) {
      this.restoreVoxelBrush(false);
      this.closeContextMenu();
      this.asset = m.model.assetId;
      this.objectMode = true;
    }
    this.reconcileScope();
    this.ids = new Set(m.selectedObjectIds);
    this.mode.value = this.objectMode ? "object" : "edit";
    const selectedObjectIds = m.model
      .objects!.filter((o) => this.ids.has(o.objectId))
      .map((o) => o.objectId);
    const pivot =
      m.model.objects!.find(o=>o.objectId===m.activeObjectId&&this.ids.has(o.objectId)) ?? m.model.objects!.find(
        (o) => this.ids.has(o.objectId) && o.canvasIds.includes(m.activeId),
      ) ?? m.model.objects!.find((o) => this.ids.has(o.objectId));
    moduleEditor.setObjectMode(this.objectMode, {
      selectedObjectIds,
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
    this.syncSeparateAction();
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
    this.syncBrushStatus();
  }
  private syncBrushStatus() {
    this.brushLabel.textContent = this.temporaryBrush
      ? "临时画笔：" + this.temporaryBrush.name
      : "当前画笔：体素格";
    this.brushLabel.title = this.brushLabel.textContent;
    this.brushStatus.dataset.sourceObject = this.temporaryBrush?.sourceObjectId ?? "";
    this.brushStatus.classList.toggle("using-object", !!this.temporaryBrush);
    this.brushReset.disabled = !this.temporaryBrush;
  }
  private restoreVoxelBrush(announce = true) {
    this.temporaryBrush = null;
    moduleEditor.setTemporaryObjectBrush(null);
    this.syncBrushStatus();
    if (announce) this.ctx.message("已恢复体素格画笔");
  }
  private async setObjectBrush(id: string) {
    const m = this.multi;
    if (!m) return;
    try {
      moduleEditor.cancel();
      this.objectMode = true;
      m.setEditObject(null);
      m.setObjectSelection([id], id);
      const brush = captureTemporaryObjectBrush(m.model, id);
      this.temporaryBrush = brush;
      moduleEditor.setTemporaryObjectBrush(brush, async targetTicks => {
        if (this.multi !== m || this.temporaryBrush !== brush) return;
        try {
          m.stampObjectBrush(brush, targetTicks);
          this.ctx.changed();
          await this.ctx.refresh();
        } catch (error: any) {
          this.ctx.message(error.message, true);
        }
      });
      this.update();
      this.ctx.message("临时画笔已设为“" + brush.name + "” · 左键放置，顶部可恢复体素格");
    } catch (error: any) {
      this.ctx.message(error.message, true);
    }
  }
  private closeContextMenu() {
    this.contextMenu.hidden = true;
  }
  private showContextMenu(
    x: number, y: number,
    actions: { label: string; run: () => void | Promise<void>; disabled?: boolean }[],
  ) {
    this.contextMenu.replaceChildren();
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.textContent = action.label;
      button.disabled = !!action.disabled;
      button.onclick = () => { this.closeContextMenu(); void action.run(); };
      this.contextMenu.append(button);
    }
    this.contextMenu.hidden = false;
    const bounds = this.contextMenu.getBoundingClientRect();
    this.contextMenu.style.left = Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)) + "px";
    this.contextMenu.style.top = Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)) + "px";
    this.contextMenu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }
  private async openObjectMenu(id: string, x: number, y: number) {
    if (!this.multi?.model.objects?.some(o => o.objectId === id)) return;
    await this.pick([id], "replace");
    this.showContextMenu(x, y, [
      { label: "设为临时画笔", run: () => this.setObjectBrush(id) },
      { label: "复制物体", run: () => this.command("copy") },
      { label: "恢复体素格画笔", run: () => this.restoreVoxelBrush(), disabled: !this.temporaryBrush },
    ]);
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
    tree.append(buttons);
    const hosts = new Map<string, HTMLElement>();
    for (const c of m.model.objectCollections ?? []) {
      const d = document.createElement("details");
      d.dataset.modelCollection = c.collectionId;
      d.open = !this.collapsed.has(c.collectionId);
      const summary = document.createElement("summary");
      const select = document.createElement("button");
      select.type = "button";
      select.className = "model-collection-label";
      select.dataset.modelCollectionSelect = c.collectionId;
      select.title = "选择整个集合 · 点击左侧箭头只折叠/展开";
      select.setAttribute("aria-label", "选择集合“" + c.name + "”中的全部物体");
      const folder = document.createElement("span");
      folder.className = "model-tree-folder";
      folder.setAttribute("aria-hidden", "true");
      folder.innerHTML = '<svg viewBox="0 0 16 14"><path d="M1 3V1h5l2 2h7v10H1Z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
      const label = document.createElement("span"); label.textContent = c.name;
      select.append(folder, label);
      select.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        void this.pick(c.memberIds, e.ctrlKey ? "subtract" : e.shiftKey ? "add" : "replace");
      };
      select.classList.toggle("active", c.memberIds.every(id => this.ids.has(id)));
      summary.append(select);
      summary.oncontextmenu = e => {
        e.preventDefault(); e.stopPropagation();
        this.showContextMenu(e.clientX, e.clientY, [
          { label: "集合改名", run: async () => {
            const name = await this.nameDialog("集合名称", c.name);
            if (name) await this.mutate(m => m.renameObjectCollection(c.collectionId, name));
          } },
          { label: "解散集合", run: () => this.mutate(m => m.dissolveObjectCollection(c.collectionId)) },
        ]);
      };
      d.append(summary);
      const children = document.createElement("div");
      children.className = "model-collection-children";
      d.append(children);
      d.ontoggle = () => {
        if (!d.isConnected) return;
        d.open
          ? this.collapsed.delete(c.collectionId)
          : this.collapsed.add(c.collectionId);
      };
      tree.append(d);
      for (const id of c.memberIds) hosts.set(id, children);
    }
    const ordered=m.model.objects!;
    for (const o of ordered.slice(0,this.treeLimit)) {
      const b = document.createElement("button");
      b.className = "model-object-row";
      b.dataset.modelObject = o.objectId;
      const icon = document.createElement("span");
      icon.className = "model-tree-object-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = '<svg viewBox="0 0 14 16"><path d="m7 1 6 3.5v7L7 15l-6-3.5v-7L7 1Zm-6 3.5L7 8l6-3.5M7 8v7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
      const name = document.createElement("span");
      name.className = "model-object-name";
      name.textContent = o.name;
      b.append(icon, name);
      b.title = (o.cellKeys?.length??0) + " 个体素";
      b.classList.toggle("active", this.ids.has(o.objectId));
      b.onclick = (e) =>
        void this.pick(
          [o.objectId],
          e.ctrlKey ? "subtract" : e.shiftKey ? "add" : "replace",
        );
      b.ondblclick = () => void this.switchMode(false);
      b.oncontextmenu = e => {
        e.preventDefault(); e.stopPropagation();
        void this.openObjectMenu(o.objectId, e.clientX, e.clientY);
      };
      (hosts.get(o.objectId) ?? tree).append(b);
    }
    if(ordered.length>this.treeLimit){const more=document.createElement('button');more.textContent=`显示更多（共 ${ordered.length} 个物体）`;more.onclick=()=>{this.treeLimit+=160;this.renderTree(tree);};tree.append(more);}
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
