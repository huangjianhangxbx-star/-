import type { SpineObjectMapping } from '../core/spine-contracts.ts';
import type { AiBundle, AiRigSurveyInput, AiRigProfile, AiReviewState, AiBundleManifest, AiReviewedProposal } from './ai-contracts.ts';
import { createAiBundle, createAiSurveyBundle, stableAiJson } from './ai-bundle.ts';
import { parseAiSurveyReply, validateAiProposal, validateRigHints } from './ai-proposal.ts';
import { aiManifestSchema, aiReviewStateSchema, validateAiJsonSchema } from './ai-contracts.ts';

function inRig(mapping: SpineObjectMapping, rig: AiRigProfile, side: 'source'|'target'): boolean {
  const name = mapping[side];
  const allowed = new Set(rig.bones.filter(bone => bone.scope !== 'ancestor' || rig.selection.sharedBones.includes(bone.name)).map(bone => bone.name));
  if (mapping.kind === 'bone') return allowed.has(name);
  if (mapping.kind === 'event') return rig.objects.events.includes(name);
  if (mapping.kind === 'slot') return rig.objects.slots.some(slot => slot.name === name && allowed.has(slot.bone));
  if (mapping.kind === 'attachment') return mapping[`${side}Skin`] === rig.skin && rig.objects.attachments.some(item => item.name === name && item.skin === mapping[`${side}Skin`] && item.slot === mapping[`${side}Slot`] && allowed.has(item.bone));
  const constraint = rig.constraints.find(item => item.name === name && item.type === mapping.kind);
  if (!constraint || !Array.isArray(constraint.bones) || !constraint.bones.every(bone => typeof bone === 'string' && allowed.has(bone))) return false;
  const controls = mapping.kind === 'transform' ? [constraint.source, constraint.target] : [constraint.target];
  return controls.filter((control): control is string => typeof control === 'string').every(control => mapping.kind === 'path'
    ? rig.objects.slots.some(slot => slot.name === control && allowed.has(slot.bone)) : allowed.has(control));
}
/** Keep out-of-direction rows in the user's configuration, but never key them into this draft. */
export function mappingWithinBundle(mapping: SpineObjectMapping, bundle: AiBundle): boolean {
  if (bundle.manifest.referenceMode === 'automatic-survey') return false;
  return inRig(mapping,bundle.sourceRig,'source') && inRig(mapping,bundle.targetRig,'target');
}
/** Reimport may reorder candidates: provenance plus actual mapping values, not indexes, preserve accepted decisions. */
export function acceptedAiCandidateIds(mappings: readonly SpineObjectMapping[], reviewed: AiReviewedProposal, bundleId: string): string[] {
  if (reviewed.proposal.bundleId !== bundleId) return [];
  const fields = ['kind', 'source', 'target', 'drive', 'side', 'channels', 'sourceSkin', 'targetSkin', 'sourceSlot', 'targetSlot'] as const;
  const equal = (a: unknown, b: unknown): boolean => a === b || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]));
  return reviewed.candidates.filter(candidate => candidate.status !== 'unresolved' && mappings.some(mapping =>
    mapping.provenance?.origin === 'reviewed-ai' && mapping.provenance.bundleId === bundleId && mapping.provenance.semanticRole === candidate.semanticRole &&
    fields.every(field => equal(mapping[field as keyof SpineObjectMapping], candidate.mapping[field as keyof SpineObjectMapping])))).map(candidate => candidate.id);
}
/** Rebuild from current read-only inputs; a reply directory manifest is data, never authority. */
export function restoreAiAnalysis(value: unknown, pair: { source: AiRigSurveyInput; target: AiRigSurveyInput }): AiBundle {
  validateAiJsonSchema(value, aiManifestSchema, 'manifest');
  const manifest = value as AiBundleManifest;
  const bundle = manifest.referenceMode === 'automatic-survey'
    ? createAiSurveyBundle({ ...pair, animations: manifest.animations, toolVersion: manifest.toolVersion })
    : createAiBundle({ source: { ...pair.source, selection: manifest.sourceSelection }, target: { ...pair.target, selection: manifest.targetSelection },
      animations: manifest.animations, toolVersion: manifest.toolVersion });
  if (stableAiJson(bundle.manifest) !== stableAiJson(manifest)) throw new Error('AI 标定身份或选择已改变，与当前工程不匹配');
  return bundle;
}
export function restoreAiReview(saved: AiReviewState, pair: {source:AiRigSurveyInput;target:AiRigSurveyInput}) {
  validateAiJsonSchema(saved, aiReviewStateSchema, 'aiReview');
  const bundle = restoreAiAnalysis(saved.manifest, pair);
  if (saved.manifest.referenceMode === 'automatic-survey') {
    if (saved.proposal || saved.hints || saved.acceptedIds.length || saved.withdrawnIds?.length || saved.derivedFromBundleId) throw new Error('调查参考尚未识别，不能包含已接受映射或已审阅提案');
    return { bundle, reviewed: null };
  }
  if (saved.derivedFromBundleId) {
    if (!saved.proposal || !saved.hints || saved.hints.rigs.length !== 2) throw new Error('调查派生标定缺少原选择回传，无法追溯');
    const survey = createAiSurveyBundle({ ...pair, animations: bundle.manifest.animations, toolVersion: bundle.manifest.toolVersion });
    if (survey.manifest.bundleId !== saved.derivedFromBundleId) throw new Error('标定来源调查包不一致，无法追溯');
    const proposal = { ...saved.proposal, bundleId: survey.manifest.bundleId };
    const hints = { ...saved.hints, bundleId: survey.manifest.bundleId };
    const derived = parseAiSurveyReply(JSON.stringify(proposal), survey, JSON.stringify(hints), pair);
    if (stableAiJson(derived.bundle.manifest) !== stableAiJson(saved.manifest)) throw new Error('派生标定与来源调查的验证结果不一致');
  }
  if (saved.hints) validateRigHints(saved.hints,bundle);
  const reviewed = saved.proposal ? validateAiProposal(saved.proposal,bundle,saved.hints) : null;
  const validIds = new Set(reviewed?.candidates.map(item=>item.id) ?? []);
  if (new Set(saved.acceptedIds).size !== saved.acceptedIds.length || saved.acceptedIds.some(id=>!validIds.has(id))) throw new Error('保存的 AI 接受记录不存在或重复');
  if (saved.acceptedIds.some(id=>reviewed?.candidates.find(candidate=>candidate.id===id)?.status==='unresolved')) throw new Error('保存的 AI 接受记录包含未确定候选');
  for (const id of saved.withdrawnIds ?? []) {
    if (!validIds.has(id)) throw new Error('保存的 AI 撤回记录引用了不存在的候选');
    if (saved.acceptedIds.includes(id)) throw new Error('保存的 AI 候选不能同时接受和撤回');
  }
  return {bundle,reviewed};
}
