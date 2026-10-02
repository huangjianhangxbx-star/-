import { EditorDocument, createMap, validateMap } from "../core/document.ts";
import { MapView } from "./view.ts";
import { thumbnail } from "./thumbnail.ts";
import { RebuildQueue } from "../core/rebuild.ts";
import { affectedChunks } from "../core/mesher.ts";
declare global {
  interface Window {
    workbench: any;
  }
}
const $ = (id: string) => document.getElementById(id)!;
const api = window.workbench;
$("app").innerHTML =
  `<header><strong>星骸 / 地图工坊<small>MAP EDITOR · 0.1</small></strong><nav><button id="new">新建</button><button id="open">打开</button><button id="save">保存</button><button id="saveas">另存为</button><button id="duplicate">复制模块</button><button id="undo">撤销</button><button id="redo">重做</button><button id="export" class="primary">导出团结源</button></nav><span id="filename" class="filename">未命名地图</span></header>
<div class="layout"><aside><div class="section-label">编辑内容</div><div class="modes" id="modes">${[
    ["height", "地台"],
    ["volume", "三维"],
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
    ["erase", "擦除"],
  ]
    .map(([v, n]) => `<button data-tool="${v}">${n}</button>`)
    .join(
      "",
    )}</div><div class="pair"><label class="field"><span>顶面高度</span><input id="height" aria-label="顶面高度" type="number" value="0" step="1" min="-8192" max="8192"></label><label class="field"><span>厚度</span><input id="thickness" aria-label="厚度" type="number" value="1" min="1" max="256"></label></div><label class="field"><span>三维工作层 / Z</span><input id="layer" type="number" value="0" min="-8192" max="8192" aria-label="三维工作层"></label><label class="field"><span>侧面与底面</span><select id="side"><option value="-1">继承体素颜色</option>${Array.from({ length: 8 }, (_, i) => `<option value="${i}">固定色板 ${i + 1}</option>`).join("")}</select></label><label class="field"><span><input id="section" type="checkbox"> 剖切：隐藏工作层上方</span></label><div id="palette" class="swatches"></div><label class="field"><span>当前色板颜色</span><input id="color" type="color" value="#59737a"></label><label class="field"><span>表面属性</span><select id="tag"><option value="walk">可行走</option><option value="deploy">可部署</option><option value="obstacle">障碍</option><option value="highground">高台</option></select></label><label class="field"><span>摆放旋转</span><select id="rotation"><option>0</option><option>90</option><option>180</option><option>270</option></select></label><div class="pair"><label class="field"><span>贴花宽 / 米</span><input id="decalwidth" type="number" value="1" min="0.25" step="0.25"></label><label class="field"><span>贴花长 / 米</span><input id="decalheight" type="number" value="1" min="0.25" step="0.25"></label></div><label class="field"><span>事件注册键</span><input id="eventkey" value="sample.switch" maxlength="80"></label><label class="field"><span>模型锚点 X / Y / Z（米）</span><input id="anchor" value="0,0,0" aria-label="模型锚点"></label><button id="anchor-save">保存此资产锚点</button><p class="hint" id="modehint"></p><div class="section-label">已放置内容 · 点击移除</div><div id="instances" class="instance-list"></div></aside>
<section class="workspace"><div class="views"><div class="view"><div id="editview" class="viewport"></div><div class="view-label">绘制视图</div><div class="view-actions"><button id="top">俯视</button><button id="home">复位</button></div><div id="coords" class="view-foot">X —　Y —　Z —</div><div class="ruler">1 体素 = 0.25 m</div></div><div class="view preview"><div id="preview" class="viewport"></div><div class="view-label">游戏角度预览</div><div class="view-actions"><button id="flat">无光照校色</button><button id="previewhome">复位</button></div><div class="view-foot">拖动旋转 · 滚轮缩放</div></div></div><section class="library"><div class="library-bar"><strong>资产库</strong><button id="choose">选择目录</button><button id="reload">重载</button><input id="search" placeholder="搜索名称" aria-label="搜索资产"><span id="root" class="root">选择 GLB / PNG 目录；源文件保留在 Blender 中</span><button id="locate">定位文件</button><button id="source">定位源模型</button><button id="rename">改显示名</button><button id="renamefile">改文件名</button></div><div id="assets" class="asset-list"><div class="empty">从资产目录开始，或直接在上方绘制地台。</div></div></section></section></div><footer class="status"><span id="message">左键绘制 · 右键旋转 · 中键平移 · Esc 取消笔画</span><span id="count">体素 0</span><span id="quads">四边面 0</span><span class="mono">0.25 m / Z ↑</span></footer><dialog id="rename-dialog"><form method="dialog"><p>输入新的资源名称</p><input id="rename-input" maxlength="80"><div class="rename"><button value="cancel">取消</button><button value="ok">确定</button></div></form></dialog>`;
let editor = new EditorDocument(),
  mode = "height",
  tool = "brush",
  color = 0,
  selected: any = null,
  assets: any[] = [],
  drawing = false,
  start: any = null,
  last: any = null,
  savedRevision = 0;
const views = [
  new MapView($("editview"), true),
  new MapView($("preview"), false),
];
const num = (id: string) => Number(($(id) as HTMLInputElement).value);
function message(text: string, error = false) {
  $("message").textContent = text;
  document.querySelector("footer")!.classList.toggle("error", error);
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
    b.onclick = () => {
      color = i;
      ($("color") as HTMLInputElement).value = hex;
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
  void api.dirty(doc.revision !== savedRevision);
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
    update(objects);
    message("已修改地图");
  } catch (e: any) {
    editor.cancel();
    update(false, true);
    message(e.message, true);
  }
}
function modeButtons() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  document
    .querySelectorAll<HTMLButtonElement>("[data-tool]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  $("modehint").textContent = (
    {
      height: "顶面0也是有效地台。三维编辑过的列需用三维工具继续修改。",
      volume: "工作层是要增删的体素底面。视角旋转不改变工作层。",
      property:
        "点击地形任意表面赋予标签。标签不改变地形，也不等于已接入寻路。",
      model: "从资产库选择GLB，点击地面放置。模型按原始单位与根锚点摆放。",
      event:
        "选择GLB作为事件预览。团结端须将事件注册键映射到功能预制体；预览模型仅供摆放。",
      decal: "选择PNG，点击地面放置水平贴花。墙体正常遮挡。",
    } as any
  )[mode];
}
document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.mode!;
      modeButtons();
    }),
);
document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach(
  (b) =>
    (b.onclick = () => {
      tool = b.dataset.tool!;
      modeButtons();
    }),
);
const level = () => (mode === "volume" ? num("layer") : num("height"));
function apply(hit: any) {
  const x = hit.x,
    y = hit.y;
  if (mode === "height") {
    if (tool === "erase") editor.eraseColumn(x, y);
    else if (tool === "fill") editor.flood(x, y, hit.z - 1, color);
    else editor.height(x, y, num("height"), num("thickness"), color);
  } else if (mode === "volume") {
    if (tool === "fill") editor.flood(x, y, num("layer"), color);
    else editor.volume(x, y, num("layer"), color, tool === "erase");
  } else if (mode === "property")
    editor.surface(
      x,
      y,
      hit.z,
      hit.face ?? 4,
      tool === "erase" ? "" : ($("tag") as HTMLSelectElement).value,
    );
  else {
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
document.addEventListener(
  "click",
  (e) => {
    if (batch) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const hit = views[0].hit(
    e,
    level(),
    !["height", "volume"].includes(mode) || tool === "fill",
  );
  if (!hit) return;
  try {
    editor.begin();
    drawing = true;
    start = last = hit;
    canvas.setPointerCapture(e.pointerId);
    if (tool !== "rectangle") apply(hit);
    update(["model", "event", "decal"].includes(mode));
  } catch (err: any) {
    editor.cancel();
    drawing = false;
    message(err.message, true);
  }
});
canvas.addEventListener("pointermove", (e) => {
  const hit = views[0].hit(
    e,
    level(),
    !["height", "volume"].includes(mode) || tool === "fill",
  );
  views[0].hover(hit, level());
  if (hit) $("coords").textContent = `X ${hit.x}　Y ${hit.y}　Z ${hit.z}`;
  if (
    !drawing ||
    !hit ||
    tool === "rectangle" ||
    tool === "fill" ||
    !["height", "volume", "property"].includes(mode)
  )
    return;
  try {
    const steps = Math.max(Math.abs(hit.x - last.x), Math.abs(hit.y - last.y));
    if (steps > 512) throw Error("单次笔画跨度过大");
    for (let i = 1; i <= steps; i++)
      apply({
        ...hit,
        x: Math.round(last.x + ((hit.x - last.x) * i) / steps),
        y: Math.round(last.y + ((hit.y - last.y) * i) / steps),
      });
    last = hit;
    update();
  } catch (err: any) {
    editor.cancel();
    drawing = false;
    update(false, true);
    message(err.message, true);
  }
});
canvas.addEventListener("pointerup", async (e) => {
  if (!drawing || batch) return;
  const token = ++batchToken;
  try {
    const hit = views[0].hit(e, level());
    if (tool === "rectangle" && hit) {
      const n =
        (Math.abs(hit.x - start.x) + 1) * (Math.abs(hit.y - start.y) + 1);
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
    message("笔画完成 · 可整笔撤销");
  } catch (err: any) {
    editor.cancel();
    update(false, true);
    message(err.message, true);
  } finally {
    drawing = false;
    batch = false;
  }
});
canvas.addEventListener("pointercancel", () => {
  editor.cancel();
  drawing = false;
  update(false, true);
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
function install(doc: any, name: string) {
  views.forEach((v) => v.clearAssets());
  editor = new EditorDocument(validateMap(doc));
  savedRevision = editor.doc.revision;
  selected = null;
  ($("side") as HTMLSelectElement).value = String(editor.doc.sideColor ?? -1);
  views.forEach((v) => v.fit(editor.doc));
  $("filename").textContent = name;
  palette();
  update(true, true);
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
async function save(as = false) {
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
  editor.undo();
  update(true, true);
};
$("redo").onclick = () => {
  editor.redo();
  update(true, true);
};
$("color").onchange = () =>
  perform(() => {
    editor.data.palette[color] = ($("color") as HTMLInputElement).value;
    palette();
  });
$("side").onchange = () =>
  perform(() => {
    editor.data.sideColor = num("side") < 0 ? null : num("side");
  });
$("section").onchange = () =>
  views.forEach((v) =>
    v.setSection(
      ($("section") as HTMLInputElement).checked ? num("layer") + 1 : null,
    ),
  );
$("layer").oninput = () => {
  if (($("section") as HTMLInputElement).checked)
    views.forEach((v) => v.setSection(num("layer") + 1));
};
$("top").onclick = () => views[0].top();
$("home").onclick = () => views[0].fit(editor.doc);
$("previewhome").onclick = () => views[1].fit(editor.doc);
$("flat").onclick = () => {
  views.forEach((v) => (v.flat = !v.flat));
  $("flat").classList.toggle("active", views[1].flat);
  update(false, true);
};
function assetList() {
  const query = ($("search") as HTMLInputElement).value.toLowerCase();
  $("assets").replaceChildren();
  for (const a of assets
    .filter((a) => a.name.toLowerCase().includes(query))
    .slice(0, 300)) {
    const b = document.createElement("button");
    b.className = "asset" + (selected?.id === a.id ? " active" : "");
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
    b.onclick = () => {
      selected = a;
      ($("anchor") as HTMLInputElement).value = (a.anchor ?? [0, 0, 0]).join(
        ",",
      );
      assetList();
      message(
        "已选择 " + a.name + " · 锚点 " + (a.anchor ?? [0, 0, 0]).join(","),
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
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    batchToken++;
    editor.cancel();
    drawing = false;
    update(false, true);
    message("已取消笔画");
    return;
  }
  if (batch || (e.target as HTMLElement).matches("input,select,textarea"))
    return;
  if (e.ctrlKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    void run(() => save(e.shiftKey));
  }
  if (e.ctrlKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? editor.redo() : editor.undo();
    update(true, true);
  }
});
palette();
modeButtons();
update(false, true);
function frame() {
  views.forEach((v) => v.draw());
  requestAnimationFrame(frame);
}
frame();
setInterval(() => {
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
