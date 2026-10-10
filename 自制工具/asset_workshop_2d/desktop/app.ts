import { DraftModel } from './draft-model.ts';
import type { DraftField, ProjectStyleContract, RequirementLevel, TaskStyleDelta } from './draft-model.ts';
import type { PresetFieldDescriptor, PresetSelection } from '../core/compose-preset.ts';
import { getStyleConflicts } from '../core/style-contract.ts';

type Choice = PresetSelection & { label: string };
type FormDescription = { fields: PresetFieldDescriptor[]; errors: { field: string; code: string; message: string }[] };
type ReferenceTile = {
  token: string; refId: string; sourceName: string; role: 'content' | 'style'; note: string;
  priority?: number; widthPx: number; heightPx: number; byteLength: number; thumbnailDataUrl?: string;
};
type ReferenceResult = { cancelled?: boolean; references: ReferenceTile[] };
type WorkflowStep = { id: string; title: string; phase: string; active: boolean; reason: string; outputs: string[] };
type PreviewResult = {
  revision: number; spec: unknown; specJson: string; prompt: string; entries: string[]; references: ReferenceTile[];
  workflow: { schemaVersion: '2dw-workflow/1'; steps: WorkflowStep[] };
  workflowPlan: string; workflowRecipeJson: string;
};
type ExportResult = { cancelled: boolean; path?: string; sha256?: string; entries?: string[] };
type TaskInfo = { taskId: string; references: ReferenceTile[]; projectStyleDefault: ProjectStyleContract | null; projectStyleWarning?: string };

declare global {
  interface Window {
    assetWorkshop: {
      info(): Promise<{ name: string; version: string; userData: string; outputDirectory: string }>;
      check(): Promise<{ spec: unknown; prompt: string; referenceCount: number }>;
      exportProof(): Promise<{ path: string; sha256: string; entries: number | string[] }>;
      choices(): Promise<Choice[]>;
      describeForm(input: { selection: PresetSelection; values: ReturnType<DraftModel['valuesForBridge']> }): Promise<FormDescription>;
      chooseReferences(): Promise<ReferenceResult>;
      pasteReference(): Promise<ReferenceResult>;
      updateReference(input: { token: string; role: ReferenceTile['role']; note: string; priority?: number }): Promise<ReferenceResult>;
      removeReference(input: { token: string }): Promise<ReferenceResult>;
      previewTask(input: { selection: PresetSelection; values: ReturnType<DraftModel['valuesForBridge']>; revision: number }): Promise<PreviewResult>;
      exportTask(input: { revision: number }): Promise<ExportResult>;
      taskInfo(): Promise<TaskInfo>;
      saveProjectStyleContract(contract: ProjectStyleContract): Promise<{ projectStyleDefault: ProjectStyleContract }>;
      beginTask(input: { copy: boolean }): Promise<TaskInfo>;
      copyTaskId(): Promise<void>;
    };
  }
}

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`缺少界面元素：${id}`);
  return element as T;
};
const modeSelect = $<HTMLSelectElement>('mode-select');
const newTaskButton = $<HTMLButtonElement>('new-task');
const copyTaskButton = $<HTMLButtonElement>('copy-task');
const checkExportButton = $<HTMLButtonElement>('check-export');
const taskSummary = $<HTMLDivElement>('task-summary');
const taskIdField = $<HTMLInputElement>('task-id');
const copyTaskIdButton = $<HTMLButtonElement>('copy-task-id');
const effectiveTitle = $<HTMLDivElement>('effective-title');
const titleMode = $<HTMLElement>('title-mode');
const manualTitle = $<HTMLInputElement>('manual-title');
const restoreAutoTitle = $<HTMLButtonElement>('restore-auto-title');
const selectionIdentity = $<HTMLDivElement>('selection-identity');
const intentFields = $<HTMLDivElement>('intent-fields');
const specFields = $<HTMLDivElement>('spec-fields');
const advancedFields = $<HTMLDivElement>('advanced-fields');
const referenceList = $<HTMLDivElement>('reference-list');
const referencePanel = $<HTMLElement>('reference-panel');
const referenceCount = $<HTMLSpanElement>('reference-count');
const addReferenceButton = $<HTMLButtonElement>('add-reference');
const pasteReferenceButton = $<HTMLButtonElement>('paste-reference');
const projectStyleBaseline = $<HTMLSelectElement>('project-style-baseline');
const projectStyleEditor = $<HTMLDivElement>('project-style-editor');
const taskStyleEditor = $<HTMLDivElement>('task-style-editor');
const saveProjectStyleDefaultButton = $<HTMLButtonElement>('save-project-style-default');
const styleWarning = $<HTMLDivElement>('style-warning');
const requirementsPanel = $<HTMLElement>('requirements-panel');
const requirementsEditor = $<HTMLDivElement>('requirements-editor');
const previewButton = $<HTMLButtonElement>('preview-task');
const exportButton = $<HTMLButtonElement>('export-task');
const status = $<HTMLParagraphElement>('status');
const fieldErrors = $<HTMLDivElement>('field-errors');
const workflowStatus = $<HTMLParagraphElement>('workflow-status');
const workflowCount = $<HTMLSpanElement>('workflow-count');
const workflowSteps = $<HTMLOListElement>('workflow-steps');
const workflowPlanPreview = $<HTMLPreElement>('workflow-plan-preview');
const workflowRecipePreview = $<HTMLPreElement>('workflow-recipe-preview');
const specPreview = $<HTMLPreElement>('spec-preview');
const promptPreview = $<HTMLPreElement>('prompt-preview');
const entryPreview = $<HTMLUListElement>('entry-preview');
const model = new DraftModel();
const fieldNodes = new Map<string, { wrapper: HTMLDivElement; control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; help: HTMLElement }>();
let choices: Choice[] = [];
let references: ReferenceTile[] = [];
let currentForm: FormDescription | null = null;
let renderedRequirementMode: 'preset' | 'custom' | null = null;
let describeSequence = 0;
let describeTimer: number | undefined;
let busy: 'preview' | 'export' | 'references' | 'task' | null = null;
let emptyAcknowledgedRevision: number | null = null;

function setStatus(message: string, state: 'idle' | 'ready' | 'error' | 'exported' = 'idle'): void {
  status.textContent = message;
  status.dataset.state = state;
}

function selection(): Choice {
  const chosen = choices.find(choice => choice.mode === model.mode);
  if (!chosen) throw new Error('当前任务模式不可用');
  return chosen;
}

function syncButtons(): void {
  const available = choices.length > 0 && busy === null;
  modeSelect.disabled = !available;
  newTaskButton.disabled = !available;
  copyTaskButton.disabled = !available;
  checkExportButton.disabled = !available || currentForm === null || currentForm.errors.length > 0;
  addReferenceButton.disabled = !available || references.length >= 8;
  pasteReferenceButton.disabled = !available || references.length >= 8;
  projectStyleBaseline.disabled = !available;
  saveProjectStyleDefaultButton.disabled = !available || model.valuesForBridge().projectStyleContract === null;
  for (const element of projectStyleEditor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea'))
    element.disabled = !available || model.valuesForBridge().projectStyleContract === null;
  for (const element of taskStyleEditor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')) element.disabled = !available;
  previewButton.disabled = !available || currentForm === null || currentForm.errors.length > 0;
  exportButton.disabled = !available || model.exportRevision === null;
  manualTitle.disabled = !available;
  restoreAutoTitle.disabled = !available;
  copyTaskIdButton.disabled = !available;
  for (const node of fieldNodes.values()) node.control.disabled = !available || node.control.dataset.editable === 'false';
  for (const element of referenceList.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input,select,textarea,button')) element.disabled = !available;
  for (const element of document.querySelectorAll<HTMLButtonElement>('.quick-specs button, #requirements-editor button')) element.disabled = !available;
  for (const element of requirementsEditor.querySelectorAll<HTMLTextAreaElement>('textarea')) element.disabled = !available;
}

function updateTaskIdentity(): void {
  taskIdField.value = model.valuesForBridge().taskId ?? '';
  effectiveTitle.textContent = model.effectiveTitle;
  titleMode.textContent = model.titleMode === 'manual' ? '手动标题' : '自动生成';
  if (manualTitle !== document.activeElement) manualTitle.value = model.titleMode === 'manual' ? model.effectiveTitle : '';
}

function updateSummary(): void {
  const values = model.valuesForBridge();
  const descriptor = (name: string) => currentForm?.fields.find(field => field.field === name);
  const width = values.widthPx ?? descriptor('output.widthPx')?.defaultValue;
  const locked = values.squareLocked ?? descriptor('output.squareLocked')?.defaultValue;
  const height = values.heightPx ?? descriptor('output.heightPx')?.defaultValue ?? (locked ? width : undefined);
  const ppu = values.ppu ?? descriptor('output.ppu')?.defaultValue ?? 100;
  const alpha = values.alphaRequirement ?? descriptor('output.alphaRequirement')?.defaultValue;
  const dimensions = Number.isFinite(Number(width)) && Number.isFinite(Number(height))
    ? `${width} × ${height} px` : '画布待确认';
  const world = Number(width) > 0 && Number(height) > 0 && Number(ppu) > 0
    ? ` · ${Number(width) / Number(ppu)} × ${Number(height) / Number(ppu)} units` : '';
  const alphaLabel = typeof alpha === 'string' ? optionLabel('output.alphaRequirement', alpha, alpha) : '背景待确认';
  const content = references.filter(ref => ref.role === 'content').length;
  const style = references.length - content;
  const blockers = currentForm?.errors.length ?? 0;
  taskSummary.textContent = `codex@1 · PNG · ${dimensions} · ${ppu} PPU${world}\n${alphaLabel} · ${content} 张内容参考 / ${style} 张风格参考\n${model.effectiveTitle}${blockers ? `\n${blockers} 项阻断错误，请按提示修改` : ''}`;
}

function updateStyleWarning(): void {
  const { projectStyleContract: contract, taskStyleDelta: delta } = model.valuesForBridge();
  const warnings = getStyleConflicts(contract, delta);
  styleWarning.hidden = warnings.length === 0;
  styleWarning.textContent = warnings.join('\n');
}

function clearPreview(): void {
  workflowStatus.textContent = '内容已改变；请重新生成预览。';
  workflowCount.textContent = '';
  workflowSteps.replaceChildren();
  workflowPlanPreview.textContent = '内容已改变；请重新生成预览。';
  workflowRecipePreview.textContent = '内容已改变；请重新生成预览。';
  specPreview.textContent = '内容已改变；请重新生成预览。';
  promptPreview.textContent = '内容已改变；请重新生成预览。';
  entryPreview.replaceChildren();
  const item = document.createElement('li');
  item.textContent = '内容已改变；请重新生成预览。';
  entryPreview.append(item);
  syncButtons();
}

function renderWorkflow(result: PreviewResult): void {
  const { workflow } = result;
  if (workflow.schemaVersion !== '2dw-workflow/1' || !Array.isArray(workflow.steps)) {
    throw new Error('执行流程预览的格式不受支持');
  }
  const activeCount = workflow.steps.filter(step => step.active).length;
  workflowCount.textContent = `${activeCount} / ${workflow.steps.length} 步`;
  workflowStatus.textContent = '以下是计划，尚未分析参考图或制作素材；启用的步骤将由外部 AI 执行。';
  workflowSteps.replaceChildren();
  for (const step of workflow.steps) {
    const row = document.createElement('li');
    row.className = `workflow-step ${step.active ? 'is-active' : 'is-inactive'}`;
    row.dataset.stepId = step.id;
    const heading = document.createElement('div'); heading.className = 'workflow-step-heading';
    const title = document.createElement('strong'); title.textContent = step.title;
    const state = document.createElement('span'); state.className = 'workflow-step-state';
    state.textContent = step.active ? '待外部 AI 执行' : '本次不启用';
    heading.append(title, state);
    const reason = document.createElement('p'); reason.className = 'workflow-step-reason'; reason.textContent = step.reason;
    row.append(heading, reason);
    if (step.outputs.length) {
      const outputs = document.createElement('small'); outputs.className = 'workflow-step-outputs';
      outputs.textContent = `预期产出：${step.outputs.join('、')}`;
      row.append(outputs);
    }
    workflowSteps.append(row);
  }
  workflowPlanPreview.textContent = result.workflowPlan;
  workflowRecipePreview.textContent = result.workflowRecipeJson;
}

function draftChanged(immediate = false): void {
  clearPreview();
  emptyAcknowledgedRevision = null;
  setStatus('内容已改变，请重新生成预览。');
  currentForm = null;
  updateTaskIdentity(); updateSummary(); updateStyleWarning();
  syncButtons();
  if (describeTimer !== undefined) window.clearTimeout(describeTimer);
  if (immediate) void describeCurrentForm();
  else describeTimer = window.setTimeout(() => { void describeCurrentForm(); }, 140);
}

const styleText = (id: string): string => $<HTMLInputElement | HTMLTextAreaElement>(id).value;
const styleLines = (id: string): string[] => styleText(id).split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
const optionalTiers = (id: string): number | undefined => styleText(id).trim() === '' ? undefined : Number(styleText(id));
const writeStyleText = (id: string, value: string): void => { $<HTMLInputElement | HTMLTextAreaElement>(id).value = value; };
function readProjectStyle(): ProjectStyleContract {
  return {
    schemaVersion: '2dw-project-style/1',
    name: styleText('project-style-name'), summary: styleText('project-style-summary'),
    positiveRules: styleLines('project-style-positive'), negativeRules: styleLines('project-style-negative'),
    toneBudget: { darkMaxTiers: Number(styleText('project-style-dark-tiers')), lightMaxTiers: Number(styleText('project-style-light-tiers')) },
    shapeLanguageRules: styleLines('project-style-shape'), textureRules: styleLines('project-style-texture'),
    renderingWarnings: styleLines('project-style-warnings'),
  };
}

function readTaskStyle(): TaskStyleDelta | null {
  const focus = styleText('task-style-focus');
  const mustPreserve = styleLines('task-style-preserve');
  const mustChange = styleLines('task-style-change');
  const localReferenceNote = styleText('task-style-reference-note');
  const avoid = styleLines('task-style-avoid');
  const darkMaxTiers = optionalTiers('task-style-dark-tiers');
  const lightMaxTiers = optionalTiers('task-style-light-tiers');
  if (!focus.trim() && !mustPreserve.length && !mustChange.length && !localReferenceNote.trim()
    && !avoid.length && darkMaxTiers === undefined && lightMaxTiers === undefined) return null;
  return {
    schemaVersion: '2dw-task-style-delta/1', focus, mustPreserve, mustChange, localReferenceNote, avoid,
    ...(darkMaxTiers === undefined && lightMaxTiers === undefined ? {} : { toneBudget: {
      ...(darkMaxTiers === undefined ? {} : { darkMaxTiers }),
      ...(lightMaxTiers === undefined ? {} : { lightMaxTiers }),
    } }),
  };
}

function renderStyleEditors(): void {
  const { projectStyleContract: contract, taskStyleDelta: delta } = model.valuesForBridge();
  projectStyleBaseline.value = model.projectStyleSource;
  writeStyleText('project-style-name', contract?.name ?? '');
  writeStyleText('project-style-summary', contract?.summary ?? '');
  writeStyleText('project-style-positive', contract?.positiveRules.join('\n') ?? '');
  writeStyleText('project-style-negative', contract?.negativeRules.join('\n') ?? '');
  writeStyleText('project-style-dark-tiers', contract?.toneBudget.darkMaxTiers === undefined ? '' : String(contract.toneBudget.darkMaxTiers));
  writeStyleText('project-style-light-tiers', contract?.toneBudget.lightMaxTiers === undefined ? '' : String(contract.toneBudget.lightMaxTiers));
  writeStyleText('project-style-shape', contract?.shapeLanguageRules.join('\n') ?? '');
  writeStyleText('project-style-texture', contract?.textureRules.join('\n') ?? '');
  writeStyleText('project-style-warnings', contract?.renderingWarnings.join('\n') ?? '');
  writeStyleText('task-style-focus', delta?.focus ?? '');
  writeStyleText('task-style-preserve', delta?.mustPreserve.join('\n') ?? '');
  writeStyleText('task-style-change', delta?.mustChange.join('\n') ?? '');
  writeStyleText('task-style-reference-note', delta?.localReferenceNote ?? '');
  writeStyleText('task-style-avoid', delta?.avoid.join('\n') ?? '');
  writeStyleText('task-style-dark-tiers', delta?.toneBudget?.darkMaxTiers === undefined ? '' : String(delta.toneBudget.darkMaxTiers));
  writeStyleText('task-style-light-tiers', delta?.toneBudget?.lightMaxTiers === undefined ? '' : String(delta.toneBudget.lightMaxTiers));
  updateStyleWarning(); syncButtons();
}

projectStyleBaseline.addEventListener('change', () => {
  if (projectStyleBaseline.value === 'empty') model.useEmptyProjectStyle();
  else if (projectStyleBaseline.value === 'default') model.useProjectStyleDefault();
  else if (projectStyleBaseline.value === 'custom') {
    const current = model.valuesForBridge().projectStyleContract;
    model.setProjectStyleContract(current ?? {
      schemaVersion: '2dw-project-style/1', name: '', summary: '', positiveRules: [], negativeRules: [],
      toneBudget: { darkMaxTiers: 3, lightMaxTiers: 3 }, shapeLanguageRules: [], textureRules: [], renderingWarnings: [],
    });
  }
  renderStyleEditors(); draftChanged(true);
});
for (const element of projectStyleEditor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')) {
  element.addEventListener('input', () => {
    model.setProjectStyleContract(readProjectStyle());
    projectStyleBaseline.value = 'custom';
    draftChanged();
  });
}
for (const element of taskStyleEditor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')) {
  element.addEventListener('input', () => { model.setTaskStyleDelta(readTaskStyle()); draftChanged(); });
}
saveProjectStyleDefaultButton.addEventListener('click', async () => {
  const contract = model.valuesForBridge().projectStyleContract;
  if (!contract || busy) return;
  busy = 'task'; syncButtons();
  try {
    const result = await window.assetWorkshop.saveProjectStyleContract(contract);
    model.setProjectStyleDefault(result.projectStyleDefault);
    renderStyleEditors(); draftChanged(true);
    setStatus('项目默认风格已保存；当前任务已切换为新默认，请重新生成预览。');
  } catch (error) { setStatus(`保存项目风格失败：${(error as Error).message}`, 'error'); }
  finally { busy = null; syncButtons(); }
});

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    'project-default': '项目默认', 'preset-default': '种子默认', 'structure-default': '结构默认',
    'user-override': '手动填写', derived: '自动推导', 'structure-lock': '结构锁定', 'preset-lock': '种子锁定',
  };
  return labels[source] ?? source;
}

function optionLabel(field: string, value: string, fallback: string): string {
  if (field === 'output.format' && value === 'png') return 'PNG';
  if (field !== 'output.alphaRequirement') return fallback;
  const labels: Record<string, string> = {
    'transparent-required': '必须透明背景',
    'opaque-required': '必须不透明',
    'alpha-allowed': '可含透明区域',
  };
  return labels[value] ?? fallback;
}

function renderSelectionIdentity(): void {
  selectionIdentity.replaceChildren();
  const chosen = selection();
  const axes = [
    ['用途', chosen.purpose], ['结构', chosen.structure], ['操作', chosen.operation],
    ['风格', chosen.style], ['目标 AI', chosen.adapter],
  ] as const;
  for (const [name, identity] of axes) {
    const item = document.createElement('div');
    const label = document.createElement('span'); label.textContent = name;
    const value = document.createElement('code'); value.textContent = `${identity.id}@${identity.version}`;
    item.append(label, value); selectionIdentity.append(item);
  }
}

function fieldId(field: string): string { return `field-${field.replaceAll('.', '-')}`; }
function valueKey(field: string): DraftField { return (field.startsWith('output.') ? field.slice(7) : field) as DraftField; }

function createField(descriptor: PresetFieldDescriptor): { wrapper: HTMLDivElement; control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; help: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.className = `field${descriptor.control === 'textarea' ? ' field-wide' : ''}`;
  wrapper.dataset.field = descriptor.field;
  const label = document.createElement('label');
  label.htmlFor = fieldId(descriptor.field);
  label.textContent = descriptor.label;
  const control = descriptor.control === 'textarea' ? document.createElement('textarea')
    : descriptor.control === 'select' ? document.createElement('select') : document.createElement('input');
  control.id = fieldId(descriptor.field);
  if (control instanceof HTMLInputElement) control.type = descriptor.control === 'number' ? 'number' : descriptor.control === 'checkbox' ? 'checkbox' : 'text';
  if (control instanceof HTMLTextAreaElement) control.rows = 3;
  const help = document.createElement('small');
  help.className = 'field-help';
  help.id = `${control.id}-help`;
  control.setAttribute('aria-describedby', help.id);
  control.addEventListener(descriptor.control === 'checkbox' || descriptor.control === 'select' ? 'change' : 'input', () => {
    const before = model.revision;
    const key = valueKey(descriptor.field);
    let value: string | number | boolean | undefined;
    if (control instanceof HTMLInputElement && control.type === 'checkbox') value = control.checked;
    else if (control instanceof HTMLInputElement && control.type === 'number') value = control.value === '' ? undefined : Number(control.value);
    else value = control.value;
    model.setField(key, value);
    if (model.revision !== before) draftChanged(descriptor.field === 'output.squareLocked');
  });
  wrapper.append(label, control, help);
  return { wrapper, control, help };
}

function updateField(descriptor: PresetFieldDescriptor, errors: FormDescription['errors']): void {
  let node = fieldNodes.get(descriptor.field);
  if (!node) {
    node = createField(descriptor);
    fieldNodes.set(descriptor.field, node);
  }
  node.wrapper.hidden = !descriptor.visible;
  node.wrapper.classList.toggle('field-locked', !descriptor.editable);
  const control = node.control;
  control.dataset.editable = String(descriptor.editable);
  control.disabled = !descriptor.editable || busy !== null;
  control.required = descriptor.required;
  control.setAttribute('aria-required', String(descriptor.required));
  const error = errors.find(item => item.field === descriptor.field || item.field.startsWith(`${descriptor.field}[`));
  if (error) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid');

  if (control instanceof HTMLSelectElement) {
    const options = descriptor.options?.length ? descriptor.options : descriptor.defaultValue === undefined ? []
      : [{ value: String(descriptor.defaultValue), label: String(descriptor.defaultValue) }];
    const signature = options.map(option => `${option.value}\u0000${optionLabel(descriptor.field, option.value, option.label)}`).join('\u0001');
    if (control.dataset.options !== signature) {
      control.replaceChildren();
      for (const choice of options) {
        const option = document.createElement('option');
        option.value = choice.value; option.textContent = optionLabel(descriptor.field, choice.value, choice.label);
        control.append(option);
      }
      control.dataset.options = signature;
    }
  }
  const key = valueKey(descriptor.field);
  const values = model.valuesForBridge();
  const userValue = values[key];
  const displayValue = userValue === undefined ? descriptor.defaultValue : userValue;
  if (control !== document.activeElement) {
    if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = displayValue === true;
    else control.value = displayValue === undefined || displayValue === null ? '' : String(displayValue);
  }
  const notes: string[] = [];
  if (descriptor.source) notes.push(`来源：${sourceLabel(descriptor.source)}`);
  if (descriptor.reason) notes.push(descriptor.reason);
  if (error) notes.push(error.message);
  node.help.textContent = notes.join(' · ');
}

function renderErrors(errors: FormDescription['errors']): void {
  fieldErrors.replaceChildren();
  fieldErrors.hidden = errors.length === 0;
  if (!errors.length) return;
  const heading = document.createElement('strong'); heading.textContent = '请先处理以下字段：';
  const list = document.createElement('ul');
  for (const error of errors) {
    const item = document.createElement('li');
    const link = document.createElement('button'); link.type = 'button'; link.className = 'error-link';
    link.textContent = error.message;
    link.addEventListener('click', () => focusError(error.field));
    item.append(link); list.append(item);
  }
  fieldErrors.append(heading, list);
}

function focusError(field: string): void {
  const styleFields: Record<string, string> = {
    'projectStyleContract.name': 'project-style-name', 'projectStyleContract.summary': 'project-style-summary',
    'projectStyleContract.positiveRules': 'project-style-positive', 'projectStyleContract.negativeRules': 'project-style-negative',
    'projectStyleContract.toneBudget.darkMaxTiers': 'project-style-dark-tiers',
    'projectStyleContract.toneBudget.lightMaxTiers': 'project-style-light-tiers',
    'projectStyleContract.shapeLanguageRules': 'project-style-shape', 'projectStyleContract.textureRules': 'project-style-texture',
    'projectStyleContract.renderingWarnings': 'project-style-warnings',
    'taskStyleDelta.focus': 'task-style-focus', 'taskStyleDelta.mustPreserve': 'task-style-preserve',
    'taskStyleDelta.mustChange': 'task-style-change', 'taskStyleDelta.localReferenceNote': 'task-style-reference-note',
    'taskStyleDelta.avoid': 'task-style-avoid', 'taskStyleDelta.toneBudget.darkMaxTiers': 'task-style-dark-tiers',
    'taskStyleDelta.toneBudget.lightMaxTiers': 'task-style-light-tiers',
  };
  const styleField = Object.entries(styleFields).find(([prefix]) => field === prefix || field.startsWith(`${prefix}[`));
  const direct = fieldNodes.get(field)?.control;
  const correction = field === 'output.heightPx' && direct?.disabled
    ? [fieldNodes.get('output.squareLocked')?.control, fieldNodes.get('output.widthPx')?.control]
      .find(control => control && !control.disabled) : undefined;
  const target = correction ?? direct ?? (styleField ? document.getElementById(styleField[1]) : null)
    ?? (field === 'taskId' ? taskIdField : field === 'title' ? manualTitle : undefined);
  if (target) {
    target.closest('details')?.setAttribute('open', '');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.focus();
  } else if (field.startsWith('requirements.')) {
    requirementsPanel.querySelector('details')?.setAttribute('open', '');
    requirementsPanel.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function requirementList(level: RequirementLevel): string[] {
  return [...(model.valuesForBridge().requirements?.[level] ?? [])];
}

function renderRequirementGroup(descriptor: PresetFieldDescriptor): HTMLElement {
  const level = descriptor.field.slice('requirements.'.length) as RequirementLevel;
  const group = document.createElement('section'); group.className = 'requirement-group';
  group.dataset.requirementLevel = level;
  const heading = document.createElement('div'); heading.className = 'requirement-heading';
  const title = document.createElement('h3'); title.textContent = descriptor.label;
  const add = document.createElement('button'); add.type = 'button'; add.textContent = '添加一项';
  const list = document.createElement('ol'); list.className = 'requirement-list';
  const renderItems = (): void => {
    list.replaceChildren();
    const entries = requirementList(level);
    add.disabled = !descriptor.editable || entries.length >= 32;
    if (!entries.length) {
      const empty = document.createElement('li'); empty.className = 'requirement-empty'; empty.textContent = '尚无要求'; list.append(empty);
    }
    entries.forEach((text, index) => {
      const item = document.createElement('li'); item.className = 'requirement-item';
      const textarea = document.createElement('textarea'); textarea.rows = 2; textarea.value = text;
      textarea.setAttribute('aria-label', `${descriptor.label}第 ${index + 1} 项`);
      textarea.addEventListener('input', () => {
        const before = model.revision; model.setRequirement(level, index, textarea.value);
        if (model.revision !== before) draftChanged();
      });
      const controls = document.createElement('div'); controls.className = 'requirement-controls';
      const action = (label: string, titleText: string, callback: () => void, disabled = false): HTMLButtonElement => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.setAttribute('aria-label', `${descriptor.label}第 ${index + 1} 项${titleText}`);
        button.disabled = disabled || !descriptor.editable;
        button.addEventListener('click', () => { callback(); renderItems(); draftChanged(true); });
        return button;
      };
      controls.append(
        action('↑', '上移', () => model.moveRequirement(level, index, -1), index === 0),
        action('↓', '下移', () => model.moveRequirement(level, index, 1), index === entries.length - 1),
        action('×', '删除', () => model.removeRequirement(level, index)),
      );
      item.append(textarea, controls); list.append(item);
    });
  };
  add.addEventListener('click', () => {
    model.addRequirement(level, ''); renderItems(); draftChanged(true);
    list.querySelector<HTMLTextAreaElement>('li:last-child textarea')?.focus();
  });
  heading.append(title, add); group.append(heading, list); renderItems();
  return group;
}

function renderRequirements(descriptors: PresetFieldDescriptor[]): void {
  const visible = descriptors.filter(field => field.visible && field.field.startsWith('requirements.'));
  requirementsPanel.hidden = visible.length === 0;
  if (!visible.length) { renderedRequirementMode = 'preset'; return; }
  if (renderedRequirementMode === 'custom') return;
  requirementsEditor.replaceChildren(...visible.map(renderRequirementGroup));
  renderedRequirementMode = 'custom';
}

async function describeCurrentForm(): Promise<void> {
  if (!choices.length) return;
  const call = ++describeSequence;
  const revision = model.revision;
  try {
    const description = await window.assetWorkshop.describeForm({ selection: selection(), values: model.valuesForBridge() });
    if (call !== describeSequence || revision !== model.revision) return;
    currentForm = description;
    for (const descriptor of description.fields) {
      if (descriptor.field === 'references' || descriptor.field === 'taskId' || descriptor.field === 'title'
        || descriptor.field.startsWith('requirements.')) continue;
      updateField(descriptor, description.errors);
      const node = fieldNodes.get(descriptor.field)!;
      const parent = descriptor.field === 'description' ? intentFields
        : descriptor.field === 'styleDescription' || descriptor.field === 'output.format'
          || descriptor.field === 'output.relativePath' ? advancedFields : specFields;
      if (node.wrapper.parentElement !== parent) parent.append(node.wrapper);
    }
    renderRequirements(description.fields);
    renderErrors(description.errors);
    updateTaskIdentity(); updateSummary();
    if (description.errors.length) setStatus('字段存在冲突，请按提示修改。', 'error');
    syncButtons();
  } catch (error) {
    if (call !== describeSequence || revision !== model.revision) return;
    currentForm = { fields: [], errors: [{ field: 'form', code: 'unavailable', message: (error as Error).message }] };
    renderErrors(currentForm.errors);
    updateSummary();
    setStatus(`无法读取表单：${(error as Error).message}`, 'error');
    syncButtons();
  }
}

function referenceControl<T extends HTMLElement>(labelText: string, control: T): HTMLLabelElement {
  const label = document.createElement('label'); label.textContent = labelText; label.append(control); return label;
}

function renderReferences(): void {
  referenceList.replaceChildren();
  referenceCount.textContent = `${references.length} / 8`;
  if (!references.length) {
    const empty = document.createElement('p'); empty.className = 'empty-state';
    empty.textContent = '尚未添加参考图。可直接用文字描述任务。'; referenceList.append(empty);
  }
  for (const reference of references) {
    const tile = document.createElement('article'); tile.className = 'reference-tile';
    tile.dataset.token = reference.token; tile.dataset.refId = reference.refId;
    const image = document.createElement('div'); image.className = 'reference-image';
    if (reference.thumbnailDataUrl?.startsWith('data:image/png;base64,')) {
      const img = document.createElement('img'); img.src = reference.thumbnailDataUrl; img.alt = `${reference.sourceName} 预览`;
      image.append(img);
    } else image.textContent = 'PNG';
    const content = document.createElement('div'); content.className = 'reference-content';
    const name = document.createElement('strong'); name.textContent = reference.sourceName;
    const meta = document.createElement('small');
    meta.textContent = `${reference.widthPx} × ${reference.heightPx} px · ${Math.ceil(reference.byteLength / 1024)} KB`;
    const role = document.createElement('select'); role.dataset.referenceRole = '';
    for (const [value, label] of [['content', '内容参考'], ['style', '风格参考']] as const) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; role.append(option);
    }
    role.value = reference.role;
    const note = document.createElement('textarea'); note.rows = 2; note.value = reference.note;
    note.placeholder = '这张图供执行端参考的要点'; note.dataset.referenceNote = '';
    const priority = document.createElement('input'); priority.type = 'number'; priority.min = '0'; priority.max = '100';
    priority.value = reference.priority === undefined ? '' : String(reference.priority); priority.dataset.referencePriority = '';
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '移除'; remove.dataset.referenceRemove = '';
    remove.setAttribute('aria-label', `移除 ${reference.sourceName}`);
    const update = async (): Promise<void> => {
      const nextPriority = priority.value === '' ? undefined : Number(priority.value);
      if (nextPriority !== undefined && (!Number.isInteger(nextPriority) || nextPriority < 0 || nextPriority > 100)) {
        setStatus('参考图优先级须为 0 到 100 的整数。', 'error'); priority.focus(); return;
      }
      if (role.value === reference.role && note.value === reference.note && nextPriority === reference.priority) return;
      busy = 'references'; syncButtons();
      try {
        const result = await window.assetWorkshop.updateReference({ token: reference.token, role: role.value as ReferenceTile['role'], note: note.value, priority: nextPriority });
        references = result.references; model.invalidate(); clearPreview(); renderReferences();
        setStatus('参考图说明已更新，请重新生成预览。');
      } catch (error) {
        renderReferences(); setStatus(`参考图更新失败：${(error as Error).message}`, 'error');
      } finally { busy = null; syncButtons(); }
    };
    role.addEventListener('change', () => { void update(); });
    note.addEventListener('change', () => { void update(); });
    priority.addEventListener('change', () => { void update(); });
    remove.addEventListener('click', async () => {
      busy = 'references'; syncButtons();
      try {
        const result = await window.assetWorkshop.removeReference({ token: reference.token });
        references = result.references; model.invalidate(); clearPreview(); renderReferences();
        setStatus('参考图已移除，请重新生成预览。');
      } catch (error) { setStatus(`移除失败：${(error as Error).message}`, 'error'); }
      finally { busy = null; syncButtons(); }
    });
    content.append(name, meta,
      referenceControl('用途', role), referenceControl('参考说明', note),
      referenceControl('优先级（可选，数字越大越优先）', priority), remove);
    tile.append(image, content); referenceList.append(tile);
  }
  updateSummary();
  syncButtons();
}

modeSelect.addEventListener('change', () => {
  if (modeSelect.value !== 'preset' && modeSelect.value !== 'custom') return;
  model.setMode(modeSelect.value);
  renderSelectionIdentity();
  renderedRequirementMode = null;
  currentForm = null;
  draftChanged(true);
});

for (const size of [256, 384, 512]) {
  $<HTMLButtonElement>(`quick-square-${size}`).addEventListener('click', () => {
    if (busy) return;
    model.setField('heightPx', undefined);
    model.setField('widthPx', size);
    model.setField('squareLocked', true);
    draftChanged(true);
    setStatus(`已明确将宽度设为 ${size} px、清除原显式高度，并启用正方形锁；仍将检查当前预设规则。`);
  });
}
$<HTMLButtonElement>('quick-custom').addEventListener('click', () => {
  if (busy) return;
  const values = model.valuesForBridge();
  if (values.heightPx === undefined && values.widthPx !== undefined) model.setField('heightPx', values.widthPx);
  model.setField('squareLocked', false);
  draftChanged(true);
  fieldNodes.get('output.widthPx')?.control.focus();
  setStatus('已切换为自定义画布；请核对宽、高与当前预设规则。');
});

manualTitle.addEventListener('input', () => {
  if (busy) return;
  const before = model.revision;
  model.setManualTitle(manualTitle.value);
  if (model.revision !== before) draftChanged();
});
restoreAutoTitle.addEventListener('click', () => {
  const before = model.revision;
  model.restoreAutoTitle();
  if (model.revision !== before) draftChanged();
});
copyTaskIdButton.addEventListener('click', async () => {
  try { await window.assetWorkshop.copyTaskId(); setStatus('内部任务 ID 已复制。'); }
  catch { setStatus('无法复制 ID，请选中上方只读文本手动复制。', 'error'); }
});

async function beginTask(copy: boolean): Promise<void> {
  if (busy) return;
  busy = 'task'; syncButtons();
  try {
    const result = await window.assetWorkshop.beginTask({ copy });
    if (copy) model.copyTask(result.taskId); else model.newTask(result.taskId);
    references = result.references;
    modeSelect.value = model.mode;
    currentForm = null; renderedRequirementMode = null;
    requirementsEditor.replaceChildren();
    renderSelectionIdentity(); renderReferences(); renderStyleEditors(); draftChanged(true);
    setStatus(copy ? '已复制为新任务；任务 ID 已更新，参考图会在预览与导出时重新核验。'
      : '已新建任务；描述、参考图与自定义设置已清空。');
  } catch (error) { setStatus(`无法${copy ? '复制' : '新建'}任务：${(error as Error).message}`, 'error'); }
  finally { busy = null; syncButtons(); }
}
newTaskButton.addEventListener('click', () => { void beginTask(false); });
copyTaskButton.addEventListener('click', () => { void beginTask(true); });

addReferenceButton.addEventListener('click', async () => {
  busy = 'references'; syncButtons(); setStatus('正在选择参考 PNG…');
  try {
    const result = await window.assetWorkshop.chooseReferences();
    if (result.cancelled) { setStatus('已取消选择参考图。'); return; }
    references = result.references; model.invalidate(); clearPreview(); renderReferences();
    setStatus(`已加入 ${references.length} 张参考图，请重新生成预览。`);
  } catch (error) { setStatus(`无法添加参考图：${(error as Error).message}`, 'error'); }
  finally { busy = null; syncButtons(); }
});

async function pasteReference(): Promise<void> {
  if (busy || !choices.length || references.length >= 8) return;
  busy = 'references'; syncButtons(); setStatus('正在读取剪贴板中的 PNG…');
  try {
    const result = await window.assetWorkshop.pasteReference();
    if (result.cancelled) { setStatus('剪贴板中没有可导入的 PNG。', 'error'); return; }
    references = result.references; model.invalidate(); clearPreview(); renderReferences();
    setStatus(`已从剪贴板加入 PNG；当前共 ${references.length} 张参考图，请重新生成预览。`);
  } catch (error) { setStatus(`粘贴 PNG 失败：${(error as Error).message}`, 'error'); }
  finally { busy = null; syncButtons(); }
}
pasteReferenceButton.addEventListener('click', () => { void pasteReference(); });
referencePanel.addEventListener('keydown', event => {
  if (!event.ctrlKey || event.altKey || event.metaKey || event.key.toLowerCase() !== 'v') return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input,textarea,select'))) return;
  event.preventDefault();
  void pasteReference();
});

async function checkCurrent(exportAfterCheck: boolean): Promise<void> {
  if (busy || !choices.length) return;
  const revision = model.revision;
  const values = model.valuesForBridge();
  const hasContent = Boolean(values.description?.trim()) || references.some(ref => ref.role === 'content')
    || Boolean(values.requirements?.hard?.some(text => text.trim()));
  if (exportAfterCheck && !hasContent && emptyAcknowledgedRevision !== revision) {
    emptyAcknowledgedRevision = revision;
    setStatus('本包缺少具体内容意图，也没有内容参考图。若仍要导出，请再次点击“检查并导出 ZIP”。', 'error');
    return;
  }
  busy = 'preview'; syncButtons(); setStatus('正在组合规范、指令和 ZIP 目录…');
  try {
    const result = await window.assetWorkshop.previewTask({ selection: selection(), values, revision });
    if (result.revision !== revision || !model.acceptPreview(revision)) {
      setStatus('预览期间内容已更改，请重新生成预览。'); return;
    }
    renderWorkflow(result);
    specPreview.textContent = result.specJson || JSON.stringify(result.spec, null, 2);
    promptPreview.textContent = result.prompt;
    entryPreview.replaceChildren();
    for (const path of result.entries) {
      const item = document.createElement('li'); item.textContent = path; entryPreview.append(item);
    }
    if (Array.isArray(result.references)) { references = result.references; renderReferences(); }
    updateSummary();
    if (exportAfterCheck) {
      busy = 'export'; syncButtons();
      const saved = await window.assetWorkshop.exportTask({ revision });
      if (saved.cancelled) { setStatus('已取消保存；当前核验结果仍可导出。', 'ready'); return; }
      setStatus(`任务 ZIP 已保存：${saved.path ?? '未知路径'}\nSHA256：${saved.sha256 ?? '未知'} · ${saved.entries?.length ?? result.entries.length} 个条目\n目标 PNG 尚未生成，由执行端制作。`, 'exported');
    } else setStatus(`预览通过：${references.length} 张参考图，${result.entries.length} 个 ZIP 条目。`, 'ready');
  } catch (error) {
    setStatus(`检查或导出失败：${(error as Error).message}`, 'error');
    if (typeof (error as {field?: unknown}).field === 'string') focusError((error as {field: string}).field);
  }
  finally { busy = null; syncButtons(); }
}
previewButton.addEventListener('click', () => { void checkCurrent(false); });
checkExportButton.addEventListener('click', () => { void checkCurrent(true); });

exportButton.addEventListener('click', async () => {
  const revision = model.exportRevision;
  if (revision === null || busy) return;
  busy = 'export'; syncButtons(); setStatus('正在保存并校验任务 ZIP…');
  try {
    const result = await window.assetWorkshop.exportTask({ revision });
    if (result.cancelled) { setStatus('已取消保存，当前预览仍可导出。'); return; }
    const suffix = model.revision === revision ? '' : '\n当前表单已更改，请重新生成预览。';
    setStatus(`任务 ZIP 已保存：${result.path ?? '未知路径'}\nSHA256：${result.sha256 ?? '未知'}${suffix}`, 'exported');
  } catch (error) { setStatus(`导出失败：${(error as Error).message}`, 'error'); }
  finally { busy = null; syncButtons(); }
});

async function start(): Promise<void> {
  try {
    const task = await window.assetWorkshop.taskInfo();
    model.setTaskId(task.taskId);
    model.setProjectStyleDefault(task.projectStyleDefault);
    references = task.references;
    choices = await window.assetWorkshop.choices();
    if (!choices.some(choice => choice.mode === 'preset') || !choices.some(choice => choice.mode === 'custom')) throw new Error('缺少静态 PNG 模式');
    modeSelect.replaceChildren();
    for (const choice of choices) {
      const option = document.createElement('option'); option.value = choice.mode; option.textContent = choice.label;
      modeSelect.append(option);
    }
    modeSelect.value = model.mode;
    renderSelectionIdentity();
    renderReferences(); renderStyleEditors(); updateTaskIdentity();
    setStatus(task.projectStyleWarning ?? '描述素材并选择规格，点击“检查并导出 ZIP”。', task.projectStyleWarning ? 'error' : 'idle');
    syncButtons();
    await describeCurrentForm();
  } catch (error) { setStatus(`启动失败：${(error as Error).message}`, 'error'); }
  void window.assetWorkshop.info().then(info => {
    $('identity').textContent = `${info.name} ${info.version} · 离线运行`;
  }).catch(() => { $('identity').textContent = '星骸 2D 素材任务工坊 · 离线运行'; });
}

void start();
export {};
