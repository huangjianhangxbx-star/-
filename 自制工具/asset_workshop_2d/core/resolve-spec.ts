import { LIMITS, SCHEMA_VERSION, SpecValidationError } from './schema.ts';
import type { AssetTaskDraft, FieldSource, OutputInput, ReferenceFact, ResolvedAssetSpec, ResolvedReference } from './schema.ts';
function fail(field: string, code: string, message: string): never { throw new SpecValidationError(field, code, message); }
function text(value: unknown, field: string, required = false, limit = LIMITS.maxTextBytes): string {
  if (typeof value !== 'string') fail(field, 'invalid-text', '必须为字符串');
  const result = value.replace(/\r\n?/g, '\n').normalize('NFC');
  if ((required && !result.trim()) || /\u0000/.test(result) || new TextEncoder().encode(result).byteLength > limit) fail(field, 'invalid-text', '文本为空、包含空字节或超过预算');
  return result;
}
function id(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) fail(field, 'invalid-id', '必须为安全标识，不能是路径或设备名');
  return value;
}
function positiveInteger(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || value > max) fail(field, 'invalid-number', `必须为1至${max}的整数`);
  return value;
}
function outputValue(key: keyof OutputInput, value: unknown): any {
  const field = `output.${key}`;
  if (key === 'widthPx' || key === 'heightPx') return positiveInteger(value, field, LIMITS.maxDimension);
  if (key === 'ppu') { if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1_000_000) fail(field, 'invalid-number', 'PPU必须为有限正数且不超过1000000'); return value; }
  if (key === 'format') { if (value !== 'png') fail(field, 'invalid-format', '首轮只支持PNG'); return value; }
  if (key === 'alphaRequirement') { if (!['transparent-required', 'opaque-required', 'alpha-allowed'].includes(value as string)) fail(field, 'invalid-alpha', '必须显式指定Alpha要求'); return value; }
  if (typeof value !== 'string' || value.length > 240 || !/^output\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\.png$/.test(value) || value.includes('..') || /^(?:output\/)(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(value)) fail(field, 'invalid-path', '必须为output/下安全PNG相对文件路径');
  return value;
}
function enumVersion(value: unknown, fallback: string, allowed: string[], field: string): any { const v = value === undefined ? fallback : value; if (!allowed.includes(v as string)) fail(field, 'unsupported-version', '未支持的身份或版本'); return v; }
function freeze<T>(value: T): T { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical((value as Record<string, unknown>)[k])]));
  return value;
}
export function serializeSpec(spec: ResolvedAssetSpec): string { return JSON.stringify(canonical(spec), null, 2) + '\n'; }
export function resolveSpec(draft: AssetTaskDraft, facts: readonly ReferenceFact[]): ResolvedAssetSpec {
  if (!draft || typeof draft !== 'object' || !draft.output || typeof draft.output !== 'object') fail('draft', 'invalid-draft', '缺少任务和output对象');
  const fieldSources: Record<string, FieldSource> = {};
  const keys: (keyof OutputInput)[] = ['format', 'widthPx', 'heightPx', 'ppu', 'alphaRequirement', 'relativePath'];
  const defaults: Partial<OutputInput> = { format: 'png', ppu: 100, relativePath: 'output/asset.png' };
  const output: Record<string, any> = {};
  for (const key of keys) {
    let value = defaults[key]; let source: FieldSource = key === 'ppu' ? 'project-default' : 'preset-default';
    if (draft.presetDefaults && draft.presetDefaults[key] !== undefined) { value = draft.presetDefaults[key] as never; source = 'preset-default'; }
    if (draft.output[key] !== undefined) { value = draft.output[key] as never; source = 'user-override'; }
    output[key] = outputValue(key, value); fieldSources[`output.${key}`] = source;
    if (draft.hardConstraints && draft.hardConstraints[key] !== undefined && outputValue(key, draft.hardConstraints[key]) !== output[key]) fail(`output.${key}`, 'constraint-conflict', '有效值与已声明硬约束冲突');
  }
  if (output.widthPx * output.heightPx > LIMITS.maxPixels) fail('output.widthPx', 'pixel-budget', '超过总像素预算');
  output.worldWidth = output.widthPx / output.ppu; output.worldHeight = output.heightPx / output.ppu;
  if (!Number.isFinite(output.worldWidth) || !Number.isFinite(output.worldHeight)) fail('output.ppu', 'invalid-number', 'PPU过小，派生世界尺寸必须为有限数');
  fieldSources['output.worldWidth'] = 'derived'; fieldSources['output.worldHeight'] = 'derived';
  if (!Array.isArray(draft.references) || draft.references.length < 1 || draft.references.length > LIMITS.maxReferences || !Array.isArray(facts)) fail('references', 'reference-budget', '参考图数量不合法');
  const factMap = new Map<string, ReferenceFact>();
  for (const fact of facts) { if (!fact || factMap.has(fact.refId)) fail('references.facts', 'duplicate-fact', '重复或无效事实'); factMap.set(fact.refId, fact); }
  const seen = new Set<string>(); let total = 0;
  const references: ResolvedReference[] = draft.references.map((input, index) => {
    const loc = `references[${index}]`; const refId = id(input.refId, `${loc}.refId`);
    if (seen.has(refId)) fail(`${loc}.refId`, 'duplicate-reference', '重复参考图ID'); seen.add(refId);
    if (input.role !== 'content' && input.role !== 'style') fail(`${loc}.role`, 'invalid-role', '仅支持content/style');
    if (typeof input.sourcePath !== 'string' || !input.sourcePath.trim() || input.sourcePath.includes('\u0000')) fail(`${loc}.sourcePath`, 'missing-source', '缺少参考图源身份');
    const fact = factMap.get(refId); if (!fact) fail(`${loc}.refId`, 'missing-fact', '缺少实际读图事实');
    if (!/^[a-f0-9]{64}$/.test(fact.sha256)) fail(`${loc}.sha256`, 'invalid-hash', 'SHA256必须为小写64位十六进制');
    const byteLength = positiveInteger(fact.byteLength, `${loc}.byteLength`, LIMITS.maxReferenceBytes); total += byteLength;
    const widthPx = positiveInteger(fact.widthPx, `${loc}.widthPx`, LIMITS.maxReferenceDimension); const heightPx = positiveInteger(fact.heightPx, `${loc}.heightPx`, LIMITS.maxReferenceDimension);
    if (widthPx * heightPx > LIMITS.maxReferencePixels) fail(`${loc}.widthPx`, 'pixel-budget', '参考图超过像素预算');
    const sourceName = text(fact.sourceName, `${loc}.sourceName`, true, 240);
    if (/[\\/:]/.test(sourceName) || sourceName === '.' || sourceName === '..') fail(`${loc}.sourceName`, 'private-source-path', '源显示名不得含路径');
    if (input.priority !== undefined && (!Number.isSafeInteger(input.priority) || input.priority < 0 || input.priority > 100)) fail(`${loc}.priority`, 'invalid-priority', '优先级须为0至100整数');
    const result: ResolvedReference = { refId, role: input.role, sourceName, sha256: fact.sha256, byteLength, widthPx, heightPx, note: text(input.note, `${loc}.note`, false, 4096), packagePath: `references/${input.role}/${refId}.png` };
    if (input.priority !== undefined) result.priority = input.priority;
    return result;
  }).sort((a,b) => a.role < b.role ? -1 : a.role > b.role ? 1 : a.refId < b.refId ? -1 : a.refId > b.refId ? 1 : 0);
  if (total > LIMITS.maxTotalReferenceBytes) fail('references', 'reference-budget', '参考图总字节超过预算');
  if (seen.size !== factMap.size) fail('references.facts', 'orphan-fact', '存在未被任务引用的事实');
  for (const reference of references) { fieldSources[`references.${reference.refId}.role`] = 'user-override'; fieldSources[`references.${reference.refId}.identity`] = 'reference-fact'; }
  const requirements: { hard: string[]; preferences: string[]; creativeFreedom: string[] } = { hard: [], preferences: [], creativeFreedom: [] };
  for (const level of ['hard', 'preferences', 'creativeFreedom'] as const) {
    const values = draft.requirements?.[level] ?? [];
    if (!Array.isArray(values) || values.length > 32) fail(`requirements.${level}`, 'invalid-requirements', '必须为不超过32项的文本列表');
    requirements[level] = values.map((value, i) => text(value, `requirements.${level}[${i}]`, true, 4096));
  }
  const result = {
    schemaVersion: enumVersion(draft.schemaVersion, SCHEMA_VERSION, [SCHEMA_VERSION], 'schemaVersion'), taskId: id(draft.taskId, 'taskId'), title: text(draft.title, 'title', true, 240),
    description: text(draft.description, 'description', false), styleDescription: text(draft.styleDescription ?? '', 'styleDescription', false),
    presetId: enumVersion(draft.presetId, 'standalone-static-png', ['standalone-static-png', 'custom'], 'presetId'), presetVersion: enumVersion(draft.presetVersion, '1', ['1'], 'presetVersion'),
    adapterId: enumVersion(draft.adapterId, 'codex', ['codex'], 'adapterId'), adapterVersion: enumVersion(draft.adapterVersion, '1', ['1'], 'adapterVersion'),
    output: output as ResolvedAssetSpec['output'], requirements, references, fieldSources,
  } as ResolvedAssetSpec;
  for (const field of ['title', 'description', 'styleDescription'] as const) fieldSources[field] = draft[field] === undefined ? 'project-default' : 'user-override';
  return freeze(result);
}
