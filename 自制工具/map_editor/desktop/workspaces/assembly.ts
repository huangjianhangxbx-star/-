import { AssemblyView } from "../assembly-view.ts";
import type { SceneSession } from "../../core/scene-session.ts";
import {
  createScene,
  type AssetDocument,
  type SceneDocument,
  type Vec3,
} from "../../core/workshop-documents.ts";
type Context = {
  scene: () => SceneDocument | null;
  session: () => SceneSession;
  assets: () => Map<string, AssetDocument>;
  binaries: () => Map<string, { row: any; data: string }>;
  key: () => string;
  library: () => any[];
  changed: () => void;
  save: () => Promise<void>;
  history: (redo: boolean) => void;
  edit: (id: string) => Promise<void>;
  import: () => Promise<void>;
  drop: (id: string, position: Vec3) => Promise<void>;
  message: (text: string, error?: boolean) => void;
  run: (fn: () => void | Promise<void>) => Promise<void>;
};
const el = (tag: string, text?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
export class AssemblyWorkspace {
  readonly view: AssemblyView;
  private ids = new Set<string>();
  private fieldsKey = "";
  private contextKey = "";
  private ctx: Context;
  private host: HTMLElement;
  private $ = (id: string) => this.host.querySelector<HTMLElement>("#" + id)!;
  constructor(host: HTMLElement, ctx: Context) {
    this.host = host;
    this.ctx = ctx;
    host.replaceChildren();
    host.classList.add("assembly-layout");
    const tools = el("aside"),
      viewport = el("div");
    viewport.id = "assembly-viewport";
    tools.append(
      el("h1", "场景装配"),
      el("p", "Ctrl 点击多选 · Shift 拖动框选 · 体素按 0.25 米相位对齐。"),
    );
    const actions = el("div");
    actions.className = "actions";
    const action = (
      id: string,
      label: string,
      fn: () => void | Promise<void>,
      parent: HTMLElement = actions,
    ) => {
      const b = el("button", label) as HTMLButtonElement;
      b.id = id;
      b.onclick = () =>
        void ctx.run(async () => {
          await fn();
          this.render();
        });
      parent.append(b);
      return b;
    };
    const mutate = (fn: () => void) => {
      fn();
      ctx.changed();
    };
    action("assembly-copy", "复制实例", () =>
      mutate(() => {
        const ids = [...this.ids],
          copies = ids.map(() => crypto.randomUUID());
        ctx.session().duplicateMany(ids, copies);
        this.ids = new Set(copies);
      }),
    );
    action("assembly-delete", "删除实例", () =>
      mutate(() => {
        ctx.session().removeMany([...this.ids]);
        this.ids.clear();
      }),
    );
    action("assembly-rotate", "旋转 90°", () =>
      mutate(() => ctx.session().rotateMany([...this.ids])),
    );
    action("assembly-undo", "撤销", () => {
      ctx.history(false);
      ctx.changed();
    });
    action("assembly-redo", "重做", () => {
      ctx.history(true);
      ctx.changed();
    });
    action("assembly-save", "保存草稿", ctx.save);
    action("assembly-fit", "查看全部实例", () => this.view.fit());
    let drag = false;
    const dragButton = action("assembly-drag", "轴拖拽", () => {
      drag = !drag;
      dragButton.classList.toggle("active", drag);
      this.view.setDrag(drag);
    });
    tools.append(actions);
    action("assembly-import", "导入 GLB / PNG", ctx.import, tools);
    for (const id of ["assembly-selection", "assembly-groups"]) {
      const node = el("div");
      node.id = id;
      tools.append(node);
    }
    const assets = el("select") as HTMLSelectElement;
    assets.id = "assembly-assets";
    assets.setAttribute("aria-label", "放入模块");
    tools.append(assets);
    action(
      "assembly-add",
      "放入模块",
      () =>
        mutate(() => {
          const row = ctx
            .scene()
            ?.assets.find((a) => a.assetId === assets.value);
          if (!row) throw Error("先选择私有资产");
          const id = crypto.randomUUID();
          if (row.kind === "texture")
            ctx
              .session()
              .addDecal({
                decalId: id,
                assetId: row.assetId,
                positionM: [0, 0, 0],
                rotationDeg: 0,
                widthM: 1,
                heightM: 1,
              });
          else {
            const root =
              row.kind === "voxel"
                ? ctx.assets().get(row.assetId)?.anchorM
                : row.anchorM;
            if (!root) throw Error("缺少模块源");
            ctx
              .session()
              .add({
                instanceId: id,
                assetId: row.assetId,
                positionM: structuredClone(root),
                rotationDeg: 0,
                groupId: row.kind === "voxel" ? "base" : "large-env",
              });
          }
          this.ids = new Set([id]);
        }),
      tools,
    );
    const tree = el("div");
    tree.id = "assembly-tree";
    tools.append(tree);
    const input = (id: string, label: string) => {
      const wrap = el("label", label),
        field = el("input") as HTMLInputElement;
      field.id = id;
      wrap.append(field);
      tools.append(wrap);
      return field;
    };
    const position = input(
      "assembly-position",
      "位置 X / Y / Z（米；多选以第一项为准）",
    );
    action(
      "assembly-apply",
      "应用位置",
      () =>
        mutate(() => {
          const p = this.selected()[0];
          if (!p) throw Error("先选择元素");
          const values = position.value.split(",");
          if (values.length !== 3 || values.some((n) => !n.trim()))
            throw Error("请输入三个米坐标");
          const target = values.map(Number);
          ctx
            .session()
            .translateMany(
              [...this.ids],
              target.map((v, i) => v - p.positionM[i]) as Vec3,
            );
        }),
      tools,
    );
    const size = input("assembly-size", "贴花宽 / 高（米）");
    action(
      "assembly-size-apply",
      "应用贴花尺寸",
      () =>
        mutate(() => {
          const v = size.value.split(",").map(Number);
          if (v.length !== 2 || this.ids.size !== 1)
            throw Error("请选择一个贴花并输入两个尺寸");
          ctx.session().resizeDecal([...this.ids][0], v[0], v[1]);
        }),
      tools,
    );
    const groupLabel = el("label", "模型分组"),
      group = el("select") as HTMLSelectElement;
    group.id = "assembly-group";
    groupLabel.append(group);
    tools.append(groupLabel);
    action(
      "assembly-group-apply",
      "应用分组",
      () => mutate(() => ctx.session().setGroup([...this.ids], group.value)),
      tools,
    );
    action(
      "assembly-edit",
      "编辑模块",
      async () => {
        const p = this.selected()[0];
        if (!p) throw Error("先选择实例");
        await ctx.edit(p.assetId);
      },
      tools,
    );
    const issues = el("p");
    issues.id = "assembly-issues";
    tools.append(issues, el("h2", "公共库 · 拖入独立副本"));
    const library = el("div");
    library.id = "assembly-library";
    tools.append(library);
    host.append(tools, viewport);
    this.view = new AssemblyView(viewport);
    this.view.onSelect = (id, additive) =>
      this.select(id ? [id] : [], additive);
    this.view.onSelectMany = (ids, additive) => this.select(ids, additive);
    this.view.onAssetLoaded = () => {
      if (!host.hidden) this.render();
    };
    this.view.onError = (error) => ctx.message(error, true);
    this.view.onTransform = (id, position, revision) =>
      void ctx.run(() => {
        const scene = ctx.scene(),
          p =
            scene?.instances.find((p) => p.instanceId === id) ??
            scene?.decals.find((p) => p.decalId === id);
        try {
          if (!scene || !p || scene.revision !== revision)
            throw Error("拖拽期间场景发生修改，请重试");
          ctx
            .session()
            .translateMany(
              [...this.ids],
              position.map((v, i) => v - p.positionM[i]) as Vec3,
            );
          ctx.changed();
        } finally {
          this.render();
        }
      });
    viewport.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("application/x-xinghai-library")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    });
    viewport.addEventListener("drop", (e) => {
      const id = e.dataTransfer?.getData("application/x-xinghai-library");
      if (!id) return;
      e.preventDefault();
      const point = this.view.dropPosition(e.clientX, e.clientY);
      void ctx.run(() => ctx.drop(id, point));
    });
  }
  private selected() {
    const s = this.ctx.scene();
    return s
      ? [...s.instances, ...s.decals].filter((p) =>
          this.ids.has("instanceId" in p ? p.instanceId : p.decalId),
        )
      : [];
  }
  select(ids: string[], additive = false) {
    if (!additive) this.ids.clear();
    for (const id of ids) {
      if (additive && ids.length === 1 && this.ids.has(id)) this.ids.delete(id);
      else this.ids.add(id);
    }
    this.render();
  }
  clearSelection() {
    this.ids.clear();
    this.contextKey = "";
  }
  cancel() {
    this.view.cancelDrag();
  }
  render() {
    const scene = this.ctx.scene();
    if (!scene) {
      this.ids.clear();
      for (const id of [
        "assembly-tree",
        "assembly-assets",
        "assembly-groups",
        "assembly-library",
      ])
        this.$(id).replaceChildren();
      this.$("assembly-selection").textContent = "当前项目没有场景。";
      this.host
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((b) => (b.disabled = true));
      this.view.update(createScene("empty"), new Map(), [], new Map());
      return;
    }
    const ctx = this.ctx,
      key = ctx.key();
    if (this.contextKey && this.contextKey !== key) this.ids.clear();
    this.contextKey = key;
    const elements = [...scene.instances, ...scene.decals],
      live = new Set(
        elements.map((p) => ("instanceId" in p ? p.instanceId : p.decalId)),
      );
    for (const id of this.ids) if (!live.has(id)) this.ids.delete(id);
    this.host
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = false));
    const assets = ctx.assets(),
      binaries = ctx.binaries(),
      selected = this.selected(),
      primary = selected[0];
    this.$("assembly-selection").textContent = `已选 ${this.ids.size} 个元素`;
    const groups = this.$("assembly-groups");
    groups.replaceChildren();
    for (const g of scene.groups) {
      const label = el("label", g.name),
        check = el("input") as HTMLInputElement;
      check.type = "checkbox";
      check.checked = g.visible;
      check.dataset.group = g.groupId;
      check.onchange = () =>
        void ctx.run(() => {
          ctx.session().setGroupVisible(g.groupId, check.checked);
          ctx.changed();
          this.render();
        });
      label.prepend(check);
      groups.append(label);
    }
    const choices = this.$("assembly-assets") as HTMLSelectElement,
      old = choices.value;
    choices.replaceChildren();
    for (const row of scene.assets) {
      const option = el(
        "option",
        row.kind === "voxel"
          ? assets.get(row.assetId)?.name || "未命名"
          : `${row.kind === "texture" ? "PNG贴花" : "GLB模型"} · ${row.assetId.slice(0, 8)}`,
      ) as HTMLOptionElement;
      option.value = row.assetId;
      choices.append(option);
    }
    if (scene.assets.some((a) => a.assetId === old)) choices.value = old;
    const tree = this.$("assembly-tree");
    tree.replaceChildren();
    for (const p of elements) {
      const id = "instanceId" in p ? p.instanceId : p.decalId,
        b = el(
          "button",
          `${assets.get(p.assetId)?.name || ("decalId" in p ? "PNG贴花" : "GLB模型")} · ${id.slice(0, 8)}`,
        );
      b.dataset.instance = id;
      b.classList.toggle("active", this.ids.has(id));
      b.onclick = (e) => this.select([id], e.ctrlKey || e.metaKey);
      tree.append(b);
    }
    const fieldKey = JSON.stringify([key, [...this.ids], scene.revision]);
    if (fieldKey !== this.fieldsKey) {
      (this.$("assembly-position") as HTMLInputElement).value =
        primary?.positionM.join(",") ?? "";
      const d =
        selected.length === 1 && primary && "decalId" in primary
          ? primary
          : null;
      (this.$("assembly-size") as HTMLInputElement).value = d
        ? `${d.widthM},${d.heightM}`
        : "";
      this.fieldsKey = fieldKey;
    }
    for (const id of [
      "assembly-copy",
      "assembly-delete",
      "assembly-rotate",
      "assembly-apply",
    ])
      (this.$(id) as HTMLButtonElement).disabled = !selected.length;
    (this.$("assembly-edit") as HTMLButtonElement).disabled =
      selected.length !== 1 || !primary || !assets.has(primary.assetId);
    (this.$("assembly-size-apply") as HTMLButtonElement).disabled =
      selected.length !== 1 || !primary || !("decalId" in primary);
    const group = this.$("assembly-group") as HTMLSelectElement,
      oldGroup = group.value;
    group.replaceChildren();
    for (const g of scene.groups) {
      const option = el("option", g.name) as HTMLOptionElement;
      option.value = g.groupId;
      group.append(option);
    }
    group.value =
      primary && "groupId" in primary
        ? primary.groupId
        : oldGroup || scene.groups[0]?.groupId;
    (this.$("assembly-group-apply") as HTMLButtonElement).disabled =
      !selected.length || selected.some((p) => "decalId" in p);
    const library = this.$("assembly-library");
    library.replaceChildren();
    for (const row of ctx.library()) {
      const item = el("div", `${row.name} · ${row.type}`);
      item.className = "assembly-library-item";
      item.dataset.libraryId = row.id;
      item.draggable = row.status === "ready";
      item.ondragstart = (e) => {
        e.dataTransfer?.setData("application/x-xinghai-library", row.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
      };
      library.append(item);
    }
    this.view.update(scene, assets, [...this.ids], binaries);
    const unavailable = scene.assets.filter(
        (a) => !assets.has(a.assetId) && !binaries.has(a.assetId),
      ),
      status = this.view.assetStatus();
    this.$("assembly-issues").textContent = unavailable.length
      ? `${unavailable.length} 项资产缺失，以粉色线框占位；发布前需解决。`
      : `${elements.length} 个元素 · ${scene.assets.length} 个私有资产`;
    if (status.loading)
      this.$("assembly-issues").textContent +=
        ` · 正在加载 ${status.loading} 项`;
    if (status.errors.length)
      this.$("assembly-issues").textContent +=
        ` · 无法显示，发布前需解决：${status.errors.join("；")}`;
  }
  dispose() {
    this.view.dispose();
  }
}
