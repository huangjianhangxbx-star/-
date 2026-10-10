import { SpecValidationError } from './schema.ts';
import type { ProjectStyleContract, TaskStyleDelta } from './schema.ts';
import { getStyleConflicts, DEFAULT_PROJECT_STYLE_CONTRACT } from './style-contract.ts';
import { ENVIRONMENT_RULES, ENVIRONMENT_CATALOG_VERSION, MATERIAL_FAMILIES, POSITIVE_VISUAL_ANCHOR } from './environment-style-catalog.ts';

export type MaterialFamily = 'general' | 'stone' | 'wood' | 'soil' | 'metal' | 'vegetation';
export interface EnvironmentStyleInput {
  schemaVersion: '2dw-environment-style/1'; domain: 'environment'; materialFamily: MaterialFamily; repeatable: boolean; connected: boolean;
}
export interface EnvironmentRule {
  id: string; version: string; layer: 'L0' | 'L1' | 'L2' | 'failure'; domain: 'environment';
  applicableMaterialFamilies: readonly (MaterialFamily | 'all')[];
  ruleType: 'positive' | 'negative' | 'warning' | 'failure-signal'; text: string;
  status: 'approved' | 'candidate'; origin: string; checkMode: 'visual-review';
  appliesWhen?: 'repeatable-or-connected'; trigger?: string; inheritedFrom?: string;
}
export interface ResolvedEnvironmentStyle {
  schemaVersion: '2dw-environment-style/1'; catalogVersion: '1'; selection: EnvironmentStyleInput;
  approvedRules: EnvironmentRule[]; candidateRules: EnvironmentRule[]; failureSignals: EnvironmentRule[];
  conflicts: string[]; referenceAnchors: (typeof POSITIVE_VISUAL_ANCHOR)[];
}
export function validateEnvironmentSelection(value: unknown): EnvironmentStyleInput | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SpecValidationError('environmentStyle', 'invalid-object', '场景选择必须为对象或空');
  const record = value as Record<string, unknown>;
  const keys = ['schemaVersion', 'domain', 'materialFamily', 'repeatable', 'connected'];
  if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(record, key)))
    throw new SpecValidationError('environmentStyle', 'unknown-field', '场景选择必须包含且仅包含已知字段');
  if (record.schemaVersion !== '2dw-environment-style/1' || record.domain !== 'environment'
    || !MATERIAL_FAMILIES.some(f => f.id === record.materialFamily)
    || typeof record.repeatable !== 'boolean' || typeof record.connected !== 'boolean')
    throw new SpecValidationError('environmentStyle', 'invalid-selection', '未知场景版本、领域、材质或条件');
  return structuredClone(record) as unknown as EnvironmentStyleInput;
}
export function resolveEnvironmentStyle(value: unknown, contract: ProjectStyleContract | null, delta: TaskStyleDelta | null): ResolvedEnvironmentStyle | null {
  const selection = validateEnvironmentSelection(value);
  if (!selection) return null;
  const rules = ENVIRONMENT_RULES.filter(rule => (rule.applicableMaterialFamilies.includes('all') || rule.applicableMaterialFamilies.includes(selection.materialFamily))
    && (!rule.appliesWhen || selection.repeatable || selection.connected)).map(rule => ({ ...structuredClone(rule),
      trigger: rule.appliesWhen ? '显式重复利用/联通选择' : rule.layer === 'L2' ? `材质 ${selection.materialFamily}` : '场景领域',
    }));
  // Preserve the old authority; annotate equivalent inherited semantics instead of duplicating its text in prompts.
  const darkRule = rules.find(r => r.id === 'ENV-COM-04');
  if (darkRule && contract?.positiveRules.includes(DEFAULT_PROJECT_STYLE_CONTRACT.positiveRules[1])) darkRule.inheritedFrom = 'projectStyleContract.positiveRules';
  const budgetRule = rules.find(r => r.id === 'ENV-COM-10');
  if (budgetRule && contract) budgetRule.inheritedFrom = 'projectStyleContract.toneBudget';
  const conflicts = [...getStyleConflicts(contract, delta)];
  if (contract && (contract.toneBudget.darkMaxTiers > 3 || contract.toneBudget.lightMaxTiers > 3))
    conflicts.push('项目主要块面预算与已批准场景暗/亮各最多3阶不同；暂停受影响制作并确认。');
  if (!contract && ((delta?.toneBudget?.darkMaxTiers ?? 3) > 3 || (delta?.toneBudget?.lightMaxTiers ?? 3) > 3))
    conflicts.push('本次明暗预算放宽已批准场景主要块面各最多3阶；空项目基线不能解除场景约束，暂停受影响制作并确认。');
  return { schemaVersion: '2dw-environment-style/1', catalogVersion: ENVIRONMENT_CATALOG_VERSION, selection,
    approvedRules: rules.filter(r => r.status === 'approved' && r.layer !== 'failure'),
    candidateRules: rules.filter(r => r.status === 'candidate'), failureSignals: rules.filter(r => r.layer === 'failure'),
    conflicts, referenceAnchors: selection.materialFamily === 'stone' ? [{ ...POSITIVE_VISUAL_ANCHOR }] : [],
  };
}
const escapeText = (text: string) => JSON.stringify(text).replace(/</gu, '\\u003c').replace(/>/gu, '\\u003e').replace(/&/gu, '\\u0026');
export function renderEnvironmentEntries(env: ResolvedEnvironmentStyle): Record<string, string> {
  const render = (title: string, rules: readonly EnvironmentRule[]) => [
    `# ${title}`, '', 'spec/asset-spec.json 是唯一权威；本文件仅为派生镜像。美术结果待人工/外部 AI 看图审阅，未自动验收。', '',
    ...rules.map(r => `- ${r.id}@${r.version} [${r.status}] ${escapeText(r.text)}\n  来源：${escapeText(r.origin)}；适用：${r.trigger}${r.inheritedFrom ? `；继承已有 ${r.inheritedFrom}，仅补充解释，不重复旧契约正文` : ''}。`), '',
  ].join('\n');
  return {
    'style/scene-style-charter.md': render('已批准场景美术总纲 L0', env.approvedRules.filter(r => r.layer === 'L0')),
    'style/environment-common-rules.md': render('已批准通用表现 L1', env.approvedRules.filter(r => r.layer === 'L1')),
    'style/material-family.md': render(`材质 ${env.selection.materialFamily}：正式与实验候选分开`, [...env.approvedRules.filter(r => r.layer === 'L2'), ...env.candidateRules])
      + '\n候选不作为强制规则；待补材质不虚构画法。正向参考元信息（只有明确选入 references 才携带图片）：\n'
      + JSON.stringify(env.referenceAnchors.map(anchor => Object.fromEntries(Object.entries(anchor).sort(([a], [b]) => a.localeCompare(b)))), null, 2) + '\n',
    'style/failure-signals.md': render('人工/外部 AI 判错检查点', env.failureSignals)
      + '\n可检测的预算/文字冲突（未检测到不等于没有视觉冲突）：\n' + JSON.stringify(env.conflicts, null, 2) + '\n',
  };
}
