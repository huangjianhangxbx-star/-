import { ToolPopovers } from "./tool-popovers.ts";
import { moduleEditor } from "./renderer.ts";
import type { AssetSession } from "./workshop-session.ts";
const $ = (id: string) => document.getElementById(id)!;
export class WorkshopShell {
  readonly menus = new ToolPopovers();
  readonly inspector = document.createElement("aside");
  readonly toolHost = document.createElement("div");
  private hierarchy = document.createElement("aside");
  private scope = document.createElement("div");
  private narrowTree = false;
  private mode: "model" | "color" | "asset" | "rock" = "model";
  private state = {
    preview: false,
    assets: false,
    hierarchy: true,
    inspector: true,
    width: 280,
  };
  constructor(
    private deps: {
      session: () => AssetSession | null;
      paintButton: HTMLButtonElement;
    },
  ) {
    document.body.classList.add("tool014");
    moduleEditor.externalPaintOnly();
    for (const id of ["sidebar-splitter", "view-splitter", "library-splitter"])
      document.getElementById(id)?.remove();
    document
      .querySelector("#app .layout")!
      .classList.remove("sidebar-collapsed", "library-collapsed");
    try {
      const raw = JSON.parse(
        localStorage.getItem("workshop-layout-u14") ?? "null",
      );
      if (raw && typeof raw === "object") {
        for (const k of [
          "preview",
          "assets",
          "hierarchy",
          "inspector",
        ] as const)
          if (typeof raw[k] === "boolean") this.state[k] = raw[k];
        if (Number.isFinite(raw.width))
          this.state.width = Math.max(240, Math.min(380, raw.width));
      }
    } catch {}
    document.querySelector("[data-workspace=module]")!.textContent = "模型制作";
    document.querySelector("[data-workspace=assembly]")!.textContent =
      "场景试摆";
    const layout = document.querySelector<HTMLElement>("#app .layout")!,
      parameters = layout.querySelector<HTMLElement>(":scope>aside")!;
    parameters.id = "model-tool-parameters";
    this.inspector.id = "tool-inspector";
    this.hierarchy.id = "model-hierarchy";
    this.toolHost.id = "inspector-preview-tool";
    this.scope.id = "inspector-scope";
    this.scope.setAttribute("aria-live", "polite");
    const title = document.createElement("h2");
    title.textContent = "当前工具与属性";
    this.inspector.append(title, this.scope, this.toolHost, parameters);
    layout.append(this.hierarchy, this.inspector);
    const adjust = document.createElement("input");
    adjust.id = "inspector-width";
    adjust.type = "range";
    adjust.min = "240";
    adjust.max = "380";
    adjust.value = String(this.state.width);
    adjust.setAttribute("aria-label", "属性栏宽度");
    adjust.oninput = () => {
      this.state.width = Number(adjust.value);
      this.applyLayout();
    };
    const width = document.createElement("details");
    width.innerHTML = "<summary>布局设置</summary>";
    width.dataset.shellLayout = "settings";
    width.append(adjust);
    const reset = this.button("复位布局", () => {
      this.state = {
        preview: false,
        assets: false,
        hierarchy: true,
        inspector: true,
        width: 280,
      };
      this.applyLayout();
    });
    width.append(reset);
    this.inspector.append(width);
    const tasks = document.createElement("span");
    tasks.className = "asset-tasks";
    tasks.append(
      this.button("建模", () => void this.task("model")),
      this.button("自动上色", () => void this.task("color")),
      deps.paintButton,
    );
    const saved = document.createElement("small");
    saved.id = "document-save-state";
    $("module-tabs").after(saved, tasks);
    const more = document.createElement("details");
    more.id = "asset-document-more";
    more.innerHTML = "<summary>资产更多</summary>";
    document.querySelector(".module-context")!.append(more);
    for (const id of [
      "module-name",
      "duplicate",
      "asset-folder",
      "save-asset-as",
      "close-module",
    ]) {
      const n = $(id);
      more.append(id === "module-name" ? n.closest("label")! : n);
    }
    const asset = this.button("资产定位", () => void this.task("asset"));
    more.append(asset);
    const rootGroup = document.createElement("div");
    rootGroup.id = "inspector-asset";
    rootGroup.append($("module-root-menu"));
    this.inspector.append(rootGroup);
    rootGroup.hidden = true;
    const nav = $("undo").parentElement!,
      views = this.button("双视口", () => this.toggle("preview")),
      assets = $("toggle-library");
    views.id = "shell-preview-toggle";
    views.dataset.shellLayout = "preview";
    assets.textContent = "资产抽屉";
    assets.dataset.shellLayout = "assets";
    assets.onclick = () => this.toggle("assets");
    const hierarchy = $("toggle-sidebar"),
      inspector = this.button("属性", () => this.toggle("inspector"));
    hierarchy.textContent = "层级";
    hierarchy.onclick = () => this.toggle("hierarchy");
    hierarchy.dataset.shellLayout = "hierarchy";
    inspector.dataset.shellLayout = "inspector";
    nav.append(views, assets, hierarchy, inspector);
    more.append($("shortcut-map-open"));
    const commandMore = document.createElement("details");
    commandMore.id = "model-commands-more";
    commandMore.innerHTML = "<summary>建模命令</summary>";
    const commandBody = document.createElement("div");
    commandBody.className = "model-command-body";
    commandBody.setAttribute("popover", "manual");
    commandMore.append(commandBody);
    this.menus.register(
      commandMore,
      commandBody,
      commandMore.querySelector("summary")!,
      "below",
    );
    for (const id of ["model-object-actions"]) {
      const n = document.getElementById(id);
      if (n) commandBody.append(n);
    }
    nav.append(commandMore);
    moduleEditor.dockTools(this.toolHost);
    $("appearance-open").parentElement!.remove();
    const rock = this.button("岩体塑形", () => void this.rockTask());
    rock.id = "shell-rock";
    commandBody.append(rock);
    const legacy = document.createElement("details");
    legacy.innerHTML = "<summary>旧随机工具</summary>";
    for (const [id, label] of [
      ["random-tone", "逐格色阶随机"],
      ["random-edge", "边缘随机"],
    ] as const) {
      const b = $(id);
      b.textContent = label;
      legacy.append(b);
    }
    commandBody.append(legacy);
    const helpers = document.createElement("details");
    helpers.innerHTML = "<summary>辅助与参考</summary>";
    const reference = document
      .getElementById("reference-import")
      ?.closest("details");
    if (reference) helpers.append(reference);
    const align = document.getElementById("canvas-align");
    if (align) nav.append(align);
    commandBody.append(helpers);
    const treeTabs = document.createElement("nav");
    treeTabs.id = "hierarchy-tabs";
    treeTabs.append(
      this.button("物体与集合", () => {
        this.hierarchy.dataset.tab = "objects";
      }),
      this.button("画布", () => {
        this.hierarchy.dataset.tab = "canvases";
      }),
    );
    this.hierarchy.append(treeTabs);
    this.hierarchy.dataset.tab = "objects";
    for (const id of [
      "viewport-mode-menu",
      "viewport-brush-menu",
      "viewport-precision",
    ]) {
      const details = $(id) as HTMLDetailsElement,
        body = document.createElement("div");
      body.className = "viewport-tool-popover";
      for (const node of [...details.children])
        if (node.tagName !== "SUMMARY") body.append(node);
      details.append(body);
      this.menus.register(details, body, details.querySelector("summary")!);
    }
    this.groupParameters(parameters);
    this.applyLayout();
    this.collect();
    this.previewGuard();
    window.addEventListener("resize", () => this.applyLayout());
    const observer = new MutationObserver(() => this.collect());
    observer.observe(layout, { childList: true, subtree: true });
    setInterval(() => this.summary(), 300);
    document.addEventListener("click", (e) => {
      if (
        e.target instanceof Element &&
        e.target.closest(
          "#app [data-tool],#app [data-mode],#model-object-actions",
        )
      )
        void this.task("model");
    });
  }
  private groupParameters(parameters: HTMLElement) {
    const geometry = document.createElement("section");
    geometry.id = "current-geometry-properties";
    parameters.prepend(geometry);
    const moved = new Set<Element>();
    for (const id of [
      "brush-size",
      "brush-direction",
      "brush-meters",
      "thickness",
      "layer",
      "side",
    ]) {
      const node = $(id),
        root = node.closest(".pair") ?? node.closest("label") ?? node;
      if (!moved.has(root)) {
        geometry.append(root);
        moved.add(root);
      }
    }
    const plane = $("work-plane").closest("details")!;
    plane.querySelector("summary")!.textContent = "绘制平面";
    geometry.prepend(plane);
    const colors = document.createElement("details");
    colors.id = "current-color-properties";
    colors.open = true;
    colors.innerHTML = "<summary>颜色与色板</summary>";
    for (const selector of [
      ".palette-library",
      "#palette",
      "#palette-toggle",
      "#color-panel",
    ]) {
      const node = parameters.querySelector(selector);
      if (node) colors.append(node);
    }
    geometry.after(colors);
  }
  private previewGuard() {
    let replay = false;
    const gate = (event: Event) => {
      if (
        replay ||
        !moduleEditor.hasDraft ||
        !(event.target instanceof Element) ||
        event.target.closest(
          ".docked-tool,.canvas-list-panel,#mode-current,.viewport-display-menu,#shortcut-map-open,.shortcut-dialog,[data-shell-layout],.draft-decision,.ortho-nav,#home,#previewhome,#top,#flat",
        )
      )
        return;
      const action = event.target.closest<HTMLElement>(
        "button,select,input,summary",
      );
      if (!action || action.tagName === "SUMMARY") return;
      if (action.id === "save-draft") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void moduleEditor.resolveDraft("继续该操作").then((allowed) => {
        if (!allowed) return;
        replay = true;
        try {
          if (event.type === "change")
            action.dispatchEvent(new Event("change", { bubbles: true }));
          else action.click();
        } finally {
          replay = false;
        }
      });
    };
    window.addEventListener("click", gate, true);
    window.addEventListener("change", gate, true);
    window.addEventListener(
      "keydown",
      (event) => {
        if (!moduleEditor.hasDraft || document.querySelector("dialog[open]"))
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          moduleEditor.cancelDraft();
        } else if (
          (event.ctrlKey || event.metaKey) &&
          ["z", "y"].includes(event.key.toLowerCase()) &&
          !(
            event.target instanceof Element &&
            event.target.closest("input,textarea")
          )
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          void moduleEditor.history(
            event.key.toLowerCase() === "y" || event.shiftKey ? "redo" : "undo",
          );
        }
      },
      true,
    );
  }
  private button(text: string, fn: () => void) {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = fn;
    return b;
  }
  private collect() {
    const tabs = document.getElementById("hierarchy-tabs");
    if (tabs && this.hierarchy.firstElementChild !== tabs)
      this.hierarchy.prepend(tabs);
    const panel = document.getElementById("model-canvases");
    if (panel && panel.parentElement !== this.hierarchy)
      this.hierarchy.append(panel);
    const toolbar = document.querySelector<HTMLElement>(
      ".viewport-brush-toolbar",
    );
    const layout = document.querySelector("#app .layout")!;
    if (toolbar && toolbar.parentElement !== layout) layout.append(toolbar);
    const root = document.getElementById("module-root-menu");
    if (root && root.parentElement !== $("inspector-asset"))
      $("inspector-asset").append(root);
  }
  private summary() {
    if (
      (this.mode === "color" || this.mode === "rock") &&
      !moduleEditor.hasDraft
    ) {
      this.mode = "model";
      this.inspector.dataset.task = "model";
      $("model-tool-parameters").hidden = false;
      this.toolHost.hidden = true;
    }
    const s = this.deps.session(),
      c = s?.canvases;
    if (!s || !c) return;
    const o = c.model.objects?.find((o) => o.objectId === c.editObjectId),
      text = `${c.model.name} → ${c.active.name} · ${c.active.voxelStepM} m\n${o ? "内部编辑：" + o.name : "物体模式：已选 " + c.selectedObjectIds.length + " 件"} · ${document.querySelector("#editview")?.getAttribute("data-selection-count") ?? 0} 格选区`;
    if (this.scope.textContent !== text) this.scope.textContent = text;
    const geometry = document.getElementById("current-geometry-properties");
    if (geometry) geometry.hidden = moduleEditor.currentTool === "选择";
    const colors = document.getElementById("current-color-properties");
    if (colors) colors.hidden = moduleEditor.currentTool === "擦除";
    const heading = this.inspector.querySelector("h2")!;
    const label =
      this.mode === "color"
        ? "自动上色"
        : this.mode === "asset"
          ? "资产定位"
          : this.mode === "rock"
            ? "岩体塑形"
            : "建模 · " + moduleEditor.currentTool;
    if (heading.textContent !== label) heading.textContent = label;
    const title = $("module-tabs");
    const saveState =
      s.savedRevision === c.model.revision ? "已保存" : "● 未保存";
    title.title = saveState + " · " + c.model.assetId;
    $("document-save-state").textContent = saveState;
  }
  async task(mode: "model" | "color" | "asset") {
    if (!(await moduleEditor.resolveDraft("切换工具"))) return;
    this.mode = mode;
    this.inspector.dataset.task = mode;
    $("model-tool-parameters").hidden = mode !== "model";
    $("inspector-asset").hidden = mode !== "asset";
    this.toolHost.hidden =
      mode !== "color" &&
      !document.querySelector("#rock-shape-panel:not([hidden])");
    this.state.inspector = true;
    this.applyLayout();
    if (mode === "color") moduleEditor.openAppearance();
    if (mode === "asset")
      ($("module-root-menu") as HTMLDetailsElement).open = true;
  }
  async rockTask() {
    if (!(await moduleEditor.resolveDraft("岩体塑形"))) return;
    this.showRock();
  }
  showRock() {
    this.mode = "rock";
    this.inspector.dataset.task = "rock";
    $("model-tool-parameters").hidden = true;
    $("inspector-asset").hidden = true;
    this.toolHost.hidden = false;
    this.state.inspector = true;
    this.applyLayout();
    moduleEditor.rockShaping();
  }
  private toggle(k: "preview" | "assets" | "hierarchy" | "inspector") {
    if (k === "hierarchy" && window.innerWidth <= 1100)
      this.narrowTree = !this.narrowTree;
    else this.state[k] = !this.state[k];
    this.applyLayout();
  }
  private applyLayout() {
    const root = $("module-workspace");
    for (const k of ["preview", "assets", "hierarchy", "inspector"] as const)
      root.dataset[k] = String(
        k === "hierarchy" && window.innerWidth <= 1100
          ? this.narrowTree
          : this.state[k],
      );
    root.style.setProperty("--inspector-width", this.state.width + "px");
    try {
      localStorage.setItem("workshop-layout-u14", JSON.stringify(this.state));
    } catch {}
    requestAnimationFrame(() => moduleEditor.resize());
  }
}
