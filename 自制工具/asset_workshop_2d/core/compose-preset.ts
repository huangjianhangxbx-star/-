import { COMPOSED_SCHEMA_VERSION, SpecValidationError } from './schema.ts';
import type { AlphaRequirement, AssetTaskDraft, FieldSource, OutputInput, PresetIdentity, ReferenceFact, ReferenceInput, RequirementInput, ResolvedAssetSpec } from './schema.ts';
import { resolveComposedBase, validateOutputField, validatePartialTaskMetadata } from './resolve-spec.ts';
import { BUILTIN_CATALOG } from './presets/catalog.ts';
import type { CatalogDefinition, PresetCatalog, RuleField, RuleValues, StyleDefinition } from './presets/catalog.ts';

export interface PresetSelection {
  mode: 'preset' | 'custom';
  seed: PresetIdentity; purpose: PresetIdentity; structure: PresetIdentity;
  operation: PresetIdentity; style: PresetIdentity; adapter: PresetIdentity;
}
export interface PresetUserValues {
  taskId: string; title: string; description?: string; styleDescription?: string;
  widthPx?: number; heightPx?: number; squareLocked?: boolean; ppu?: number;
  alphaRequirement?: AlphaRequirement; references?: ReferenceInput[]; requirements?: RequirementInput;
}
export interface PresetFieldDescriptor {
  field: string; label: string; control: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'references';
  visible: boolean; required: boolean; editable: boolean; defaultValue?: unknown;
  options?: readonly { value: string; label: string }[]; source?: FieldSource; reason?: string;
}
export interface PresetFormDescription {
  readonly fields: readonly PresetFieldDescriptor[];
  readonly errors: readonly { field: string; code: string; message: string }[];
}
export type ComposedAssetSpec = ResolvedAssetSpec & {
  readonly schemaVersion: typeof COMPOSED_SCHEMA_VERSION;
  readonly composition: NonNullable<ResolvedAssetSpec['composition']>;
  readonly styleProfile: NonNullable<ResolvedAssetSpec['styleProfile']>;
};

type Axis = 'purpose' | 'structure' | 'operation' | 'style' | 'adapter' | 'seed';
type RuleState = { values: Record<RuleField, unknown>; sources: Record<RuleField, FieldSource>; locks: Map<RuleField, { value: unknown; source: FieldSource }> };
const outputFields: readonly RuleField[] = ['format', 'widthPx', 'heightPx', 'ppu', 'alphaRequirement', 'relativePath', 'squareLocked'];
const userFields = new Set(['taskId', 'title', 'description', 'styleDescription', 'widthPx', 'heightPx', 'squareLocked', 'ppu', 'alphaRequirement', 'references', 'requirements']);
const editableOutputFields: readonly RuleField[] = ['widthPx', 'heightPx', 'squareLocked', 'ppu', 'alphaRequirement'];

export class PresetConflictError extends SpecValidationError {
  readonly rule: string; readonly expectedSource: string; readonly actualSource: string;
  constructor(field: string, rule: string, expectedSource: string, actualSource: string) {
    super(field, 'constraint-conflict', `规则 ${rule} 来自 ${expectedSource}，与 ${actualSource} 冲突`);
    this.rule = rule; this.expectedSource = expectedSource; this.actualSource = actualSource;
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
function definition<T extends CatalogDefinition>(axis: Axis, selected: PresetIdentity, entries: readonly T[]): T {
  if (!selected || typeof selected.id !== 'string' || typeof selected.version !== 'string') throw new SpecValidationError(axis, 'invalid-selection', '必须明确指定ID及版本');
  const match = entries.find(x => x.id === selected.id && x.version === selected.version);
  if (!match) throw new SpecValidationError(axis, entries.some(x => x.id === selected.id) ? 'unsupported-version' : axis === 'adapter' ? 'unsupported-adapter' : 'unknown-preset', `未支持的${axis} ID或版本`);
  return match;
}
function source(axis: Axis, locked: boolean): FieldSource {
  if (axis === 'seed') return locked ? 'preset-lock' : 'preset-default';
  if (axis === 'adapter') throw new SpecValidationError('adapter', 'invalid-catalog', '适配器不得改动结构化规格');
  return `${axis}-${locked ? 'lock' : 'default'}` as FieldSource;
}
function safeRules(axis: Axis, rules: RuleValues): void {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) throw new SpecValidationError(axis, 'invalid-catalog', '规则必须是纯数据对象');
  for (const key of Object.keys(rules)) if (!outputFields.includes(key as RuleField)) throw new SpecValidationError(`${axis}.${key}`, 'invalid-catalog', '未知规则字段');
}

function collect(catalog: PresetCatalog, selection: PresetSelection, values: Partial<PresetUserValues>) {
  if (!selection || (selection.mode !== 'preset' && selection.mode !== 'custom')) throw new SpecValidationError('mode', 'invalid-selection', '必须选择预设或自定义');
  const chosen = {
    purpose: definition('purpose', selection.purpose, catalog.purposes),
    structure: definition('structure', selection.structure, catalog.structures),
    operation: definition('operation', selection.operation, catalog.operations),
    style: definition('style', selection.style, catalog.styles),
    adapter: definition('adapter', selection.adapter, catalog.adapters),
    seed: definition('seed', selection.seed, catalog.seeds),
  };
  if ((selection.mode === 'custom') !== (selection.seed.id === 'custom')) throw new SpecValidationError('seed', 'invalid-selection', '模式与种子不匹配');
  if (chosen.adapter.id !== 'codex' || chosen.adapter.version !== '1') throw new SpecValidationError('adapter', 'unsupported-adapter', '当前仅支持codex@1');
  if (Object.keys(chosen.adapter.defaults).length || Object.keys(chosen.adapter.locks).length) throw new SpecValidationError('adapter', 'invalid-catalog', '适配器不得改变素材规格');
  if (Object.keys(chosen.style.defaults).length || Object.keys(chosen.style.locks).length) throw new SpecValidationError('style', 'invalid-catalog', '风格档案不得改变结构化规格');
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new SpecValidationError('userValues', 'invalid-values', '用户值必须是对象');
  for (const key of Object.keys(values)) if (!userFields.has(key)) throw new SpecValidationError(`userValues.${key}`, 'unknown-field', '此字段不能作为用户值传入');
  if (Object.hasOwn(values, 'references') && !Array.isArray(values.references)) throw new SpecValidationError('references', 'invalid-references', '参考图必须为列表');
  if (Object.hasOwn(values, 'requirements') && (!values.requirements || typeof values.requirements !== 'object' || Array.isArray(values.requirements))) throw new SpecValidationError('requirements', 'invalid-requirements', '要求必须为结构化对象');
  validatePartialTaskMetadata(values as unknown as Record<string, unknown>);

  const state: RuleState = { values: { format: 'png', widthPx: undefined, heightPx: undefined, ppu: 100, alphaRequirement: undefined, relativePath: 'output/asset.png', squareLocked: undefined },
    sources: { format: 'project-default', widthPx: 'project-default', heightPx: 'project-default', ppu: 'project-default', alphaRequirement: 'project-default', relativePath: 'project-default', squareLocked: 'project-default' }, locks: new Map() };
  for (const [axis, item] of Object.entries(chosen) as [Axis, CatalogDefinition][]) {
    safeRules(axis, item.defaults); safeRules(axis, item.locks);
    for (const [key, value] of Object.entries(item.defaults) as [RuleField, unknown][]) {
      const existing = state.locks.get(key);
      if (existing && existing.value !== value) throw new PresetConflictError(`output.${key}`, 'catalog-lock', existing.source, source(axis, false));
      state.values[key] = value; state.sources[key] = source(axis, false);
    }
    for (const [key, value] of Object.entries(item.locks) as [RuleField, unknown][]) {
      const existing = state.locks.get(key);
      const incoming = { value, source: source(axis, true) };
      if (existing && existing.value !== value) throw new PresetConflictError(`output.${key}`, 'catalog-lock', existing.source, incoming.source);
      if (state.values[key] !== undefined && state.values[key] !== value && state.sources[key] !== 'project-default') throw new PresetConflictError(`output.${key}`, 'catalog-lock', incoming.source, state.sources[key]);
      state.locks.set(key, incoming);
    }
  }
  for (const key of editableOutputFields) if (Object.hasOwn(values, key) && values[key as keyof PresetUserValues] !== undefined) {
    if (key !== 'squareLocked') validateOutputField(key, values[key as keyof PresetUserValues]);
    state.values[key] = values[key as keyof PresetUserValues]; state.sources[key] = 'user-override';
  }
  for (const [key, lock] of state.locks) {
    if (state.values[key] !== undefined && state.values[key] !== lock.value && state.sources[key] === 'user-override')
      throw new PresetConflictError(`output.${key}`, 'catalog-lock', lock.source, 'user-override');
    state.values[key] = lock.value; state.sources[key] = lock.source;
  }
  if (typeof state.values.squareLocked !== 'boolean') throw new SpecValidationError('output.squareLocked', 'invalid-boolean', '正方形锁必须是布尔值');
  if (state.values.squareLocked) {
    if (state.values.heightPx === undefined && state.values.widthPx !== undefined) {
      state.values.heightPx = state.values.widthPx; state.sources.heightPx = 'derived';
    } else if (state.values.heightPx !== undefined && state.values.widthPx !== undefined && state.values.heightPx !== state.values.widthPx) {
      throw new PresetConflictError('output.heightPx', 'square-locked', 'structure-lock', state.sources.heightPx);
    }
  }
  return { chosen, state };
}

function form(catalog: PresetCatalog, selection: PresetSelection, values: Partial<PresetUserValues> = {}): PresetFormDescription {
  const errors: { field: string; code: string; message: string }[] = [];
  let collected: ReturnType<typeof collect>;
  try { collected = collect(catalog, selection, values); }
  catch (error) {
    if (!(error instanceof SpecValidationError)) throw error;
    errors.push({ field: error.field, code: error.code, message: error.message });
    const safe = { ...values } as Record<string, unknown>;
    if (error.field === 'output.heightPx') delete safe.heightPx;
    else if (error.field.startsWith('output.')) delete safe[error.field.slice('output.'.length)];
    else if (error.field.startsWith('userValues.')) delete safe[error.field.slice('userValues.'.length)];
    else if (error.field.startsWith('requirements.')) delete safe.requirements;
    else if (error.field.startsWith('references')) delete safe.references;
    else if (error.field === 'taskId' || error.field === 'title' || error.field === 'description' || error.field === 'styleDescription') delete safe[error.field];
    else for (const key of Object.keys(safe)) delete safe[key];
    try { collected = collect(catalog, selection, safe as Partial<PresetUserValues>); }
    catch (again) {
      if (!(again instanceof SpecValidationError)) throw again;
      return freeze({ fields: [], errors });
    }
  }
  const { state } = collected;
  const descriptor = (field: string, label: string, control: PresetFieldDescriptor['control'], required: boolean, visible = true, editable = true,
    defaultValue?: unknown, sourceValue?: FieldSource, reason?: string, options?: PresetFieldDescriptor['options']): PresetFieldDescriptor =>
    ({ field, label, control, visible, required, editable, ...(defaultValue === undefined ? {} : { defaultValue }), ...(sourceValue ? { source: sourceValue } : {}), ...(reason ? { reason } : {}), ...(options ? { options } : {}) });
  const lockedHeight = state.values.squareLocked === true;
  const editable = (key: RuleField) => !state.locks.has(key) && !(key === 'heightPx' && lockedHeight);
  const lockReason = (key: RuleField, fallback?: string) => state.locks.has(key)
    ? `由 ${state.locks.get(key)!.source} 锁定` : fallback;
  const fields: PresetFieldDescriptor[] = [
    descriptor('taskId', '任务 ID', 'text', true),
    descriptor('title', '标题', 'text', true),
    descriptor('description', '内容描述', 'textarea', false),
    descriptor('styleDescription', '人工风格描述', 'textarea', false),
    descriptor('output.format', '格式', 'select', true, true, false, state.values.format, state.sources.format, '本轮固定 PNG'),
    descriptor('output.widthPx', '宽度 px', 'number', true, true, editable('widthPx'), state.values.widthPx, state.sources.widthPx, lockReason('widthPx')),
    descriptor('output.heightPx', '高度 px', 'number', !lockedHeight, true, editable('heightPx'), state.values.heightPx, state.sources.heightPx,
      lockReason('heightPx', lockedHeight ? '锁定正方形：高度须等于宽度，未填写时由宽度推导' : undefined)),
    descriptor('output.squareLocked', '锁定正方形', 'checkbox', false, true, editable('squareLocked'), state.values.squareLocked, state.sources.squareLocked, lockReason('squareLocked')),
    descriptor('output.alphaRequirement', 'Alpha 策略', 'select', true, true, editable('alphaRequirement'), state.values.alphaRequirement, state.sources.alphaRequirement, lockReason('alphaRequirement'),
      ['transparent-required', 'opaque-required', 'alpha-allowed'].map(value => ({ value, label: value }))),
    descriptor('output.ppu', 'Unity PPU', 'number', true, true, editable('ppu'), state.values.ppu, state.sources.ppu, lockReason('ppu')),
    descriptor('output.relativePath', '包内未来输出位置', 'text', true, true, false, state.values.relativePath, state.sources.relativePath, '锁定安全 output/*.png 路径'),
    descriptor('references', '内容／风格参考图', 'references', false, true),
    descriptor('requirements.hard', '自定义硬内容要求', 'textarea', false, selection.mode === 'custom'),
    descriptor('requirements.preferences', '自定义偏好', 'textarea', false, selection.mode === 'custom'),
    descriptor('requirements.creativeFreedom', '创意发挥空间', 'textarea', false, selection.mode === 'custom'),
  ];
  return freeze({ fields, errors });
}

function compose(catalog: PresetCatalog, selection: PresetSelection, values: PresetUserValues, facts: readonly ReferenceFact[]): ComposedAssetSpec {
  const { chosen, state } = collect(catalog, selection, values);
  const output = Object.fromEntries((['format', 'widthPx', 'heightPx', 'ppu', 'alphaRequirement', 'relativePath'] as const).map(key => [key, state.values[key]])) as unknown as OutputInput;
  const description = chosen.style.manualDescription ? [chosen.style.manualDescription, values.styleDescription ?? ''].filter(Boolean).join('\n') : values.styleDescription;
  const requirements: RequirementInput = {
    hard: [...chosen.style.constraints.filter(x => x.level === 'hard').map(x => x.text), ...(values.requirements?.hard ?? [])],
    preferences: [...chosen.style.constraints.filter(x => x.level === 'preferences').map(x => x.text), ...(values.requirements?.preferences ?? [])],
    creativeFreedom: [...chosen.style.constraints.filter(x => x.level === 'creativeFreedom').map(x => x.text), ...(values.requirements?.creativeFreedom ?? [])],
  };
  const draft: AssetTaskDraft = { taskId: values.taskId, title: values.title, description: values.description ?? '',
    styleDescription: description, presetId: selection.seed.id as AssetTaskDraft['presetId'], presetVersion: '1',
    adapterId: 'codex', adapterVersion: '1', output, references: values.references ?? [], requirements };
  const base = resolveComposedBase(draft, facts);
  const fieldSources = { ...base.fieldSources };
  for (const key of outputFields) fieldSources[`output.${key}`] = state.sources[key];
  fieldSources['output.worldWidth'] = 'derived'; fieldSources['output.worldHeight'] = 'derived';
  fieldSources.description = Object.hasOwn(values, 'description') ? 'user-override' : 'project-default';
  fieldSources.styleDescription = values.styleDescription === undefined ? 'style-default' : 'user-override';
  const styleProfile = { id: chosen.style.id, version: chosen.style.version, manualDescription: chosen.style.manualDescription,
    constraints: chosen.style.constraints.map(x => ({ ...x })), styleReferenceIds: base.references.filter(x => x.role === 'style').map(x => x.refId) };
  const identity = (item: CatalogDefinition) => ({ id: item.id, version: item.version });
  return freeze({ ...base, schemaVersion: COMPOSED_SCHEMA_VERSION, presetVersion: chosen.seed.version, composition: { mode: selection.mode,
    seed: identity(chosen.seed), purpose: identity(chosen.purpose), structure: identity(chosen.structure),
    operation: identity(chosen.operation), style: identity(chosen.style), adapter: identity(chosen.adapter) },
    styleProfile, output: { ...base.output, squareLocked: state.values.squareLocked as boolean }, fieldSources }) as ComposedAssetSpec;
}

export function createPresetComposer(catalog: PresetCatalog) {
  // Catalog construction belongs to application code. The user-facing methods only accept IDs and whitelisted values.
  const copy = freeze(structuredClone(catalog));
  return freeze({
    composePreset: (selection: PresetSelection, values: PresetUserValues, facts: readonly ReferenceFact[]) => compose(copy, selection, values, facts),
    describePresetForm: (selection: PresetSelection, values?: Partial<PresetUserValues>) => form(copy, selection, values),
  });
}
const builtin = createPresetComposer(BUILTIN_CATALOG);
export const composePreset = builtin.composePreset;
export const describePresetForm = builtin.describePresetForm;
export function listPresetChoices(): readonly (PresetSelection & { label: string })[] {
  const common = { purpose: { id: 'generic-asset', version: '1' }, structure: { id: 'standalone-static-png', version: '1' },
    operation: { id: 'create-new', version: '1' }, style: { id: 'project-neutral', version: '1' }, adapter: { id: 'codex', version: '1' } };
  return freeze(BUILTIN_CATALOG.seeds.map(seed => ({ mode: seed.id === 'custom' ? 'custom' as const : 'preset' as const,
    seed: { id: seed.id, version: seed.version }, ...structuredClone(common), label: seed.label })));
}
