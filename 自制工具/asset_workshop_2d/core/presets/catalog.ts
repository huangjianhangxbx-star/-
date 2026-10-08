import type { OutputInput, PresetIdentity } from '../schema.ts';

export type RuleField = keyof OutputInput | 'squareLocked';
export type RuleValues = Partial<OutputInput> & { squareLocked?: boolean };
export interface CatalogDefinition extends PresetIdentity {
  readonly label: string;
  readonly defaults: Readonly<RuleValues>;
  readonly locks: Readonly<RuleValues>;
}
export interface StyleDefinition extends CatalogDefinition {
  readonly manualDescription: string;
  readonly constraints: readonly Readonly<{ level: 'hard' | 'preferences' | 'creativeFreedom'; text: string }>[];
}
export interface PresetCatalog {
  readonly purposes: readonly CatalogDefinition[];
  readonly structures: readonly CatalogDefinition[];
  readonly operations: readonly CatalogDefinition[];
  readonly styles: readonly StyleDefinition[];
  readonly adapters: readonly CatalogDefinition[];
  readonly seeds: readonly CatalogDefinition[];
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

// This module is authored with the application, never loaded from a task ZIP or user draft.
export const BUILTIN_CATALOG: PresetCatalog = freeze({
  purposes: [{ id: 'generic-asset', version: '1', label: '一般素材', defaults: {}, locks: {} }],
  structures: [{ id: 'standalone-static-png', version: '1', label: '独立静态 PNG',
    defaults: { alphaRequirement: 'transparent-required', squareLocked: false },
    locks: { format: 'png', relativePath: 'output/asset.png' } }],
  operations: [{ id: 'create-new', version: '1', label: '创建新素材', defaults: {}, locks: {} }],
  styles: [{ id: 'project-neutral', version: '1', label: '项目中性（人工描述）', defaults: {}, locks: {}, manualDescription: '', constraints: [] }],
  adapters: [{ id: 'codex', version: '1', label: 'Codex 任务文本', defaults: {}, locks: {} }],
  seeds: [
    { id: 'standalone-static-png', version: '1', label: '独立静态 PNG', defaults: {}, locks: {} },
    { id: 'custom', version: '1', label: '自定义静态 PNG', defaults: {}, locks: {} },
  ],
});
