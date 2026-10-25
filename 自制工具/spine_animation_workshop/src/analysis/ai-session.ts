import type { SpineObjectMapping } from '../core/spine-contracts.ts';
import type { AiBundle, AiRigInput, AiRigProfile, AiReviewState } from './ai-contracts.ts';
import { createAiBundle, stableAiJson } from './ai-bundle.ts';
import { validateAiProposal, validateRigHints } from './ai-proposal.ts';
import { aiReviewStateSchema, validateAiJsonSchema } from './ai-contracts.ts';

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
  return inRig(mapping,bundle.sourceRig,'source') && inRig(mapping,bundle.targetRig,'target');
}
export function restoreAiReview(saved: AiReviewState, pair: {source:Omit<AiRigInput,'selection'>;target:Omit<AiRigInput,'selection'>}) {
  validateAiJsonSchema(saved, aiReviewStateSchema, 'aiReview');
  const bundle = createAiBundle({source:{...pair.source,selection:saved.manifest.sourceSelection},target:{...pair.target,selection:saved.manifest.targetSelection},animations:saved.manifest.animations,toolVersion:saved.manifest.toolVersion});
  if (stableAiJson(bundle.manifest) !== stableAiJson(saved.manifest)) throw new Error('AI 标定身份或选择已改变，与当前工程不匹配');
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
