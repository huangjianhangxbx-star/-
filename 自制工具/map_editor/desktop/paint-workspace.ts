import { CanvasSession } from "../core/workshop-canvases.ts";
import { meshMap } from "../core/mesher.ts";
import { appearanceColor } from "../core/appearance-color.ts";
import { MapView } from "./view.ts";
import { CanvasView } from "./canvas-view.ts";
import { SurfacePaintTools } from "./surface-paint-tools.ts";
import { mountDisplayMenu } from "./viewport-display-ui.ts";
import { attachAxisNavigation } from "./axis-navigation.ts";
const api = (window as any).paintClient,
  $ = (id: string) => document.getElementById(id)!;
let snapshot: any,
  session: CanvasSession,
  tools: SurfacePaintTools,
  busy = false,
  invalid = false,
  hex = "#ffffff";
const view = new MapView($("paint-view"), true, false),
  canvases = new CanvasView(view);
view.display.set({ preset: "albedo" });
mountDisplayMenu(view.display, $("paint-display"), false, "显示");
attachAxisNavigation(view, () => tools?.cancel());
const message = (s: string) => ($("paint-status").textContent = s);
function install(next: any) {
  snapshot = next;
  session = new CanvasSession(next.model);
  session.activeId = next.canvasId;
  session.setEditObject(next.objectId);
  view.update(session.editor.doc, meshMap(session.editor.doc));
  canvases.update(session);
  $("paint-title").textContent = session.model.name;
  $("paint-scope").textContent =
    `目标：${session.model.objects!.find((o) => o.objectId === next.objectId)!.name} / ${session.active.name} / ${session.active.voxelStepM} m · 内部手绘`;
  if (!busy) tools?.sync();
}
async function command(kind: string, source?: any) {
  if (busy || invalid) return;
  busy = true;
  document.body.dataset.busy = "true";
  message("等待主会话确认…");
  try {
    const next = await api.command({
      leaseId: snapshot.leaseId,
      commandId: crypto.randomUUID(),
      baseRevision: snapshot.model.revision,
      kind,
      ...(source ? { source } : {}),
    });
    install(next);
    message(
      kind === "save"
        ? "项目已保存"
        : "已提交至主会话 · 可撤销；未保存修改关闭窗口后仍保留",
    );
  } catch (e: any) {
    message(e.message);
  } finally {
    busy = false;
    document.body.dataset.busy = "false";
    tools?.sync();
  }
}
const choose = (color: string) => {
  hex = color;
  ($("paint-color") as HTMLInputElement).value = color;
  ($("paint-hex") as HTMLInputElement).value = color;
};
async function start() {
  install(await api.ready());
  tools = new SurfacePaintTools({
    host: $("paint-view"),
    canvas: view.renderer.domElement,
    toolbar: $("paint-toolbar"),
    state: () =>
      invalid || busy
        ? null
        : {
            source: session.active.paintSource,
            step: session.active.voxelStepM,
            context: snapshot.leaseId,
          },
    hit: (e) => canvases.paintHit(e),
    preview: (source) => canvases.previewPaint(source),
    color: () => hex,
    baseColor: (hit) => {
      const cell = session.editor.cells.get(`${hit.x},${hit.y},${hit.z}`)!;
      return session.model.palette[
        hit.face === 4 ? cell.color : (session.model.sideColor ?? cell.color)
      ];
    },
    authorColor: (hit, paint) => {
      const c = session.editor.cells.get(`${hit.x},${hit.y},${hit.z}`)!;
      return appearanceColor(
        session.model.palette[
          hit.face === 4 ? c.color : (session.model.sideColor ?? c.color)
        ],
        paint,
        session.active.faceTone?.faces[hit.key],
      );
    },
    pick: choose,
    commit: (source) => void command("paint", source),
    prepare: () => {},
    changed: () => view.display.paintMode(!!tools?.active),
    history: (kind) => void command(kind),
    save: () => void command("save"),
    message,
  });
  tools.mode.value = "paint";
  tools.mode.dispatchEvent(new Event("change"));
  tools.element.style.flexDirection = "column";
  tools.element.style.alignItems = "stretch";
  view.fit(session.editor.doc);
  for (const color of session.model.palette) {
    const b = document.createElement("button");
    b.style.background = color;
    b.title = color;
    b.setAttribute("aria-label", "颜色 " + color);
    b.onclick = () => choose(color);
    $("paint-palette").append(b);
  }
  message("已连接同一资产会话 · 修改画笔不会修改体素几何");
}
$("paint-save").onclick = () => void command("save");
$("paint-return").onclick = () => void api.return();
$("paint-undo").onclick = () => void command("undo");
$("paint-redo").onclick = () => void command("redo");
$("paint-home").onclick = () => view.fit(session.editor.doc);
$("paint-color").oninput = (e) => choose((e.target as HTMLInputElement).value);
$("paint-hex").onchange = (e) => {
  const v = (e.target as HTMLInputElement).value;
  if (/^#[0-9a-f]{6}$/i.test(v)) choose(v);
};
api.onInvalid((reason: string) => {
  invalid = true;
  tools?.cancel();
  document.body.dataset.invalid = "true";
  message(reason);
});
api.onMenu((kind: string) => {
  if (["save", "undo", "redo"].includes(kind)) void command(kind);
});
let frame = 0;
function draw() {
  if (!document.hidden && !invalid) view.draw();
  frame = requestAnimationFrame(draw);
}
draw();
window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(frame);
  tools?.dispose();
  canvases.update(null);
  view.dispose();
});
start().catch((e: any) => {
  invalid = true;
  message(e.message);
});

window.addEventListener(
  "keydown",
  (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.stopImmediatePropagation();
      void command("save");
    }
  },
  true,
);
