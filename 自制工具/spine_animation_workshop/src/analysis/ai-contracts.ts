import type { SpineObjectMapping, SpineSide, SpineDrive } from '../core/spine-contracts.ts';
import type { RigProfile, RigSelection } from './rig-profile.ts';

export type AiRigIdentity = {
  projectPath: string; skeletonName: string; projectHash: string; fileHash: string;
  skeletonFingerprint: string; skin: string; directionId: string;
};
export type AiRigInput = { projectPath: string; skeletonName: string; projectHash: string;
  document: unknown; jsonText?: string; atlasText: string; skin: string; selection: RigSelection };
export type AiBundleInput = { source: AiRigInput; target: AiRigInput; animations: readonly string[]; toolVersion: string };
export type AiBundleManifest = {
  bundleSchema: 'spw.ai.bundle.v1'; bundleId: string; toolVersion: string;
  source: AiRigIdentity; target: AiRigIdentity; animations: string[]; evidenceIds: string[];
  sourceSelection: RigSelection; targetSelection: RigSelection;
  editorVersions: { source: string; target: string };
};
export type AiObjectInventory = {
  slots: { name: string; bone: string }[]; events: string[];
  attachments: { name: string; skin: string; slot: string; bone: string }[];
};
export type AiRigProfile = RigProfile & { identity: AiRigIdentity; objects: AiObjectInventory };
export type AiBundle = { manifest: AiBundleManifest; sourceRig: AiRigProfile; targetRig: AiRigProfile; files: Record<string, string> };
export type AiValidationContext = Pick<AiBundle, 'manifest' | 'sourceRig' | 'targetRig'>;
export type AiRecognitionStatus = 'confirmed' | 'proposed' | 'unresolved';
export type AiMappingEntry = {
  kind: SpineObjectMapping['kind']; source: string; target: string; side: SpineSide;
  drive: Exclude<SpineDrive, 'skip'>; semanticRole: string; status: AiRecognitionStatus;
  evidenceIds: string[]; reason: string; reviewNotes?: string[]; channels?: string[];
  sourceSkin?: string; sourceSlot?: string; targetSkin?: string; targetSlot?: string;
};
export type AiMappingProposal = {
  proposalSchema: 'spw.ai.mapping.v1'; bundleId: string; source: AiRigIdentity; target: AiRigIdentity;
  mappings: AiMappingEntry[]; unresolved: { source: string; reason: string }[];
};
export type AiRigHints = {
  hintsSchema: 'spw.ai.rig-hints.v1'; bundleId: string; rigs: {
    side: 'source' | 'target'; identity: AiRigIdentity; selection: RigSelection;
    bones: { name: string; semanticRole: string; status: AiRecognitionStatus; evidenceIds: string[]; reason: string; sharedControl: boolean }[];
  }[];
};
export type AiCandidateGroup = 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'control' | 'decoration' | 'display';
export type AiReviewedCandidate = {
  id: string; group: AiCandidateGroup; mapping: SpineObjectMapping; semanticRole: string; status: AiRecognitionStatus;
  evidenceIds: string[]; reason: string; reviewNotes: string[]; warnings: string[];
};
export type AiReviewedProposal = { proposal: AiMappingProposal; hints?: AiRigHints;
  candidates: AiReviewedCandidate[]; unresolved: AiMappingProposal['unresolved']; warnings: string[] };
/** Persist reviewed data, not the large sampled bundle; revalidate against fresh inputs when reopening. */
export type AiReviewState = {
  reviewSchema: 'spw.ai.review.v1'; manifest: AiBundleManifest; proposal?: AiMappingProposal; hints?: AiRigHints; acceptedIds: string[];
  withdrawnIds?: string[];
};

export type JsonSchema = {
  $schema?: string; $id?: string; title?: string; description?: string; type?: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, JsonSchema>; required?: readonly string[]; additionalProperties?: boolean;
  items?: JsonSchema; minItems?: number; maxItems?: number; uniqueItems?: boolean;
  minLength?: number; maxLength?: number; pattern?: string; const?: unknown; enum?: readonly unknown[];
};
const text: JsonSchema = { type: 'string', minLength: 1, maxLength: 4096 };
const name: JsonSchema = { type: 'string', minLength: 1, maxLength: 1024 };
const list = (items: JsonSchema, maxItems = 4096): JsonSchema => ({ type: 'array', items, maxItems });
const record = (properties: Record<string, JsonSchema>, required = Object.keys(properties)): JsonSchema =>
  ({ type: 'object', properties, required, additionalProperties: false });
export const aiIdentitySchema = record({ projectPath: text, skeletonName: name,
  projectHash: { ...name, pattern: '^[a-fA-F0-9]{64}$' }, fileHash: name, skeletonFingerprint: name, skin: name, directionId: name });
const names: JsonSchema = { ...list(name), uniqueItems: true };
export const aiSelectionSchema = record({ directionId: name, directionRoot: name, bodyAnchor: name, groundAnchor: name,
  sharedBones: names, normalizationBones: names }, ['directionId', 'directionRoot', 'bodyAnchor', 'sharedBones']);
const status: JsonSchema = { type: 'string', enum: ['confirmed', 'proposed', 'unresolved'] };
const evidence: JsonSchema = { ...list(name, 128), minItems: 1, uniqueItems: true };
const mapping = record({ kind: { type: 'string', enum: ['bone', 'slot', 'ik', 'transform', 'path', 'physics', 'attachment', 'event'] },
  source: name, target: name, side: { type: 'string', enum: ['left', 'right', 'center', 'unknown'] },
  drive: { type: 'string', enum: ['direct', 'fk-bone', 'ik-target', 'transform-control'] },
  semanticRole: name, status, evidenceIds: evidence, reason: text, reviewNotes: list(text, 32), channels: { ...names, minItems: 1 },
  sourceSkin: name, sourceSlot: name, targetSkin: name, targetSlot: name },
['kind', 'source', 'target', 'side', 'drive', 'semanticRole', 'status', 'evidenceIds', 'reason']);
export const mappingProposalSchema: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://xinghai.local/schemas/spw-ai-mapping-v1.schema.json',
  title: 'SPW AI 映射提案 v1', ...record({ proposalSchema: { const: 'spw.ai.mapping.v1' }, bundleId: name,
    source: aiIdentitySchema, target: aiIdentitySchema, mappings: list(mapping), unresolved: list(record({ source: name, reason: text })) }),
};
export const rigHintsSchema: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://xinghai.local/schemas/spw-ai-rig-hints-v1.schema.json',
  title: 'SPW AI 角色标定提示 v1', ...record({ hintsSchema: { const: 'spw.ai.rig-hints.v1' }, bundleId: name,
    rigs: { ...list(record({ side: { type: 'string', enum: ['source', 'target'] }, identity: aiIdentitySchema, selection: aiSelectionSchema,
      bones: list(record({ name, semanticRole: name, status, evidenceIds: evidence, reason: text, sharedControl: { type: 'boolean' } })) }), 2), minItems: 1 } }),
};
export const aiManifestSchema = record({ bundleSchema: { const: 'spw.ai.bundle.v1' }, bundleId: name, toolVersion: name,
  source: aiIdentitySchema, target: aiIdentitySchema, animations: { ...names, minItems: 1, maxItems: 2 }, evidenceIds: names,
  sourceSelection: aiSelectionSchema, targetSelection: aiSelectionSchema, editorVersions: record({ source: name, target: name }) });
export const aiReviewStateSchema = record({ reviewSchema: { const: 'spw.ai.review.v1' }, manifest: aiManifestSchema,
  proposal: mappingProposalSchema, hints: rigHintsSchema, acceptedIds: names, withdrawnIds: names }, ['reviewSchema', 'manifest', 'acceptedIds']);
export const aiMappingProvenanceSchema = record({ origin: { type: 'string', enum: ['manual', 'local-auto', 'reviewed-ai'] },
  bundleId: name, semanticRole: name, evidenceIds: evidence }, ['origin']);

/** Validate the complete vocabulary used by our exported data-only schemas; never resolve external code or references. */
export function validateAiJsonSchema(value: unknown, schema: JsonSchema, path = '$'): void {
  if ('const' in schema && value !== schema.const) throw new Error(`${path} 固定协议值不正确`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} 不在允许值中`);
  if (schema.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} 必须是 JSON 对象`);
    const row = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!Object.hasOwn(row, key)) throw new Error(`${path}.${key} 为必填字段`);
    for (const [key, entry] of Object.entries(row)) {
      const property = schema.properties && Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined;
      if (!property && schema.additionalProperties === false) throw new Error(`${path}.${key} 为未允许的额外字段`);
      if (property) validateAiJsonSchema(entry, property, `${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(`${path} 必须是数组`);
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) throw new Error(`${path} 数量超出协议限制`);
    if (schema.uniqueItems && new Set(value.map(entry => JSON.stringify(entry))).size !== value.length) throw new Error(`${path} 含重复项`);
    if (schema.items) value.forEach((entry, index) => validateAiJsonSchema(entry, schema.items!, `${path}[${index}]`));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') throw new Error(`${path} 必须是文字`);
    if (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity) || !value.trim()) throw new Error(`${path} 文字长度不合法`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) throw new Error(`${path} 格式不符合协议`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${path} 必须是布尔值`);
  else if (schema.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`${path} 必须是有限数字`);
}
