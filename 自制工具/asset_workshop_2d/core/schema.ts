export const SCHEMA_VERSION = '1.0.0' as const;
export type ReferenceRole = 'content' | 'style';
export type AlphaRequirement = 'transparent-required' | 'opaque-required' | 'alpha-allowed';
export type FieldSource = 'project-default' | 'preset-default' | 'user-override' | 'derived' | 'reference-fact';
export interface OutputInput {
  format?: 'png'; widthPx: number; heightPx: number; ppu?: number;
  alphaRequirement: AlphaRequirement; relativePath?: string;
}
export interface ReferenceInput { refId: string; role: ReferenceRole; sourcePath: string; note: string; priority?: number; }
export interface ReferenceFact { refId: string; sha256: string; byteLength: number; widthPx: number; heightPx: number; sourceName: string; }
export interface RequirementInput { hard?: string[]; preferences?: string[]; creativeFreedom?: string[]; }
export interface AssetTaskDraft {
  schemaVersion?: typeof SCHEMA_VERSION; taskId: string; title: string; description: string; styleDescription?: string;
  presetId?: 'standalone-static-png' | 'custom'; presetVersion?: '1'; adapterId?: 'codex'; adapterVersion?: '1';
  output: OutputInput; presetDefaults?: Partial<OutputInput>; hardConstraints?: Partial<OutputInput>;
  references: ReferenceInput[]; requirements?: RequirementInput;
}
export interface ResolvedReference extends ReferenceFact { role: ReferenceRole; note: string; priority?: number; packagePath: string; }
export interface ResolvedAssetSpec {
  readonly schemaVersion: typeof SCHEMA_VERSION; readonly taskId: string; readonly title: string; readonly description: string; readonly styleDescription: string;
  readonly presetId: 'standalone-static-png' | 'custom'; readonly presetVersion: '1'; readonly adapterId: 'codex'; readonly adapterVersion: '1';
  readonly output: Readonly<Required<OutputInput> & { worldWidth: number; worldHeight: number }>;
  readonly requirements: Readonly<{ hard: readonly string[]; preferences: readonly string[]; creativeFreedom: readonly string[] }>;
  readonly references: readonly Readonly<ResolvedReference>[];
  readonly fieldSources: Readonly<Record<string, FieldSource>>;
}
export class SpecValidationError extends Error {
  readonly field: string; readonly code: string;
  constructor(field: string, code: string, message: string) { super(`${field}: ${message}`); this.name = 'SpecValidationError'; this.field = field; this.code = code; }
}
export const LIMITS = Object.freeze({ maxDimension: 8192, maxPixels: 67_108_864, maxReferenceDimension: 4096, maxReferencePixels: 16_777_216, maxReferences: 8, maxReferenceBytes: 4 * 1024 * 1024, maxTotalReferenceBytes: 32 * 1024 * 1024, maxTextBytes: 64 * 1024 });
