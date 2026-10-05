import {brushCandidates,applyBrush,type BrushConfig} from "../core/brush.ts";
import { EditorDocument, createMap, validateMap } from "../core/document.ts";
import { inspectLegacyTags, migrateLegacyTags } from "../core/migration.ts";
import { MapView } from "./view.ts";
import { thumbnail } from "./thumbnail.ts";
import { RebuildQueue } from "../core/rebuild.ts";
import { affectedChunks } from "../core/mesher.ts";
import { bindColorWheel } from "./color-wheel.ts";
import { inspectAsset } from "./asset-viewer.ts";
import { editorCommand } from "./shortcuts.ts";
declare global {
  interface Window {
    workbench: any;
  }
}
const $ = (id: string) => document.getElementById(id)!;
const api = window.workbench;
let moduleBinding:{sessionId:string;root:()=>[number,number,number];changed:()=>void;undo:()=>void;redo:()=>void;save:()=>Promise<void>}|null=null;
let rootPlacement:((root:[number,number,number])=>void)|null=null;
let referencePlacement=false;
const listeners:(()=>void)[]=[];
function listen(target:any,type:string,fn:any,options?:any){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
$("app").innerHTML =
  `<header><strong>星骸 / 地图工坊<small>MAP EDITOR · M1.2</small></strong><nav><button id="new">新建</button><button id="open">打开</button><button id="save">保存</button><button id="saveas">另存为</button><button id="duplicate">复制模块</button><button id="undo">撤销</button><button id="redo">重做</button><button id="export" class="primary">导出团结源</button></nav><span id="filename" class="filename">未命名地图</span></header>
<div class="layout"><aside><div class="section-label">编辑内容</div><div class="modes" id="modes">${[
    ["height", "地台"],
    ["volume", "三维"],
    ["stack", "表面搭积木"],
    ["property", "属性"],
    ["model", "模型"],
    ["event", "事件"],
    ["decal", "贴花"],
  ]
    .map(([v, n]) => `<button data-mode="${v}">${n}</button>`)
    .join(
      "",
    )}</div><div class="section-label">绘制工具</div><div class="tools" id="tools">${[
    ["brush", "笔刷"],
    ["rectangle", "矩形"],
    ["fill", "填色"],
    ["repaint", "重染"],
    ["erase", "擦除"],
  ]
    .map(([v, n]) => `<button data-tool="${v}">${n}</button>`)
    .join(
      "",
    )}</div><div class="pair"><label class="field"><span>顶面高度</span><input id="height" aria-label="顶面高度" type="number" value="0" step="1" min="-8192" max="8192"></label><label class="field"><span>厚度</span><input id="thickness" aria-label="厚度" type="number" value="1" min="1" max="256"></label></div><label class="field"><span>三维工作层 / Z</span><input id="layer" type="number" value="0" min="-8192" max="8192" aria-label="三维工作层"></label><label class="field"><span>侧面与底面</span><select id="side"><option value="-1">继承体素颜色</option>${Array.from({ length: 8 }, (_, i) => `<option value="${i}">固定色板 ${i + 1}</option>`).join("")}</select></label><label class="field"><span><input id="section" type="checkbox"> 剖切：隐藏工作层上方</span></label><label class="field"><span><input id="showz" type="checkbox"> 显示已有表面 Z</span></label><div id="palette" class="swatches"></div><label class="field"><span>当前色板颜色</span><input id="color" type="color" value="#59737a"></label><label class="field"><span>表面属性</span><select id="tag"><option value="walk">普通地面（可站立/可部署）</option><option value="obstacle">实体阻挡</option><option value="highground">高台（可站立/可部署）</option></select></label><label class="field"><span>摆放旋转</span><select id="rotation"><option>0</option><option>90</option><option>180</option><option>270</option></select></label><div class="pair"><label class="field"><span>贴花宽 / 米</span><input id="decalwidth" type="number" value="1" min="0.25" step="0.25"></label><label class="field"><span>贴花长 / 米</span><input id="decalheight" type="number" value="1" min="0.25" step="0.25"></label></div><label class="field"><span>事件注册键</span><input id="eventkey" value="sample.switch" maxlength="80"></label><label class="field"><span>模型锚点 X / Y / Z（米）</span><input id="anchor" value="0,0,0" aria-label="模型锚点"></label><button id="anchor-save">保存此资产锚点</button><p class="hint" id="modehint"></p><div class="section-label">已放置内容 · 点击移除</div><div id="instances" class="instance-list"></div></aside>
<section class="workspace"><div class="views"><div class="view"><div id="editview" class="viewport"></div><div class="view-label">绘制视图</div><div class="view-actions"><button id="top">俯视</button><button id="home">复位</button></div><div id="coords" class="view-foot">X —　Y —　Z —</div><div class="ruler">1 体素 = 0.25 m</div></div><div class="view preview"><div id="preview" class="viewport"></div><div class="view-label">游戏角度预览</div><div class="view-actions"><button id="flat">无光照校色</button><button id="previewhome">复位</button></div><div class="view-foot">拖动旋转 · 滚轮缩放</div></div></div><section class="library"><div class="library-bar"><strong>资产库</strong><button id="choose">选择目录</button><button id="reload">重载</button><input id="search" placeholder="搜索名称" aria-label="搜索资产"><span id="root" class="root">选择 GLB / PNG 目录；源文件保留在 Blender 中</span><button id="locate">定位文件</button><button id="source">定位源模型</button><button id="rename">改显示名</button><button id="renamefile">改文件名</button></div><div id="assets" class="asset-list"><div class="empty">从资产目录开始，或直接在上方绘制地台。</div></div></section></section></div><footer class="status"><span id="message">左键绘制 · 右键旋转 · 中键平移 · Esc 取消笔画</span><span id="count">体素 0</span><span id="quads">四边面 0</span><span class="mono">0.25 m / Z ↑</span></footer><dialog id="rename-dialog"><form method="dialog"><p>输入新的资源名称</p><input id="rename-input" maxlength="80"><div class="rename"><button value="cancel">取消</button><button value="ok">确定</button></div></form></dialog>`;
$("instances").insertAdjacentHTML('beforebegin','<details id="native-panel"><summary>原生资产与模型交换</summary><p class="hint">框选体素，使用独立原生源与带色GLB。选择Z范围以体素层计。</p><div class="pair"><label class="field">最低层<input id="native-minz" type="number" value="-2"></label><label class="field">最高层<input id="native-maxz" type="number" value="8"></label></div><button id="native-select">框选资产</button><button id="native-all">选择全部体素</button><p id="native-selection" class="hint">未选择范围</p><label class="field">名称<input id="native-name" value="体素资产"></label><label class="field">局部锚点<select id="native-anchor"><option value="bottom">底面中心</option><option value="origin">局部原点</option><option value="custom">指定坐标（米）</option></select></label><input id="native-anchorxyz" value="0,0,0" aria-label="原生资产锚点"><button id="native-save">保存为新资产</button><button id="native-open">打开原生资产编辑</button><button id="native-update" disabled>更新当前原生资产</button><button id="model-glb">导出地图 GLB</button><button id="model-fbx">导出 FBX（Blender）</button></details>');
$("instances").insertAdjacentHTML("beforebegin", '<details id="reference-panel"><summary>PNG 比例参考 · 编辑辅助</summary><button id="reference-import">导入 / 替换 PNG</button><p id="reference-name" class="hint">未导入参考</p><label class="field">世界高度 / 米<input id="reference-height" type="number" value="1.7" min=".01" step=".1"></label><label class="field">脚底位置 X / Y / Z（米）<input id="reference-position" value="0,0,0"></label><label class="field">有效上下边界（0—1）<input id="reference-bounds" value="0,1"></label><label class="field">脚底锚点 X / Y（0—1）<input id="reference-foot" value="0.5,1"></label><label class="field"><span><input id="reference-visible" type="checkbox" checked>显示参考（普通绘制不可选中）</span></label><button id="reference-move">放置参考</button><button id="reference-cancel">取消放置</button><button id="reference-reset">重置位置</button><p class="hint">图片已嵌入地图；高度按有效范围计算。导出游戏/模型时排除。</p></details>');
$("tools").insertAdjacentHTML("afterend", '<div class="pair"><label class="field">笔刷范围 / 格<input id="brush-size" type="number" min="1" max="33" step="1" value="1"></label><label class="field">形状<select id="brush-shape"><option value="square">方形</option><option value="circle">圆形</option></select></label></div><label class="field">厚度方向<select id="brush-direction"><option value="1">从工作层向上</option><option value="-1">从工作层向下</option></select></label><p class="hint" id="brush-meters">1格 = 0.25米</p>');
$("palette").insertAdjacentHTML("afterend", `<button id="palette-toggle" type="button">显示/隐藏色环</button><div id="color-panel" class="color-panel"><canvas id="color-wheel" width="184" height="184" aria-label="色相环与明度区域"></canvas><div class="color-controls"><label>HEX <input id="color-hex" value="#59737a" maxlength="7"></label><button id="use-color" type="button">作为画笔色</button><button id="replace-color" type="button">重染当前槽</button></div><small>画笔色只影响后续绘制；重染槽会改变所有引用此槽的体素。</small></div>`);
$("showz").closest("label")!.insertAdjacentHTML("afterend", `<button id="migrate-tags" type="button" hidden>迁移旧部署标签 · 另存副本</button>`);
$("locate").insertAdjacentHTML("beforebegin", `<button id="inspect" type="button">独立检视</button>`);
$("inspect").insertAdjacentHTML("beforebegin", `<button id="batchrename" type="button">批量命名</button>`);
$("app").insertAdjacentHTML("beforeend", `<dialog id="asset-viewer"><div class="asset-viewer-header"><strong id="asset-viewer-heading"></strong><button id="asset-viewer-close" type="button">关闭</button></div><p id="asset-viewer-meta"></p><div id="asset-viewer-stage"></div><p class="hint">左键旋转 · 滚轮缩放 · 中键平移。尺寸为 GLB 实际包围盒；模型不被自动缩放。</p></dialog>`);
$("app").insertAdjacentHTML("beforeend", `<dialog id="batch-dialog"><div class="asset-viewer-header"><strong>资产命名预检</strong><button id="batch-close" type="button">关闭</button></div><p class="hint">Ctrl/Shift 点击资产可多选。先预览全部目标，再确认；同一资产的 GLB、FBX 和 Blender 源共用编号，地图实例 ID 不变。</p><div class="batch-fields"><label>前缀<input id="batch-prefix" value="SM"></label><label>套件<input id="batch-kit" value="Ruin"></label><label>分类<input id="batch-category" value=""></label><label>主体<input id="batch-subject" value=""></label><label>变体<input id="batch-variant" value=""></label><label>后缀<input id="batch-suffix" value=""></label><label>分隔符<input id="batch-separator" value="_" maxlength="2"></label><label>起始编号<input id="batch-start" type="number" value="1" min="0"></label><label>补零位数<input id="batch-width" type="number" value="3" min="0" max="8"></label><label class="batch-check"><input id="batch-physical" type="checkbox"> 连带改实体文件名（GLB/PNG/FBX/Blend）</label></div><div class="batch-actions"><button id="batch-preview" type="button">检查并预览</button><button id="batch-commit" type="button" disabled>确认执行</button></div><div id="batch-result"></div></dialog>`);
$("asset-viewer-close").onclick = () => ($("asset-viewer") as HTMLDialogElement).close();
$("batch-close").onclick = () => ($("batch-dialog") as HTMLDialogElement).close();
const sidebarSplitter = document.createElement("div");
sidebarSplitter.id = "sidebar-splitter"; sidebarSplitter.className = "splitter vertical";
sidebarSplitter.setAttribute("role", "separator"); sidebarSplitter.setAttribute("aria-label", "调整工具区宽度");
document.querySelector(".layout")!.insertBefore(sidebarSplitter, document.querySelector(".workspace")!);
const viewSplitter = document.createElement("div");
viewSplitter.id = "view-splitter"; viewSplitter.className = "splitter vertical";
viewSplitter.setAttribute("role", "separator"); viewSplitter.setAttribute("aria-label", "调整双视口宽度");
document.querySelector(".views")!.insertBefore(viewSplitter, document.querySelector(".preview")!);
const librarySplitter = document.createElement("div");
librarySplitter.id = "library-splitter"; librarySplitter.className = "splitter horizontal";
librarySplitter.setAttribute("role", "separator"); librarySplitter.setAttribute("aria-label", "调整资产库高度");
document.querySelector(".workspace")!.insertBefore(librarySplitter, document.querySelector(".library")!);
$("palette-toggle").insertAdjacentHTML("afterend", `<button id="layout-reset" type="button">复位布局</button>`);
$("app").querySelector("header nav")!.insertAdjacentHTML("beforeend", `<button id="toggle-sidebar" type="button" aria-pressed="false">工具区</button><button id="toggle-library" type="button" aria-pressed="false">资产区</button>`);
function togglePanel(id: string, className: string) {
  const label = $(id).textContent!;
  const sync = () => {
    const expanded = !document.querySelector(".layout")!.classList.contains(className);
    $(id).setAttribute("aria-pressed", String(expanded));
    $(id).setAttribute("aria-expanded", String(expanded));
    $(id).classList.toggle("active", expanded);
    $(id).textContent = `${label} · ${expanded ? "展开" : "关闭"}`;
  };
  $(id).onclick = () => {
    document.querySelector(".layout")!.classList.toggle(className);
    sync();
  };
  sync();
}
togglePanel("toggle-sidebar", "sidebar-collapsed");
togglePanel("toggle-library", "library-collapsed");
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const layoutVars = ["--sidebar-width", "--edit-width", "--library-height"];
const layoutKey=document.body.classList.contains('workshop')?'xinghai-workshop':'xinghai-map';
for (const name of layoutVars) {
  const saved = localStorage.getItem(`${layoutKey}${name}`);
  if (saved && /^\d+px$/.test(saved)) document.documentElement.style.setProperty(name, saved);
}
function dragSplitter(el: HTMLElement, cssVar: string, measure: (e: PointerEvent) => number) {
  let dragging = false;
  el.onpointerdown = (e) => { dragging = true; el.setPointerCapture(e.pointerId); e.preventDefault(); };
  el.onpointermove = (e) => {
    if (!dragging) return;
    const value = `${Math.round(measure(e))}px`;
    document.documentElement.style.setProperty(cssVar, value);
    localStorage.setItem(`${layoutKey}${cssVar}`, value);
  };
  el.onpointerup = el.onpointercancel = () => { dragging = false; };
}
dragSplitter(sidebarSplitter, "--sidebar-width", (e) => {
  const r = document.querySelector(".layout")!.getBoundingClientRect();
  return clamp(e.clientX - r.left, 190, Math.min(480, r.width - 450));
});
dragSplitter(viewSplitter, "--edit-width", (e) => {
  const r = document.querySelector(".views")!.getBoundingClientRect();
  return clamp(e.clientX - r.left, 220, r.width - 220);
});
dragSplitter(librarySplitter, "--library-height", (e) => {
  const r = document.querySelector(".workspace")!.getBoundingClientRect();
  return clamp(r.bottom - e.clientY, 150, Math.min(430, r.height - 250));
});
$("layout-reset").onclick = () => {
  for (const name of layoutVars) { document.documentElement.style.removeProperty(name); localStorage.removeItem(`${layoutKey}${name}`); }
};
let editor = new EditorDocument(),
  mode = "height",
  tool = "brush",
  color = 0,
  selected: any = null,
  selectedIds = new Set<string>(),
  assets: any[] = [],
  drawing = false,
  start: any = null,
  last: any = null,
  savedRevision = 0;
let draftHex = "#59737a";
const wheel = bindColorWheel($("color-wheel") as HTMLCanvasElement, draftHex, (hex) => {
  draftHex = hex;
  ($("color") as HTMLInputElement).value = hex;
  ($("color-hex") as HTMLInputElement).value = hex;
});
const views = [
  new MapView($("editview"), true),
  new MapView($("preview"), false),
];
const num = (id: string) => Number(($(id) as HTMLInputElement).value);
function message(text: string, error = false) {
  $("message").textContent = text;
  document.querySelector("footer")!.classList.toggle("error", error);
}
function supportNotice() {
  if(editor.skipped.size) return `跳过 ${editor.skipped.size} 处受保护/无效位置；有效笔画已保留`;
  const { surfaces, instances, decals } = editor.detached;
  const removed = surfaces + instances + decals;
  return removed ? `已移除 ${removed} 项失去支撑的属性/实例/贴花；撤销可恢复` : null;
}
views.forEach((v) => (v.onError = (s) => message(s, true)));
function palette() {
  const el = $("palette");
  el.replaceChildren();
  editor.doc.palette.forEach((hex: string, i: number) => {
    const b = document.createElement("button");
    b.style.background = hex;
    b.title = `色板 ${i + 1}`;
    b.setAttribute("aria-label", `色板 ${i + 1}`);
    b.classList.toggle("active", i === color);
    b.setAttribute("aria-pressed", String(i === color));
    b.onclick = () => {
      color = i;
      ($("color") as HTMLInputElement).value = hex;
      ($("color-hex") as HTMLInputElement).value = hex;
      draftHex = hex;
      wheel.set(hex);
      palette();
    };
    el.append(b);
  });
}
const worker = new Worker("./mesh-worker.js");
const rebuild = new RebuildQueue(
  (job) => worker.postMessage(job),
  (result, doc, chunks) => {
    views.forEach((v) => v.update(doc, result.faces, chunks));
    $("quads").textContent =
      `四边面 ${views[0].stats.quads} · ${result.milliseconds.toFixed(0)} ms`;
  },
);
worker.onmessage = ({ data }) => {
  if (data.error) message("网格更新失败：" + data.error, true);
  rebuild.receive(data);
};
worker.onerror = (e) => message("网格进程错误：" + e.message, true);
function update(objects = false, all = false) {
  const doc = editor.doc;
  syncReference();
  const chunks =
    !all && editor.dirty.size
      ? new Set(
          [...editor.dirty].flatMap((k) =>
            affectedChunks(
              ...(k.split(",").map(Number) as [number, number, number]),
            ),
          ),
        )
      : undefined;
  rebuild.request(doc, chunks);
  editor.dirty.clear();
  $("count").textContent = `体素 ${doc.cells.length}`;
  $("quads").textContent = "网格更新中…";
  if(moduleBinding){moduleBinding.changed();views.forEach(v=>v.setRoot(moduleBinding!.root()));}else void api.dirty(doc.revision !== savedRevision);
  if (objects) {
    views.forEach(
      (v) => void v.refreshObjects(doc, (id: string) => api.assetData(id)),
    );
    instanceList();
  }
}
function instanceList() {
  $("instances").replaceChildren();
  for (const p of [...editor.doc.instances, ...editor.doc.decals]) {
    const b = document.createElement("button");
    b.textContent =
      (assets.find((a) => a.id === p.assetId)?.name ?? p.assetId.slice(0, 8)) +
      " ×";
    b.onclick = () => perform(() => editor.remove(p.id), true);
    $("instances").append(b);
  }
}
function perform(fn: () => void, objects = false) {
  try {
    editor.begin();
    fn();
    editor.commit();
    update(objects || editor.detached.instances + editor.detached.decals > 0);
    message(supportNotice() ?? "已修改地图");
  } catch (e: any) {
    editor.cancel();
    update(false, true);
    message(e.message, true);
  }
}
function modeButtons() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-tool]")
    .forEach((b) => {
      b.classList.toggle("active", b.dataset.tool === tool);
      b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
    });
  $("modehint").textContent = (
    {
      height: "顶面0也是有效地台。三维编辑过的列需用三维工具继续修改。",
      volume: "工作层是要增删的体素底面。视角旋转不改变工作层。",
      stack: "从已有外露面开始，沿固定法线绘制厚度；一笔内工作面不漂移。",
      property:
        "普通地面/高台仅可标在真实外露顶面；已有侧面可标阻挡。属性不产生几何。",
      model: "从资产库选择GLB，点击地面放置。模型按原始单位与根锚点摆放。",
      event:
        "选择GLB作为事件预览。团结端须将事件注册键映射到功能预制体；预览模型仅供摆放。",
      decal: "选择PNG，点击地面放置水平贴花。墙体正常遮挡。",
    } as any
  )[mode];
  const modeLabel = document.querySelector(`[data-mode="${mode}"]`)?.textContent ?? "体素选区";
  const toolLabel = document.querySelector(`[data-tool="${tool}"]`)?.textContent ?? tool;
  $("modehint").textContent = `当前：${modeLabel} · ${toolLabel}。${$("modehint").textContent ?? ""}`;
  $("native-select").classList.toggle("active", mode === "selection");
  $("native-select").setAttribute("aria-pressed", String(mode === "selection"));
}
function syncPlacement() {
  for (const [id, active] of [["module-root-pick", !!rootPlacement], ["reference-move", referencePlacement]] as const) {
    const button = document.getElementById(id);
    button?.classList.toggle("active", active);
    button?.setAttribute("aria-pressed", String(active));
  }
}
document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      cancelActiveStroke(); mode = b.dataset.mode!;
      modeButtons();
    }),
);
document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(
  (b) =>
    (b.onclick = () => {
      cancelActiveStroke(); tool = b.dataset.tool!;
      modeButtons();
    }),
);
let strokeConfig: BrushConfig | null = null;
const strokeSeen = new Set<string>();
function config():BrushConfig { return strokeConfig ?? {mode,action:tool==='erase'?'erase':tool==='repaint'?'repaint':'add',shape:($("brush-shape") as HTMLSelectElement).value,size:tool==='rectangle'?1:num('brush-size'),thickness:num('thickness'),level:mode==='volume'?num('layer'):num('height'),direction:num('brush-direction'),color,tag:($("tag") as HTMLSelectElement).value}; }
const level = () => config().level;
function paintHit(e:PointerEvent){if(drawing&&mode==='stack'&&start)return views[0].planeHit(e,start);return views[0].hit(e,level(),needsSurface(),editor.cells,editor.bounds);}
function preview(hit:any){
 if(!hit||!['height','volume','stack','property'].includes(mode)||tool==='fill'){views[0].brushPreview([]);views[0].hover(hit,level());return;}
 try{const c=config(),p=brushCandidates(editor,hit,c);views[0].hover(null,0);views[0].brushPreview(p,c.mode==='property');$("brush-meters").textContent=`范围 ${(c.size*.25).toFixed(2)}米 · 厚度 ${(c.thickness*.25).toFixed(2)}米 · 候选 ${p.length} 格`;}catch(e:any){views[0].brushPreview([]);message(e.message,true);}
}
const needsSurface = () => !["height", "volume", "selection"].includes(mode) || tool === "fill";
function apply(hit: any) {
  if (["height","volume","stack","property"].includes(mode) && tool !== "fill") { const c=config(); applyBrush(editor,brushCandidates(editor,hit,c),c,strokeSeen); return; }
  const x = hit.x,
    y = hit.y;
  if (mode === "height") {
    if (tool === "erase") editor.eraseColumn(x, y);
    else if (tool === "fill") editor.fillTop(x, y, hit.z, color);
    else editor.height(x, y, num("height"), num("thickness"), color);
  } else if (mode === "volume") {
    if (tool === "fill") editor.fillTop(x, y, hit.z, color);
    else editor.volume(x, y, num("layer"), color, tool === "erase");
  } else if (mode === "stack") {
    if (tool === "fill" || tool === "rectangle") throw Error("表面搭积木只支持单点加减");
    editor.stack(x, y, hit.z, hit.face, tool === "erase" ? "remove" : "add", color);
  } else if (mode === "property") {
    if (tool === "fill") {
      if (hit.face !== 4) throw Error("同高填充请选择水平顶面");
      editor.fillTop(x, y, hit.z, color, ($("tag") as HTMLSelectElement).value);
    } else editor.surface(
      x, y, hit.z, hit.face ?? 4,
      tool === "erase" ? "" : ($("tag") as HTMLSelectElement).value,
    );
  }
  else {
    if (hit.face !== 4) throw Error("模型、事件和水平贴花需要已有顶面");
    if (!selected) throw Error("请先选择一个资产");
    if (
      (mode === "decal" && selected.type !== "png") ||
      (mode !== "decal" && selected.type !== "glb")
    )
      throw Error(mode === "decal" ? "贴花需要PNG" : "模型与事件预览需要GLB");
    const p = {
      id: crypto.randomUUID(),
      assetId: selected.id,
      x: (x + 0.5) * 0.25,
      y: (y + 0.5) * 0.25,
      z: hit.z * 0.25,
      rotation: num("rotation"),
      kind: mode,
      registryKey:
        mode === "event"
          ? ($("eventkey") as HTMLInputElement).value
          : undefined,
      anchor: selected.anchor ?? [0, 0, 0],
    };
    if (mode === "decal")
      editor.decal({
        ...p,
        width: num("decalwidth"),
        height: num("decalheight"),
        order: 0,
      });
    else editor.place(p);
  }
}
const canvas = views[0].renderer.domElement;
let batch = false,
  batchToken = 0;
listen(document,
  "click",
  (e:Event) => {
    if (batch) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
listen(canvas,"pointerdown", (e:PointerEvent) => {
  if (e.button !== 0) return;
  if(rootPlacement){const hit=views[0].hit(e,level(),true,editor.cells,editor.bounds);if(hit&&'cell' in hit){const apply=rootPlacement;rootPlacement=null;syncPlacement();apply([hit.cell.x*.25,hit.cell.y*.25,hit.cell.z*.25]);}e.preventDefault();return;}
  if(referencePlacement){const hit=views[0].hit(e,level(),true,editor.cells,editor.bounds);if(hit){const pos=referencePosition(hit);referencePlacement=false;syncPlacement();perform(()=>Object.assign(editor.data.editor.reference,pos));message("参考已放置；可继续绘制");}e.preventDefault();return;}
  const hit = paintHit(e);
  if (!hit) return;
  try {
    strokeConfig = {...config()}; strokeSeen.clear();
    editor.begin();
    drawing = true;
    start = last = hit;
    last.pointer = { clientX: e.clientX, clientY: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    if (tool === "rectangle") views[0].rectangle(start, hit, mode === "volume" ? num("layer") + 1 : num("height"));
    else {
      apply(hit);
      update(["model", "event", "decal"].includes(mode) || editor.detached.instances + editor.detached.decals > 0);
    }
  } catch (err: any) {
    editor.cancel();
    drawing = false; strokeConfig=null;strokeSeen.clear();
    message(err.message, true);
  }
});
listen(canvas,"pointermove", (e:PointerEvent) => {
  if(referencePlacement){const hit=views[0].hit(e,level(),true,editor.cells,editor.bounds);if(hit)views.forEach(v=>v.reference.update({...editor.data.editor.reference,...referencePosition(hit)}));return;}
  const hit = paintHit(e);
  preview(hit);
  if (hit) $("coords").textContent = `X ${hit.x}　Y ${hit.y}　Z ${hit.z}`;
  if (drawing && tool === "rectangle") {
    if(mode==="selection"){views[0].rectangle(start,hit,level());return;}
    if(hit){try { const c=config(),n=(Math.abs(hit.x-start.x)+1)*(Math.abs(hit.y-start.y)+1);if(n>4096||n*c.thickness>250000)throw Error('矩形超过列数或体积预算');const points=[];for(let x=Math.min(start.x,hit.x);x<=Math.max(start.x,hit.x);x++)for(let y=Math.min(start.y,hit.y);y<=Math.max(start.y,hit.y);y++)points.push(...brushCandidates(editor,{...hit,x,y},c));views[0].rectangle(null,null,0);views[0].brushPreview(points);views[0].host.dataset.rectanglePreview="active"; }catch(err:any){views[0].brushPreview([]);message(err.message,true);} }
    return;
  }
  if (
    !drawing ||
    !hit ||
    tool === "rectangle" ||
    tool === "fill" ||
    !["height", "volume", "stack", "property"].includes(mode)
  )
    return;
  try {
    const steps = Math.max(Math.abs(hit.x - last.x), Math.abs(hit.y - last.y));
    if (!steps && hit.z === last.z && hit.face === last.face) return;
    if (steps > 512) throw Error("单次笔画跨度过大");
    if (needsSurface()) {
      // Sample the actual current face at each screen point; a different height
      // or a gap may lie between the endpoints of a stroke.
      const previous = last.pointer ?? { clientX: e.clientX, clientY: e.clientY };
      const samples = Math.max(1, Math.ceil(Math.hypot(e.clientX - previous.clientX, e.clientY - previous.clientY) / 4));
      for (let i = 1; i <= samples; i++) {
        const point = { clientX: previous.clientX + (e.clientX - previous.clientX) * i / samples,
          clientY: previous.clientY + (e.clientY - previous.clientY) * i / samples } as PointerEvent;
        const stepHit = paintHit(point);
        if (stepHit) apply(stepHit);
      }
    } else for (let i = 1; i <= steps; i++)
      apply({ ...hit, x: Math.round(last.x + ((hit.x - last.x) * i) / steps),
        y: Math.round(last.y + ((hit.y - last.y) * i) / steps) });
    last = hit;
    last.pointer = { clientX: e.clientX, clientY: e.clientY };
    update();
  } catch (err: any) {
    editor.cancel();
    drawing = false;strokeConfig=null;strokeSeen.clear();
    rebuild.invalidate();
    update(false, true);
    message(err.message, true);
  }
});
listen(canvas,"pointerup", async (e:PointerEvent) => {
  if (!drawing || batch) return;
  const token = ++batchToken;
  try {
    const hit = paintHit(e);
    if(mode==="selection"&&hit){ selectionBounds={min:[Math.min(start.x,hit.x),Math.min(start.y,hit.y),num("native-minz")],max:[Math.max(start.x,hit.x),Math.max(start.y,hit.y),num("native-maxz")]};showSelection();editor.cancel();mode="height";tool="brush";modeButtons();return;}
    if (tool === "rectangle" && hit) {
      if (!["height", "volume"].includes(mode))
        throw Error("矩形工具仅适用于地台和固定工作层三维绘制");
      const n =
        (Math.abs(hit.x - start.x) + 1) * (Math.abs(hit.y - start.y) + 1);
      if (n * config().thickness > 250000) throw Error("矩形体积超过25万格预算");
      if (n > 4096) throw Error("矩形超过4096列，请分批绘制");
      batch = true;
      let count = 0;
      const lo = { x: Math.min(start.x, hit.x), y: Math.min(start.y, hit.y) },
        hi = { x: Math.max(start.x, hit.x), y: Math.max(start.y, hit.y) };
      for (let x = lo.x; x <= hi.x; x++)
        for (let y = lo.y; y <= hi.y; y++) {
          if (token !== batchToken) return;
          apply({ ...hit, x, y });
          if (++count % 64 === 0) {
            message(`绘制 ${count}/${n} · Esc 可取消`);
            await new Promise(requestAnimationFrame);
          }
        }
    }
    editor.commit();
    update(["model", "event", "decal"].includes(mode));
    message(supportNotice() ?? "笔画完成 · 可整笔撤销");
  } catch (err: any) {
    editor.cancel();
    rebuild.invalidate();
    update(false, true);
    message(err.message, true);
  } finally {
    drawing = false;
    strokeConfig = null; strokeSeen.clear(); views[0].brushPreview([]);
    batch = false;
    views[0].rectangle(null, null, 0);
  }
});
function cancelActiveStroke(){rootPlacement=null;syncPlacement(); if(referencePlacement){referencePlacement=false;syncPlacement();syncReference();} if(!drawing)return; batchToken++;editor.cancel();drawing=false;strokeConfig=null;strokeSeen.clear();views[0].brushPreview([]);views[0].rectangle(null,null,0);rebuild.invalidate();update(false,true); }
listen(canvas,"pointercancel", () => {
  editor.cancel();
  drawing = false; strokeConfig=null;strokeSeen.clear();views[0].brushPreview([]);
  views[0].rectangle(null, null, 0);
  rebuild.invalidate();
  update(false, true);
});
listen(window,"blur", () => {
  rootPlacement=null;
  if (!drawing) return;
  batchToken++;
  editor.cancel();
  drawing = false; strokeConfig=null;strokeSeen.clear();views[0].brushPreview([]);
  views[0].rectangle(null, null, 0);
  rebuild.invalidate();
  update(false, true);
  message("窗口失焦，已取消未完成笔画");
});
listen(canvas,"contextmenu", (e:Event) => e.preventDefault());
function install(doc: any, name: string) {
  rebuild.invalidate();
  views.forEach((v) => v.clearAssets());
  editor = new EditorDocument(validateMap(doc));
  savedRevision = editor.doc.revision;
  nativeEditing=false;selectionBounds=null;showSelection();($("native-update") as HTMLButtonElement).disabled=true;referencePlacement=false;
  selected = null;
  ($("side") as HTMLSelectElement).value = String(editor.doc.sideColor ?? -1);
  views.forEach((v) => v.fit(editor.doc));
  $("filename").textContent = name;
  palette();
  update(true, true);
  const legacy = inspectLegacyTags(editor.doc);
  $("migrate-tags").hidden = legacy.converted === 0 && legacy.issues.length === 0;
  if (legacy.converted || legacy.issues.length)
    message(`旧标签：可迁移 ${legacy.converted} 面；需人工修正 ${legacy.issues.length} 面。原文件不会自动改写。`, legacy.issues.length > 0);
}
async function run(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    message(e.message, true);
  }
}
$("new").onclick = () =>
  run(async () => {
    if (await api.newMap()) install(createMap(), "未命名地图");
  });
$("open").onclick = () =>
  run(async () => {
    const r = await api.open();
    if (r) install(r.doc, r.name);
  });
$("migrate-tags").onclick = () => run(async () => {
  const { doc, report } = migrateLegacyTags(editor.doc);
  if (!report.converted) { message("没有需要迁移的旧部署标签"); return; }
  const saved = await api.save(doc, true);
  if (!saved) return;
  install(doc, saved.name);
  message(`迁移 ${report.converted} 个顶面标签为普通地面；已另存 ${saved.name}，原文件保留`);
});
async function save(as = false) {
  if(moduleBinding){cancelActiveStroke();await moduleBinding.save();return;}
  const r = await api.save(editor.doc, as);
  if (r) {
    savedRevision = editor.doc.revision;
    $("filename").textContent = r.name;
    message("已保存 " + r.name);
  }
}
$("duplicate").onclick = () =>
  run(async () => {
    const copy = { ...editor.doc, mapId: crypto.randomUUID(), revision: 0 };
    if (await api.newMap()) {
      install(copy, "新模块副本");
      savedRevision = -1;
      update(true, true);
      message("已复制为新模块身份，请保存；另存为则保留原身份");
    }
  });
$("save").onclick = () => run(() => save());
$("saveas").onclick = () => run(() => save(true));
$("export").onclick = () =>
  run(async () => {
    const r = await api.exportMap(editor.doc);
    if (r) message(r.message);
  });
$("undo").onclick = () => {
  rebuild.invalidate();
  if(moduleBinding)moduleBinding.undo();else editor.undo();
  update(true, true);
};
$("redo").onclick = () => {
  rebuild.invalidate();
  if(moduleBinding)moduleBinding.redo();else editor.redo();
  update(true, true);
};
function chooseBrushHex(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw Error("请输入 #RRGGBB 六位颜色");
  hex = hex.toLowerCase();
  let index = editor.data.palette.findIndex((p: string) => p.toLowerCase() === hex);
  if (index < 0) {
    if (editor.data.palette.length >= 64) throw Error("色板已满 64 色；请明确重染槽或删除未使用颜色");
    perform(() => { editor.data.palette.push(hex); });
    index = editor.data.palette.length - 1;
  }
  color = index;
  draftHex = hex;
  ($("color") as HTMLInputElement).value = hex;
  ($("color-hex") as HTMLInputElement).value = hex;
  wheel.set(hex);
  palette();
  message(`画笔已选色板 ${index + 1}；已有体素不变`);
}
function syncColorPanel() {
  const expanded = !$("color-panel").classList.contains("hidden");
  $("palette-toggle").setAttribute("aria-pressed", String(expanded));
  $("palette-toggle").setAttribute("aria-expanded", String(expanded));
  $("palette-toggle").classList.toggle("active", expanded);
  $("palette-toggle").textContent = `颜色区 · ${expanded ? "展开" : "关闭"}`;
}
$("palette-toggle").onclick = () => {
  $("color-panel").classList.toggle("hidden");
  syncColorPanel();
};
syncColorPanel();
$("use-color").onclick = () => { try { chooseBrushHex(draftHex); } catch (e: any) { message(e.message, true); } };
$("replace-color").onclick = () => {
  if (!window.confirm(`重染色板 ${color + 1}？所有引用此槽的已有体素都会改变。`)) return;
  perform(() => { editor.data.palette[color] = draftHex; });
  palette();
};
$("color").onchange = () => { try { chooseBrushHex(($("color") as HTMLInputElement).value); } catch (e: any) { message(e.message, true); } };
$("color-hex").onchange = () => { try { chooseBrushHex(($("color-hex") as HTMLInputElement).value); } catch (e: any) { message(e.message, true); } };
$("side").onchange = () =>
  perform(() => {
    editor.data.sideColor = num("side") < 0 ? null : num("side");
  });
$("section").onchange = () =>
  views[0].setSection(($("section") as HTMLInputElement).checked ? num("layer") + 1 : null);
$("showz").onchange = () => views[0].setZLabels(($("showz") as HTMLInputElement).checked);
$("layer").oninput = () => {
  if (($("section") as HTMLInputElement).checked)
    views[0].setSection(num("layer") + 1);
};
$("top").onclick = () => views[0].top();
$("home").onclick = () => views[0].fit(editor.doc);
$("previewhome").onclick = () => views[1].fit(editor.doc);
$("flat").onclick = () => {
  views.forEach((v) => (v.flat = !v.flat));
  $("flat").classList.toggle("active", views[1].flat);
  $("flat").setAttribute("aria-pressed", String(views[1].flat));
  update(false, true);
};
function assetList() {
  const query = ($("search") as HTMLInputElement).value.toLowerCase();
  $("assets").replaceChildren();
  for (const a of assets
    .filter((a) => ["glb", "png"].includes(a.type) && a.name.toLowerCase().includes(query))
    .slice(0, 300)) {
    const b = document.createElement("button");
    b.className = "asset" + (selectedIds.has(a.id) ? " active" : "");
    b.setAttribute("aria-pressed", String(selectedIds.has(a.id)));
    const glyph = document.createElement("span");
    glyph.className = "glyph";
    glyph.textContent =
      ({ glb: "◇", png: "▧", blend: "B", fbx: "F" } as any)[a.type] ?? "·";
    const name = document.createElement("span");
    name.textContent = a.name;
    const meta = document.createElement("small");
    meta.textContent =
      a.type.toUpperCase() +
      " · " +
      (a.status === "ready" ? Math.ceil(a.bytes / 1024) + " KB" : a.status);
    b.append(glyph, name, meta);
    b.onclick = (event) => {
      if (event.ctrlKey || event.shiftKey) {
        if (selectedIds.has(a.id)) selectedIds.delete(a.id);
        else selectedIds.add(a.id);
      } else { selectedIds.clear(); selectedIds.add(a.id); }
      selected = a;
      ($("anchor") as HTMLInputElement).value = (a.anchor ?? [0, 0, 0]).join(
        ",",
      );
      assetList();
      message(
        `已选择 ${selectedIds.size} 件 · 当前 ${a.name} · 锚点 ${(a.anchor ?? [0, 0, 0]).join(",")}`,
      );
    };
    $("assets").append(b);
    if (a.status === "ready" && ["glb", "png"].includes(a.type))
      void thumbnail(a, () => api.assetData(a.id))
        .then((url) => {
          if (!b.isConnected) return;
          const img = document.createElement("img");
          img.src = url;
          img.alt = a.name;
          img.style.cssText = "width:100%;height:45px;object-fit:contain";
          glyph.replaceWith(img);
        })
        .catch(() => {
          glyph.textContent = "预览失败";
        });
  }
  instanceList();
}
$("choose").onclick = () =>
  run(async () => {
    const r = await api.chooseAssets();
    if (r) {
      assets = r.assets;
      $("root").textContent = r.root;
      selected = null;
      selectedIds.clear();
      assetList();
      views.forEach((v) => v.clearAssets());
      update(true, true);
    }
  });
$("reload").onclick = () =>
  run(async () => {
    assets = await api.reloadAssets();
    await Promise.all(
      views.map((v) =>
        v.reloadObjects(editor.doc, (id: string) => api.assetData(id)),
      ),
    );
    assetList();
    update(false, true);
    message("资产已重载；实例位置保持");
  });
$("search").oninput = assetList;
$("locate").onclick = () =>
  run(async () => {
    if (selected) await api.locateAsset(selected.id, false);
  });
$("inspect").onclick = () => run(async () => {
  if (!selected) throw Error("请先选择资产");
  try { await inspectAsset($("asset-viewer") as HTMLDialogElement, selected, (id) => api.assetData(id)); }
  catch (error) { ($("asset-viewer") as HTMLDialogElement).close(); throw error; }
});
$("source").onclick = () =>
  run(async () => {
    if (selected) await api.locateAsset(selected.id, true);
  });
function rename(physical: boolean) {
  if (!selected) return;
  const dlg = $("rename-dialog") as HTMLDialogElement;
  ($("rename-input") as HTMLInputElement).value = selected.name;
  dlg.onclose = () => {
    if (dlg.returnValue === "ok")
      void run(async () => {
        const changed = await api.renameAsset(
          selected.id,
          ($("rename-input") as HTMLInputElement).value,
          physical,
        );
        if (changed) {
          Object.assign(selected, changed);
          assetList();
        }
      });
  };
  dlg.showModal();
}
$("anchor-save").onclick = () =>
  run(async () => {
    if (!selected) throw Error("请先选择模型");
    const values = ($("anchor") as HTMLInputElement).value
      .split(",")
      .map(Number);
    Object.assign(selected, await api.setAnchor(selected.id, values));
    message("资产锚点已保存，影响之后新放置的实例");
  });
$("rename").onclick = () => rename(false);
$("renamefile").onclick = () => rename(true);
let batchIds: string[] = [], batchPreview: any = null;
const batchDialog = $("batch-dialog") as HTMLDialogElement;
function batchOptions() {
  const field = (id: string) => ($(id) as HTMLInputElement).value;
  return { prefix: field("batch-prefix"), kit: field("batch-kit"),
    category: field("batch-category"), subject: field("batch-subject"),
    variant: field("batch-variant"), suffix: field("batch-suffix"),
    separator: field("batch-separator"), numberStart: Number(field("batch-start")),
    numberWidth: Number(field("batch-width")) };
}
batchDialog.querySelectorAll("input").forEach((input) => listen(input,"input", () => {
  batchPreview = null;
  ($("batch-commit") as HTMLButtonElement).disabled = true;
  $("batch-result").textContent = "参数已变化，请重新预检。";
}));
$("batchrename").onclick = () => {
  batchIds = [...selectedIds];
  if (!batchIds.length) { message("请在资产库选择一件或多件 GLB/PNG", true); return; }
  batchPreview = null;
  ($("batch-commit") as HTMLButtonElement).disabled = true;
  $("batch-result").textContent = `已选择 ${batchIds.length} 件；可用 Ctrl/Shift 多选。`;
  batchDialog.showModal();
};
$("batch-preview").onclick = () => run(async () => {
  const plan = await api.previewRename(batchIds, batchOptions(), ($("batch-physical") as HTMLInputElement).checked);
  batchPreview = plan;
  const result = $("batch-result");
  result.replaceChildren();
  const table = document.createElement("table");
  for (const item of plan.items) {
    const tr = document.createElement("tr");
    const oldName = document.createElement("td"), next = document.createElement("td");
    oldName.textContent = item.oldName;
    next.textContent = item.newName + (plan.physical ? ` · ${item.moves.length} 文件` : " · 仅显示名");
    tr.append(oldName, next);
    table.append(tr);
  }
  result.append(table);
  ($("batch-commit") as HTMLButtonElement).disabled = false;
  message(`命名预检通过：${plan.items.length} 件，${plan.fileCount} 个物理文件`);
});
$("batch-commit").onclick = () => run(async () => {
  if (!batchPreview) throw Error("请先预检");
  const changed = await api.renameBatch(batchIds, batchOptions(), ($("batch-physical") as HTMLInputElement).checked);
  if (!changed) return;
  assets = changed;
  selected = assets.find((a) => a.id === selected?.id) ?? null;
  assetList();
  batchDialog.close();
  message(`已命名 ${batchPreview.items.length} 件；资产身份保持不变`);
  batchPreview = null;
});
listen(document,"keydown", (e:KeyboardEvent) => {
  if(document.body.classList.contains("workshop") && !$("app").offsetParent)return;
  if (e.key === "Escape") {
    if(rootPlacement){rootPlacement=null;syncPlacement();message('已取消 Root 选点');return;}
    if(referencePlacement){referencePlacement=false;syncReference();message("已取消参考放置，原位置不变");return;}
    batchToken++;
    editor.cancel();
    drawing = false;strokeConfig=null;strokeSeen.clear();views[0].brushPreview([]);
    views[0].rectangle(null, null, 0);
    rebuild.invalidate();
    update(false, true);
    message("已取消笔画");
    return;
  }
  const command = batch ? null : editorCommand(e);
  if (!command) return;
  if (command === "save") {
    e.preventDefault();
    void run(() => save(e.shiftKey));
  }
  if (command === "undo" || command === "redo") {
    e.preventDefault();
    rebuild.invalidate();
    if(moduleBinding)command === "redo"?moduleBinding.redo():moduleBinding.undo();else command === "redo" ? editor.redo() : editor.undo();
    update(true, true);
  }
});
void api.info().then((info:any)=>{const el=document.createElement('small');el.id='build-info';el.textContent=`${info.version} · ${info.commit.slice(0,8)} · ${info.builtAt}`;el.title=`源码指纹 ${info.sourceFingerprint}\n资源包 ${info.resourcePath}\n程序 ${info.executable}`;document.querySelector('footer')!.append(el);}).catch((e:any)=>message(e.message,true));
let selectionBounds:any=null;
let nativeEditing=false;
function wholeBounds(){if(!editor.cells.size)throw Error('没有可选体素');const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const c of editor.cells.values())[c.x,c.y,c.z].forEach((v,i)=>{min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v);});return {min,max};}
function showSelection(){$('native-selection').textContent=selectionBounds?`范围 ${selectionBounds.min.join(',')} → ${selectionBounds.max.join(',')}`:'未选择范围';}
$('native-select').onclick=()=>{cancelActiveStroke();mode='selection';tool='rectangle';modeButtons();message('拖动框选XY；Z范围由最低/最高层指定');};
$('native-all').onclick=()=>{try{selectionBounds=wholeBounds();showSelection();}catch(e:any){message(e.message,true);}};
$('native-open').onclick=()=>run(async()=>{cancelActiveStroke();const r=await api.openNative();if(!r)return;install(r.doc,'原生资产：'+r.name);nativeEditing=true;($('native-update') as HTMLButtonElement).disabled=false;($('native-name') as HTMLInputElement).value=r.name;selectionBounds=wholeBounds();showSelection();message('已打开原生体素源；编辑完成后使用更新当前原生资产');});
async function saveNative(update=false){cancelActiveStroke();const bounds=update?wholeBounds():selectionBounds;if(!bounds)throw Error('请先框选或选择全部体素');let anchor:any=($('native-anchor') as HTMLSelectElement).value;if(anchor==='custom')anchor=($('native-anchorxyz') as HTMLInputElement).value.split(',').map(Number);const r=await api.saveNative(editor.doc,bounds,{name:($('native-name') as HTMLInputElement).value,anchor:update&&typeof anchor==='string'?undefined:anchor},update);if(!r)return;assets=r.assets;$('root').textContent=r.root;selected=assets.find(a=>a.id===r.assetId);selectedIds=new Set([r.assetId]);assetList();if(update)savedRevision=editor.doc.revision;await Promise.all(views.map(v=>v.reloadObjects(editor.doc,(id:string)=>api.assetData(id))));message('已保存原生源与GLB；资产库可重复摆放，同ID更新保持实例位置');}
$('native-save').onclick=()=>run(()=>saveNative(false));$('native-update').onclick=()=>run(()=>saveNative(true));
$('model-glb').onclick=()=>run(async()=>{cancelActiveStroke();message('正在导出GLB…');const r=await api.exportModel(editor.doc,false);if(r)message(r.message);});
$('model-fbx').onclick=()=>run(async()=>{cancelActiveStroke();message('正在调用已安装Blender转换FBX…');const r=await api.exportModel(editor.doc,true);if(r)message(r.message);});
function referencePosition(hit:any){const axis=Math.floor(hit.face/2);return {x:(hit.x+(axis===0?0:.5))*.25,y:(hit.y+(axis===1?0:.5))*.25,z:(hit.z+(axis===2?0:.5))*.25};}
function syncReference(){const r=editor.data.editor?.reference;views.forEach(v=>v.reference.update(r));$("reference-name").textContent=r?`${r.name} · ${r.pixelWidth}×${r.pixelHeight}`:'未导入参考';if(!r)return;const fields:any={'reference-height':r.height,'reference-position':[r.x,r.y,r.z].join(','),'reference-bounds':[r.contentTop,r.contentBottom].join(','),'reference-foot':[r.footX,r.footY].join(',')};for(const [id,value]of Object.entries(fields))if(document.activeElement!==$(id))($(id) as HTMLInputElement).value=String(value);($("reference-visible") as HTMLInputElement).checked=r.visible;}
function referenceChange(fn:(r:any)=>void){cancelActiveStroke();if(!editor.data.editor?.reference){message('请先导入PNG参考',true);return;}perform(()=>fn(editor.data.editor.reference));}
$("reference-import").onclick=()=>run(async()=>{cancelActiveStroke();const reference=await api.importReference();if(reference)perform(()=>{editor.data.editor={...editor.data.editor,reference};});});
$("reference-move").onclick=()=>{cancelActiveStroke();if(!editor.data.editor?.reference){message('请先导入PNG参考',true);return;}referencePlacement=true;views[0].brushPreview([]);message('点击真实表面放置参考；Esc取消；普通绘制暂不生效');};
$("reference-cancel").onclick=()=>{referencePlacement=false;syncReference();};
$("reference-reset").onclick=()=>referenceChange(r=>Object.assign(r,{x:0,y:0,z:0}));
$("reference-height").onchange=()=>referenceChange(r=>r.height=num('reference-height'));
$("reference-visible").onchange=()=>referenceChange(r=>r.visible=($("reference-visible") as HTMLInputElement).checked);
$("reference-position").onchange=()=>referenceChange(r=>{const p=($("reference-position") as HTMLInputElement).value.split(',').map(Number);if(p.length!==3)throw Error('位置需要三个米坐标');[r.x,r.y,r.z]=p;});
$("reference-bounds").onchange=()=>referenceChange(r=>{const p=($("reference-bounds") as HTMLInputElement).value.split(',').map(Number);if(p.length!==2)throw Error('请输入有效上下边界');[r.contentTop,r.contentBottom]=p;});
$("reference-foot").onchange=()=>referenceChange(r=>{const p=($("reference-foot") as HTMLInputElement).value.split(',').map(Number);if(p.length!==2)throw Error('请输入脚底坐标');[r.footX,r.footY]=p;});
palette();
modeButtons();
syncPlacement();
update(false, true);
function frame() {
  if(disposed)return;
  if($("app").offsetParent)views.forEach((v) => v.draw());
  animation=requestAnimationFrame(frame);
}
let disposed=false,animation=0;
frame();
const resourceTimer=setInterval(() => {
  $("quads").dataset.resources = JSON.stringify(
    views.map((v) => ({
      geometry: v.renderer.info.memory.geometries,
      textures: v.renderer.info.memory.textures,
      programs: v.renderer.info.programs?.length ?? 0,
      models: v.cache.size,
      decals: v.textures.size,
      drawCalls: v.renderer.info.render.calls,
    })),
  );
}, 500);
export const moduleEditor={
 bind(next:EditorDocument,name:string,binding:NonNullable<typeof moduleBinding>){cancelActiveStroke();rebuild.invalidate();rebuild.sessionId=binding.sessionId;views.forEach(v=>v.clearAssets());editor=next;moduleBinding=binding;selected=null;referencePlacement=false;selectionBounds=null;mode='height';tool='brush';color=0;$("filename").textContent=name||'未命名草稿';($("side") as HTMLSelectElement).value=String(editor.doc.sideColor??-1);palette();modeButtons();views.forEach(v=>{v.resize();v.fit(editor.doc);});update(true,true);},
 refresh(){palette();syncReference();update(false,true);},
 cancel:cancelActiveStroke,
 resize(){views.forEach(v=>v.resize());},
 pickRoot(fn:(root:[number,number,number])=>void){cancelActiveStroke();rootPlacement=fn;syncPlacement();message('点击体素局部底角设置 Root；Esc 取消');},
 selection(){cancelActiveStroke();return structuredClone(selectionBounds);},
 unbind(){cancelActiveStroke();rebuild.invalidate();moduleBinding=null;views.forEach(v=>{v.clearAssets();v.reference.update(undefined);v.setRoot();});},
 dispose(){if(disposed)return;cancelActiveStroke();disposed=true;cancelAnimationFrame(animation);clearInterval(resourceTimer);listeners.splice(0).forEach(off=>off());wheel.dispose();worker.terminate();views.forEach(v=>v.dispose());},
};
window.addEventListener('beforeunload',()=>moduleEditor.dispose(),{once:true});
