import type { ViewportDisplayController } from "./viewport-display-controller.ts";
import {
  displayDefaults,
  preferenceKey,
  presetNames,
  readDisplayPreferences,
  type DisplayState,
} from "./viewport-display-state.ts";
let styled = false;
const menus = new Set<HTMLDetailsElement>();
function styles() {
  if (styled) return;
  styled = true;
  const style = document.createElement("style");
  style.textContent = `
.viewport-display-menu{position:relative;display:inline-block;color:#dae1e5;font:12px/1.5 'Segoe UI','Microsoft YaHei',sans-serif;z-index:45;text-align:left}
.viewport-display-menu>summary{list-style:none;cursor:pointer;border:1px solid #536069;background:#2c3339;border-radius:3px;padding:5px 9px;white-space:nowrap}
.viewport-display-menu[open]>summary{border-color:#d1aa66;color:#efcf91;background:#4e4332}
.viewport-display-body{position:absolute;top:calc(100% + 5px);right:0;width:244px;max-height:calc(100vh - 220px);overflow:auto;padding:12px;background:#242b31;border:1px solid #65717a;border-top:2px solid #d1aa66;box-shadow:0 5px 18px #0006;border-radius:3px;box-sizing:border-box}
.viewport-display-floating{position:absolute;top:12px;right:12px}
.viewport-display-toolbar{display:inline-flex;align-items:center;flex-wrap:wrap;gap:7px;max-width:100%;order:20}
.viewport-display-body[popover]{position:fixed;inset:auto;margin:0;max-width:calc(100vw - 16px)}
.workshop #app>header{height:auto;min-height:44px;padding-top:6px;padding-bottom:6px}
.workshop #app>header nav{flex:1;min-width:0;align-items:center;flex-wrap:wrap}
.viewport-display-body label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0;font-size:12px}
.viewport-display-body select{min-width:0;max-width:140px;background:#171d22;color:#e0e6eb;border:1px solid #536069;border-radius:3px;padding:4px;font:inherit}
.viewport-display-body input[type=range]{width:118px;min-width:0;accent-color:#d1aa66}
.viewport-display-body input[type=checkbox]{accent-color:#d1aa66}.viewport-display-body button{font:inherit;margin-top:8px;background:#30383f;color:#e0e6eb;border:1px solid #536069;border-radius:3px;padding:5px 8px;cursor:pointer}
.viewport-display-body details{border-top:1px solid #46515a;margin-top:10px;padding-top:8px}.viewport-display-body details summary{cursor:pointer}
.viewport-display-body .display-note{font-size:11px;color:#b7c2cb;margin-top:9px;line-height:1.5}.viewport-display-body :disabled{opacity:.4}
`;
  document.head.append(style);
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      let closed = false;
      for (const menu of menus)
        if (menu.open) {
          menu.open = false;
          if (menu.contains(document.activeElement))
            (document.activeElement as HTMLElement)?.blur();
          closed = true;
        }
      if (closed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    (event) => {
      for (const menu of menus)
        if (menu.open && !menu.contains(event.target as Node))
          menu.open = false;
    },
    true,
  );
}
export function mountDisplayMenu(
  controller: ViewportDisplayController,
  parent: HTMLElement,
  floating = true,
  title = "显示",
) {
  styles();
  const menu = document.createElement("details");
  menu.className =
    "viewport-display-menu" + (floating ? " viewport-display-floating" : "");
  menu.dataset.viewport = controller.context.id;
  const summary = document.createElement("summary"),
    body = document.createElement("div");
  body.className = "viewport-display-body";
  body.setAttribute("popover", "manual");
  body.setAttribute("aria-label", title + "设置");
  menu.append(summary, body);
  menus.add(menu);
  const position = () => {
    if (!menu.open) return;
    const anchor = summary.getBoundingClientRect(),
      gap = 6,
      margin = 8;
    const below = innerHeight - anchor.bottom - gap - margin,
      above = anchor.top - gap - margin,
      useAbove = below < 160 && above > below;
    body.style.width = Math.min(244, innerWidth - margin * 2) + "px";
    body.style.maxHeight = Math.max(1, useAbove ? above : below) + "px";
    body.style.left =
      Math.max(
        margin,
        Math.min(anchor.left, innerWidth - body.offsetWidth - margin),
      ) + "px";
    body.style.right = "auto";
    body.style.top =
      (useAbove
        ? Math.max(margin, anchor.top - body.offsetHeight - gap)
        : anchor.bottom + gap) + "px";
  };
  const toggle = () => {
    if (menu.open) {
      body.showPopover();
      position();
    } else if (body.matches(":popover-open")) body.hidePopover();
  };
  menu.addEventListener("toggle", toggle);
  window.addEventListener("resize", position);
  const controls = new Map<
    keyof DisplayState,
    HTMLInputElement | HTMLSelectElement
  >();
  const label = (text: string, control: HTMLElement) => {
    const row = document.createElement("label");
    row.append(document.createTextNode(text), control);
    body.append(row);
  };
  const select = (
    key: keyof DisplayState,
    title: string,
    options: Record<string, string>,
  ) => {
    const field = document.createElement("select");
    field.dataset.displayControl = key;
    field.setAttribute("aria-label", title);
    for (const [value, name] of Object.entries(options))
      field.add(new Option(name, value));
    field.onchange = () => controller.set({ [key]: field.value });
    controls.set(key, field);
    label(title, field);
  };
  const check = (
    key: keyof DisplayState,
    title: string,
    host: HTMLElement = body,
  ) => {
    const field = document.createElement("input");
    field.type = "checkbox";
    field.dataset.displayControl = key;
    field.onchange = () => controller.set({ [key]: field.checked });
    controls.set(key, field);
    const row = document.createElement("label");
    row.append(document.createTextNode(title), field);
    host.append(row);
  };
  const range = (
    key: "rotation" | "brightness",
    title: string,
    min: string,
    max: string,
    step: string,
  ) => {
    const field = document.createElement("input");
    field.type = "range";
    field.min = min;
    field.max = max;
    field.step = step;
    field.dataset.displayControl = key;
    field.setAttribute("aria-label", title);
    field.oninput = () => controller.set({ [key]: Number(field.value) });
    controls.set(key, field);
    label(title, field);
  };
  select("preset", "显示预设", presetNames);
  range("rotation", "光向旋转", "0", "360", "1");
  check("followCamera", "灯光随视角");
  range("brightness", "视口亮度", ".25", "2", ".05");
  select("cavity", "凹槽增强", { off: "关闭", low: "低", medium: "中" });
  select("background", "背景", { dark: "深灰", mid: "中灰", light: "浅灰" });
  const aids = document.createElement("details"),
    aidsTitle = document.createElement("summary");
  aidsTitle.textContent = "辅助显示";
  aids.append(aidsTitle);
  body.append(aids);
  check("structureEdges", "结构边线", aids);
  check("voxelLines", "体素格线", aids);
  check("grid", "地面参考网格", aids);
  const sync = document.createElement("label");
  sync.className = "display-sync-row";
  body.append(sync);
  const reset = document.createElement("button");
  reset.textContent = "恢复本视口默认";
  reset.onclick = () => controller.set(displayDefaults(controller.context.id));
  body.append(reset);
  const note = document.createElement("div");
  note.className = "display-note";
  body.append(note);
  for (const type of [
    "pointerdown",
    "pointerup",
    "click",
    "dblclick",
    "wheel",
    "contextmenu",
  ])
    menu.addEventListener(type, (event) => event.stopPropagation());
  menu.addEventListener("keydown", (event) => {
    if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
  });
  parent.append(menu);
  const previous = controller.onChange;
  const refresh = () => {
    summary.textContent =
      title + "：" + presetNames[controller.state.preset] + " ▾";
    const busy = controller.busy,
      albedo = controller.state.preset === "albedo";
    for (const [key, field] of controls) {
      if (field instanceof HTMLInputElement && field.type === "checkbox")
        field.checked = Boolean(controller.state[key]);
      else field.value = String(controller.state[key]);
      field.disabled =
        busy ||
        (albedo &&
          ["rotation", "brightness", "followCamera", "cavity"].includes(key));
    }
    reset.disabled = busy;
    note.textContent = busy
      ? "完成当前笔画或拖拽后可切换显示"
      : albedo
        ? "原色检查不受灯光、亮度或凹槽增强影响"
        : controller.context.host.dataset.cavityStatus?.includes("暂停") ||
            controller.context.host.dataset.cavityStatus?.includes("未启用")
          ? controller.context.host.dataset.cavityStatus!
          : controller.state.preset.includes("gray")
            ? "灰模不显示颜色笔触"
            : controller.context.host.dataset.displayMaterialNote ||
              "灯光与凹槽增强仅影响观察";
    if (body.matches(":popover-open")) position();
  };
  controller.onChange = () => {
    previous();
    refresh();
  };
  refresh();
  const timer = setInterval(refresh, 300);
  return {
    menu,
    sync,
    dispose: () => {
      clearInterval(timer);
      menu.removeEventListener("toggle", toggle);
      window.removeEventListener("resize", position);
      if (body.matches(":popover-open")) body.hidePopover();
      menus.delete(menu);
      menu.remove();
      controller.onChange = previous;
    },
  };
}
export function syncDisplayViews(
  a: ViewportDisplayController,
  b: ViewportDisplayController,
  menus: ReturnType<typeof mountDisplayMenu>[],
) {
  let enabled = false;
  try {
    enabled = readDisplayPreferences(localStorage.getItem(preferenceKey)).sync;
  } catch {}
  let copying = false;
  const boxes = menus.map((menu, index) => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = enabled;
    input.dataset.displaySync = "true";
    menu.sync.append(document.createTextNode("同步模块双视口"), input);
    input.onchange = () => {
      enabled = input.checked;
      for (const box of boxes) box.checked = enabled;
      try {
        const preferences = readDisplayPreferences(
          localStorage.getItem(preferenceKey),
        );
        preferences.sync = enabled;
        localStorage.setItem(preferenceKey, JSON.stringify(preferences));
      } catch {}
      if (enabled) {
        const from = index === 0 ? a : b,
          to = index === 0 ? b : a;
        copying = true;
        to.set({ ...from.state });
        copying = false;
      }
    };
    return input;
  });
  const listeners = [a.onChange, b.onChange];
  [a, b].forEach((from, index) => {
    from.onChange = () => {
      listeners[index]();
      if (enabled && !copying) {
        copying = true;
        (index === 0 ? b : a).set({ ...from.state }, false);
        copying = false;
      }
    };
  });
  return () => {
    a.onChange = listeners[0];
    b.onChange = listeners[1];
  };
}
