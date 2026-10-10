export const SCHEMA_VERSION = '1.0.0' as const;
export const COMPOSED_SCHEMA_VERSION = '1.1.0' as const;
export type ReferenceRole = 'content' | 'style';
export type AlphaRequirement = 'transparent-required' | 'opaque-required' | 'alpha-allowed';
export type FieldSource = 'project-default' | 'purpose-default' | 'structure-default' | 'operation-default' | 'style-default' | 'preset-default' | 'user-override' | 'derived' | 'reference-fact' | 'purpose-lock' | 'structure-lock' | 'operation-lock' | 'style-lock' | 'preset-lock';
export interface OutputInput {
  format?: 'png'; widthPx: number; heightPx: number; ppu?: number;
  alphaRequirement: AlphaRequirement; relativePath?: string;
}
export interface ReferenceInput { refId: string; role: ReferenceRole; sourcePath: string; note: string; priority?: number; }
export interface ReferenceFact { refId: string; sha256: string; byteLength: number; widthPx: number; heightPx: number; sourceName: string; }
export interface RequirementInput { hard?: string[]; preferences?: string[]; creativeFreedom?: string[]; }
export interface ProjectStyleContract {
  schemaVersion: '2dw-project-style/1'; name: string; summary: string;
  positiveRules: string[]; negativeRules: string[];
  toneBudget: { darkMaxTiers: number; lightMaxTiers: number };
  shapeLanguageRules: string[]; textureRules: string[]; renderingWarnings: string[];
}
export interface TaskStyleDelta {
  schemaVersion: '2dw-task-style-delta/1'; focus: string;
  mustPreserve: string[]; mustChange: string[]; localReferenceNote: string; avoid: string[];
  toneBudget?: { darkMaxTiers?: number; lightMaxTiers?: number };
}
export interface AssetTaskDraft {
  schemaVersion?: typeof SCHEMA_VERSION; taskId: string; title: string; description: string; styleDescription?: string;
  presetId?: 'standalone-static-png' | 'custom'; presetVersion?: '1'; adapterId?: 'codex'; adapterVersion?: '1';
  output: OutputInput; presetDefaults?: Partial<OutputInput>; hardConstraints?: Partial<OutputInput>;
  references: ReferenceInput[]; requirements?: RequirementInput;
}
export interface ResolvedReference extends ReferenceFact { role: ReferenceRole; note: string; priority?: number; packagePath: string; }
export interface ResolvedAssetSpec {
  readonly schemaVersion: typeof SCHEMA_VERSION | typeof COMPOSED_SCHEMA_VERSION; readonly taskId: string; readonly title: string; readonly description: string; readonly styleDescription: string;
  readonly presetId: 'standalone-static-png' | 'custom'; readonly presetVersion: string; readonly adapterId: 'codex'; readonly adapterVersion: '1';
  readonly output: Readonly<Required<OutputInput> & { worldWidth: number; worldHeight: number; squareLocked?: boolean }>;
  readonly requirements: Readonly<{ hard: readonly string[]; preferences: readonly string[]; creativeFreedom: readonly string[] }>;
  readonly references: readonly Readonly<ResolvedReference>[];
  readonly fieldSources: Readonly<Record<string, FieldSource>>;
  readonly composition?: Readonly<{ mode: 'preset' | 'custom'; seed: Readonly<PresetIdentity>; purpose: Readonly<PresetIdentity>; structure: Readonly<PresetIdentity>; operation: Readonly<PresetIdentity>; style: Readonly<PresetIdentity>; adapter: Readonly<PresetIdentity> }>;
  readonly styleProfile?: Readonly<{ id: string; version: string; manualDescription: string; constraints: readonly Readonly<{ level: 'hard' | 'preferences' | 'creativeFreedom'; text: string }>[]; styleReferenceIds: readonly string[] }>;
  readonly projectStyleContract?: Readonly<ProjectStyleContract> | null;
  readonly taskStyleDelta?: Readonly<TaskStyleDelta> | null;
}
export interface PresetIdentity { id: string; version: string; }
export class SpecValidationError extends Error {
  readonly field: string; readonly code: string;
  constructor(field: string, code: string, message: string) { super(`${field}: ${message}`); this.name = 'SpecValidationError'; this.field = field; this.code = code; }
}
export const LIMITS = Object.freeze({ maxDimension: 8192, maxPixels: 67_108_864, maxReferenceDimension: 4096, maxReferencePixels: 16_777_216, maxReferences: 8, maxReferenceBytes: 4 * 1024 * 1024, maxTotalReferenceBytes: 32 * 1024 * 1024, maxTextBytes: 64 * 1024 });
