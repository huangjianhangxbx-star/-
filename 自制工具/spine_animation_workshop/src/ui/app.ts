import type { DriverFrame, DriverMapping, MotionSource, TargetSummary, TransferConfig } from '../core/contracts.ts';
import { openGlb } from '../source/glb-motion.ts';
import { readSpineTarget } from '../target/spine-target.ts';
import { generateClip } from '../transfer/sample-clip.ts';
import { createTransfer } from '../transfer/retarget.ts';
import { appendAnimation } from '../output/spine43-animation.ts';
import { validateConfig } from '../config/validate-config.ts';
import { SourcePreview } from '../preview/source-preview.ts';
import { SourceModelPreview } from '../preview/source-model-preview.ts';
import { Spine43Preview, type SpinePreviewAssets } from '../preview/spine43-preview.ts';
import { createDraftConfig, readinessIssues } from './workshop-state.ts';
import { stepFrame } from './time-controls.ts';

type OpenSource = { path: string; name: string; bytes: ArrayBuffer };
type OpenTarget = { resourceId: string; path: string; name: string; nativeProject?: boolean; jsonPath?: string; atlasPath?: string; jsonText: string; atlasText: string; pages: { name: string; bytes: ArrayBuffer }[] };
type SavedOutput = { directory: string; jsonPath: string; handoffId?: string; projectPath?: string; carrierPath?: string; skeletonName?: string; animationName?: string; replaceEmpty?: boolean };
declare global {
  interface Window {
    spw: {
      openSource(): Promise<OpenSource | null>;
      openSpineSource(): Promise<OpenTarget | null>;
      openTarget(): Promise<OpenTarget | null>;
      chooseOutput(): Promise<string | null>;
      saveOutput(payload: { targetResourceId: string; outputDirectory: string; animationName: string; jsonText: string; configText: string; sourceKind?: 'spine'; sourceResourceId?: string; reportText?: string }): Promise<SavedOutput>;
      nativeAction(handoffId: string, action: 'copy' | 'open' | 'verify'): Promise<{ passed?: boolean; projectPath?: string }>;
      openConfig(): Promise<{ path: string; jsonText: string } | null>;
      saveConfig(jsonText: string): Promise<string | null>;
    };
  }
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const sourceView = new SourcePreview(el<HTMLCanvasElement>('source-canvas'));
let modelView: SourceModelPreview | null = null;
try { modelView = new SourceModelPreview(el<HTMLCanvasElement>('source-model-canvas')); }
catch (error) { showStatus(`源模型预览不可用，将显示三维骨架：${message(error)}`); }
let targetView: Spine43Preview | null = null;
let targetPreviewError = '';
try { targetView = new Spine43Preview(el<HTMLCanvasElement>('target-canvas')); }
catch (error) { targetPreviewError = message(error); el<HTMLElement>('target-caption').textContent = `目标预览不可用：${targetPreviewError}`; }
sourceView.clear();

let source: { input: OpenSource; motion: MotionSource } | null = null;
let target: { input: OpenTarget; summary: TargetSummary; document: unknown } | null = null;
let config: TransferConfig | null = null;
let pendingConfig: TransferConfig | null = null;
let generated: { jsonText: string; name: string; targetResourceId: string } | null = null;
let currentSeconds = 0;
let playing = false;
let playStarted = 0;
let playFrom = 0;
let selectedMapping = -1;
let selectedSourcePath = '';
let selectedTargetBone = '';
let targetLoadSerial = 0;
let stateVersion = 0;
let liveTransfer: { version: number; source: MotionSource; target: TargetSummary; config: TransferConfig; transfer: ReturnType<typeof createTransfer> } | null = null;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function showStatus(value: string, error = false): void {
  const status = el<HTMLParagraphElement>('status');
  status.textContent = value;
  status.classList.toggle('error', error);
}
function options(select: HTMLSelectElement, entries: readonly { value: string; label: string }[], selected = ''): void {
  select.replaceChildren(...entries.map(({ value, label }) => {
    const item = document.createElement('option'); item.value = value; item.textContent = label; return item;
  }));
  select.value = selected;
}
function numbered(id: string, value: number): void { el<HTMLInputElement>(id).value = String(value); }
function selectEntries(items: readonly string[], placeholder: string): { value: string; label: string }[] {
  return [{ value: '', label: placeholder }, ...items.map((name) => ({ value: name, label: name }))];
}
function sourceEntries(): { value: string; label: string }[] {
  return selectEntries(source?.motion.joints.map((joint) => joint.path) ?? [], '选择关节');
}
function targetEntries(): { value: string; label: string }[] {
  return selectEntries(target?.summary.bones.map((bone) => bone.name) ?? [], '选择骨骼');
}
function mappingEntries(kind: 'source' | 'target', selected: string): { value: string; label: string }[] {
  const query = el<HTMLInputElement>(kind === 'source' ? 'source-search' : 'target-search').value.trim().toLocaleLowerCase();
  const all = kind === 'source' ? sourceEntries() : targetEntries();
  return !query ? all : all.filter((entry) => !entry.value || entry.value === selected || entry.label.toLocaleLowerCase().includes(query));
}
function renderBoneBrowsers(): void {
  const targetParents = new Map(target?.summary.bones.map((bone) => [bone.name, bone.parent]) ?? []);
  for (const kind of ['source', 'target'] as const) {
    const host = el<HTMLDivElement>(`${kind}-browser`);
    const query = el<HTMLInputElement>(`${kind}-search`).value.trim().toLocaleLowerCase();
    const entries = kind === 'source'
      ? (source?.motion.joints.map((joint) => ({ name: joint.name, value: joint.path, depth: Math.max(0, joint.path.split('/').length - 2) })) ?? [])
      : (target?.summary.bones.map((bone) => {
        let depth = 0, parent = bone.parent;
        while (parent && depth < 12) { depth++; parent = targetParents.get(parent) ?? null; }
        return { name: bone.name, value: bone.name, depth };
      }) ?? []);
    host.replaceChildren();
    for (const item of entries) {
      if (query && !`${item.name} ${item.value}`.toLocaleLowerCase().includes(query)) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'bone-choice';
      button.textContent = `${'›'.repeat(Math.min(item.depth, 7))} ${item.name}`;
      button.title = item.value;
      button.classList.toggle('active', item.value === (kind === 'source' ? selectedSourcePath : selectedTargetBone));
      button.addEventListener('click', () => selectBone(kind, item.value));
      host.append(button);
    }
    if (!host.childElementCount) {
      const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = entries.length ? '没有匹配结果' : '尚未载入'; host.append(empty);
    }
  }
}
function selectBone(kind: 'source' | 'target', value: string): void {
  if (config && selectedMapping >= 0 && config.mappings[selectedMapping]) {
    config.mappings = config.mappings.map((mapping, index) => index === selectedMapping ? { ...mapping, [kind === 'source' ? 'sourcePath' : 'target']: value } : mapping);
    renderMappings(); renderCorrections(); changed(); selectMapping(selectedMapping);
    return;
  }
  if (kind === 'source') selectedSourcePath = value;
  else { selectedTargetBone = value; targetView?.setSelectedBone(value); }
  renderBoneBrowsers();
  renderAt(currentSeconds);
}
function applyConfig(next: TransferConfig): void {
  config = next;
  const clips = source?.motion.clips ?? [];
  options(el<HTMLSelectElement>('clip'), clips.map((clip) => ({ value: clip.id, label: `${clip.name} · ${clip.durationSeconds.toFixed(2)} s` })), next.source.clipId);
  numbered('range-start', next.source.rangeSeconds[0]); numbered('range-end', next.source.rangeSeconds[1]);
  options(el<HTMLSelectElement>('front-axis'), ['+X', '-X', '+Y', '-Y', '+Z', '-Z'].map((value) => ({ value, label: value })), next.source.frontAxis);
  options(el<HTMLSelectElement>('up-axis'), ['+X', '-X', '+Y', '-Y', '+Z', '-Z'].map((value) => ({ value, label: value })), next.source.upAxis);
  options(el<HTMLSelectElement>('skin'), (target?.summary.skins ?? []).map((name) => ({ value: name, label: name })), next.target.skin);
  options(el<HTMLSelectElement>('display-animation'), selectEntries(target?.summary.animations ?? [], '仅设置姿势'), next.target.displayAnimation ?? '');
  el<HTMLInputElement>('direction-id').value = next.target.directionId;
  el<HTMLInputElement>('yaw').value = String(next.view.yawDegrees);
  el<HTMLOutputElement>('yaw-value').value = `${next.view.yawDegrees}°`;
  numbered('pitch', next.view.pitchDegrees);
  el<HTMLInputElement>('mirror').checked = next.view.mirror;
  options(el<HTMLSelectElement>('source-foot'), sourceEntries(), next.anchors.sourceFootPath);
  options(el<HTMLSelectElement>('target-foot'), targetEntries(), next.anchors.targetFootBone);
  numbered('scale', next.anchors.scale); numbered('offset-x', next.anchors.offsetX); numbered('offset-y', next.anchors.offsetY);
  el<HTMLInputElement>('animation-name').value = next.output.animationName;
  numbered('sample-hz', next.sampleHz);
  el<HTMLParagraphElement>('output-path').textContent = next.output.directory || '尚未选择目录';
  el<HTMLButtonElement>('add-mapping').disabled = !source || !target;
  el<HTMLButtonElement>('add-correction').disabled = !source || !target;
  renderMappings();
  renderCorrections();
  renderBoneBrowsers();
  el<HTMLInputElement>('time').max = String(next.source.rangeSeconds[1]);
  el<HTMLInputElement>('time').min = String(next.source.rangeSeconds[0]);
  currentSeconds = next.source.rangeSeconds[0];
  el<HTMLInputElement>('time').value = String(currentSeconds);
  refresh();
}
function loadDraft(): void {
  if (!source || !target) return;
  const relocated = pendingConfig && (pendingConfig.source.file !== source.input.path || pendingConfig.target.file !== target.input.path);
  const draft = pendingConfig ? { ...pendingConfig, source: { ...pendingConfig.source, file: source.input.path }, target: { ...pendingConfig.target, file: target.input.path }, chainCorrections: pendingConfig.chainCorrections ?? [], output: { ...pendingConfig.output, directory: '' } } : createDraftConfig(source.motion, target.summary, source.input.path, target.input.path);
  pendingConfig = null;
  generated = null;
  targetView?.clearGenerated();
  selectedMapping = -1;
  selectedSourcePath = '';
  selectedTargetBone = '';
  targetView?.setSelectedBone('');
  applyConfig(draft);
  showStatus(relocated ? '配置中的素材路径与当前载入文件不同，已按当前文件重定位。请核对片段、骨骼映射与局部修正，再选择输出目录。' : '素材已载入。选择脚点、映射和输出目录后生成。');
}

function renderMappings(): void {
  const host = el<HTMLDivElement>('mapping-list');
  host.replaceChildren();
  if (!config || !config.mappings.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '尚无映射。添加源关节与目标控制骨。'; host.append(empty); return;
  }
  config.mappings.forEach((mapping, index) => {
    const row = document.createElement('div'); row.className = 'mapping-row';
    row.dataset.mappingIndex = String(index);
    row.classList.toggle('selected', index === selectedMapping);
    row.addEventListener('click', () => selectMapping(index));
    const head = document.createElement('div'); head.className = 'row-head';
    const label = document.createElement('span'); label.textContent = `映射 ${index + 1}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除';
    remove.addEventListener('click', (event) => { event.stopPropagation(); if (!config) return; config.mappings = config.mappings.filter((_, item) => item !== index); selectedMapping = -1; selectMapping(-1); renderMappings(); renderCorrections(); changed(); });
    head.append(label, remove); row.append(head);
    function rowSelect(title: string, entries: { value: string; label: string }[], value: string, key: keyof DriverMapping): HTMLSelectElement {
      const wrapper = document.createElement('label'); wrapper.textContent = title;
      const select = document.createElement('select'); options(select, entries, value);
      select.addEventListener('change', () => { if (!config) return; config.mappings = config.mappings.map((item, i) => i === index ? { ...item, [key]: select.value } as DriverMapping : item); selectMapping(index); renderCorrections(); changed(); });
      wrapper.append(select); row.append(wrapper); return select;
    }
    rowSelect('源关节', mappingEntries('source', mapping.sourcePath), mapping.sourcePath, 'sourcePath');
    rowSelect('方向终点 · 可选', mappingEntries('source', mapping.sourceEndPath ?? ''), mapping.sourceEndPath ?? '', 'sourceEndPath');
    rowSelect('目标骨或控制骨', mappingEntries('target', mapping.target), mapping.target, 'target');
    const compact = document.createElement('div'); compact.className = 'compact';
    const modeWrap = document.createElement('label'); modeWrap.textContent = '驱动方式';
    const mode = document.createElement('select'); options(mode, [
      { value: 'fk-bone', label: 'FK 骨骼' }, { value: 'ik-target', label: 'IK 目标' },
      { value: 'transform-control', label: '变换控制' }, { value: 'skip', label: '跳过' },
    ], mapping.mode);
    mode.addEventListener('change', () => { if (!config) return; config.mappings = config.mappings.map((item, i) => i === index ? { ...item, mode: mode.value as DriverMapping['mode'] } : item); changed(); });
    modeWrap.append(mode);
    const sideWrap = document.createElement('label'); sideWrap.textContent = '侧别';
    const side = document.createElement('select'); options(side, [{ value: 'center', label: '中央' }, { value: 'left', label: '左' }, { value: 'right', label: '右' }], mapping.side);
    side.addEventListener('change', () => { if (!config) return; config.mappings = config.mappings.map((item, i) => i === index ? { ...item, side: side.value as DriverMapping['side'] } : item); changed(); });
    sideWrap.append(side); compact.append(modeWrap, sideWrap); row.append(compact); host.append(row);
  });
}

function selectMapping(index: number): void {
  selectedMapping = index;
  const mapping = config?.mappings[index];
  selectedSourcePath = mapping?.sourcePath ?? '';
  selectedTargetBone = mapping?.target ?? '';
  targetView?.setSelectedBone(selectedTargetBone);
  document.querySelectorAll<HTMLElement>('.mapping-row').forEach((row) => row.classList.toggle('selected', Number(row.dataset.mappingIndex) === index));
  el<HTMLElement>('source-caption').textContent = selectedSourcePath ? `选中源关节：${selectedSourcePath}` : modelView?.ready ? '源 GLB 模型 · 可调水平角与俯角' : '源动作三维关节投影';
  el<HTMLElement>('target-caption').textContent = targetPreviewError ? `目标预览不可用：${targetPreviewError}` : selectedTargetBone ? `对应目标骨：${selectedTargetBone}${generated ? ` · ${generated.name}` : ''}` : generated ? `新增动画 ${generated.name}` : 'Spine 4.3 完整工程预览';
  renderBoneBrowsers();
  renderAt(currentSeconds);
}

function renderCorrections(): void {
  const host = el<HTMLDivElement>('correction-list');
  host.replaceChildren();
  if (!config || !config.chainCorrections.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '暂无局部修正。'; host.append(empty); return;
  }
  const draft = config;
  draft.chainCorrections.forEach((correction, index) => {
    const row = document.createElement('div'); row.className = 'correction-row';
    const head = document.createElement('div'); head.className = 'row-head';
    const title = document.createElement('span'); title.textContent = `修正 ${index + 1}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除';
    remove.addEventListener('click', () => { if (!config) return; config.chainCorrections = config.chainCorrections.filter((_, item) => item !== index); renderCorrections(); changed(); });
    head.append(title, remove); row.append(head);
    const targetWrap = document.createElement('label'); targetWrap.textContent = '目标骨或控制骨';
    const select = document.createElement('select');
    const mapped = new Set(draft.mappings.filter((item) => item.mode !== 'skip').map((item) => item.target));
    if (correction.target) mapped.add(correction.target);
    options(select, selectEntries([...mapped].filter(Boolean), '选择已映射目标'), correction.target);
    select.addEventListener('change', () => { if (!config) return; config.chainCorrections = config.chainCorrections.map((item, i) => i === index ? { ...item, target: select.value } : item); changed(); });
    targetWrap.append(select); row.append(targetWrap);
    const values = document.createElement('div'); values.className = 'field-triple';
    for (const [key, label] of [['rotationDegrees', '旋转 °'], ['offsetX', '水平偏移'], ['offsetY', '纵向偏移']] as const) {
      const wrapper = document.createElement('label'); wrapper.textContent = label;
      const input = document.createElement('input'); input.type = 'number'; input.step = key === 'rotationDegrees' ? '1' : '0.5'; input.value = String(correction[key] ?? 0);
      input.addEventListener('change', () => { if (!config) return; config.chainCorrections = config.chainCorrections.map((item, i) => i === index ? { ...item, [key]: Number(input.value) } : item); changed(); });
      wrapper.append(input); values.append(wrapper);
    }
    row.append(values); host.append(row);
  });
}

function changed(): void {
  stateVersion++;
  const hadGenerated = !!generated;
  generated = null;
  targetView?.clearGenerated();
  el<HTMLElement>('stage-state').textContent = '参数已变更 · 需重新生成';
  if (hadGenerated) el<HTMLElement>('target-caption').textContent = '上次生成的预览已失效 · 重新生成后更新';
  refresh();
}
function refresh(): void {
  const ready = !!(source && target && config && readinessIssues(config, source.motion, target.summary).length === 0);
  const issues = source && target && config ? readinessIssues(config, source.motion, target.summary) : [];
  el<HTMLButtonElement>('generate').disabled = !ready;
  el<HTMLButtonElement>('save-config').disabled = !ready;
  el<HTMLButtonElement>('save-output').disabled = !generated;
  el<HTMLButtonElement>('play').disabled = !source || !config;
  el<HTMLButtonElement>('step-back').disabled = !source || !config;
  el<HTMLButtonElement>('step-forward').disabled = !source || !config;
  el<HTMLInputElement>('time').disabled = !source || !config;
  el<HTMLElement>('draft-state').textContent = !source || !target ? '等待素材' : issues.length ? `${issues.length} 项待设` : generated ? '已生成' : '可生成';
  if (issues.length) showStatus(issues.join(' · '));
  renderAt(currentSeconds);
}
function renderAt(seconds: number): void {
  if (!source || !config) return;
  const start = config.source.rangeSeconds[0], end = config.source.rangeSeconds[1];
  currentSeconds = Math.max(start, Math.min(end, seconds));
  el<HTMLInputElement>('time').value = String(currentSeconds);
  el<HTMLElement>('time-value').textContent = `${(currentSeconds - start).toFixed(2)} / ${(end - start).toFixed(2)} s`;
  try {
    if (modelView?.ready) modelView.render(source.motion, config, currentSeconds, selectedSourcePath);
    else sourceView.render(source.motion, config, currentSeconds, selectedSourcePath);
  } catch (error) { el<HTMLElement>('source-caption').textContent = `预览错误：${message(error)}`; sourceView.clear(message(error)); el<HTMLElement>('source-model-canvas').parentElement?.classList.remove('model-ready'); }
  try {
    const live = generated ? null : liveFrameAt(currentSeconds);
    targetView?.setLiveFrame(live);
    targetView?.seek(currentSeconds - start);
    if (live && !targetPreviewError) el<HTMLElement>('target-caption').textContent = selectedTargetBone ? `对应目标骨：${selectedTargetBone} · 当前帧实时预览` : '当前帧实时预览 · 保存前仍需生成动画';
  }
  catch (error) { targetPreviewError = message(error); el<HTMLElement>('target-caption').textContent = `预览错误：${targetPreviewError}`; }
}
function liveFrameAt(seconds: number): DriverFrame | null {
  if (!source || !target || !config) return null;
  try {
    if (!liveTransfer || liveTransfer.version !== stateVersion || liveTransfer.source !== source.motion || liveTransfer.target !== target.summary || liveTransfer.config !== config) {
      liveTransfer = { version: stateVersion, source: source.motion, target: target.summary, config, transfer: createTransfer(source.motion, target.summary, config) };
    }
    return liveTransfer.transfer.poseAt(seconds);
  } catch { return null; }
}
function field(id: string, event: 'input' | 'change', update: (value: HTMLInputElement | HTMLSelectElement) => void): void {
  el<HTMLInputElement>(id).addEventListener(event, () => { if (!config) return; update(el<HTMLInputElement>(id)); changed(); });
}

el<HTMLButtonElement>('open-source').addEventListener('click', async () => {
  try {
    const input = await window.spw.openSource(); if (!input) return;
    showStatus('正在解析 GLB 骨架与动画…');
    source = { input, motion: await openGlb(input.bytes) };
    el<HTMLElement>('source-name').textContent = input.name;
    renderBoneBrowsers();
    try {
      const hasModel = await modelView?.load(input.bytes);
      el<HTMLElement>('source-model-canvas').parentElement?.classList.toggle('model-ready', !!hasModel);
      el<HTMLElement>('source-caption').textContent = hasModel ? '源 GLB 三维模型 · 可调水平角与俯角' : 'GLB 无网格 · 显示三维关节投影';
    } catch (error) {
      el<HTMLElement>('source-model-canvas').parentElement?.classList.remove('model-ready');
      el<HTMLElement>('source-caption').textContent = `模型不可用，显示三维关节投影：${message(error)}`;
    }
    loadDraft();
    if (!target) showStatus(`已读取 ${source.motion.joints.length} 个关节、${source.motion.clips.length} 个动作。继续载入目标 JSON。`);
  } catch (error) { showStatus(`GLB 载入失败：${message(error)}`, true); }
});
el<HTMLButtonElement>('open-target').addEventListener('click', async () => {
  const operation = ++targetLoadSerial;
  stateVersion++;
  const previous = { target, config };
  generated = null;
  targetView?.clearGenerated();
  targetView?.seek(0);
  playing = false;
  el<HTMLButtonElement>('play').textContent = '▶';
  el<HTMLButtonElement>('save-output').disabled = true;
  el<HTMLElement>('stage-state').textContent = '正在更换目标 · 旧生成结果已失效';
  el<HTMLElement>('target-caption').textContent = '正在载入目标工程，旧生成预览已失效';
  showStatus('正在选择目标工程…');
  target = null;
  config = null;
  refresh();
  try {
    const input = await window.spw.openTarget();
    if (operation !== targetLoadSerial) return;
    if (!input) {
      target = previous.target; config = previous.config; refresh();
      showStatus('已取消目标重选；旧生成结果已失效，可重新生成。');
      return;
    }
    showStatus('正在读取 Spine 4.3 工程数据…');
    const parsed = readSpineTarget(input.jsonText, { atlasText: input.atlasText, availablePageNames: input.pages.map((page) => page.name) });
    const skin = parsed.summary.skins.includes('default') ? 'default' : (parsed.summary.skins[0] ?? '');
    try {
      if (!targetView) throw new Error(targetPreviewError);
      await targetView.load(input.jsonText, { atlasText: input.atlasText, pages: input.pages }, skin);
      targetPreviewError = '';
      el<HTMLElement>('target-caption').textContent = `${parsed.summary.bones.length} 骨 · ${parsed.summary.animations.length} 原动画 · ${input.pages.length} 页贴图`;
    } catch (error) { targetPreviewError = message(error); el<HTMLElement>('target-caption').textContent = `目标预览不可用：${targetPreviewError}`; }
    if (operation !== targetLoadSerial) return;
    target = { input, ...parsed };
    el<HTMLElement>('target-name').textContent = input.name;
    renderBoneBrowsers();
    loadDraft();
    if (!source) showStatus('目标工程已读取。继续载入 GLB 动作。');
  } catch (error) {
    if (operation !== targetLoadSerial) return;
    target = previous.target; config = previous.config; refresh();
    showStatus(`目标载入失败：${message(error)}`, true);
  }
});
el<HTMLButtonElement>('choose-output').addEventListener('click', async () => {
  try { const directory = await window.spw.chooseOutput(); if (!directory || !config) return; config.output.directory = directory; el<HTMLElement>('output-path').textContent = directory; changed(); }
  catch (error) { showStatus(`无法选择输出目录：${message(error)}`, true); }
});
el<HTMLButtonElement>('open-config').addEventListener('click', async () => {
  try {
    const result = await window.spw.openConfig(); if (!result) return;
    const loaded = validateConfig(JSON.parse(result.jsonText) as unknown);
    pendingConfig = loaded;
    if (source && target) loadDraft();
    else showStatus('配置已读取。请载入对应的 GLB 与 Spine 素材，随后核对骨骼映射并选择输出目录。');
  } catch (error) { showStatus(`配置读取失败：${message(error)}`, true); }
});
el<HTMLButtonElement>('save-config').addEventListener('click', async () => {
  try { if (!config) return; validateConfig(config); const path = await window.spw.saveConfig(`${JSON.stringify(config, null, 2)}\n`); if (path) showStatus(`配置已保存：${path}`); }
  catch (error) { showStatus(`配置保存失败：${message(error)}`, true); }
});

field('clip', 'change', (input) => {
  if (!config || !source) return;
  config.source.clipId = input.value;
  const clip = source.motion.clips.find((item) => item.id === input.value);
  if (clip) { config.source.rangeSeconds = [0, clip.durationSeconds]; numbered('range-start', 0); numbered('range-end', clip.durationSeconds); el<HTMLInputElement>('time').max = String(clip.durationSeconds); currentSeconds = 0; }
});
field('range-start', 'change', (input) => { if (config) { config.source.rangeSeconds = [Number(input.value), config.source.rangeSeconds[1]]; el<HTMLInputElement>('time').min = input.value; } });
field('range-end', 'change', (input) => { if (config) { config.source.rangeSeconds = [config.source.rangeSeconds[0], Number(input.value)]; el<HTMLInputElement>('time').max = input.value; } });
field('front-axis', 'change', (input) => { if (config) config.source.frontAxis = input.value; });
field('up-axis', 'change', (input) => { if (config) config.source.upAxis = input.value; });
field('skin', 'change', (input) => { if (config) config.target.skin = input.value; });
field('direction-id', 'change', (input) => { if (config) config.target.directionId = input.value.trim(); });
field('display-animation', 'change', (input) => { if (config) { config.target.displayAnimation = input.value || undefined; targetView?.setDisplayAnimation(input.value); } });
field('yaw', 'input', (input) => { if (config) { config.view.yawDegrees = Number(input.value); el<HTMLOutputElement>('yaw-value').value = `${input.value}°`; } });
field('pitch', 'change', (input) => { if (config) config.view.pitchDegrees = Number(input.value); });
field('mirror', 'change', (input) => { if (config) config.view.mirror = (input as HTMLInputElement).checked; });
field('source-foot', 'change', (input) => { if (config) config.anchors.sourceFootPath = input.value; });
field('target-foot', 'change', (input) => { if (config) config.anchors.targetFootBone = input.value; });
field('scale', 'change', (input) => { if (config) config.anchors.scale = Number(input.value); });
field('offset-x', 'change', (input) => { if (config) config.anchors.offsetX = Number(input.value); });
field('offset-y', 'change', (input) => { if (config) config.anchors.offsetY = Number(input.value); });
field('animation-name', 'change', (input) => { if (config) config.output.animationName = input.value.trim(); });
field('sample-hz', 'change', (input) => { if (config) config.sampleHz = Number(input.value); });
el<HTMLButtonElement>('add-mapping').addEventListener('click', () => {
  if (!config) return;
  config.mappings = [...config.mappings, { sourcePath: '', target: '', mode: 'fk-bone', side: 'center' }];
  renderMappings(); changed();
});
el<HTMLInputElement>('source-search').addEventListener('input', () => { renderMappings(); renderBoneBrowsers(); });
el<HTMLInputElement>('target-search').addEventListener('input', () => { renderMappings(); renderBoneBrowsers(); });
el<HTMLButtonElement>('add-correction').addEventListener('click', () => {
  if (!config) return;
  const targetBone = config.mappings.find((mapping) => mapping.mode !== 'skip' && mapping.target)?.target ?? '';
  config.chainCorrections = [...config.chainCorrections, { target: targetBone, rotationDegrees: 0, offsetX: 0, offsetY: 0 }];
  renderCorrections(); changed();
});
for (const angle of [0, 45, -45, 90, -90, 135, -135, 180]) {
  const button = document.createElement('button'); button.textContent = `${angle}°`; button.type = 'button';
  button.addEventListener('click', () => { if (!config) return; config.view.yawDegrees = angle; el<HTMLInputElement>('yaw').value = String(angle); el<HTMLOutputElement>('yaw-value').value = `${angle}°`; changed(); });
  el<HTMLElement>('quick-angles').append(button);
}

el<HTMLInputElement>('time').addEventListener('input', (event) => { playing = false; el<HTMLButtonElement>('play').textContent = '▶'; renderAt(Number((event.target as HTMLInputElement).value)); });
for (const [id, direction] of [['step-back', -1], ['step-forward', 1]] as const) {
  el<HTMLButtonElement>(id).addEventListener('click', () => {
    if (!config) return;
    playing = false;
    el<HTMLButtonElement>('play').textContent = '▶';
    renderAt(stepFrame(config.source.rangeSeconds[0], currentSeconds, direction as -1 | 1, config.source.rangeSeconds[1], config.sampleHz));
  });
}
function tick(now: number): void {
  if (!playing || !config) return;
  const end = config.source.rangeSeconds[1];
  const speed = Number(el<HTMLSelectElement>('playback-speed').value);
  renderAt(Math.min(end, playFrom + (now - playStarted) / 1000 * speed));
  if (currentSeconds >= end) { playing = false; el<HTMLButtonElement>('play').textContent = '▶'; return; }
  requestAnimationFrame(tick);
}
el<HTMLButtonElement>('play').addEventListener('click', () => {
  if (!config) return;
  playing = !playing;
  el<HTMLButtonElement>('play').textContent = playing ? 'Ⅱ' : '▶';
  if (playing) { playFrom = currentSeconds >= config.source.rangeSeconds[1] ? config.source.rangeSeconds[0] : currentSeconds; playStarted = performance.now(); requestAnimationFrame(tick); }
});
el<HTMLSelectElement>('playback-speed').addEventListener('change', () => {
  if (!playing) return;
  playFrom = currentSeconds;
  playStarted = performance.now();
});

el<HTMLButtonElement>('generate').addEventListener('click', async () => {
  if (!source || !target || !config) return;
  const version = stateVersion;
  const currentSource = source, currentTarget = target, currentConfig = config;
  try {
    const issues = readinessIssues(currentConfig, currentSource.motion, currentTarget.summary);
    if (issues.length) throw new Error(issues.join(' · '));
    showStatus('正在采样 GLB 并生成 Spine 4.3 动画…');
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (version !== stateVersion) return;
    const clip = generateClip(currentSource.motion, currentTarget.summary, currentConfig);
    generated = { ...appendAnimation(currentTarget.document, clip), targetResourceId: currentTarget.input.resourceId };
    const assets: SpinePreviewAssets = { atlasText: currentTarget.input.atlasText, pages: currentTarget.input.pages };
    try {
      if (!targetView) throw new Error(targetPreviewError);
      await targetView.load(generated.jsonText, assets, currentConfig.target.skin, currentConfig.target.displayAnimation, generated.name);
      if (version !== stateVersion) return;
      targetPreviewError = '';
      el<HTMLElement>('target-caption').textContent = `新增动画 ${generated.name} · ${clip.frames.length} 帧`;
    } catch (error) { targetPreviewError = message(error); el<HTMLElement>('target-caption').textContent = `已生成，预览失败：${targetPreviewError}`; }
    if (version !== stateVersion) return;
    el<HTMLElement>('stage-state').textContent = `已生成 · ${generated.name}`;
    showStatus(`已生成 ${clip.frames.length} 帧，请检查预览并保存完整副本。`);
    refresh();
  } catch (error) { generated = null; showStatus(`生成失败：${message(error)}`, true); refresh(); }
});
el<HTMLButtonElement>('save-output').addEventListener('click', async () => {
  if (!generated || !config) return;
  try {
    const result = await window.spw.saveOutput({ targetResourceId: generated.targetResourceId, outputDirectory: config.output.directory, animationName: generated.name, jsonText: generated.jsonText, configText: `${JSON.stringify(config, null, 2)}\n` });
    showStatus(`完整副本已保存：${result.directory}`);
  } catch (error) { showStatus(`保存失败：${message(error)}`, true); }
});
window.addEventListener('resize', () => renderAt(currentSeconds));
showStatus('先载入带骨骼动作的 GLB 和 Spine 4.3 导出。');
