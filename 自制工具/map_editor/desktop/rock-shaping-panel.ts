import { DEFAULT_ROCK_OPTIONS, type RockOptions, type RockSeedGroup } from '../core/rock-shaping.ts';
import { planRockAsset, type RockAssetPlan } from '../core/rock-shaping-asset.ts';
import type { AssetDocument } from '../core/workshop-documents.ts';

type Context = { model: AssetDocument; objectId: string; selectionKeys?: ReadonlySet<string> };
type Dependencies = {
  host: HTMLElement;
  begin: () => Context;
  preview: (plan: RockAssetPlan | null, highlight?: boolean) => void;
  commit: (plan: RockAssetPlan) => void;
  message: (text: string, error?: boolean) => void;
  selectRegion?: () => void;
};
type NumericKey = 'maxDepth'|'minWidth'|'maxWidth'|'continuity'|'breakStrength'|'regularity'|'chips'|'bandWidth'|'layers'|'contourScale'|'layerVariation'|'minThickness';
type Slider = [NumericKey,string,number,number,number,boolean?];
const columnControls: Slider[] = [
  ['maxDepth','起伏深度',0,8,1,true], ['minWidth','最小岩柱宽',2,10,1,true],
  ['maxWidth','最大岩柱宽',2,14,1,true], ['continuity','竖向延续',6,36,1,true],
  ['breakStrength','断阶变化',0,1,.05], ['regularity','规整程度',0,1,.05], ['chips','局部缺损',0,.3,.01],
];
const terraceControls: Slider[] = [
  ['bandWidth','层阶进深',0,14,1,true], ['layers','主层段数',2,6,1],
  ['contourScale','轮廓段大小',6,32,1,true], ['layerVariation','层间错落',0,1,.05],
];
function reasonText(reason: string): string {
  if (reason.startsWith('Terraces require')) return '层阶需要平底、每列连续的平台；悬挑或上下分层暂不支持。';
  if (reason.startsWith('Platform is too thin')) return '平台太薄，请减少层数或选择更厚的物体。';
  if (reason.startsWith('Joint carving')) return '削切会破坏最小厚度或连通性，请减小深度、带宽或缺损。';
  if (reason.startsWith('Invalid parameters')) return '参数或格尺寸不受支持。';
  if (reason.startsWith('Target is hidden')) return '目标已隐藏或锁定。';
  if (reason.startsWith('Empty target')) return '没有可处理的体素。';
  if (reason.startsWith('Perimeter cannot')) return '周长不足，请减小岩柱宽度。';
  if (reason.includes('budget exceeded')) return '目标超过当前计算规模限制，请拆分后处理。';
  return reason;
}
function reroll(previous: number): number {
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff; } while (!value || value === previous);
  return value;
}

/** Owns a temporary preview only; the host validates and commits its source stamp. */
export class RockShapingPanel {
  private element: HTMLElement;
  private context: Context | null = null;
  private options: RockOptions = { ...DEFAULT_ROCK_OPTIONS, sides: [0,1,2,3] };
  private plan: RockAssetPlan | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private protectPaint = true;
  private protectColumns = false;
  private original = false;
  private highlight = true;
  private revision = 0;
  private applyButton!: HTMLButtonElement;
  private status!: HTMLElement;
  private parameters!: HTMLElement;
  private randomControls!: HTMLElement;
  private sideSection!: HTMLElement;
  private sliders = new Map<NumericKey, { input: HTMLInputElement; output: HTMLOutputElement; physical: boolean }>();

  constructor(private readonly deps: Dependencies) {
    this.element = document.createElement('section');
    this.element.id = 'rock-shape-panel';
    this.element.hidden = true;
    this.element.setAttribute('aria-label','岩体塑形');
    this.element.style.cssText = 'position:absolute;right:12px;top:54px;width:286px;max-width:calc(100% - 24px);max-height:calc(100% - 66px);display:flex;flex-direction:column;overflow:hidden;overscroll-behavior:contain;z-index:40;padding:12px;box-sizing:border-box;background:#252b31f5;border:1px solid #555c63;border-top:2px solid #d7ad65;border-radius:4px;color:#e3e8ed;font-size:12px;line-height:1.5;box-shadow:0 3px 12px #0005;';
    for (const event of ['pointerdown','pointerup','pointermove','mousedown','mouseup','click','dblclick','wheel','contextmenu']) {
      this.element.addEventListener(event, e => e.stopPropagation());
    }
    this.element.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); this.cancel(); }
      e.stopPropagation();
    });
    deps.host.append(this.element);
  }

  get active(): boolean { return this.context !== null; }

  open(): void {
    if (this.active) return;
    try {
      const source = this.deps.begin();
      this.context = { model: structuredClone(source.model), objectId: source.objectId,
        selectionKeys: source.selectionKeys === undefined ? undefined : new Set(source.selectionKeys) };
      const object = this.context.model.objects?.find(o => o.objectId === source.objectId);
      const canvas = this.context.model.canvases?.find(c => c.canvasId === object?.canvasIds[0]);
      this.options.cellSize = canvas?.voxelStepM ?? .25;
      this.original = false;
      this.highlight = true;
      this.protectPaint = true;
      this.protectColumns = false;
      this.element.hidden = false;
      this.build();
      this.element.scrollTop = 0;
      this.recompute();
    } catch (error) {
      this.context = null;
      this.element.hidden = true;
      this.deps.message(error instanceof Error ? error.message : String(error), true);
    }
  }

  cancel(): void {
    if (!this.active) return;
    this.stopPending();
    this.context = null;
    this.plan = null;
    this.element.hidden = true;
    this.deps.preview(null);
  }

  dispose(): void { this.cancel(); this.element.remove(); }

  private stopPending(): void {
    this.revision++;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.stopPending();
    this.plan = null;
    // A click during the debounce flushes the current parameters synchronously.
    this.applyButton.disabled = false;
    this.applyButton.textContent = '更新并应用';
    this.status.textContent = '等待更新…';
    const revision = this.revision;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.active && revision === this.revision) this.recompute();
    }, 80);
  }

  private recompute(): void {
    this.stopPending();
    const context = this.context;
    if (!context) return;
    const start = performance.now();
    try {
      const plan = planRockAsset(context.model, context.objectId, this.options, {
        protectPaint: this.protectPaint,
        selectionKeys: context.selectionKeys,
        protectColumns: this.protectColumns,
      });
      this.plan = plan;
      const diagnostics = plan.result.diagnostics;
      this.element.dataset.computeMs=String(performance.now()-start);
      const blockers = diagnostics.blockingReasons;
      this.applyButton.textContent = '应用';
      this.applyButton.disabled = !!blockers.length || !plan.result.removedCellKeys.length;
      const count = (value: number | readonly unknown[]) => typeof value === 'number' ? value : value.length;
      this.status.textContent = blockers.length ? blockers.map(reasonText).join('；') :
        `削去 ${plan.result.removedCellKeys.length.toLocaleString()} 格 · 保护命中 ${diagnostics.protected.toLocaleString()}\n` +
        `彩绘受影响 ${count(plan.surfaces.paintedAffected).toLocaleString()} · 新露表面 ${count(plan.surfaces.revealed).toLocaleString()}` +
        (!plan.result.removedCellKeys.length ? '\n没有可应用的变化：检查侧面、选区厚度或保护开关。' : '');
      this.status.title = `移除表面 ${count(plan.surfaces.removed)} · 新露表面 ${count(plan.surfaces.revealed)} · 厚度/连接保留 ${diagnostics.limited??0} 格 · 计算 ${(performance.now()-start).toFixed(0)} ms`;
      this.status.style.color = blockers.length ? '#efbc8d' : '#b5c3cf';
      this.deps.preview(this.original || blockers.length ? null : plan,this.highlight);
    } catch (error) {
      this.plan = null;
      this.applyButton.textContent = '应用';
      this.applyButton.disabled = true;
      this.status.textContent = error instanceof Error ? error.message : String(error);
      this.status.style.color = '#efbc8d';
      this.deps.preview(null);
    }
  }

  private button(text: string, id: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button'; button.id = id; button.textContent = text;
    button.style.cssText = 'min-height:29px;padding:4px 8px;font:inherit;cursor:pointer;background:#30373f;color:#e3e8ed;border-color:#555c63;';
    button.addEventListener('click', action);
    return button;
  }

  private row(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:7px 0;';
    return row;
  }

  private checkbox(title: string, id: string, checked: boolean, change: (checked: boolean) => void): HTMLLabelElement {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;gap:4px;align-items:center;margin:6px 0;';
    const input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.checked = checked;
    input.style.cssText = 'width:auto;flex:none;margin:0;accent-color:#d7ad65;';
    input.addEventListener('change', () => change(input.checked));
    label.append(input, document.createTextNode(title));
    return label;
  }

  private seedRow(title: string, id: string, value: number, set: (value: number) => void): HTMLElement {
    const label = document.createElement('label'); label.style.cssText = 'display:block;margin:8px 0;';
    label.append(document.createTextNode(title));
    const row = this.row(), input = document.createElement('input');
    input.type = 'number'; input.min = '0'; input.max = '2147483647'; input.step = '1'; input.value = String(value);
    input.id = `rock-seed${id ? '-'+id : ''}`;
    input.style.cssText = 'width:100%;min-width:0;font:inherit;background:#1d2228;color:#e3e8ed;';
    input.setAttribute('aria-label',title);
    const update = (next: number) => { input.value = String(next); set(next); this.schedule(); };
    input.addEventListener('change', () => {
      const next = input.valueAsNumber;
      if (Number.isInteger(next) && next >= 0 && next <= 2147483647) update(next);
      else input.value = String(id ? this.options.randomSeeds?.[id as RockSeedGroup] ?? 0 : this.options.seed);
    });
    row.append(input, this.button('重抽',`rock-reroll-${id || 'all'}`, () => update(reroll(Number(input.value)))));
    label.append(row); return label;
  }

  private build(): void {
    this.element.replaceChildren();
    const title = document.createElement('strong'); title.textContent = '岩体塑形';
    const header = this.row(); header.style.justifyContent = 'space-between';
    header.append(title, this.button('关闭','rock-close',() => this.cancel())); this.element.append(header);
    const scope = document.createElement('div');scope.id='rock-scope';
    const object=this.context?.model.objects?.find(o=>o.objectId===this.context?.objectId);
    scope.textContent=this.context?.selectionKeys===undefined?`整个物体 · ${object?.cellKeys?.length??0} 格`:`当前选区 · ${this.context.selectionKeys.size} 格`;
    scope.style.cssText='color:#d7ad65;margin:6px 0;';this.element.append(scope);
    if(this.context?.selectionKeys===undefined&&this.deps.selectRegion)this.element.append(this.button('进入编辑模式选择局部','rock-select-region',()=>{this.cancel();this.deps.selectRegion?.();}));
    const preset = document.createElement('select'); preset.id = 'rock-preset'; preset.style.cssText = 'width:100%;font:inherit;background:#1d2228;color:#e3e8ed;';
    preset.add(new Option('柱状岩壁','columnar-wall')); preset.add(new Option('层阶崖岸','terraced-rim'));
    preset.value = this.options.preset;
    preset.addEventListener('change', () => {
      this.options.preset = preset.value as RockOptions['preset'];
      this.buildParameters(); this.buildSeeds(); this.schedule();
    });
    this.element.append(preset, this.seedRow('总种子','',this.options.seed,value => this.options.seed = value));
    this.parameters = document.createElement('div'); this.element.append(this.parameters);
    this.sideSection = document.createElement('div');
    const sides = this.row();
    ['+X','−X','+Y','−Y'].forEach((side,index) => sides.append(this.checkbox(side,`rock-side-${index}`,this.options.sides!.includes(index),checked => {
      this.options.sides = checked ? [...this.options.sides!,index] : this.options.sides!.filter(s => s !== index); this.schedule();
    })));
    this.sideSection.append(document.createTextNode('影响侧面'), sides); this.element.append(this.sideSection);
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = '高级随机'; summary.style.cursor = 'pointer'; details.append(summary);
    this.randomControls = document.createElement('div'); details.append(this.randomControls);
    details.append(this.button('重置分项种子','rock-reset-seeds',() => { delete this.options.randomSeeds; this.buildSeeds(); this.schedule(); }));
    this.element.append(details);
    this.element.append(this.checkbox('保护已有彩绘','rock-protect-paint',this.protectPaint,checked => { this.protectPaint = checked; this.schedule(); }));
    this.element.append(this.checkbox('沿用旧保护柱','rock-protect-columns',this.protectColumns,checked => {this.protectColumns=checked;this.schedule();}));
    this.element.append(this.checkbox('橙色显示待削切体素','rock-highlight',this.highlight,checked=>{
      this.highlight=checked;this.deps.preview(this.original?null:this.plan,this.highlight);
    }));
    this.element.append(this.checkbox('查看原形','rock-original',this.original,checked => {
      this.original = checked;
      this.deps.preview(checked || this.plan?.result.diagnostics.blockingReasons.length ? null : this.plan,this.highlight);
    }));
    const controls = document.createElement('div');
    controls.style.cssText = 'min-height:0;overflow:auto;overscroll-behavior:contain;margin-right:-8px;padding-right:8px;';
    controls.append(...Array.from(this.element.children));
    this.element.append(controls);
    this.status = document.createElement('div'); this.status.id = 'rock-status'; this.status.setAttribute('role','status');
    this.status.style.cssText = 'flex-shrink:0;white-space:pre-line;font-size:11px;line-height:1.5;margin:6px 0;'; this.element.append(this.status);
    const actions = this.row();
    actions.style.cssText += 'flex-shrink:0;background:#252b31;padding:4px 0;margin-bottom:0;';
    this.applyButton = this.button('应用','rock-apply',() => {
      if (this.timer !== null) this.recompute();
      const plan = this.plan;
      if (!plan || this.applyButton.disabled) return;
      try { this.deps.commit(plan); this.cancel(); }
      catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        this.status.textContent = text; this.deps.message(text,true);
      }
    });
    this.applyButton.style.flex = '1';
    const cancel = this.button('取消','rock-cancel',() => this.cancel()); cancel.style.flex = '1';
    actions.append(cancel,this.applyButton); this.element.append(actions);
    const help = document.createElement('div'); help.textContent = '右键旋转 · 中键平移 · Esc 取消\nZ 为竖向，按勾选侧面向内削切。选区严格限界，不向未选体素扩展；橙色显示待削去的位置。';
    help.style.cssText = 'white-space:pre-line;font-size:10px;color:#a1adb8;margin-top:7px;'; controls.append(help);
    this.buildParameters(); this.buildSeeds();
  }

  private buildSeeds(): void {
    this.randomControls.replaceChildren();
    const groups: [RockSeedGroup,string][] = this.options.preset === 'columnar-wall' ?
      [['layout','岩柱布局'],['breaks','竖向断阶'],['chips','局部缺损']] : [['terraces','层高与退台'],['contour','边缘轮廓']];
    for (const [group,title] of groups) this.randomControls.append(this.seedRow(title,group,this.options.randomSeeds?.[group] ?? 0,value => {
      this.options.randomSeeds = { ...this.options.randomSeeds, [group]: value };
    }));
  }

  private buildParameters(): void {
    this.parameters.replaceChildren(); this.sliders.clear();
    this.sideSection.hidden = false;
    const controls = this.options.preset === 'columnar-wall' ? columnControls : terraceControls;
    for (const [key,title,min,max,step,physical] of [...controls,['minThickness','最小保留厚度',2,8,1,true] as Slider]) {
      const label = document.createElement('label'); label.style.cssText = 'display:block;margin:10px 0;';
      const line = this.row(); line.style.justifyContent = 'space-between';
      const name = document.createElement('span'); name.textContent = title;
      const output = document.createElement('output'); output.id = `rock-${key}-value`; output.style.color = '#d7ad65';
      line.append(name,output);
      const input = document.createElement('input'); input.type = 'range'; input.id = `rock-${key}`;
      input.min = String(min); input.max = String(max); input.step = String(step);
      input.style.cssText = 'width:100%;accent-color:#d7ad65;margin:0;';
      this.sliders.set(key,{input,output,physical:!!physical});
      input.addEventListener('input', () => {
        this.options[key] = Number(input.value);
        if (key === 'minWidth') this.options.maxWidth = Math.max(this.options.maxWidth,this.options.minWidth);
        if (key === 'maxWidth') this.options.minWidth = Math.min(this.options.minWidth,this.options.maxWidth);
        this.options.continuity = Math.max(this.options.continuity,this.options.maxWidth*2);
        this.refreshSliders(); this.schedule();
      });
      label.append(line,input); this.parameters.append(label);
    }
    this.refreshSliders();
  }

  private refreshSliders(): void {
    for (const [key,{input,output,physical}] of this.sliders) {
      const value = this.options[key];
      if (key === 'continuity') input.min = String(Math.max(6,this.options.maxWidth*2));
      input.value = String(value);
      output.value = physical ? `${value} 格 / ${Number((value*this.options.cellSize!).toFixed(4))} m` : String(value);
    }
  }
}
