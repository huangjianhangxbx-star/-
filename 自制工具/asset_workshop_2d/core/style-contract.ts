import { SpecValidationError } from './schema.ts';
import type { ProjectStyleContract, TaskStyleDelta } from './schema.ts';

export const DEFAULT_PROJECT_STYLE_CONTRACT: ProjectStyleContract = {
  schemaVersion: '2dw-project-style/1',
  name: '星骸回廊手绘块面风格',
  summary: '以清楚、经过设计的色块和黑色结构概括体积；控制明暗层级与细节密度。',
  positiveRules: [
    '闭塞区域、裂缝、接触面和背光面优先用黑线、黑块或深色块概括。',
    '暗部接近黑色后停止继续刻画细节。',
    '用经过设计的装饰性块面组织体积，保留画面的整体可读性。',
  ],
  negativeRules: [
    '避免过度精致和写实抛光感。',
    '避免 AI 式密集材质细节。',
    '避免平均铺开的裂纹和无目标噪点。',
  ],
  toneBudget: { darkMaxTiers: 3, lightMaxTiers: 3 },
  shapeLanguageRules: ['形状与轮廓优先，黑色结构块承担遮挡、接触和转折。'],
  textureRules: ['减少碎纹理和重复噪点；让大中小块面有明确主次。'],
  renderingWarnings: ['仅允许少量克制的渐变，不能用平滑过渡替代块面设计。'],
};

function fail(field: string, code: string, message: string): never { throw new SpecValidationError(field, code, message); }
function record(value: unknown, field: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'invalid-object', '必须是结构化对象');
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) if (!keys.includes(key)) fail(`${field}.${key}`, 'unknown-field', '未知字段');
  return result;
}
function line(value: unknown, field: string, required: boolean): string {
  if (typeof value !== 'string') fail(field, 'invalid-text', '必须是文本');
  const normalized = value.replace(/\r\n?/gu, '\n').normalize('NFC');
  if ((required && !normalized.trim()) || normalized.includes('\0') || new TextEncoder().encode(normalized).byteLength > 2048)
    fail(field, 'invalid-text', '文本为空、含空字节或超过预算');
  return normalized;
}
function lines(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 16) fail(field, 'invalid-list', '必须是不超过16项的文本列表');
  return value.map((item, index) => line(item, `${field}[${index}]`, true));
}
function tiers(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 5)
    fail(field, 'invalid-number', '明暗层级预算必须为1到5的整数');
  return value as number;
}
export function validateProjectStyleContract(value: unknown): ProjectStyleContract {
  const field = 'projectStyleContract';
  const source = record(value, field, ['schemaVersion', 'name', 'summary', 'positiveRules', 'negativeRules', 'toneBudget', 'shapeLanguageRules', 'textureRules', 'renderingWarnings']);
  if (source.schemaVersion !== '2dw-project-style/1') fail(`${field}.schemaVersion`, 'unsupported-version', '不支持的项目风格契约版本');
  const budget = record(source.toneBudget, `${field}.toneBudget`, ['darkMaxTiers', 'lightMaxTiers']);
  return {
    schemaVersion: '2dw-project-style/1', name: line(source.name, `${field}.name`, true), summary: line(source.summary, `${field}.summary`, true),
    positiveRules: lines(source.positiveRules, `${field}.positiveRules`), negativeRules: lines(source.negativeRules, `${field}.negativeRules`),
    toneBudget: { darkMaxTiers: tiers(budget.darkMaxTiers, `${field}.toneBudget.darkMaxTiers`), lightMaxTiers: tiers(budget.lightMaxTiers, `${field}.toneBudget.lightMaxTiers`) },
    shapeLanguageRules: lines(source.shapeLanguageRules, `${field}.shapeLanguageRules`), textureRules: lines(source.textureRules, `${field}.textureRules`),
    renderingWarnings: lines(source.renderingWarnings, `${field}.renderingWarnings`),
  };
}
export function normalizeProjectStyleContract(value: unknown): ProjectStyleContract | null {
  if (value === null) return null;
  return validateProjectStyleContract(value === undefined ? DEFAULT_PROJECT_STYLE_CONTRACT : value);
}
export function validateTaskStyleDelta(value: unknown): TaskStyleDelta {
  const field = 'taskStyleDelta';
  const source = record(value, field, ['schemaVersion', 'focus', 'mustPreserve', 'mustChange', 'localReferenceNote', 'avoid', 'toneBudget']);
  if (source.schemaVersion !== '2dw-task-style-delta/1') fail(`${field}.schemaVersion`, 'unsupported-version', '不支持的任务风格偏移版本');
  let toneBudget: TaskStyleDelta['toneBudget'];
  if (source.toneBudget !== undefined) {
    const budget = record(source.toneBudget, `${field}.toneBudget`, ['darkMaxTiers', 'lightMaxTiers']);
    toneBudget = {};
    if (budget.darkMaxTiers !== undefined) toneBudget.darkMaxTiers = tiers(budget.darkMaxTiers, `${field}.toneBudget.darkMaxTiers`);
    if (budget.lightMaxTiers !== undefined) toneBudget.lightMaxTiers = tiers(budget.lightMaxTiers, `${field}.toneBudget.lightMaxTiers`);
  }
  return { schemaVersion: '2dw-task-style-delta/1', focus: line(source.focus, `${field}.focus`, true),
    mustPreserve: lines(source.mustPreserve, `${field}.mustPreserve`), mustChange: lines(source.mustChange, `${field}.mustChange`),
    localReferenceNote: line(source.localReferenceNote, `${field}.localReferenceNote`, false), avoid: lines(source.avoid, `${field}.avoid`),
    ...(toneBudget ? { toneBudget } : {}),
  };
}
export function normalizeTaskStyleDelta(value: unknown): TaskStyleDelta | null {
  return value === undefined || value === null ? null : validateTaskStyleDelta(value);
}
function compactRule(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}
function prohibitedPhrases(rule: string): string[] {
  return rule.split(/[和与及或、，。；;:：]/u)
    .map(part => compactRule(part).replace(/^(?:避免|不要|禁止|不得|杜绝|拒绝|减少|控制|压低)/u, '').replace(/感$/u, ''))
    .filter(part => part.length >= 2);
}
function requestsProhibitedLook(request: string, negativeRule: string): boolean {
  const proposal = compactRule(request);
  // This is deliberately a narrow warning for explicit requests, not semantic image analysis.
  if (/(?:避免|不要|不得|禁止|减少|削弱|压低|抑制|克制|去除|去掉|停止|不再)/u.test(proposal)) return false;
  if (!/(?:改成|改为|变成|变为|采用|使用|增加|加入|强化|加强|追求|突出|呈现|做成|希望|更|保持)/u.test(proposal)) return false;
  return prohibitedPhrases(negativeRule).some(phrase => proposal.includes(phrase));
}
export function getStyleConflicts(contract: ProjectStyleContract | null | undefined, delta: TaskStyleDelta | null | undefined): string[] {
  if (!delta) return [];
  if (!contract) return ['无项目基线保护：本次风格偏移仍可记录，但需在执行前确认项目画风约束。'];
  const conflicts: string[] = [];
  const dark = delta.toneBudget?.darkMaxTiers;
  const light = delta.toneBudget?.lightMaxTiers;
  if (dark !== undefined && dark > contract.toneBudget.darkMaxTiers) conflicts.push(`暗部层级偏移 ${dark} 超过项目上限 ${contract.toneBudget.darkMaxTiers}；暂停受影响制作并确认。`);
  if (light !== undefined && light > contract.toneBudget.lightMaxTiers) conflicts.push(`亮部层级偏移 ${light} 超过项目上限 ${contract.toneBudget.lightMaxTiers}；暂停受影响制作并确认。`);
  for (const request of [delta.focus, ...delta.mustChange]) {
    for (const prohibition of contract.negativeRules) {
      if (requestsProhibitedLook(request, prohibition))
        conflicts.push(`本次要求“${request}”可能与项目负向约束“${prohibition}”冲突；暂停受影响制作并确认。`);
    }
  }
  return conflicts;
}
