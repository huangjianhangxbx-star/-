import {
  planAppearance,
  type AppearancePlan,
  type AppearanceOptions,
} from "../core/appearance-asset.ts";
import {
  regionalDefaults,
  stableHash,
  type RegionalOptions,
} from "../core/regional-color.ts";
import type { AssetDocument } from "../core/workshop-documents.ts";
type Context = {
  model: AssetDocument;
  canvasId: string;
  keys: Set<string>;
  token: string;
};
type Dependencies = {
  toolbar: HTMLElement;
  command: (kind: "save" | "undo" | "redo") => void;
  begin: () => Context;
  valid: (context: Context) => boolean;
  preview: (model: AssetDocument | null) => void;
  commit: (plan: AppearancePlan) => void;
  message: (text: string, error?: boolean) => void;
};
/** Frozen source, explicit scope and native top-layer popup: no edits until Apply. */
export class AppearancePanel {
  readonly element = document.createElement("span");
  readonly body = document.createElement("div");
  private context: Context | null = null;
  private plan: AppearancePlan | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private offs: (() => void)[] = [];
  private regional = regionalDefaults();
  private docked=false;
  dock(host:HTMLElement){this.docked=true;this.body.removeAttribute("popover");this.body.classList.add("docked-tool");if(!this.body.querySelector('.appearance-scroll')){const scroll=document.createElement('div');scroll.className='appearance-scroll';const actions=this.body.querySelector('.appearance-actions')!;while(this.body.firstChild!==actions)scroll.append(this.body.firstChild!);this.body.prepend(scroll);}host.append(this.body);this.body.hidden=!this.active;}
  apply(){if(this.timer!==null){clearTimeout(this.timer);this.compute();}if(!this.plan||!this.context||!this.deps.valid(this.context))return false;this.deps.commit(this.plan);this.cancel();return true;}
  get active() {
    return !!this.context;
  }
  constructor(private deps: Dependencies) {
    const style = document.createElement("style");
    style.textContent = `.appearance-tools{display:inline-flex;align-items:center}.appearance-panel{position:fixed;inset:auto;margin:0;width:330px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;background:#242b31;color:#dae1e5;border:1px solid #69747a;border-top:2px solid #d1aa66;border-radius:3px;padding:12px;box-sizing:border-box;font:12px/1.5 'Microsoft YaHei',sans-serif;box-shadow:0 6px 20px #0007}.appearance-panel .appearance-title{display:block;font-weight:600;color:#e2c18a;margin-bottom:10px}.appearance-panel [hidden]{display:none!important}.appearance-panel label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:9px 0}.appearance-panel select,.appearance-panel input[type=number],.appearance-panel input[type=text]{width:150px;min-width:0;background:#171d22;color:inherit;border:1px solid #56616b;border-radius:3px;padding:4px;font:inherit}.appearance-panel input[type=range]{width:140px;accent-color:#d1aa66}.appearance-panel input[type=checkbox]{accent-color:#d1aa66}.appearance-panel label>span:has(input[type=range]){display:inline-flex;align-items:center;white-space:nowrap}.appearance-panel output{color:#e2bb75;margin-left:5px;min-width:40px;text-align:right}.appearance-panel .appearance-note{font-size:11px;color:#b8c3cc;margin:10px 0;white-space:pre-line}.appearance-panel details{border-top:1px solid #46515a;margin:10px 0;padding-top:8px}.appearance-actions{display:flex;justify-content:flex-end;gap:8px;position:sticky;bottom:-12px;background:#242b31;padding:10px 0}.appearance-panel button{font:inherit;padding:5px 10px}.appearance-panel button:disabled{opacity:.4}`;
    document.head.append(style);
    this.element.className = "appearance-tools";
    this.element.innerHTML = '<button id="appearance-open">上色 ▾</button>';
    this.body.id = "appearance-panel";
    this.body.className = "appearance-panel";
    this.body.setAttribute("popover", "manual");
    this.body.setAttribute("aria-label", "区域色差与美术暗面");
    this.element.append(this.body);
    deps.toolbar.append(this.element);
    this.body.innerHTML = `<div class="appearance-title">上色 · SAMPLE</div><label>功能<select data-ap="kind"><option value="region">区域色差</option><option value="tone">美术暗面</option><option value="clear">清除选区暗面</option></select></label><div data-page="region"><label>区域分组<select data-ap="mode"><option value="brick">虚拟砖块</option><option value="objects">作者物体分块</option><option value="patch">成片色斑</option></select></label><label>排列平面<select data-ap="plane"><option>XZ</option><option>XY</option><option>YZ</option></select></label>${this.range("amount", "色差幅度", 0, 0.6, 0.01, 0.18)}${this.range("ratio", "变化比例", 0, 1, 0.01, 0.35)}<label>色阶<select data-ap="steps"><option>5</option><option>3</option></select></label>${this.range("width", "砖宽 / 米", 0.0625, 8, 0.0625, 1)}${this.range("height", "砖高 / 米", 0.0625, 4, 0.0625, 0.5)}${this.range("depth", "砖深 / 米", 0.0625, 4, 0.0625, 0.5)}${this.range("stagger", "错缝比例", 0, 1, 0.05, 0.5)}${this.range("scale", "色斑尺度 / 米", 0.125, 8, 0.125, 1.5)}<label>总种子<input data-ap="seed" type="number" min="0" max="2147483647" value="17"><button data-ap-action="reroll">重抽</button></label><details><summary>高级分组与随机</summary><label>局部原点 / 米<input data-ap="origin" type="text" value="0,0,0"></label>${["layoutSeed", "maskSeed", "colorSeed"].map((k, i) => `<label>${["布局种子", "范围种子", "色阶种子"][i]}<input data-ap="${k}" type="number" min="0" max="2147483647" value="0"></label>`).join("")}<small>0 跟随总种子；幅度不会重新划分区域。</small></details></div><div data-page="tone" hidden><label>暗面预设<select data-ap="preset"><option value="up-down">上亮下暗</option><option value="directional">指定光向</option></select></label>${this.range("strength", "暗面强度", 0, 0.8, 0.01, 0.3)}<label>明暗档数<select data-ap="bands"><option>3</option><option>2</option></select></label><label>指向光源 X/Y/Z<input data-ap="light" type="text" value="1,-1,2"></label><small>Z 向上；方向从表面指向光源，与相机无关。</small><details><summary>目标面</summary>${["+X", "−X", "+Y", "−Y", "+Z", "−Z"].map((v, i) => `<label>${v}<input type="checkbox" data-ap-face="${i}" checked></label>`).join("")}</details><label><span>暗面同时影响手绘</span><input data-ap="affectPaint" type="checkbox"></label></div><label>预览<select data-ap="comparison"><option value="result">作者结果</option><option value="original">原始模型</option><option value="groups">区域 / 面分档</option><option value="base">仅底色对照</option></select></label><div id="appearance-scope" class="appearance-note"></div><div id="appearance-status" class="appearance-note" role="status"></div><div class="appearance-note">写入资产并随导出保留。灰模模式不显示作者颜色；仅改变底色和按面明暗，不烘焙遮挡阴影。</div><div class="appearance-actions"><button data-ap-action="cancel">取消</button><button data-ap-action="apply" disabled>应用</button></div>`;
    this.element.querySelector<HTMLButtonElement>("#appearance-open")!.onclick =
      () => (this.active ? this.cancel() : this.open());
    this.body.addEventListener("input", () => this.schedule());
    this.body.addEventListener("change", () => this.schedule());
    this.body.querySelector<HTMLButtonElement>(
      "[data-ap-action=cancel]",
    )!.onclick = () => this.cancel();
    this.body.querySelector<HTMLButtonElement>(
      "[data-ap-action=apply]",
    )!.onclick = () => {
      if (!this.plan) return;
      try {
        if (!this.context || !deps.valid(this.context))
          throw Error("编辑上下文已变化，请重新打开上色");
        deps.commit(this.plan);
        this.cancel();
        deps.message("上色完成 · 可整次撤销");
      } catch (e: any) {
        this.status(e.message, true);
      }
    };
    this.body.querySelector<HTMLButtonElement>(
      "[data-ap-action=reroll]",
    )!.onclick = () => {
      this.field("seed").value = String(Math.floor(Math.random() * 2147483647));
      this.schedule();
    };
    const key = (e: KeyboardEvent) => {
      if (!this.active) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.cancel();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        ["s", "z", "y"].includes(e.key.toLowerCase())
      ) {
        if(e.key.toLowerCase()!=='s'&&e.target instanceof Element&&e.target.closest('input,textarea'))return;
        const k = e.key.toLowerCase(),
          command =
            k === "s" ? "save" : k === "y" || e.shiftKey ? "redo" : "undo";
        e.preventDefault();
        e.stopImmediatePropagation();
        if(command!=="save")this.cancel();
        this.deps.command(command);
        return;
      }
      if (
        e.target instanceof Element &&
        e.target.closest("#appearance-panel,.viewport-display-menu")
      )
        return;
      if (!["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const pointer = (e: PointerEvent) => {
      if (
        !this.active ||
        !(e.target instanceof Element) ||
        e.target.closest(".appearance-tools,.viewport-display-menu")
      )
        return;
      if (e.target.tagName === "CANVAS") {
        if (e.button === 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        return;
      }
      if(this.docked)return;
      if (e.target.closest("button,input,select,summary,[data-model-object]"))this.cancel();
    };
    const resize = () => {
      if (this.active) this.position();
    };
    window.addEventListener("resize", resize);
    this.offs.push(() => window.removeEventListener("resize", resize));
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", pointer, true);
    this.offs.push(
      () => document.removeEventListener("keydown", key, true),
      () => document.removeEventListener("pointerdown", pointer, true),
      () => style.remove(),
    );
  }
  private range(
    k: string,
    label: string,
    min: number,
    max: number,
    step: number,
    value: number,
  ) {
    return `<label>${label}<span><input data-ap="${k}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output data-ap-output="${k}">${value}</output></span></label>`;
  }
  private field(k: string) {
    return this.body.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-ap="${k}"]`,
    )!;
  }
  private number(k: string) {
    return Number(this.field(k).value);
  }
  private vector(k: string) {
    return this.field(k).value.split(",").map(Number);
  }
  open() {
    try {
      this.context = this.deps.begin();
      if(this.docked)this.body.hidden=false;else this.body.showPopover();
      this.body.scrollTop = 0;
      this.position();
      this.body.querySelector("#appearance-scope")!.textContent =
        `冻结范围：当前画布 ${this.context.keys.size.toLocaleString()} 格 · 未选中内容保持原样`;
      this.compute();
    } catch (e: any) {
      this.context = null;
      this.deps.message(e.message, true);
    }
  }
  private position() {
    if(this.docked)return;
    const r = this.element.getBoundingClientRect();
    this.body.style.left =
      Math.max(8, Math.min(r.left, innerWidth - 338)) + "px";
    this.body.style.top = Math.min(r.bottom + 6, innerHeight - 200) + "px";
    this.body.style.maxHeight =
      Math.max(160, innerHeight - r.bottom - 14) + "px";
  }
  private schedule() {
    for (const e of this.body.querySelectorAll<HTMLOutputElement>(
      "[data-ap-output]",
    ))
      e.value = this.field(e.dataset.apOutput!).value;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.compute(), 90);
    this.body.querySelector<HTMLButtonElement>(
      "[data-ap-action=apply]",
    )!.disabled = true;
  }
  private status(text: string, error = false) {
    const e = this.body.querySelector<HTMLElement>("#appearance-status")!;
    e.textContent = text;
    e.style.color = error ? "#edaa83" : "";
  }
  private options(): AppearanceOptions {
    const kind = this.field("kind").value;
    if (kind === "clear") return { kind };
    if (kind === "tone")
      return {
        kind,
        preset: this.field("preset").value as "up-down" | "directional",
        strength: this.number("strength"),
        light: this.vector("light"),
        bands: this.number("bands"),
        affectPaint: (this.field("affectPaint") as HTMLInputElement).checked,
        faces: [
          ...this.body.querySelectorAll<HTMLInputElement>(
            "[data-ap-face]:checked",
          ),
        ].map((e) => Number(e.dataset.apFace)),
      };
    const o: RegionalOptions = {
      ...this.regional,
      mode: this.field("mode").value as RegionalOptions["mode"],
      plane: this.field("plane").value as RegionalOptions["plane"],
      origin: this.vector("origin"),
    };
    for (const k of [
      "amount",
      "ratio",
      "steps",
      "width",
      "height",
      "depth",
      "stagger",
      "scale",
      "seed",
      "layoutSeed",
      "maskSeed",
      "colorSeed",
    ] as const)
      o[k] = this.number(k);
    return { kind: "region", regional: o };
  }
  private compute() {
    this.timer = null;
    if (!this.context) return;
    if (!this.deps.valid(this.context)) {
      this.cancel();
      this.deps.message("上色上下文已变化，已取消预览", true);
      return;
    }
    const kind = this.field("kind").value;
    for (const p of this.body.querySelectorAll<HTMLElement>("[data-page]"))
      p.hidden = p.dataset.page !== kind;
    const grouping = this.field("mode").value;
    for (const k of ["plane", "width", "height", "depth", "stagger", "scale"])
      this.field(k).closest("label")!.hidden =
        k === "scale" ? grouping !== "patch" : grouping !== "brick";
    try {
      this.plan = planAppearance(
        this.context.model,
        this.context.canvasId,
        this.context.keys,
        this.options(),
      );
      this.body.dataset.changed = String(this.plan.changed);
      this.body.dataset.computeMs = String(this.plan.computeMs);
      const mode = this.field("comparison").value;
      let model = this.plan.nextModel;
      if (mode === "original") model = this.context.model;
      else if (mode === "base") {
        model = structuredClone(model);
        for (const c of model.canvases!) delete c.paintSource;
      } else if (mode === "groups" && this.plan.options.kind !== "region") {
        model = structuredClone(this.plan.nextModel);
        model.palette = ["#546068", "#e2c18a"];
        delete model.sideColor;
        for (const c of model.canvases!) {
          delete c.paintSource;
          for (const cell of c.cells)
            cell.color =
              c.canvasId === this.context.canvasId &&
              this.context.keys.has([cell.x, cell.y, cell.z].join(","))
                ? 1
                : 0;
        }
      } else if (mode === "groups") {
        model = structuredClone(this.context.model);
        model.palette = [
          "#768997",
          "#b4a184",
          "#789789",
          "#a8a1b3",
          "#b1ad8e",
          "#8498b2",
        ];
        delete model.sideColor;
        for (const c of model.canvases!) {
          delete c.paintSource;
          delete c.faceTone;
          for (const cell of c.cells) {
            const k = [cell.x, cell.y, cell.z].join(","),
              g = this.plan.groups[k];
            cell.color =
              g === undefined ? 0 : 1 + Math.floor(stableHash(g) * 5);
          }
        }
      }
      this.deps.preview(model);
      this.status(
        `变化 ${this.plan.changed.toLocaleString()} 项 · ${this.plan.computeMs.toFixed(0)} ms\n${this.plan.warnings.join("\n")}`,
      );
      this.body.querySelector<HTMLButtonElement>(
        "[data-ap-action=apply]",
      )!.disabled = !this.plan.changed;
    } catch (e: any) {
      this.plan = null;
      this.deps.preview(null);
      this.status(e.message, true);
      this.body.querySelector<HTMLButtonElement>(
        "[data-ap-action=apply]",
      )!.disabled = true;
    }
  }
  sync() {
    if (this.context && !this.deps.valid(this.context)) this.cancel();
  }
  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.context) return;
    this.context = null;
    this.plan = null;
    if(this.docked)this.body.hidden=true;else this.body.hidePopover();
    this.deps.preview(null);
  }
  dispose() {
    this.cancel();
    this.offs.forEach((f) => f());
    this.element.remove();
  }
}
