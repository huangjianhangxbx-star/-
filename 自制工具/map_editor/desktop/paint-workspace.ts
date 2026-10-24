import { CanvasSession } from "../core/workshop-canvases.ts";
import { meshMap } from "../core/mesher.ts";
import { appearanceColor } from "../core/appearance-color.ts";
import { PaintSurfaceDomain } from "../core/paint-surface-domain.ts";
import { MapView } from "./view.ts";
import { CanvasView } from "./canvas-view.ts";
import { SurfacePaintTools } from "./surface-paint-tools.ts";
import { PaintCommandQueue } from "./paint-command-queue.ts";
import { bindColorWheel, hexToHsv, hsvToHex } from "./color-wheel.ts";
import { SymmetryControls, type SymmetryTarget } from "./symmetry-controls.ts";
import { mountDisplayMenu } from "./viewport-display-ui.ts";
import { attachAxisNavigation } from "./axis-navigation.ts";
const api = (window as any).paintClient,
  $ = (id: string) => document.getElementById(id)!;
let snapshot: any,
  session: CanvasSession,
  tools: SurfacePaintTools,
  queue: PaintCommandQueue,
  domain: PaintSurfaceDomain,
  invalid = false,
  hex = "#ffffff",
  previous = "#ffffff",
  recent: string[] = [],
  leaving = false;
const view = new MapView($("paint-view"), true, false),
  canvases = new CanvasView(view);
view.display.set({ preset: "albedo" });
mountDisplayMenu(view.display, $("paint-display"), false, "显示");
attachAxisNavigation(view, () => {});
const message = (s: string) => ($("paint-status").textContent = s);
function target(): SymmetryTarget | null {
  if (!session) return null;
  const c = session.active,
    o = session.model.objects!.find((o) => o.objectId === snapshot.objectId)!;
  return {
    key: session.model.assetId + ":" + c.canvasId + ":" + o.objectId,
    origin: c.originTicks.map((n) => n * 0.03125) as [number, number, number],
    step: c.voxelStepM,
    cells: c.cells.filter((c) => o.cellKeys!.includes(`${c.x},${c.y},${c.z}`)),
  };
}
const symmetry = new SymmetryControls(
  $("paint-symmetry"),
  target,
  (s) => {
    const t = target();
    if (t) canvases.symmetryGuides(s, t.origin, t.step);
  },
  message,
);
let installedRevision = -1;
function install(next: any, source?: any) {
  snapshot = next;
  if (installedRevision !== next.model.revision || !session) {
    installedRevision = next.model.revision;
    session = new CanvasSession(next.model);
    session.activeId = next.canvasId;
    session.setEditObject(next.objectId);
    view.update(session.editor.doc, meshMap(session.editor.doc));
    canvases.update(session);
    const owner = session.model.objects!.find(
      (o) => o.objectId === next.objectId,
    )!;
    domain = new PaintSurfaceDomain(
      session.active.cells,
      new Set(owner.cellKeys),
      session.active.voxelStepM,
    );
    $("paint-title").textContent = session.model.name;
    $("paint-scope").textContent =
      `目标：${owner.name} / ${session.active.name} / ${session.active.voxelStepM} m · 内部手绘`;
    symmetry.sync();
    tools?.sync();
  }
  canvases.previewPaint(source);
  tools?.refreshPreview();
}
async function command(kind: string) {
  try {
    tools?.cancel();
    await queue.command(kind);
    message(kind === "save" ? "项目已保存" : "已确认 · 可整笔撤销");
  } catch (e) {
    message((e as Error).message);
  }
}
const wheel = bindColorWheel(
  $("paint-wheel") as HTMLCanvasElement,
  hex,
  (color) => choose(color, false),
);
function choose(color: string, record = true) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    message("请输入六位HEX颜色，例如 #ab7850");
    return;
  }
  const next = color.toLowerCase();
  if (record && next !== hex) previous = hex;
  hex = next;
  ($("paint-color") as HTMLInputElement).value = hex;
  ($("paint-hex") as HTMLInputElement).value = hex;
  wheel.set(hex);
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  ($("paint-rgb") as HTMLInputElement).value = rgb.join(",");
  ($("paint-hsv") as HTMLInputElement).value = hexToHsv(hex)
    .map((v, i) => Math.round(v * (i ? 100 : 1)))
    .join(",");
  $("paint-previous").style.background = previous;
  if (record) {
    recent = [hex, ...recent.filter((c) => c !== hex)].slice(0, 12);
    $("paint-recent").replaceChildren(
      ...recent.map((c) => {
        const b = document.createElement("button");
        b.style.background = c;
        b.title = c;
        b.onclick = () => choose(c);
        return b;
      }),
    );
  }
}
async function start() {
  document.body.dataset.busy = "false";
  install(await api.ready());
  queue = new PaintCommandQueue(
    snapshot,
    (i) => api.command(i),
    (s, source) => {
      install(s, source);
      document.body.dataset.busy = String(queue?.pending > 0 && !queue?.failed);
      $("paint-queue-actions").hidden = !queue?.failed;
      if (queue?.failed) tools?.cancel();
      message(
        queue?.failed
          ? "提交失败 · 后续笔触冻结，可重试或放弃"
          : "等待确认 " + (queue?.pending ?? 0) + " 笔 · 可继续绘画",
      );
    },
  );
  view.renderer.domElement.addEventListener(
    "pointerdown",
    (e) => {
      if (!symmetry.picking || e.button !== 0) return;
      const p = canvases.paintHit(e);
      if (!p) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const t = target()!;
      symmetry.setPoint(
        [p.x + 0.5, p.y + 0.5, p.z + 0.5].map(
          (n, a) => t.origin[a] + n * t.step,
        ) as [number, number, number],
      );
    },
    true,
  );
  tools = new SurfacePaintTools({
    host: $("paint-view"),
    canvas: view.renderer.domElement,
    toolbar: $("paint-toolbar"),
    state: () =>
      invalid
        ? null
        : {
            source: queue.source(),
            step: session.active.voxelStepM,
            context: snapshot.leaseId,
            domain,
            origin: target()!.origin,
            symmetry: symmetry.value(),
            hiddenMirror: symmetry.hiddenMirror,
          },
    hit: (e) => canvases.paintHit(e),
    project: (e, c) => canvases.paintProject(e, c),
    visible: (p) => canvases.paintVisible(p),
    guides: (p, s) => canvases.paintGuides(p, s),
    canStart: () => !queue.failed && queue.pending < 4,
    preview: (source) => canvases.previewPaint(source ?? queue.source()),
    color: () => hex,
    baseColor: (hit) => {
      const c = domain.cells.get(`${hit.x},${hit.y},${hit.z}`)!;
      return session.model.palette[
        hit.face === 4
          ? (c.color ?? 0)
          : (session.model.sideColor ?? c.color ?? 0)
      ];
    },
    authorColor: (hit, paint) => {
      const c = session.active.cells.find(
        (c) => c.x === hit.x && c.y === hit.y && c.z === hit.z,
      )!;
      return appearanceColor(
        session.model.palette[
          hit.face === 4
            ? (c.color ?? 0)
            : (session.model.sideColor ?? c.color ?? 0)
        ],
        paint,
        session.active.faceTone?.faces[hit.key],
      );
    },
    pick: choose,
    commit: async (source, before) => {
      choose(hex);
      await queue.paint(before!, source);
      message("已提交至主会话 · 可整笔撤销");
    },
    prepare: () => {},
    changed: () => view.display.paintMode(!!tools?.active),
    history: (kind) => void command(kind),
    save: () => void command("save"),
    message,
  });
  tools.mode.value = "paint";
  tools.mode.dispatchEvent(new Event("change"));
  view.fit(session.editor.doc);
  for (const color of session.model.palette) {
    const b = document.createElement("button");
    b.style.background = color;
    b.title = color;
    b.setAttribute("aria-label", "颜色 " + color);
    b.onclick = () => choose(color);
    $("paint-palette").append(b);
  }
  choose(hex);
  message("左键绘画 · Alt临时吸色 · 右键旋转，中键平移");
}
async function returnToModel() {
  tools?.cancel();
  try {
    await queue.drain();
    leaving = true;
    await api.return();
  } catch (e) {
    message((e as Error).message);
  }
}
$("paint-save").onclick = () => void command("save");
$("paint-return").onclick = () => void returnToModel();
$("paint-undo").onclick = () => void command("undo");
$("paint-redo").onclick = () => void command("redo");
$("paint-home").onclick = () => view.fit(session.editor.doc);
$("paint-retry").onclick = () =>
  void queue.retry().catch((e) => message(e.message));
$("paint-discard").onclick = () => queue.discard();
$("paint-color").oninput = (e) =>
  choose((e.target as HTMLInputElement).value, false);
$("paint-color").onchange = (e) => choose((e.target as HTMLInputElement).value);
$("paint-hex").onchange = (e) => choose((e.target as HTMLInputElement).value);
$("paint-wheel").onpointerup = () => choose(hex);
$("paint-previous").onclick = () => choose(previous);
$("paint-color-tab").onclick = () => {
  const wheel = $("paint-wheel");
  wheel.hidden = !wheel.hidden;
  $("paint-palette").hidden = !wheel.hidden;
  localStorage.setItem(
    "xh.paint.color.tab",
    wheel.hidden ? "palette" : "wheel",
  );
};
if (localStorage.getItem("xh.paint.color.tab") === "palette") {
  $("paint-wheel").hidden = true;
} else $("paint-palette").hidden = true;
$("paint-rgb").onchange = (e) => {
  const values = (e.target as HTMLInputElement).value.split(",").map(Number);
  if (
    values.length === 3 &&
    values.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
  )
    choose("#" + values.map((v) => v.toString(16).padStart(2, "0")).join(""));
  else message("RGB须为0–255整数");
};
$("paint-hsv").onchange = (e) => {
  const v = (e.target as HTMLInputElement).value.split(",").map(Number);
  if (
    v.length === 3 &&
    v.every(Number.isFinite) &&
    v[0] >= 0 &&
    v[0] <= 360 &&
    v.slice(1).every((v) => v >= 0 && v <= 100)
  )
    choose(hsvToHex(v[0], v[1] / 100, v[2] / 100));
  else message("HSV范围：0–360，0–100，0–100");
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
window.addEventListener("beforeunload", (e) => {
  if (!leaving && queue?.pending) {
    e.preventDefault();
    e.returnValue = false;
    void returnToModel();
    return;
  }
  cancelAnimationFrame(frame);
  tools?.dispose();
  wheel.dispose();
  canvases.update(null);
  view.dispose();
});
start().catch((e) => {
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
