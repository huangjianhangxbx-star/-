import type { SpineObjectMapping, SpineSide } from '../core/spine-contracts.ts';
import { aiObjectEvidenceId, stableAiJson } from './ai-bundle.ts';
import { mappingProposalSchema, rigHintsSchema, validateAiJsonSchema } from './ai-contracts.ts';
import type { AiCandidateGroup, AiMappingEntry, AiMappingProposal, AiReviewedCandidate, AiReviewedProposal,
  AiRigHints, AiRigIdentity, AiRigProfile, AiValidationContext } from './ai-contracts.ts';
export type { AiMappingProposal, AiRigHints, AiReviewedProposal, AiReviewedCandidate } from './ai-contracts.ts';
export { validateAiJsonSchema } from './ai-contracts.ts';
function identityMatches(identity: AiRigIdentity, expected: AiRigIdentity, label: string): void {
  const normalize = (item: AiRigIdentity) => ({ ...item, projectPath: item.projectPath.replace(/\\/g, '/') });
  if (stableAiJson(normalize(identity)) !== stableAiJson(normalize(expected))) throw new Error(`${label} 工程身份、SHA-256、导出内容、skeleton、skin 或方向已改变，请重新生成分析包`);
}
function requireBundle(id: string, context: AiValidationContext): void {
  if (id !== context.manifest.bundleId) throw new Error('bundleId 已过期或不属于当前角色对/身体锚点，请重新分析');
}
function evidence(ids: readonly string[], context: AiValidationContext, required: readonly string[]): void {
  const known = new Set(context.manifest.evidenceIds);
  for (const id of ids) if (!known.has(id)) throw new Error(`证据 ID 不存在：${id}`);
  for (const id of required) if (!ids.includes(id)) throw new Error(`缺少该对象的证据：${id}`);
}
function sideOf(name: string): SpineSide {
  const n = name.replace(/\[[^\]]*\]/g, '');
  if (/左|(?:^|[\/_. -])(?:left|l(?:arm|hand|leg|foot))|(?:upperarm|forearm|arm|hand|leg|foot|thigh|shoulder)l\d*$/i.test(n)) return 'left';
  if (/右|(?:^|[\/_. -])(?:right|r(?:arm|hand|leg|foot))|(?:upperarm|forearm|arm|hand|leg|foot|thigh|shoulder)r\d*$/i.test(n)) return 'right';
  return 'unknown';
}
function semanticSide(role: string): SpineSide {
  if (/(?:^|[._/ -])left(?:$|[._/ -])|左/i.test(role)) return 'left';
  if (/(?:^|[._/ -])right(?:$|[._/ -])|右/i.test(role)) return 'right';
  return 'unknown';
}
function assertSides(...sides: SpineSide[]): void {
  if (sides.includes('left') && sides.includes('right')) throw new Error('左右侧别冲突：不能把左侧语义或骨链映射到右侧');
  if (sides.includes('center') && (sides.includes('left') || sides.includes('right'))) throw new Error('侧别冲突：已知左右侧骨链不能声明为 center');
}
function inDirection(profile: AiRigProfile, name: string, label: string) {
  const bone = profile.bones.find(item => item.name === name);
  if (!bone || !profile.includedBones.includes(name)) throw new Error(`${label} 骨骼不存在或属于其他方向：${name}`);
  if (bone.scope === 'shared' && !profile.selection.sharedBones.includes(name)) throw new Error(`${label} 跨方向控制骨没有明确共享标记：${name}`);
  return bone;
}
function typedObject(profile: AiRigProfile, entry: AiMappingEntry, side: 'source' | 'target'): void {
  const name = entry[side];
  if (entry.kind === 'bone') { inDirection(profile, name, side); return; }
  if (entry.kind === 'slot') {
    const slot = profile.objects.slots.find(item => item.name === name);
    if (!slot) throw new Error(`${side} slot 对象不存在：${name}`);
    inDirection(profile, slot.bone, `${side} slot`); return;
  }
  if (entry.kind === 'event') {
    if (!profile.objects.events.includes(name)) throw new Error(`${side} event 对象不存在：${name}`);
    return;
  }
  if (entry.kind === 'attachment') {
    const skin = side === 'source' ? entry.sourceSkin : entry.targetSkin, slot = side === 'source' ? entry.sourceSlot : entry.targetSlot;
    if (!skin || !slot) throw new Error('附件对象必须同时指定 skin 和 slot');
    if (skin !== profile.skin) throw new Error(`${side} 附件 skin 不属于当前所选 skin`);
    const attachment = profile.objects.attachments.find(item => item.name === name && item.skin === skin && item.slot === slot);
    if (!attachment) throw new Error(`${side} 附件对象不存在：${skin}/${slot}/${name}`);
    inDirection(profile, attachment.bone, `${side} attachment`); return;
  }
  const constraint = profile.constraints.find(item => item.name === name && item.kind === entry.kind);
  if (!constraint) throw new Error(`${side} ${entry.kind} 约束对象不存在或不属于当前方向：${name}`);
  for (const bone of constraint.bones as string[]) inDirection(profile, bone, `${side} constraint`);
  const control = entry.kind === 'transform' ? constraint.source ?? constraint.target : constraint.target;
  if (typeof control === 'string' && entry.kind !== 'path') inDirection(profile, control, `${side} constraint target`);
  if (entry.kind === 'path' && typeof control === 'string') {
    const slot = profile.objects.slots.find(item => item.name === control);
    if (!slot) throw new Error(`${side} path 目标槽位不存在`);
    inDirection(profile, slot.bone, `${side} path target`);
  }
}
function objectKey(mapping: SpineObjectMapping | AiMappingEntry, side: 'source' | 'target'): string {
  return JSON.stringify([mapping.kind, mapping[side], ...(mapping.kind === 'attachment'
    ? [side === 'source' ? mapping.sourceSkin : mapping.targetSkin, side === 'source' ? mapping.sourceSlot : mapping.targetSlot] : [])]);
}
function toMapping(row: AiMappingEntry): SpineObjectMapping {
  const base = { source: row.source, target: row.target, side: row.side, drive: row.drive, ...(row.channels ? { channels: [...row.channels] } : {}) };
  if (row.kind === 'attachment') return { ...base, kind: 'attachment', sourceSkin: row.sourceSkin!, sourceSlot: row.sourceSlot!, targetSkin: row.targetSkin!, targetSlot: row.targetSlot! };
  return { ...base, kind: row.kind };
}
function groupFor(role: string, kind: string, drive: string): AiCandidateGroup {
  if (kind === 'slot' || kind === 'attachment' || kind === 'event' || /display|显示/.test(role)) return 'display';
  if (/decor|hair|cloth|装饰|头发|衣/.test(role)) return 'decoration';
  if (kind !== 'bone' || drive === 'ik-target' || drive === 'transform-control' || /control|weapon|grip|hold|控制|持握/.test(role)) return 'control';
  const side = semanticSide(role);
  if (/arm|hand|shoulder|腕|臂|手|肩/i.test(role) && side !== 'unknown') return side === 'left' ? 'leftArm' : 'rightArm';
  if (/leg|foot|thigh|knee|腿|足|脚|膝/i.test(role) && side !== 'unknown') return side === 'left' ? 'leftLeg' : 'rightLeg';
  return 'torso';
}
function calibrationWarnings(entry: AiMappingEntry, context: AiValidationContext): string[] {
  const warnings: string[] = [];
  if (entry.kind !== 'bone') {
    if (entry.drive !== 'direct') throw new Error('约束、槽位、事件和附件只能使用 direct 驱动');
    if (entry.kind === 'attachment' && (!entry.channels?.length || entry.channels.some(channel => /deform|sequence/i.test(channel)))) {
      throw new Error('附件提案必须显式限定可支持通道，禁止 AI 自动批准 deform/sequence');
    }
    return warnings;
  }
  const source = inDirection(context.sourceRig, entry.source, 'source'), target = inDirection(context.targetRig, entry.target, 'target');
  assertSides(sideOf(source.name), sideOf(target.name), entry.side, semanticSide(entry.semanticRole));
  if (entry.drive === 'ik-target' && (!source.control.ikTarget || !target.control.ikTarget)) throw new Error('ik-target 必须对应两端真实 IK 目标控制骨');
  if (entry.drive === 'transform-control' && (!source.control.transformTarget || !target.control.transformTarget)) throw new Error('transform-control 必须对应两端真实变换控制骨');
  if ((entry.drive === 'fk-bone' || entry.drive === 'direct') && source.control.ikTarget !== target.control.ikTarget) {
    throw new Error('FK / direct 驱动不能跨接 IK 目标控制骨与普通身体骨');
  }
  if (entry.drive === 'fk-bone' && target.control.ikTarget) throw new Error('实际 IK 目标控制器不能标成 fk-bone');
  if ((entry.drive === 'fk-bone' || entry.drive === 'direct') && (source.control.transformTarget || target.control.transformTarget)) {
    warnings.push('needs-calibration：身体 FK 骨也驱动变换跟随骨，需核对附件或辅助骨的跟随；不把它当作专用控制器');
  }
  if (source.control.ikDriven || target.control.ikDriven || source.control.transformDriven || target.control.transformDriven || source.control.pathDriven || target.control.pathDriven || source.control.physicsDriven || target.control.physicsDriven) {
    warnings.push('needs-calibration：骨链受到 IK/变换/路径/物理约束影响，需核对动作中的 mix 和实际驱动');
  }
  const s = source.setup.world, t = target.setup.world;
  if (Math.sign(s.a * s.d - s.b * s.c) !== Math.sign(t.a * t.d - t.b * t.c)) warnings.push('needs-calibration：设置姿势镜像不同，尚未执行镜像重定向');
  const delta = Math.atan2(Math.sin(Math.atan2(s.c, s.a) - Math.atan2(t.c, t.a)), Math.cos(Math.atan2(s.c, s.a) - Math.atan2(t.c, t.a))) * 180 / Math.PI;
  if (Math.abs(delta) > 5) warnings.push(`needs-calibration：设置姿势世界轴相差 ${delta.toFixed(1)}°，复制局部关键帧不等于姿态校准`);
  if (source.setup.length > 0 && target.setup.length > 0 && Math.abs(source.setup.length / target.setup.length - 1) > 0.15) warnings.push('needs-calibration：骨长差异超过 15%，需检查手脚轨迹');
  return warnings;
}
function ancestor(profile: AiRigProfile, name: string, possibleAncestor: string): boolean {
  const visited = new Set<string>(); let current = profile.bones.find(bone => bone.name === name)?.parent;
  while (current && !visited.has(current)) {
    if (current === possibleAncestor) return true;
    visited.add(current); current = profile.bones.find(bone => bone.name === current)?.parent;
  }
  return false;
}

export function validateRigHints(value: unknown, context: AiValidationContext): AiRigHints {
  validateAiJsonSchema(value, rigHintsSchema);
  const hints = structuredClone(value as AiRigHints); requireBundle(hints.bundleId, context);
  const sides = new Set<string>();
  for (const rig of hints.rigs) {
    if (sides.has(rig.side)) throw new Error(`角色标定 side 重复：${rig.side}`); sides.add(rig.side);
    const profile = rig.side === 'source' ? context.sourceRig : context.targetRig;
    identityMatches(rig.identity, profile.identity, rig.side);
    if (stableAiJson(rig.selection) !== stableAiJson(profile.selection)) throw new Error(`${rig.side} selection / 身体锚点已改变；请重建分析包后标定`);
    const seen = new Set<string>();
    for (const hint of rig.bones) {
      if (seen.has(hint.name)) throw new Error(`角色标定骨骼重复：${hint.name}`); seen.add(hint.name);
      const bone = inDirection(profile, hint.name, rig.side);
      if (hint.sharedControl && !profile.selection.sharedBones.includes(hint.name)) throw new Error(`共享控制骨未经当前方向选择授权：${hint.name}`);
      assertSides(sideOf(bone.name), semanticSide(hint.semanticRole));
      evidence(hint.evidenceIds, context, [bone.evidenceId]);
    }
  }
  return hints;
}
/** Format and identity validation produces review candidates; it never mutates or applies a mapping. */
export function validateAiProposal(value: unknown, context: AiValidationContext, hintsValue?: unknown): AiReviewedProposal {
  validateAiJsonSchema(value, mappingProposalSchema);
  const proposal = structuredClone(value as AiMappingProposal); requireBundle(proposal.bundleId, context);
  identityMatches(proposal.source, context.manifest.source, '来源'); identityMatches(proposal.target, context.manifest.target, '目标');
  const hints = hintsValue === undefined ? undefined : validateRigHints(hintsValue, context);
  const sources = new Set<string>(), targets = new Set<string>();
  const candidates: AiReviewedCandidate[] = [];
  for (const [index, entry] of proposal.mappings.entries()) {
    const sourceKey = objectKey(entry, 'source'), targetKey = objectKey(entry, 'target');
    if (sources.has(sourceKey) || targets.has(targetKey)) throw new Error(`映射重复或目标被多对一占用：${entry.source} → ${entry.target}`);
    sources.add(sourceKey); targets.add(targetKey);
    if (entry.kind !== 'attachment' && [entry.sourceSkin, entry.sourceSlot, entry.targetSkin, entry.targetSlot].some(value => value !== undefined)) throw new Error('非附件对象不能包含 skin/slot 定位字段');
    typedObject(context.sourceRig, entry, 'source'); typedObject(context.targetRig, entry, 'target');
    const warnings = calibrationWarnings(entry, context);
    evidence(entry.evidenceIds, context, [aiObjectEvidenceId('source', entry.kind, entry.source, entry.sourceSkin, entry.sourceSlot),
      aiObjectEvidenceId('target', entry.kind, entry.target, entry.targetSkin, entry.targetSlot)]);
    if (hints && entry.kind === 'bone') for (const side of ['source', 'target'] as const) {
      const hint = hints.rigs.find(rig => rig.side === side)?.bones.find(bone => bone.name === entry[side]);
      if (hint) assertSides(semanticSide(hint.semanticRole), semanticSide(entry.semanticRole), entry.side);
    }
    candidates.push({ id: `ai-mapping-${index}`, group: groupFor(entry.semanticRole, entry.kind, entry.drive), mapping: toMapping(entry),
      semanticRole: entry.semanticRole, status: entry.status, evidenceIds: [...entry.evidenceIds], reason: entry.reason,
      reviewNotes: [...(entry.reviewNotes ?? [])], warnings });
  }
  for (const a of candidates.filter(candidate => candidate.mapping.kind === 'bone')) for (const b of candidates.filter(candidate => candidate.mapping.kind === 'bone')) {
    if (a === b || !ancestor(context.sourceRig, b.mapping.source, a.mapping.source)) continue;
    if (ancestor(context.targetRig, a.mapping.target, b.mapping.target)) throw new Error(`父链逆转：${a.mapping.source} / ${b.mapping.source} 的目标父子关系反向`);
    if (!ancestor(context.targetRig, b.mapping.target, a.mapping.target)) b.warnings.push(`needs-calibration：父链结构不同于来源 ${a.mapping.source} → ${b.mapping.source}，需检查目标局部轴`);
  }
  const unresolvedSeen = new Set<string>();
  for (const unresolved of proposal.unresolved) {
    if (unresolvedSeen.has(unresolved.source)) throw new Error(`unresolved 重复：${unresolved.source}`); unresolvedSeen.add(unresolved.source);
    const isBone = context.sourceRig.includedBones.includes(unresolved.source);
    const isObject = context.sourceRig.objects.slots.some(item => item.name === unresolved.source && context.sourceRig.includedBones.includes(item.bone)) || context.sourceRig.objects.events.includes(unresolved.source)
      || context.sourceRig.constraints.some(item => item.name === unresolved.source);
    if (!isBone && !isObject) throw new Error(`unresolved 对象不存在或不在当前方向：${unresolved.source}`);
  }
  return { proposal, ...(hints ? { hints } : {}), candidates, unresolved: structuredClone(proposal.unresolved),
    warnings: ['AI 自报 confirmed 仍然是待人工审阅的建议；校验通过不代表动作视觉验收通过', ...new Set(candidates.flatMap(candidate => candidate.warnings))] };
}
function parseJson(text: string): unknown {
  if (text.length > 8 * 1024 * 1024) throw new Error('AI JSON 超过 8 MiB 协议限制');
  try { return JSON.parse(text.replace(/^\uFEFF/, '')); } catch (error) { throw new Error(`AI 返回文件必须是纯 JSON：${String(error)}`); }
}
export function parseAiProposal(text: string, context: AiValidationContext, hintsText?: string): AiReviewedProposal {
  return validateAiProposal(parseJson(text), context, hintsText === undefined ? undefined : parseJson(hintsText));
}
export function parseRigHints(text: string, context: AiValidationContext): AiRigHints { return validateRigHints(parseJson(text), context); }

export type AiMergeConflict = { id: string; reason: string; existing?: SpineObjectMapping; proposed: SpineObjectMapping };
export function mergeAcceptedAiMappings(existing: readonly SpineObjectMapping[], reviewed: AiReviewedProposal, acceptedIds: readonly string[]) {
  let mappings = structuredClone([...existing]);
  const accepted: string[] = [], conflicts: AiMergeConflict[] = [], replaced: { id: string; existing: SpineObjectMapping; proposed: SpineObjectMapping }[] = [];
  const allowed = new Set(reviewed.candidates.map(candidate => candidate.id));
  for (const id of acceptedIds) if (!allowed.has(id)) throw new Error(`接受列表引用了不存在的 AI 候选：${id}`);
  for (const candidate of reviewed.candidates) {
    if (!acceptedIds.includes(candidate.id)) continue;
    if (candidate.status === 'unresolved') { conflicts.push({ id: candidate.id, reason: '未确定候选不能直接接受，请补充证据', proposed: candidate.mapping }); continue; }
    const clashes = mappings.filter(mapping => objectKey(mapping, 'source') === objectKey(candidate.mapping, 'source') || objectKey(mapping, 'target') === objectKey(candidate.mapping, 'target'));
    const protectedMapping = clashes.find(mapping => mapping.provenance?.origin !== 'local-auto');
    if (protectedMapping) {
      conflicts.push({ id: candidate.id, reason: '保留人工或已审阅映射；新提案仅显示差异', existing: structuredClone(protectedMapping), proposed: structuredClone(candidate.mapping) }); continue;
    }
    for (const mapping of clashes) replaced.push({ id: candidate.id, existing: structuredClone(mapping), proposed: structuredClone(candidate.mapping) });
    mappings = mappings.filter(mapping => !clashes.includes(mapping));
    const mapping: SpineObjectMapping = { ...structuredClone(candidate.mapping), provenance: { origin: 'reviewed-ai', bundleId: reviewed.proposal.bundleId,
      semanticRole: candidate.semanticRole, evidenceIds: [...candidate.evidenceIds] } };
    mappings.push(mapping); accepted.push(candidate.id);
  }
  return { mappings, acceptedIds: accepted, conflicts, replaced };
}
