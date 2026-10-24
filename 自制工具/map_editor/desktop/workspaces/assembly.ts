import { AssemblyView } from "../assembly-view.ts";
import { assetPreviewImage } from "../workshop-preview.ts";
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
  libraryRoot: () => string;
  chooseLibrary: () => Promise<void>;
  reloadLibrary: () => Promise<void>;
  changed: () => void;
  save: () => Promise<void>;
  createScene: () => void;
  history: (redo: boolean) => void;
  edit: (id: string) => Promise<void>;
  projectAssetsMode: () => boolean;
  independent: (instanceId: string) => Promise<void>;
  join: (ids: string[]) => Promise<string>;
  import: () => Promise<void>;
  drop: (id: string, position: Vec3) => Promise<void>;
  dropProject: (id: string, position: Vec3) => Promise<void>;
  mountProjectBrowser: (host: HTMLElement) => void;
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
  private joining = false;
  private clipboard: {key:string; elements:ReturnType<AssemblyWorkspace['selected']>; collections:NonNullable<SceneDocument['collections']>} | null = null;
  private fieldsKey = "";
  private browserKey = "";
  private collapsedCollections = new Set<string>();
  private contextKey = "";
  private assetScope: "scene" | "library";
  private projectMode: boolean;
  private assetQuery = "";
  private ctx: Context;
  private host: HTMLElement;
  private dock: "right" | "bottom" = "right";
  private rightWidth = 340;
  private bottomHeight = 260;
  private $ = (id: string) => this.host.querySelector<HTMLElement>("#" + id)!;
  constructor(host: HTMLElement, ctx: Context) {
    this.host = host;
    this.ctx = ctx;
    this.projectMode = ctx.projectAssetsMode();
    this.assetScope = this.projectMode ? "scene" : "library";
    host.replaceChildren();
    host.classList.add("assembly-layout");
    try {
      const saved = JSON.parse(localStorage.getItem("xinghai-assembly-dock") || "null");
      if (saved?.dock === "bottom") this.dock = "bottom";
      if (Number.isFinite(saved?.rightWidth)) this.rightWidth = Math.max(240, saved.rightWidth);
      if (Number.isFinite(saved?.bottomHeight)) this.bottomHeight = Math.max(180, saved.bottomHeight);
    } catch {}
    const tools = el("aside"),
      viewport = el("div");
    tools.className = "assembly-inspector";
    const browser = el("aside");
    browser.id = "assembly-browser";
    browser.className = "assembly-browser";
    const browserHead = el("div");
    browserHead.className = "assembly-browser-head";
    browserHead.append(el("h2", "可放入资产"));
    for (const [position, label] of [["right", "右侧"], ["bottom", "底部"]] as const) {
      const button = el("button", label) as HTMLButtonElement;
      button.id = `assembly-dock-${position}`;
      button.title = `将资产浏览区停靠在${label}`;
      button.onclick = () => { this.dock = position; this.applyDock(); };
      browserHead.append(button);
    }
    browser.append(browserHead);
    const tabs = el("div");
    tabs.className = "asset-scope-tabs";
    for (const [scope, title] of [
      ["scene", ctx.projectAssetsMode() ? "项目资产库" : "当前场景资产"],
      ["library", "公共库"],
    ] as const) {
      const tab = el("button", title) as HTMLButtonElement;
      tab.dataset.assetScope = scope;
      tab.onclick = () => {
        this.assetScope = scope;
        this.renderBrowser();
      };
      tabs.append(tab);
    }
    const search = el("input") as HTMLInputElement;
    search.id = "assembly-browser-search";
    search.placeholder = "搜索可放入资产";
    search.setAttribute("aria-label", "搜索可放入资产");
    search.oninput = () => {
      this.assetQuery = search.value.trim().toLowerCase();
      this.renderBrowser();
    };
    const currentPane = el("section"),
      libraryPane = el("section");
    currentPane.id = "assembly-scene-assets-pane";
    libraryPane.id = "assembly-library-pane";
    browser.append(tabs, search, currentPane, libraryPane);
    viewport.id = "assembly-viewport";
    tools.append(
      el("h1", ctx.projectAssetsMode() ? "试摆场景" : "场景装配"),
      el(
        "p",
        "左键拖动框选 · Shift 加选 · Ctrl 减选",
      ),
    );
    const actions = el("div");
    actions.className = "actions assembly-commands";
    actions.setAttribute("aria-label", "场景操作");
    const emptyAction = el("button", "新建试摆场景") as HTMLButtonElement;
    emptyAction.id = "assembly-create-scene";
    emptyAction.onclick = () => void ctx.run(() => { ctx.createScene(); this.render(); });
    tools.append(emptyAction);
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
    action("assembly-copy", "直接复制", () =>
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
    action('assembly-clipboard-copy','复制',()=>{
      const elements=this.selected(); if (!elements.length) return;
      this.clipboard={key:ctx.key(),elements:structuredClone(elements),collections:structuredClone((ctx.scene()?.collections??[]).filter(c=>c.memberIds.every(id=>this.ids.has(id))))};
    });
    action('assembly-paste','粘贴',()=>{
      if (!this.clipboard || this.clipboard.key!==ctx.key()) return;
      const ids=this.clipboard.elements.map(()=>crypto.randomUUID());
      ctx.session().pasteElements(this.clipboard.elements,ids,this.clipboard.collections);this.ids=new Set(ids);
      ctx.changed();
    });
    action('assembly-cut','剪切',()=>{
      const elements=this.selected();if(!elements.length)return;
      this.clipboard={key:ctx.key(),elements:structuredClone(elements),collections:ctx.session().copyCollections([...this.ids])};
      ctx.session().removeMany([...this.ids]);this.ids.clear();ctx.changed();
    });
    action('assembly-all','全选',()=>this.select([...(ctx.scene()?.instances??[]).map(p=>p.instanceId),...(ctx.scene()?.decals??[]).map(p=>p.decalId)]));
    action('assembly-clear','取消选择',()=>this.select([]));
    action('assembly-join','合并物体 · Ctrl+J',async()=>{
      if (!this.canJoin()) return;
      const ids=[...this.ids];
      this.view.cancelDrag();
      this.joining=true;
      this.render();
      try {
        const id=await ctx.join(ids);
        this.select([id]);
        this.$('assembly-join').closest('details')?.removeAttribute('open');
      } finally {
        this.joining=false;
        this.render();
      }
    });
    const bindings:Record<string,string>={'c':'assembly-clipboard-copy','v':'assembly-paste','x':'assembly-cut','d':'assembly-copy','a':'assembly-all','j':'assembly-join'};
    for(const [key,id] of Object.entries(bindings)) actions.querySelector<HTMLElement>('#'+id)!.title='Ctrl+'+key.toUpperCase();
    actions.querySelector<HTMLElement>('#assembly-delete')!.title='Delete';
    actions.querySelector<HTMLElement>('#assembly-clear')!.title='Esc';
    document.addEventListener('keydown',event=>{
      if(!host.isConnected || !host.getClientRects().length || !ctx.scene() || event.defaultPrevented || document.querySelector('dialog[open]') || event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      const id=(event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey?bindings[event.key.toLowerCase()]:event.key==='Delete'?'assembly-delete':event.key==='Escape'?'assembly-clear':undefined;
      if(!id)return;event.preventDefault();
      if(event.key==='Escape')this.view.cancelDrag();
      (this.$(id) as HTMLButtonElement).click();
    });
    const more = el('details'); more.className='assembly-more';
    more.append(el('summary','更多')); const menu=el('div'); more.append(menu);
    actions.append(more);
    for (const id of ['assembly-join','assembly-cut','assembly-all','assembly-clear','assembly-rotate','assembly-undo','assembly-redo','assembly-save','assembly-fit']) menu.append(actions.querySelector('#'+id)!);
    for (const id of ['assembly-clipboard-copy','assembly-paste','assembly-copy','assembly-delete']) actions.insertBefore(actions.querySelector('#'+id)!,more);
    let modelEdges=localStorage.getItem('xh-assembly-model-edges')==='true';
    const edgesButton=action('assembly-model-edges','模型黑边',()=>{modelEdges=!modelEdges;this.view.setModelEdges(modelEdges);edgesButton.classList.toggle('active',modelEdges);edgesButton.setAttribute('aria-pressed',String(modelEdges));localStorage.setItem('xh-assembly-model-edges',String(modelEdges));});
    edgesButton.hidden=true;edgesButton.title='已移入显示菜单的结构边线';actions.insertBefore(edgesButton,more);
    viewport.append(actions);
    action("assembly-import", "导入 GLB / PNG", ctx.import, currentPane);
    for (const id of ["assembly-selection", "assembly-groups"]) {
      const node = el("div");
      node.id = id;
      tools.append(node);
    }
    const assets = el("select") as HTMLSelectElement;
    assets.id = "assembly-assets";
    assets.setAttribute("aria-label", "放入模块");
    currentPane.append(
      el("p", ctx.projectAssetsMode() ? "在下方浏览原生资产，拖到视口试摆。" : "已在当前场景中的本地资产，可重复摆放。"),
      assets,
    );
    assets.onchange = () => this.renderBrowser();
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
            ctx.session().addDecal({
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
            ctx.session().add({
              instanceId: id,
              assetId: row.assetId,
              positionM: structuredClone(root),
              rotationDeg: 0,
              groupId: row.kind === "voxel" ? "base" : "large-env",
            });
          }
          this.ids = new Set([id]);
        }),
      currentPane,
    );
    const currentAssets = el("div");
    currentAssets.id = "assembly-current-assets";
    currentPane.append(currentAssets);
    const tree = el("div");
    tree.id = "assembly-tree";
    const collectionActions=el('div');collectionActions.className='assembly-collection-actions';
    action('assembly-collection-create','新建集合',async()=>{const name=await this.collectionName('新建集合','集合');if(name){ctx.session().createCollection([...this.ids],name);ctx.changed();}},collectionActions);
    action('assembly-collection-rename','改名',async()=>{const c=ctx.scene()?.collections?.find(c=>c.memberIds.some(id=>this.ids.has(id)));if(!c)return;const name=await this.collectionName('集合名称',c.name);if(name){ctx.session().renameCollection(c.collectionId,name);ctx.changed();}},collectionActions);
    action('assembly-collection-dissolve','解散',()=>{ctx.session().dissolveCollections([...this.ids]);ctx.changed();},collectionActions);
    tools.append(el('h2','场景层级'),collectionActions,tree,el('h2','所选内容'));
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
    action('assembly-independent', '将实例另存为独立资产', async () => {
      if (!ctx.projectAssetsMode()) throw Error('旧项目请先转换副本');
      const selected = this.selected();
      if (selected.length !== 1 || !('instanceId' in selected[0])) throw Error('请选择一个模型实例');
      await ctx.independent(selected[0].instanceId);
    }, tools);
    const issues = el("p");
    issues.id = "assembly-issues";
    tools.append(issues);
    libraryPane.append(el("h3", ctx.projectAssetsMode()
      ? "公共库 · 复制为项目资产" : "公共库 · 拖入独立副本"));
    const libraryActions = el("div");
    libraryActions.className = "actions";
    action(
      "assembly-library-choose",
      "选择公共库",
      ctx.chooseLibrary,
      libraryActions,
    );
    action(
      "assembly-library-reload",
      "重载",
      ctx.reloadLibrary,
      libraryActions,
    );
    const libraryRoot = el("p");
    libraryRoot.id = "assembly-library-root";
    const libraryHint = el(
      "p",
      "把条目拖入中间视口，创建独立本地副本；公共原件保持不变。",
    );
    libraryPane.append(libraryActions, libraryRoot, libraryHint);
    const library = el("div");
    library.id = "assembly-library";
    libraryPane.append(library);
    const splitter = el("div");
    splitter.id = "assembly-browser-splitter";
    splitter.className = "assembly-browser-splitter";
    splitter.setAttribute("role", "separator");
    splitter.setAttribute("aria-label", "调整资产浏览区大小");
    splitter.tabIndex = 0;
    const resize = (clientX: number, clientY: number) => {
      const bounds = host.getBoundingClientRect();
      if (this.dock === "right") this.rightWidth = Math.max(240, Math.min(bounds.width - 500, bounds.right - clientX));
      else this.bottomHeight = Math.max(180, Math.min(bounds.height - 220, bounds.bottom - clientY));
      this.applyDock();
    };
    splitter.onpointerdown = (event) => {
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);
    };
    splitter.onpointermove = (event) => {
      if (splitter.hasPointerCapture(event.pointerId)) resize(event.clientX, event.clientY);
    };
    splitter.onpointerup = (event) => {
      if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
    };
    splitter.onkeydown = (event) => {
      const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? 20 : event.key === "ArrowRight" || event.key === "ArrowDown" ? -20 : 0;
      if (!delta) return;
      event.preventDefault();
      if (this.dock === "right") this.rightWidth = Math.max(240, this.rightWidth + delta);
      else this.bottomHeight = Math.max(180, this.bottomHeight + delta);
      this.applyDock();
    };
    const inspectorContent=el('div');inspectorContent.id='assembly-inspector-content';
    inspectorContent.append(...Array.from(tools.childNodes));
    const inspectorScroll=el('div');inspectorScroll.className='assembly-inspector-scroll';inspectorScroll.append(inspectorContent);
    const zoomBar=el('div');zoomBar.className='assembly-inspector-frame';zoomBar.append(el('span','内容缩放'));
    const zoomReset=el('button','100%') as HTMLButtonElement;zoomReset.id='assembly-zoom-reset';zoomReset.title='滚轮缩放侧栏内容 · 点击复位';zoomBar.append(zoomReset);
    let zoom=Number(localStorage.getItem('xh-assembly-inspector-zoom'))||1;
    const applyZoom=()=>{zoom=Math.max(.6,Math.min(1.5,zoom));inspectorContent.style.zoom=String(zoom);inspectorContent.dataset.zoom=String(zoom);zoomReset.textContent=Math.round(zoom*100)+'%';localStorage.setItem('xh-assembly-inspector-zoom',String(zoom));};applyZoom();
    zoomReset.onclick=()=>{zoom=1;applyZoom();};
    tools.addEventListener('wheel',event=>{if(!event.deltaY)return;event.preventDefault();event.stopPropagation();zoom=Math.round((zoom+(event.deltaY<0?.05:-.05))*100)/100;applyZoom();},{passive:false});
    tools.replaceChildren(zoomBar,inspectorScroll);
    host.append(tools, viewport, splitter, browser);
    this.applyDock();
    const dropGuide = el('div');
    dropGuide.className = 'assembly-drop-guide'; dropGuide.hidden = true;
    viewport.append(dropGuide);
    this.view = new AssemblyView(viewport);
    // Per-viewport display preferences own structural edges.
    this.view.onSelect = (id, additive, subtract) =>
      this.select(id ? [id] : [], additive, subtract);
    this.view.onSelectMany = (ids, additive, subtract) => this.select(ids, additive, subtract);
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
      if (e.dataTransfer?.types.includes("application/x-xinghai-library") ||
          e.dataTransfer?.types.includes('application/x-xinghai-project-asset')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (e.dataTransfer.types.includes('application/x-xinghai-project-asset')) {
          const rect = viewport.getBoundingClientRect();
          const point = this.view.dropPosition(e.clientX, e.clientY);
          dropGuide.style.left = `${e.clientX - rect.left}px`;
          dropGuide.style.top = `${e.clientY - rect.top}px`;
          dropGuide.textContent = `⊕ ${point.slice(0, 2).map((n) => (Math.round(n / .25) * .25).toFixed(2)).join(', ')} m · 0.25 m 网格`;
          dropGuide.hidden = false;
        }
      }
    });
    viewport.addEventListener('dragleave', (e) => {
      if (!viewport.contains(e.relatedTarget as Node)) dropGuide.hidden = true;
    });
    document.addEventListener('dragend', () => { dropGuide.hidden = true; });
    viewport.addEventListener("drop", (e) => {
      dropGuide.hidden = true;
      const projectId = e.dataTransfer?.getData('application/x-xinghai-project-asset');
      if (projectId) {
        e.preventDefault();
        const point = this.view.dropPosition(e.clientX, e.clientY);
        void ctx.run(() => ctx.dropProject(projectId, point));
        return;
      }
      const id = e.dataTransfer?.getData("application/x-xinghai-library");
      if (!id) return;
      e.preventDefault();
      const point = this.view.dropPosition(e.clientX, e.clientY);
      void ctx.run(() => ctx.drop(id, point));
    });
  }
  private collectionName(title:string,initial:string):Promise<string|null>{
    return new Promise(resolve=>{
      const dialog=el('dialog') as HTMLDialogElement;dialog.className='assembly-name-dialog';
      const form=el('form') as HTMLFormElement;form.method='dialog';const input=el('input') as HTMLInputElement;input.id='assembly-collection-name';input.value=initial;input.maxLength=80;input.required=true;input.setAttribute('aria-label',title);
      const buttons=el('div');const cancel=el('button','取消') as HTMLButtonElement;cancel.type='button';cancel.onclick=()=>dialog.close();const accept=el('button','确定') as HTMLButtonElement;accept.id='assembly-collection-confirm';accept.type='submit';buttons.append(cancel,accept);form.append(el('h3',title),input,buttons);dialog.append(form);
      let value:string|null=null;form.onsubmit=()=>{value=input.value.trim()||null;};dialog.onclose=()=>{dialog.remove();resolve(value);};document.body.append(dialog);dialog.showModal();input.select();
    });
  }
  private applyDock() {
    this.host.classList.toggle("dock-bottom", this.dock === "bottom");
    this.host.style.setProperty("--assembly-browser-width", `${this.rightWidth}px`);
    this.host.style.setProperty("--assembly-browser-height", `${this.bottomHeight}px`);
    this.host.querySelectorAll<HTMLButtonElement>("#assembly-dock-right, #assembly-dock-bottom").forEach((button) => {
      const active = button.id === `assembly-dock-${this.dock}`;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    localStorage.setItem("xinghai-assembly-dock", JSON.stringify({ dock: this.dock, rightWidth: this.rightWidth, bottomHeight: this.bottomHeight }));
  }
  private selected() {
    const s = this.ctx.scene();
    return s
      ? [...s.instances, ...s.decals].filter((p) =>
          this.ids.has("instanceId" in p ? p.instanceId : p.decalId),
        )
      : [];
  }
  private canJoin() {
    if (this.joining || this.ids.size < 2) return false;
    const scene=this.ctx.scene(), selected=this.selected();
    return !!scene && selected.length===this.ids.size && selected.every(p=>
      'instanceId' in p && this.ctx.assets().has(p.assetId) &&
      scene.assets.some(a=>a.assetId===p.assetId && a.kind==='voxel'));
  }
  select(ids: string[], additive = false, subtract = false) {
    ids=this.ctx.session().expandSelection(ids);
    if (!additive && !subtract) this.ids.clear();
    for (const id of ids) {
      if (subtract) this.ids.delete(id);
      else this.ids.add(id);
    }
    this.render();
  }
  clearSelection() {
    this.ids.clear();
    this.contextKey = "";
    this.browserKey = "";
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
      this.$("assembly-selection").textContent = "当前项目没有试摆场景。可在此新建，或直接从资产库拖入第一个资产自动创建。";
      (this.$("assembly-create-scene") as HTMLButtonElement).hidden = false;
      (this.$("assembly-import") as HTMLButtonElement).hidden = this.ctx.projectAssetsMode();
      this.host.querySelectorAll<HTMLButtonElement>(".assembly-inspector button:not(#assembly-create-scene):not(#assembly-zoom-reset), .assembly-commands button")
        .forEach((b) => (b.disabled = true));
      this.view.update(createScene("empty"), new Map(), [], new Map());
      this.renderBrowser();
      (this.$("assembly-library-choose") as HTMLButtonElement).disabled = false;
      return;
    }
    const ctx = this.ctx,
      key = ctx.key();
    (this.$("assembly-create-scene") as HTMLButtonElement).hidden = true;
    if (this.contextKey && this.contextKey !== key) this.ids.clear();
    this.contextKey = key;
    const elements = [...scene.instances, ...scene.decals],
      live = new Set(
        elements.map((p) => ("instanceId" in p ? p.instanceId : p.decalId)),
      );
    for (const id of this.ids) if (!live.has(id)) this.ids.delete(id);
    this.ids=new Set(ctx.session().expandSelection([...this.ids]));
    this.host
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => {if (!b.closest("#assembly-current-assets")) b.disabled = false;});
    const assets = ctx.assets(),
      binaries = ctx.binaries(),
      selected = this.selected(),
      primary = selected[0];
    (this.$("assembly-import") as HTMLButtonElement).hidden = ctx.projectAssetsMode();
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
    const collectionHosts=new Map<string,HTMLElement>();
    for(const c of scene.collections??[]){
      const block=el('details') as HTMLDetailsElement;block.dataset.collection=c.collectionId;block.open=!this.collapsedCollections.has(c.collectionId);
      const summary=el('summary');const select=el('button',c.name);select.title=c.name;select.classList.toggle('active',c.memberIds.some(id=>this.ids.has(id)));
      select.onclick=e=>{e.preventDefault();this.select(c.memberIds,e.shiftKey,e.ctrlKey||e.metaKey);};summary.append(select);block.append(summary);
      block.addEventListener('toggle',()=>{if(!block.isConnected)return;if(block.open)this.collapsedCollections.delete(c.collectionId);else this.collapsedCollections.add(c.collectionId);});
      const children=el('div');children.className='assembly-collection-members';block.append(children);tree.append(block);for(const id of c.memberIds)collectionHosts.set(id,children);
    }
    for (const p of elements) {
      const id = "instanceId" in p ? p.instanceId : p.decalId,
        b = el(
          "button",
          `${assets.get(p.assetId)?.name || ("decalId" in p ? "PNG贴花" : "GLB模型")} · ${id.slice(0, 8)}`,
        );
      b.dataset.instance = id;
      b.classList.toggle("active", this.ids.has(id));
      b.setAttribute("aria-pressed", String(this.ids.has(id)));
      b.onclick = (e) => this.select([id], e.shiftKey, e.ctrlKey || e.metaKey);
      (collectionHosts.get(id)??tree).append(b);
    }
    const selectedCollections=(scene.collections??[]).filter(c=>c.memberIds.some(id=>this.ids.has(id)));
    (this.$('assembly-collection-create') as HTMLButtonElement).disabled=this.ids.size<2;
    (this.$('assembly-collection-rename') as HTMLButtonElement).disabled=selectedCollections.length!==1;
    (this.$('assembly-collection-dissolve') as HTMLButtonElement).disabled=!selectedCollections.length;
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
      "assembly-clipboard-copy",
      "assembly-cut",
      "assembly-delete",
      "assembly-rotate",
      "assembly-apply",
    ])
      (this.$(id) as HTMLButtonElement).disabled = !selected.length;
    (this.$("assembly-paste") as HTMLButtonElement).disabled = !this.clipboard || this.clipboard.key !== key;
    (this.$("assembly-join") as HTMLButtonElement).disabled = !this.canJoin();
    (this.$("assembly-edit") as HTMLButtonElement).disabled =
      selected.length !== 1 || !primary || !assets.has(primary.assetId);
    const independent = this.$('assembly-independent') as HTMLButtonElement;
    independent.hidden = !ctx.projectAssetsMode();
    independent.disabled = selected.length !== 1 || !primary || !('instanceId' in primary) || !assets.has(primary.assetId);
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
    this.renderBrowser(assets);
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
  private renderBrowser(assets = this.ctx.assets()) {
    const ctx = this.ctx;
    if (this.projectMode !== ctx.projectAssetsMode()) {
      this.projectMode = ctx.projectAssetsMode();
      this.assetScope = this.projectMode ? "scene" : "library";
      const projectTab = this.host.querySelector<HTMLElement>('[data-asset-scope="scene"]');
      if (projectTab) projectTab.textContent = this.projectMode ? "项目资产库" : "当前场景资产";
      const heading = this.host.querySelector<HTMLElement>('.assembly-inspector h1');
      if (heading) heading.textContent = this.projectMode ? "试摆场景" : "场景装配";
    }
    this.host
      .querySelectorAll<HTMLButtonElement>("[data-asset-scope]")
      .forEach((button) => {
        const active = button.dataset.assetScope === this.assetScope;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    this.$("assembly-scene-assets-pane").hidden = this.assetScope !== "scene";
    this.$("assembly-library-pane").hidden = this.assetScope !== "library";
    const hasLibrary = !!ctx.libraryRoot();
    this.$("assembly-library-root").textContent = hasLibrary
      ? ctx.libraryRoot()
      : "尚未选择公共库";
    (this.$("assembly-library-reload") as HTMLButtonElement).disabled =
      !hasLibrary;
    const browserKey=JSON.stringify([ctx.key(),this.assetScope,this.assetQuery,(this.$("assembly-assets") as HTMLSelectElement).value,ctx.projectAssetsMode(),ctx.scene()?.assets,[...assets].map(([id,a])=>[id,a.revision,a.name]),ctx.libraryRoot(),ctx.library()]);
    if(this.browserKey===browserKey)return;
    this.browserKey=browserKey;
    const local = this.$("assembly-current-assets");
    local.replaceChildren();
    const choices = this.$("assembly-assets") as HTMLSelectElement;
    choices.hidden = ctx.projectAssetsMode();
    (this.$('assembly-add') as HTMLButtonElement).hidden = ctx.projectAssetsMode();
    if (ctx.projectAssetsMode()) {
      ctx.mountProjectBrowser(local);
    } else {
    for (const row of ctx.scene()?.assets ?? []) {
      const title =
        assets.get(row.assetId)?.name ||
        `${row.kind} · ${row.assetId.slice(0, 8)}`;
      if (!`${title} ${row.assetId}`.toLowerCase().includes(this.assetQuery))
        continue;
      const card = el("button") as HTMLButtonElement;
      card.className = "assembly-asset-card";
      const asset = assets.get(row.assetId);
      if (asset) card.append(assetPreviewImage(asset));
      card.append(el("span", title));
      card.dataset.assetId = row.assetId;
      card.setAttribute("aria-pressed", String(row.assetId === choices.value));
      card.classList.toggle("active", row.assetId === choices.value);
      card.onclick = () => {
        choices.value = row.assetId;
        this.renderBrowser();
      };
      local.append(card);
    }
    if (!local.children.length)
      local.append(
        el(
          "p",
          this.assetQuery
            ? "没有匹配的项目资产"
            : ctx.projectAssetsMode() ? "项目资产库为空；请到模块编辑制作并保存资产。" : "当前场景尚无资产；可切换公共库拖入或导入 GLB / PNG。",
        ),
      );
    }
    const library = this.$("assembly-library");
    library.replaceChildren();
    for (const row of ctx.library()) {
      if (!`${row.name} ${row.type}`.toLowerCase().includes(this.assetQuery))
        continue;
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
    if (!library.children.length && hasLibrary)
      library.append(
        el(
          "p",
          this.assetQuery
            ? "没有匹配的公共资产"
            : "所选公共库为空；选择其他目录或添加资产后重载。",
        ),
      );
  }
  dispose() {
    this.view.dispose();
  }
}
