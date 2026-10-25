import type { SpineAnimationJob, SpineChannelPolicy, SpineLocalCorrection, SpineObjectKind, SpineObjectMapping, SpineSourceReadResult, SpineTransferConfig } from '../core/spine-contracts.ts';
import { readSpineSource } from '../source/spine-source.ts';
import { validateSpineConfig } from '../config/spine-config.ts';
import { autoMapSpine } from '../transfer/spine-auto-map.ts';
import { createSpineDraft } from '../transfer/spine-draft.ts';
import type { SpineMigrationReport } from '../transfer/spine-timelines.ts';
import { appendDirectAnimation } from '../output/spine43-direct.ts';
import { Spine43Preview } from '../preview/spine43-preview.ts';
import { PendingSpineConfig, SpineGenerationGate } from './spine-state.ts';
import { playbackAt } from './playback-clock.ts';
import { formatSpineReportSummary, formatSpineReportText } from './spine-report.ts';
import { SpineAiPanel } from './ai-panel.ts';

type OpenSpine = { resourceId: string; path: string; name: string; projectHash?:string; skeletonName?:string; nativeProject?: boolean; jsonPath?: string; atlasPath?: string; jsonText: string; atlasText: string; pages: { name: string; bytes: ArrayBuffer }[] };
type LoadedSpine = { input: OpenSpine; read: SpineSourceReadResult };
type SavedOutput = Awaited<ReturnType<Window['spw']['saveOutput']>>;
let nativeHandoff: SavedOutput | null = null;
let saving = false;
let applyingConfig = false;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let hasDisplayedDraft = false;
let emptyDestinationNoop = false;
let automaticMapping = false;
let mappingAnalysis: ReturnType<typeof autoMapSpine> | null = null;

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing UI element #${id}`);
  return found as T;
};
const status = (value: string, error = false): void => {
  const node = el<HTMLParagraphElement>('status');
  node.textContent = value;
  node.classList.toggle('error', error);
};
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const selectOptions = (node: HTMLSelectElement, values: readonly { value: string; label: string }[], selected = ''): void => {
  node.replaceChildren(...values.map(({ value, label }) => {
    const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
  }));
  node.value = selected;
};
const names = (items: readonly string[], empty: string): { value: string; label: string }[] => [
  { value: '', label: empty }, ...items.map((value) => ({ value, label: value })),
];
const cleanName = (value: string): string => `spw02_${value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'take'}`;
const resources = (input: OpenSpine) => ({ atlasText: input.atlasText, availablePageNames: input.pages.map((page) => page.name) });
const previewAssets = (input: OpenSpine) => ({ atlasText: input.atlasText, pages: input.pages });
const identity = (loaded: LoadedSpine) => ({
  jsonFile: loaded.input.path,
  atlasFile: loaded.input.atlasPath ?? loaded.input.path.replace(/\.json$/i, '.atlas'),
  pageFiles: loaded.input.pages.map((page) => page.name),
  skeletonFingerprint: loaded.read.summary.skeletonFingerprint,
  fileHash: loaded.read.summary.fileHash,
});

let source: LoadedSpine | null = null;
let target: LoadedSpine | null = null;
let config: SpineTransferConfig | null = null;
const pendingConfigs = new PendingSpineConfig<SpineTransferConfig>();
let outputDirectory = '';
let currentSeconds = 0;
let playing = false;
let playStarted = 0;
let playFrom = 0;
let playbackFrame: number | undefined;
let previewReady = false;
let reportText = '';
let sourceLoadSerial = 0;
let targetLoadSerial = 0;
const gate = new SpineGenerationGate();
let sourceView: Spine43Preview | null = null;
let targetView: Spine43Preview | null = null;
try { sourceView = new Spine43Preview(el<HTMLCanvasElement>('source-canvas')); }
catch (error) { el<HTMLElement>('source-caption').textContent = `来源预览不可用：${message(error)}`; }
try { targetView = new Spine43Preview(el<HTMLCanvasElement>('target-canvas')); }
catch (error) { el<HTMLElement>('target-caption').textContent = `目标预览不可用：${message(error)}`; }

const aiPanel = new SpineAiPanel({
  pair:()=> source && target && config ? {
    source:{projectPath:source.input.path,skeletonName:source.input.skeletonName??source.input.name,projectHash:source.input.projectHash??'',document:source.read.document,jsonText:source.input.jsonText,atlasText:source.input.atlasText,skin:config.sourceSkin},
    target:{projectPath:target.input.path,skeletonName:target.input.skeletonName??target.input.name,projectHash:target.input.projectHash??'',document:target.read.document,jsonText:target.input.jsonText,atlasText:target.input.atlasText,skin:config.targetSkin},
    sourceResourceId:source.input.resourceId,targetResourceId:target.input.resourceId,
  }:null,
  animation:selectedAnimation,mappings:()=>config?.objectMappings??[],
  state:state=>{if(config){config={...config,aiReview:state};invalidate();}},
  commit:(mappings,state)=>{if(config){automaticMapping=false;config={...config,objectMappings:mappings,aiReview:state};invalidate();renderMappings();renderSuggestions();}},
  selection:selection=>{sourceView?.setRigSelection(selection?.source??null);targetView?.setRigSelection(selection?.target??null);},
});

function selectedAnimation(): string { return el<HTMLSelectElement>('clip').value; }
function currentJob(): SpineAnimationJob | null {
  return config?.animationJobs.find((item) => item.sourceAnimation === selectedAnimation()) ?? null;
}
function animationDuration(name: string): number {
  return source?.read.summary.animations.find((item) => item.name === name)?.durationSeconds ?? 0;
}
function updateJob(update: (job: SpineAnimationJob) => SpineAnimationJob): void {
  if (!config) return;
  const name = selectedAnimation();
  const existing = currentJob() ?? { sourceAnimation: name, rangeSeconds: [0, animationDuration(name)] as const, outputName: cleanName(name), corrections: [] };
  const other = config.animationJobs.filter((item) => item.sourceAnimation !== name);
  config = { ...config, animationJobs: [...other, update(existing)] };
  invalidate();
}
function createDraft(): SpineTransferConfig | null {
  if (!source || !target) return null;
  const first = source.read.summary.animations[0];
  if (!first) throw new Error('来源没有可迁移的动画');
  return {
    schemaVersion: 2, sourceKind: 'spine', source: identity(source), target: identity(target),
    sourceDirection: '', targetDirection: '', draftScope: 'body',
    sourceSkin: source.read.summary.skins.find((skin) => skin.name === 'default')?.name ?? source.read.summary.skins[0]?.name ?? '',
    targetSkin: target.read.summary.skins.find((skin) => skin.name === 'default')?.name ?? target.read.summary.skins[0]?.name ?? '',
    objectMappings: [], calibration: { rootScaleX: 1, rootScaleY: 1, corrections: [] },
    animationJobs: [{ sourceAnimation: first.name, rangeSeconds: [0, first.durationSeconds], outputName: cleanName(first.name), corrections: [] }],
    channelPolicies: [],
  };
}
function checkIdentity(candidate: SpineTransferConfig): void {
  if (!source || !target) return;
  if (candidate.source.skeletonFingerprint !== source.read.summary.skeletonFingerprint) throw new Error('配置的来源骨架与当前文件不同');
  if (candidate.target.skeletonFingerprint !== target.read.summary.skeletonFingerprint) throw new Error('配置的目标骨架与当前文件不同');
  if (!candidate.source.pageFiles.every((page) => source?.input.pages.some((item) => item.name === page))) throw new Error('配置的来源贴图页与当前文件不同');
  if (!candidate.target.pageFiles.every((page) => target?.input.pages.some((item) => item.name === page))) throw new Error('配置的目标贴图页与当前文件不同');
}
async function applyConfig(candidate: SpineTransferConfig): Promise<void> {
  if (!source || !target) return;
  checkIdentity(candidate);
  applyingConfig = true;
  aiPanel.reset();
  hasDisplayedDraft = false;
  config = { ...candidate, source: identity(source), target: identity(target) };
  automaticMapping = false;
  mappingAnalysis = null;
  renderSuggestions();
  el<HTMLElement>('mapping-analysis').textContent = '可离线采样当前动作并补充映射，保留已有对应关系。';
  const action = config.animationJobs[0]?.sourceAnimation ?? source.read.summary.animations[0]?.name ?? '';
  selectOptions(el<HTMLSelectElement>('clip'), source.read.summary.animations.map((item) => ({ value: item.name, label: `${item.name} · ${item.durationSeconds.toFixed(3)} s` })), action);
  selectOptions(el<HTMLSelectElement>('source-skin'), source.read.summary.skins.map((item) => ({ value: item.name, label: item.name })), config.sourceSkin);
  selectOptions(el<HTMLSelectElement>('target-skin'), target.read.summary.skins.map((item) => ({ value: item.name, label: item.name })), config.targetSkin);
  selectOptions(el<HTMLSelectElement>('target-display'), names(target.read.summary.animations.map((item) => item.name), '仅设置姿势'), config.targetDisplayAnimation ?? '');
  el<HTMLSelectElement>('draft-scope').value = config.draftScope ?? 'body';
  el<HTMLInputElement>('source-direction').value = config.sourceDirection;
  el<HTMLInputElement>('target-direction').value = config.targetDirection;
  el<HTMLElement>('source-name').textContent = source.input.name;
  el<HTMLElement>('target-name').textContent = target.input.name;
  showJob(); renderMappings(); renderDependencies(); renderCorrections();
  el<HTMLButtonElement>('add-mapping').disabled = false;
  el<HTMLButtonElement>('suggest-mappings').disabled = false;
  el<HTMLButtonElement>('add-correction').disabled = false;
  invalidate();
  sourceView?.setDisplayAnimation(action);
  targetView?.setDisplayAnimation(config.targetDisplayAnimation ?? '');
  try {
    await Promise.all([
      sourceView?.load(source.input.jsonText, previewAssets(source.input), config.sourceSkin, action),
      targetView?.load(target.input.jsonText, previewAssets(target.input), config.targetSkin, config.targetDisplayAnimation ?? ''),
    ]);
    aiPanel.reset(candidate.aiReview);
    renderAt(currentSeconds);
  } catch (error) { status(`配置已载入，预览未就绪：${message(error)}`, true); }
  finally { applyingConfig = false; scheduleDraft(); }
}
function showJob(): void {
  if (!config || !source) return;
  const job = currentJob();
  if (!job) return;
  el<HTMLInputElement>('range-start').value = String(job.rangeSeconds[0]);
  el<HTMLInputElement>('range-end').value = String(job.rangeSeconds[1]);
  const raw = target?.read.document as {animations?:Record<string,unknown>};
  const emptyNames = Object.entries(raw?.animations ?? {}).filter(([,value]) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0).map(([name]) => name);
  selectOptions(el<HTMLSelectElement>('target-empty'), [{value:'',label:'自动新增动画（默认）'}, ...emptyNames.map(name => ({value:name,label:`填入空动画：${name}`}))], job.targetEmptyAnimation ?? '');
  el<HTMLInputElement>('animation-name').value = job.outputName;
  el<HTMLInputElement>('animation-name').disabled = !!job.targetEmptyAnimation;
  const time = el<HTMLInputElement>('time');
  time.min = String(job.rangeSeconds[0]); time.max = String(job.rangeSeconds[1]); time.disabled = false;
  currentSeconds = job.rangeSeconds[0];
  if (playing) { playFrom = currentSeconds; playStarted = performance.now(); }
  renderAt(currentSeconds);
}
function invalidate(): void {
  aiPanel.invalidateReport();
  const aiState=aiPanel.syncMappings();
  if(aiState && config)config={...config,aiReview:aiState};
  gate.invalidate();
  previewReady = false;
  el<HTMLButtonElement>('save-output').disabled = true;
  el<HTMLElement>('stage-state').textContent = hasDisplayedDraft ? '映射已变更 · 预览待刷新' : '正在准备新增动画';
  refresh();
  scheduleDraft();
}
function scheduleDraft(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (applyingConfig || !source || !target || !config || !currentJob() || !el<HTMLInputElement>('auto-refresh').checked) return;
  refreshTimer = setTimeout(() => { refreshTimer = undefined; el<HTMLButtonElement>('generate').click(); }, 350);
}
function refresh(): void {
  nativeSaveLabel();
  const ready = Boolean(source && target && config && currentJob());
  el<HTMLButtonElement>('generate').disabled = !ready;
  el<HTMLButtonElement>('save-config').disabled = !ready;
  el<HTMLButtonElement>('save-output').disabled = saving || !gate.output || !previewReady || emptyDestinationNoop;
  for (const id of ['play', 'step-back', 'step-forward'] as const) el<HTMLButtonElement>(id).disabled = !source || !config;
  el<HTMLInputElement>('time').disabled = !source || !config;
  el<HTMLElement>('draft-state').textContent = !source || !target ? '等待素材' : gate.output ? '草稿可预览' : '待刷新';
  renderAt(currentSeconds);
}
function renderAt(seconds: number): void {
  const job = currentJob();
  if (!source || !job) return;
  currentSeconds = Math.max(job.rangeSeconds[0], Math.min(job.rangeSeconds[1], seconds));
  el<HTMLInputElement>('time').value = String(currentSeconds);
  el<HTMLElement>('time-value').textContent = `${(currentSeconds - job.rangeSeconds[0]).toFixed(2)} / ${(job.rangeSeconds[1] - job.rangeSeconds[0]).toFixed(2)} s`;
  try { sourceView?.seek(currentSeconds); }
  catch (error) { el<HTMLElement>('source-caption').textContent = `来源预览错误：${message(error)}`; }
  try { targetView?.seek(hasDisplayedDraft ? currentSeconds - job.rangeSeconds[0] : currentSeconds); }
  catch (error) { el<HTMLElement>('target-caption').textContent = `目标预览错误：${message(error)}`; }
}

function objectNames(loaded: LoadedSpine | null, kind: SpineObjectKind): string[] {
  if (!loaded) return [];
  const summary = loaded.read.summary;
  if (kind === 'bone') return summary.bones.map((item) => item.name);
  if (kind === 'slot') return summary.slots.map((item) => item.name);
  if (['ik', 'transform', 'path', 'physics'].includes(kind)) return summary.constraints.filter((item) => item.kind === kind).map((item) => item.name);
  const raw = loaded.read.document as Record<string, unknown>;
  if (kind === 'event') return Object.keys((raw.events ?? {}) as Record<string, unknown>);
  const skins = Array.isArray(raw.skins) ? raw.skins as { attachments?: Record<string, Record<string, unknown>> }[] : [];
  return [...new Set(skins.flatMap((skin) => Object.values(skin.attachments ?? {}).flatMap((attachments) => Object.keys(attachments))))];
}
function dataList(id: string, entries: readonly string[]): HTMLDataListElement {
  const list = document.createElement('datalist'); list.id = id;
  list.replaceChildren(...entries.map((value) => { const item = document.createElement('option'); item.value = value; return item; }));
  return list;
}
function textField(label: string, value: string, listId: string, entries: readonly string[], onChange: (value: string) => void): HTMLElement {
  const wrap = document.createElement('label'); wrap.textContent = label;
  const input = document.createElement('input'); input.type = 'text'; input.value = value; input.setAttribute('list', listId);
  input.addEventListener('change', () => onChange(input.value.trim()));
  wrap.append(input, dataList(listId, entries)); return wrap;
}
function updateMapping(index: number, next: SpineObjectMapping): void {
  if (!config) return;
  automaticMapping = false;
  config = { ...config, objectMappings: config.objectMappings.map((item, at) => at === index ? {...next,provenance:{origin:'manual'}} : item) };
  invalidate(); renderMappings(); renderSuggestions();
}
function renderMappings(): void {
  const host = el<HTMLDivElement>('mapping-list'); host.replaceChildren();
  if (!config?.objectMappings.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '尚无映射。点击自动分析并映射，或载入已保存的配置。'; host.append(empty); return; }
  const query = el<HTMLInputElement>('mapping-search').value.trim().toLowerCase();
  config.objectMappings.forEach((mapping, index) => {
    if (query && !`${mapping.kind} ${mapping.source} ${mapping.target}`.toLowerCase().includes(query)) return;
    const row = document.createElement('div'); row.className = 'mapping-row';
    const header = document.createElement('div'); header.className = 'row-head';
    const label = document.createElement('span'); label.textContent = `${index + 1}. ${mapping.source || '未设'} → ${mapping.target || '未设'}`;
    const locate = document.createElement('button'); locate.type = 'button'; locate.textContent = '定位'; locate.disabled = mapping.kind !== 'bone';
    locate.addEventListener('click', () => { sourceView?.setSelectedBone(mapping.source); targetView?.setSelectedBone(mapping.target); renderAt(currentSeconds); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除';
    remove.addEventListener('click', () => { if (!config) return; automaticMapping = false; config = { ...config, objectMappings: config.objectMappings.filter((_, at) => at !== index) }; invalidate(); renderMappings(); renderSuggestions(); });
    header.append(label, locate, remove); row.append(header);
    const controls = document.createElement('div'); controls.className = 'compact';
    for (const [key, values] of [
      ['kind', ['bone', 'slot', 'ik', 'transform', 'path', 'physics', 'attachment', 'event']],
      ['side', ['left', 'right', 'center', 'unknown']],
      ['drive', ['direct', 'fk-bone', 'ik-target', 'transform-control', 'skip']],
    ] as const) {
      const wrap = document.createElement('label'); wrap.textContent = { kind: '类型', side: '侧别', drive: '驱动' }[key];
      const select = document.createElement('select'); selectOptions(select, values.map((value) => ({ value, label: ({bone:'骨骼',slot:'槽',ik:'IK',transform:'变换约束',path:'路径',physics:'物理',attachment:'附件',event:'事件',left:'左',right:'右',center:'中',unknown:'未指定',direct:'直接', 'fk-bone':'FK 骨骼', 'ik-target':'IK 控制点', 'transform-control':'变换控制点',skip:'不迁移'} as Record<string,string>)[value] ?? value })), mapping[key]);
      select.addEventListener('change', () => {
        if (key === 'kind' && select.value === 'attachment') updateMapping(index, { ...mapping, kind: 'attachment', sourceSkin: config?.sourceSkin ?? '', sourceSlot: '', targetSkin: config?.targetSkin ?? '', targetSlot: '' });
        else if (key === 'kind') updateMapping(index, { ...mapping, kind: select.value as Exclude<SpineObjectKind, 'attachment'> });
        else updateMapping(index, { ...mapping, [key]: select.value } as SpineObjectMapping);
      });
      wrap.append(select); controls.append(wrap);
    }
    row.append(controls);
    const pair = document.createElement('div'); pair.className = 'mapping-name-grid';
    pair.append(
      textField('源对象', mapping.source, `source-${index}`, objectNames(source, mapping.kind), (value) => updateMapping(index, { ...mapping, source: value })),
      textField('目标对象', mapping.target, `target-${index}`, objectNames(target, mapping.kind), (value) => updateMapping(index, { ...mapping, target: value })),
    );
    row.append(pair);
    if (mapping.kind === 'attachment') {
      const context = document.createElement('div'); context.className = 'mapping-context-grid';
      for (const [key, title, values] of [
        ['sourceSkin', '源皮肤', source?.read.summary.skins.map((item) => item.name) ?? []],
        ['sourceSlot', '源槽', source?.read.summary.slots.map((item) => item.name) ?? []],
        ['targetSkin', '目标皮肤', target?.read.summary.skins.map((item) => item.name) ?? []],
        ['targetSlot', '目标槽', target?.read.summary.slots.map((item) => item.name) ?? []],
      ] as const) {
        context.append(textField(title, mapping[key], `${key}-${index}`, values, (value) => updateMapping(index, { ...mapping, [key]: value })));
      }
      row.append(context);
    }
    host.append(row);
  });
}

function samePolicy(a: SpineChannelPolicy, b: Pick<SpineChannelPolicy, 'kind' | 'source' | 'channel' | 'sourceSkin' | 'sourceSlot'>): boolean {
  return a.kind === b.kind && a.source === b.source && a.channel === b.channel && a.sourceSkin === b.sourceSkin && a.sourceSlot === b.sourceSlot;
}
function renderDependencies(): void {
  const host = el<HTMLDivElement>('channel-list'); host.replaceChildren();
  const dependencies = source?.read.animationDependencies[selectedAnimation()] ?? [];
  const query = el<HTMLInputElement>('channel-search').value.trim().toLowerCase();
  el<HTMLElement>('channel-summary').textContent = dependencies.length
    ? `${dependencies.length} 个实际打键通道。未映射和不支持项会在生成报告中逐项列出。`
    : '载入源动作后列出所有实际打键通道。';
  for (const dependency of dependencies) {
    const description = `${dependency.kind} ${dependency.sourceSkin ?? ''} ${dependency.sourceSlot ?? ''} ${dependency.source} ${dependency.channel}`;
    if (query && !description.toLowerCase().includes(query)) continue;
    const row = document.createElement('div'); row.className = 'channel-row';
    const label = document.createElement('div');
    const heading = document.createElement('strong'); heading.textContent = `${dependency.kind} · ${dependency.source} · ${dependency.channel}`;
    const detail = document.createElement('small'); detail.textContent = `${dependency.sourceSkin ? `${dependency.sourceSkin}/${dependency.sourceSlot} · ` : ''}${dependency.keyCount} 键${dependency.chronological ? '' : ' · 时间顺序异常'}`;
    label.append(heading, detail);
    const applicable = config?.channelPolicies.filter((item) => samePolicy(item, dependency) && (item.sourceAnimation === undefined || item.sourceAnimation === selectedAnimation())) ?? [];
    const current = applicable.find((item) => item.sourceAnimation === selectedAnimation()) ?? applicable[0];
    const select = document.createElement('select');
    selectOptions(select, [
      { value: '', label: '按映射' }, { value: 'copy', label: '强制核对' }, { value: 'skip', label: '显式跳过' }, { value: 'unsupported', label: '不支持' },
    ], current?.decision ?? '');
    select.addEventListener('change', () => {
      if (!config) return;
      const remaining = config.channelPolicies.filter((item) => !(samePolicy(item, dependency) && item.sourceAnimation === selectedAnimation()));
      config = { ...config, channelPolicies: select.value ? [...remaining, {
        sourceAnimation: selectedAnimation(),
        kind: dependency.kind, source: dependency.source, channel: dependency.channel,
        decision: select.value as SpineChannelPolicy['decision'],
        reason: select.value === 'copy' ? '人工指定复制并核对目标对象' : select.value === 'skip' ? '人工确认：首轮范围外' : '当前工坊不支持此通道',
        ...(dependency.sourceSkin ? { sourceSkin: dependency.sourceSkin, sourceSlot: dependency.sourceSlot } : {}),
      }] : remaining };
      invalidate(); renderDependencies();
    });
    row.append(label, select);
    if (current) {
      const reason = document.createElement('input');
      reason.type = 'text';
      reason.className = 'channel-reason';
      reason.value = current.reason;
      reason.setAttribute('aria-label', `${dependency.source}.${dependency.channel} 处理原因`);
      reason.placeholder = '说明跳过或指定复制的原因';
      reason.addEventListener('change', () => {
        if (!config) return;
        const remaining = config.channelPolicies.filter((item) => !(samePolicy(item, dependency) && item.sourceAnimation === selectedAnimation()));
        config = { ...config, channelPolicies: [...remaining, {
          ...current,
          sourceAnimation: selectedAnimation(),
          reason: reason.value.trim(),
        }] };
        invalidate(); renderDependencies();
      });
      row.append(reason);
    }
    host.append(row);
  }
}
function renderCorrections(): void {
  const host = el<HTMLDivElement>('correction-list'); host.replaceChildren();
  const job = currentJob();
  if (!job?.corrections.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '此动作暂无局部修正。'; host.append(empty); return; }
  job.corrections.forEach((correction, index) => {
    const row = document.createElement('div'); row.className = 'correction-row';
    const heading = document.createElement('div'); heading.className = 'row-head';
    const title = document.createElement('span'); title.textContent = `修正 ${index + 1}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '删除';
    remove.addEventListener('click', () => { updateJob((item) => ({ ...item, corrections: item.corrections.filter((_, at) => at !== index) })); renderCorrections(); });
    heading.append(title, remove); row.append(heading);
    const update = (next: SpineLocalCorrection) => { updateJob((item) => ({ ...item, corrections: item.corrections.map((value, at) => at === index ? next : value) })); renderCorrections(); };
    row.append(textField('目标对象', correction.target, `correction-target-${index}`, objectNames(target, correction.kind), (value) => update({ ...correction, target: value })));
    row.append(textField('通道', correction.channel, `correction-channel-${index}`, ['rotate', 'translate', 'translatex', 'translatey', 'scale', 'shear'], (value) => update({ ...correction, channel: value })));
    const values = document.createElement('div'); values.className = 'field-triple';
    for (const [key, label] of [['rotationDegrees', '旋转 °'], ['offsetX', 'X 偏移'], ['offsetY', 'Y 偏移']] as const) {
      const wrap = document.createElement('label'); wrap.textContent = label;
      const input = document.createElement('input'); input.type = 'number'; input.step = '0.1'; input.value = String(correction[key] ?? 0);
      input.addEventListener('change', () => update({ ...correction, [key]: Number(input.value) }));
      wrap.append(input); values.append(wrap);
    }
    row.append(values); host.append(row);
  });
}
function renderSuggestions(): void {
  const host = el<HTMLDivElement>('suggestion-list'); host.replaceChildren();
  if (!source || !target || !config || !mappingAnalysis) return;
  const mapped = config.objectMappings.filter(item => item.kind === 'bone');
  const pending = mappingAnalysis.review.filter(item => !mapped.some(m => m.source === item.source));
  const heading = document.createElement('p'); heading.className = 'field-note';
  heading.textContent = `待确认 ${pending.length} 根打键骨骼（按动作幅度排序）；评分表示规则匹配程度，不是正确率。`;
  host.append(heading);
  for (const suggestion of pending) {
    const row = document.createElement('div'); row.className = 'suggestion-row';
    const label = document.createElement('span'); label.textContent = suggestion.source;
    const options = document.createElement('select'); options.setAttribute('aria-label', `${suggestion.source} 的目标候选`);
    const candidates = suggestion.candidates.filter(c => !mapped.some(m => m.target === c.target));
    selectOptions(options, [{ value: '', label: '选择并核对目标骨骼' }, ...candidates.map(c => ({ value: c.target, label: `${c.target} · ${c.score.toFixed(2)} · ${c.reason}` }))]);
    const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = '确认对应'; accept.disabled = true;
    options.addEventListener('change', () => { accept.disabled = !options.value; });
    accept.addEventListener('click', () => {
      if (!config || !target || !options.value) return;
      if (config.objectMappings.some(m => m.kind === 'bone' && (m.source === suggestion.source || m.target === options.value))) { renderSuggestions(); return; }
      const drive = target.read.summary.constraints.some(c => c.kind === 'ik' && c.target === options.value) ? 'ik-target' : 'fk-bone';
      config = { ...config, objectMappings: [...config.objectMappings, { kind: 'bone', source: suggestion.source, target: options.value, side: 'unknown', drive }] };
      invalidate(); renderMappings(); renderSuggestions();
    });
    row.append(label, options, accept); host.append(row);
  }
}
function analyzeMappings(): void {
  if (!source || !target || !config) return;
  try {
    mappingAnalysis = autoMapSpine(source.read.document, target.read.document, source.input.atlasText, target.input.atlasText,
      selectedAnimation(), config.sourceSkin, config.targetSkin, config.objectMappings, aiPanel.selections());
    const existing = config.objectMappings;
    config = { ...config, objectMappings: mappingAnalysis.mappings.map(mapping=>{
      const previous=existing.find(item=>item.kind===mapping.kind&&item.source===mapping.source&&item.target===mapping.target);
      return previous?{...mapping,provenance:previous.provenance}:{...mapping,provenance:{origin:'local-auto'}};
    }) };
    const result = mappingAnalysis;
    el<HTMLElement>('mapping-analysis').textContent = `本地采样 ${result.frames} 帧 · ${result.sampledBones} 根骨骼 · ${result.movingBones} 根有运动；当前 ${result.mappings.length} 项对应（本次新增 ${result.added}）。${result.profileName ? `匹配到参考配置：${result.profileName}。` : ''}已匹配的骨骼会先进入预览；其余骨骼和不兼容通道可略过，按画面需要再调整。`;
    invalidate(); renderMappings(); renderSuggestions(); renderDependencies();
  } catch (error) {
    mappingAnalysis = null; renderSuggestions();
    el<HTMLElement>('mapping-analysis').textContent = `自动分析未完成：${message(error)}。已有映射保留，可继续手动编辑。`;
  }
}
type MigrationReport = SpineMigrationReport;
function reportAsText(report: MigrationReport, outputName = currentJob()?.outputName ?? ''): string {
  return formatSpineReportText(report, {
    sourcePath: source?.input.path ?? '', targetPath: target?.input.path ?? '',
    sourceAnimation: selectedAnimation(), outputName, draft: true,
  });
}
function renderReport(report: MigrationReport): void {
  el<HTMLElement>('report-summary').textContent = formatSpineReportSummary(report, true);
  const host = el<HTMLDivElement>('report-list'); host.replaceChildren();
  for (const warning of report.warnings) {
    const line = document.createElement('p');
    line.className = 'review';
    line.textContent = `校准警告 · ${warning}`;
    host.append(line);
  }
  for (const item of report.channels) {
    const line = document.createElement('p');
    line.className = item.status === 'direct' || item.status === 'corrected' ? 'copied' : 'review';
    line.textContent = `${({direct:'已迁移',corrected:'已修正','needs-calibration':'已迁移，需调整','explicit-skip':'已略过',unmapped:'未映射，已略过',unsupported:'不兼容，已略过',conflict:'冲突，已略过'} as Record<string,string>)[item.status]} · ${item.kind} ${item.sourceSkin ? `${item.sourceSkin}/${item.sourceSlot}/` : ''}${item.source}.${item.channel}${item.target ? ` → ${item.target}` : ''} · ${item.reason}`;
    host.append(line);
  }
}

async function openSource(): Promise<void> {
  const serial = ++sourceLoadSerial;
  gate.invalidate(); previewReady = false; hasDisplayedDraft = false; source = null; config = null; stopPlayback(); aiPanel.reset();
  el<HTMLButtonElement>('save-output').disabled = true;
  el<HTMLElement>('source-name').textContent = '正在载入';
  refresh(); status('正在载入来源 Spine 工程；后台读取动作和图片，请稍候…');
  try {
    const input = await window.spw.openSpineSource();
    if (serial !== sourceLoadSerial) return;
    if (!input) { el<HTMLElement>('source-name').textContent = '尚未载入'; status('已取消来源选择；重新载入后再生成。'); return; }
    const read = readSpineSource(input.jsonText, resources(input));
    const loaded = { input, read };
    source = loaded;
    el<HTMLElement>('source-name').textContent = input.name;
    try {
      if (!sourceView) throw new Error('Spine WebGL 不可用');
      await sourceView.load(input.jsonText, previewAssets(input), read.summary.skins[0]?.name ?? '');
      if (serial !== sourceLoadSerial) return;
      el<HTMLElement>('source-caption').textContent = `${read.summary.bones.length} 骨 · ${read.summary.animations.length} 动作 · ${input.pages.length} 页贴图`;
    } catch (error) { el<HTMLElement>('source-caption').textContent = `来源预览不可用：${message(error)}`; }
    if (target) {
      const selected = pendingConfigs.take(checkIdentity, () => createDraft()!);
      await applyConfig(selected.config);
      automaticMapping = selected.config.objectMappings.length === 0;
      if (automaticMapping) analyzeMappings();
      status(selected.rejected
        ? `两份素材已读取，但待载入配置不匹配：${message(selected.rejected)}。已改用新草稿。`
        : '两份素材已读取。已自动分析映射，正在准备新增动画预览。', Boolean(selected.rejected));
    }
    else status(`来源已读取：${read.summary.animations.length} 个动作。继续载入目标工程。`);
    refresh();
  } catch (error) { source = null; config = null; el<HTMLElement>('source-name').textContent = '载入失败'; status(`来源载入失败：${message(error)}`, true); refresh(); }
}
async function openTarget(): Promise<void> {
  const serial = ++targetLoadSerial;
  gate.invalidate(); previewReady = false; hasDisplayedDraft = false; target = null; config = null; stopPlayback(); aiPanel.reset();
  el<HTMLButtonElement>('save-output').disabled = true;
  el<HTMLElement>('target-name').textContent = '正在载入';
  refresh(); status('正在载入目标 Spine 工程；后台读取动作和图片，请稍候…');
  try {
    const input = await window.spw.openTarget();
    if (serial !== targetLoadSerial) return;
    if (!input) { el<HTMLElement>('target-name').textContent = '尚未载入'; status('已取消目标选择；重新载入后再生成。'); return; }
    const read = readSpineSource(input.jsonText, resources(input));
    const loaded = { input, read };
    target = loaded;
    el<HTMLElement>('target-name').textContent = input.name;
    try {
      if (!targetView) throw new Error('Spine WebGL 不可用');
      await targetView.load(input.jsonText, previewAssets(input), read.summary.skins[0]?.name ?? '');
      if (serial !== targetLoadSerial) return;
      el<HTMLElement>('target-caption').textContent = `${read.summary.bones.length} 骨 · ${read.summary.animations.length} 原动画 · ${input.pages.length} 页贴图`;
    } catch (error) { el<HTMLElement>('target-caption').textContent = `目标预览不可用：${message(error)}`; }
    if (source) {
      const selected = pendingConfigs.take(checkIdentity, () => createDraft()!);
      await applyConfig(selected.config);
      automaticMapping = selected.config.objectMappings.length === 0;
      if (automaticMapping) analyzeMappings();
      status(selected.rejected
        ? `两份素材已读取，但待载入配置不匹配：${message(selected.rejected)}。已改用新草稿。`
        : '两份素材已读取。查看对象映射区的分析结果，再生成候选检查剩余通道。', Boolean(selected.rejected));
    }
    else status('目标已读取。继续载入来源工程。');
    refresh();
  } catch (error) { target = null; config = null; el<HTMLElement>('target-name').textContent = '载入失败'; status(`目标载入失败：${message(error)}`, true); refresh(); }
}
el<HTMLButtonElement>('open-spine-source').addEventListener('click', () => { void openSource(); });
el<HTMLButtonElement>('open-target').addEventListener('click', () => { void openTarget(); });
el<HTMLButtonElement>('open-config').addEventListener('click', async () => {
  try {
    const result = await window.spw.openConfig(); if (!result) return;
    const loaded = validateSpineConfig(JSON.parse(result.jsonText) as unknown);
    if (source && target) { await applyConfig(loaded); status('映射配置已载入。请核对方向、关键通道与输出目录。'); }
    else { pendingConfigs.stage(loaded); status('配置已读取。载入对应的来源与目标工程后会核对骨架身份。'); }
  } catch (error) { status(`配置载入失败：${message(error)}`, true); }
});
el<HTMLButtonElement>('save-config').addEventListener('click', async () => {
  try {
    if (!config) return;
    validateSpineConfig(config);
    const path = await window.spw.saveConfig(`${JSON.stringify(config, null, 2)}\n`);
    if (path) status(`映射配置已保存：${path}`);
  } catch (error) { status(`配置保存失败：${message(error)}`, true); }
});
el<HTMLButtonElement>('choose-output').addEventListener('click', async () => {
  try {
    const chosen = await window.spw.chooseOutput();
    if (!chosen) return;
    outputDirectory = chosen;
    el<HTMLElement>('output-path').textContent = chosen;
    refresh();
  } catch (error) { status(`输出目录选择失败：${message(error)}`, true); }
});
el<HTMLSelectElement>('clip').addEventListener('change', () => {
  if (!config || !source) return;
  const name = selectedAnimation();
  if (!currentJob()) {
    const duration = animationDuration(name);
    config = { ...config, animationJobs: [...config.animationJobs, { sourceAnimation: name, rangeSeconds: [0, duration], outputName: cleanName(name), corrections: [] }] };
  }
  sourceView?.setDisplayAnimation(name);
  const display = target?.read.summary.animations.some((item) => item.name === name) ? name : '';
  targetView?.setDisplayAnimation(display);
  config = { ...config, targetDisplayAnimation: display || undefined };
  el<HTMLSelectElement>('target-display').value = display;
  mappingAnalysis = null;
  if (automaticMapping) analyzeMappings();
  else el<HTMLElement>('mapping-analysis').textContent = '动作已切换，沿用现有映射；可点击自动分析并映射，补充当前动作。';
  showJob(); renderDependencies(); renderCorrections(); renderSuggestions(); invalidate();
});
for (const [id, key] of [['source-skin', 'sourceSkin'], ['target-skin', 'targetSkin']] as const) {
  el<HTMLSelectElement>(id).addEventListener('change', async (event) => {
    if (!config || !source || !target) return;
    config = { ...config, [key]: (event.target as HTMLSelectElement).value };
    aiPanel.reset(); config={...config,aiReview:undefined};
    invalidate();
    if (automaticMapping) analyzeMappings();
    else { mappingAnalysis = null; renderSuggestions(); }
    try {
      if (id === 'source-skin') await sourceView?.load(source.input.jsonText, previewAssets(source.input), config.sourceSkin, selectedAnimation());
      else await targetView?.load(target.input.jsonText, previewAssets(target.input), config.targetSkin, config.targetDisplayAnimation ?? '');
      renderAt(currentSeconds);
    } catch (error) { status(`皮肤预览失败：${message(error)}`, true); }
  });
}
for (const [id, key] of [['source-direction', 'sourceDirection'], ['target-direction', 'targetDirection']] as const) {
  el<HTMLInputElement>(id).addEventListener('change', (event) => { if (!config) return; config = { ...config, [key]: (event.target as HTMLInputElement).value.trim() }; invalidate(); });
}
el<HTMLSelectElement>('target-display').addEventListener('change', (event) => {
  if (!config) return;
  const value = (event.target as HTMLSelectElement).value;
  config = { ...config, targetDisplayAnimation: value || undefined };
  targetView?.setDisplayAnimation(value);
  invalidate();
});
for (const [id, position] of [['range-start', 0], ['range-end', 1]] as const) {
  el<HTMLInputElement>(id).addEventListener('change', (event) => {
    const value = Number((event.target as HTMLInputElement).value);
    updateJob((job) => ({ ...job, rangeSeconds: position === 0 ? [value, job.rangeSeconds[1]] : [job.rangeSeconds[0], value] }));
    showJob();
  });
}
el<HTMLInputElement>('animation-name').addEventListener('change', (event) => {
  updateJob((job) => ({ ...job, outputName: (event.target as HTMLInputElement).value.trim() }));
});
el<HTMLInputElement>('mapping-search').addEventListener('input', renderMappings);
el<HTMLInputElement>('channel-search').addEventListener('input', renderDependencies);
el<HTMLButtonElement>('suggest-mappings').addEventListener('click', () => { automaticMapping = true; analyzeMappings(); });
el<HTMLButtonElement>('add-mapping').addEventListener('click', () => {
  if (!config) return;
  automaticMapping = false;
  config = { ...config, objectMappings: [...config.objectMappings, { kind: 'bone', source: '', target: '', side: 'unknown', drive: 'fk-bone' }] };
  renderMappings(); invalidate();
});
el<HTMLButtonElement>('add-correction').addEventListener('click', () => {
  if (!config) return;
  const targetBone = config.objectMappings.find((item) => item.kind === 'bone')?.target ?? '';
  updateJob((job) => ({ ...job, corrections: [...job.corrections, { kind: 'bone', target: targetBone, channel: 'rotate', rotationDegrees: 0 }] }));
  renderCorrections();
});

el<HTMLInputElement>('time').addEventListener('input', (event) => {
  stopPlayback();
  renderAt(Number((event.target as HTMLInputElement).value));
});
for (const [id, direction] of [['step-back', -1], ['step-forward', 1]] as const) {
  el<HTMLButtonElement>(id).addEventListener('click', () => {
    const job = currentJob(); if (!job) return;
    stopPlayback();
    renderAt(Math.max(job.rangeSeconds[0], Math.min(job.rangeSeconds[1], currentSeconds + direction / 30)));
  });
}
function stopPlayback(): void {
  playing = false;
  if (playbackFrame !== undefined) cancelAnimationFrame(playbackFrame);
  playbackFrame = undefined;
  el<HTMLButtonElement>('play').textContent = '▶';
}
function tick(now: number): void {
  playbackFrame = undefined;
  const job = currentJob(); if (!playing || !job) return;
  const speed = Number(el<HTMLSelectElement>('playback-speed').value);
  const next = playbackAt(playFrom, (now - playStarted) / 1000 * speed, job.rangeSeconds, el<HTMLInputElement>('loop-playback').checked);
  renderAt(next.seconds);
  if (next.finished) { stopPlayback(); return; }
  playbackFrame = requestAnimationFrame(tick);
}
el<HTMLButtonElement>('play').addEventListener('click', () => {
  const job = currentJob(); if (!job) return;
  if (playing) { stopPlayback(); return; }
  playing = true; el<HTMLButtonElement>('play').textContent = 'Ⅱ';
  playFrom = currentSeconds >= job.rangeSeconds[1] ? job.rangeSeconds[0] : currentSeconds;
  playStarted = performance.now(); playbackFrame = requestAnimationFrame(tick);
});
el<HTMLSelectElement>('playback-speed').addEventListener('change', () => { if (playing) { playFrom = currentSeconds; playStarted = performance.now(); } });
el<HTMLInputElement>('loop-playback').addEventListener('change', () => { if (playing) { playFrom = currentSeconds; playStarted = performance.now(); } });

el<HTMLButtonElement>('generate').addEventListener('click', async () => {
  if (!source || !target || !config) return;
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = undefined; }
  const currentSource = source, currentTarget = target;
  const configSnapshot = config;
  const currentConfig = { ...config, objectMappings: aiPanel.filter(config.objectMappings.filter(m => m.source.trim() && m.target.trim())) };
  const incompleteRows = config.objectMappings.length - currentConfig.objectMappings.length;
  const job = currentJob(); if (!job) return;
  gate.invalidate();
  const previewTime = currentSeconds;
  const revision = gate.begin();
  previewReady = false;
  el<HTMLButtonElement>('save-output').disabled = true;
  try {
    validateSpineConfig(currentConfig);
    checkIdentity(currentConfig);
    if (!currentSource.read.summary.animations.some((item) => item.name === job.sourceAnimation)) throw new Error('源动作不存在');
    if (!currentSource.read.summary.skins.some((item) => item.name === currentConfig.sourceSkin)) throw new Error('源皮肤不存在');
    if (!currentTarget.read.summary.skins.some((item) => item.name === currentConfig.targetSkin)) throw new Error('目标皮肤不存在');
    if (currentConfig.calibration.rootScaleX !== 1 || currentConfig.calibration.rootScaleY !== 1) throw new Error('当前迁移器尚未实现根比例校准，请恢复为 1 或在目标局部映射中处理');
    status('正在刷新身体动作草稿；未兼容的内容会略过…');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (revision !== gate.begin()) return;
    const result = createSpineDraft(
      currentSource.read.document, currentTarget.read.document, job.sourceAnimation,
      currentConfig.objectMappings, [...currentConfig.calibration.corrections, ...job.corrections],
      currentConfig.channelPolicies, job.rangeSeconds,
      { sourceSkin: currentConfig.sourceSkin, targetSkin: currentConfig.targetSkin },
      job.targetDrawOrderKeys,
      el<HTMLSelectElement>('draft-scope').value as 'body' | 'mapped',
    );
    renderReport(result.report);
    const output = appendDirectAnimation(currentTarget.read.document, result.animation, job.outputName, {emptyAnimation: job.targetEmptyAnimation});
    emptyDestinationNoop = Boolean(job.targetEmptyAnimation) && Object.keys(result.animation).length === 0;
    reportText = reportAsText(result.report, output.name);
    if (revision !== gate.begin()) return;
    const accepted = gate.commit(revision, {
      ...output, sourceResourceId: currentSource.input.resourceId, targetResourceId: currentTarget.input.resourceId, reportText, configText: JSON.stringify(configSnapshot, null, 2),
    });
    if (!accepted) return;
    aiPanel.recordReport(result.report);
    try {
      if (!targetView) throw new Error('Spine WebGL 不可用');
      await targetView.load(output.jsonText, previewAssets(currentTarget.input), currentConfig.targetSkin, '', output.name);
      if (revision !== gate.begin()) return;
      previewReady = true;
      hasDisplayedDraft = true;
      el<HTMLElement>('target-caption').textContent = `新增 ${output.name} · 草稿预览与导入数据一致`;
      el<HTMLElement>('stage-state').textContent = `草稿可预览 · ${output.name}`;
      status(emptyDestinationNoop
        ? '选中的空动画还没有新内容。可以继续预览，补充身体映射后再确认填入。'
        : result.copied
        ? `草稿已刷新：迁移 ${result.copied} 个通道，略过 ${result.omitted} 个${incompleteRows ? `，另有 ${incompleteRows} 行未填完整或不在当前有效标定内` : ''}。修改映射后可继续刷新；满意后确认迁移。`
        : '已创建空动画草稿，尚无可迁移通道。可先补充身体映射，也可确认后在 Spine 手工调整。');
      renderAt(previewTime);
    } catch (error) {
      previewReady = false;
      status(`候选已计算，但目标预览失败：${message(error)}`, true);
      el<HTMLElement>('target-caption').textContent = '候选预览失败 · 暂不可保存';
    }
    refresh();
  } catch (error) {
    gate.invalidate(); previewReady = false;
    status(`生成失败：${message(error)}`, true);
    refresh();
  }
});
el<HTMLButtonElement>('save-output').addEventListener('click', async () => {
  const output = gate.output;
  if (saving || !output || !previewReady || !config || emptyDestinationNoop) return;
  saving = true;
  refresh();
  try {
    if (!outputDirectory) {
      const chosen = await window.spw.chooseOutput();
      if (!chosen) return;
      if (gate.output !== output || !previewReady) { status('映射已改变，请等待预览刷新后再确认迁移。'); return; }
      outputDirectory = chosen; el<HTMLElement>('output-path').textContent = chosen;
    }
    el<HTMLButtonElement>('save-output').disabled = true;
    status(target?.input.nativeProject ? '正在准备目标原工程副本和动画导入文件…' : '正在保存完整副本…');
    const result = await window.spw.saveOutput({
      sourceKind: 'spine', sourceResourceId: output.sourceResourceId, targetResourceId: output.targetResourceId,
      outputDirectory, animationName: output.name, jsonText: output.jsonText,
      configText: `${output.configText ?? JSON.stringify(config, null, 2)}\n`, reportText: output.reportText ?? reportText,
    });
    if (result.handoffId) {
      nativeHandoff = result;
      el<HTMLElement>('native-handoff').hidden = false;
      el<HTMLElement>('native-project-path').textContent = result.projectPath ?? '';
      el<HTMLElement>('native-import-path').textContent = result.carrierPath ?? '';
      el<HTMLElement>('native-instructions').textContent = `在 Spine 主菜单选择“导入项目 → 动画”，来源与目标骨架均选 ${result.skeletonName}，勾选 ${result.animationName}${result.replaceEmpty ? '，勾选“替换现有动画 / Replace existing animations”以填入选中的空动画' : '，使用新增动画方式'}，导入后保存。然后点击下方“校验导回结果”。`;
      el<HTMLElement>('native-result').textContent = '已准备，尚未导入。目标是原工程副本；原文件保持不变。';
      status(`导回文件已准备：${result.directory}`);
      try { await window.spw.nativeAction(result.handoffId, 'open'); }
      catch (error) { el<HTMLElement>('native-result').textContent = `文件已准备，但打开 Spine 失败：${message(error)}。可手动打开上方目标工程。`; }
    } else status(`完整副本与迁移报告已保存：${result.directory}`);
  } catch (error) { status(`保存失败：${message(error)}`, true); }
  finally { saving = false; refresh(); }
});
for (const [id, action] of [['native-copy', 'copy'], ['native-open', 'open'], ['native-verify', 'verify']] as const) {
  el<HTMLButtonElement>(id).addEventListener('click', async () => {
    const current = nativeHandoff;
    if (!current?.handoffId) return;
    const button = el<HTMLButtonElement>(id);
    button.disabled = true;
    el<HTMLElement>('native-result').textContent = action === 'verify' ? '正在独立读取保存后的工程并校验动画和骨架…' : '正在处理…';
    try {
      const result = await window.spw.nativeAction(current.handoffId, action);
      if (nativeHandoff !== current) return;
      el<HTMLElement>('native-result').textContent = action === 'verify' && result.passed
        ? `校验通过：新动画已写入，原有导出骨架数据和动画保持一致。工程：${result.projectPath}`
        : action === 'copy' ? '导入文件地址已复制。在 Spine“导入项目”对话框粘贴，选择“动画”。' : '已打开目标工程副本。';
    } catch (error) { if (nativeHandoff === current) el<HTMLElement>('native-result').textContent = message(error); }
    finally { button.disabled = false; }
  });
}
function nativeSaveLabel(): void {
  el<HTMLButtonElement>('save-output').textContent = target?.input.nativeProject ? '确认迁移到 Spine' : '确认保存新增动画';
}
el<HTMLSelectElement>('draft-scope').addEventListener('change', () => { if (config) config = {...config,draftScope:el<HTMLSelectElement>('draft-scope').value as 'body'|'mapped'}; invalidate(); });
el<HTMLSelectElement>('target-empty').addEventListener('change', () => { const name = el<HTMLSelectElement>('target-empty').value; updateJob(job => ({...job,targetEmptyAnimation:name || undefined,outputName:name || cleanName(selectedAnimation())})); showJob(); });
el<HTMLInputElement>('auto-refresh').addEventListener('change', () => { if (el<HTMLInputElement>('auto-refresh').checked) scheduleDraft(); else if (refreshTimer) clearTimeout(refreshTimer); });
window.addEventListener('resize', () => renderAt(currentSeconds));
status('先载入来源与目标 .spine 工程，使用本机 Spine 4.3 自动读取；也兼容 JSON 导出。');
