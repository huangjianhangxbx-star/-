import { AnimationState, AnimationStateData, AtlasAttachmentLoader, Physics, Skeleton, SkeletonJson, TextureAtlas } from '@esotericsoftware/spine-webgl';
import type { SpineObjectMapping, SpineSide } from '../core/spine-contracts.ts';
import { readSpineSource } from '../source/spine-source.ts';
import { suggestSpineMappings } from './spine-suggestions.ts';
import { knownSpinePairs } from './spine-known-pairs.ts';

type BoneFeature = { name: string; parent: string | null; x: number; y: number; length: number; motion: number; side: SpineSide };
export type MappingReview = { source: string; candidates: { target: string; score: number; reason: string }[] };
function side(name: string): SpineSide {
  const n = name.replace(/\[[^\]]*\]/g, '').toLowerCase();
  if (/(?:^|[\/_ -])(?:l(?:arm|hand|leg|foot)|left)|(?:[_.-]l$)|左/.test(n)) return 'left';
  if (/(?:^|[\/_ -])(?:r(?:arm|hand|leg|foot)|right)|(?:[_.-]r$)|右/.test(n)) return 'right';
  return 'unknown';
}
function canonical(name: string): string {
  return name.replace(/\[[^\]]*\]/g, '').toLowerCase().replace(/left|左/g, 'l').replace(/right|右/g, 'r').replace(/[\s_\-/.:]+/g, '');
}

/** Official runtime sampling, with atlas metadata only: no canvas, network request or texture decoding. */
export function sampleRig(document: unknown, atlasText: string, animationName: string, skin: string) {
  const atlas = new TextureAtlas(atlasText);
  const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(document);
  const skeleton = new Skeleton(data);
  if (skin) skeleton.setSkin(skin);
  skeleton.setupPose(); skeleton.updateWorldTransform(Physics.reset);
  const bones: BoneFeature[] = skeleton.bones.map(bone => ({ name: bone.data.name, parent: bone.parent?.data.name ?? null,
    x: bone.appliedPose.worldX, y: bone.appliedPose.worldY, length: bone.data.length * Math.hypot(bone.appliedPose.a, bone.appliedPose.c), motion: 0, side: side(bone.data.name) }));
  const size = Math.max(1, ...bones.map(b => b.length), Math.max(...bones.map(b => b.y)) - Math.min(...bones.map(b => b.y)), Math.max(...bones.map(b => b.x)) - Math.min(...bones.map(b => b.x)));
  const animation = data.findAnimation(animationName);
  const frames = animation && animation.duration > 0 ? 25 : 1;
  const previous = new Map<string, { x: number; y: number; angle: number }>();
  for (let i = 0; i < frames; i++) {
    skeleton.setupPose();
    if (animation) {
      const state = new AnimationState(new AnimationStateData(data));
      state.setAnimation(0, animationName, false); state.update(animation.duration * i / Math.max(1, frames - 1)); state.apply(skeleton);
    }
    skeleton.updateWorldTransform(Physics.reset);
    skeleton.bones.forEach((bone, index) => {
      const pose = bone.appliedPose, angle = Math.atan2(pose.c, pose.a);
      const old = previous.get(bone.data.name);
      if (old) bones[index]!.motion += Math.hypot(pose.worldX - old.x, pose.worldY - old.y) / size + Math.abs(Math.atan2(Math.sin(angle - old.angle), Math.cos(angle - old.angle))) / Math.PI;
      previous.set(bone.data.name, { x: pose.worldX, y: pose.worldY, angle });
    });
  }
  const origin = bones.find(b => !b.parent) ?? { x: 0, y: 0 };
  const ox = origin.x, oy = origin.y;
  for (const bone of bones) { bone.x = (bone.x - ox) / size; bone.y = (bone.y - oy) / size; bone.length /= size; }
  return { bones, frames, duration: animation?.duration ?? 0 };
}

export function autoMapSpine(sourceDocument: unknown, targetDocument: unknown, sourceAtlas: string, targetAtlas: string,
  animation: string, sourceSkin: string, targetSkin: string, existing: readonly SpineObjectMapping[] = []) {
  const source = readSpineSource(JSON.stringify(sourceDocument)), target = readSpineSource(JSON.stringify(targetDocument));
  const sampled = sampleRig(sourceDocument, sourceAtlas, animation, sourceSkin);
  const targetSampled = sampleRig(targetDocument, targetAtlas, animation, targetSkin);
  const mappings: SpineObjectMapping[] = structuredClone([...existing]);
  const key = (mapping: SpineObjectMapping) => mapping.kind === 'attachment' ? `${mapping.kind}:${mapping.sourceSkin}:${mapping.sourceSlot}:${mapping.source}` : `${mapping.kind}:${mapping.source}`;
  const present = new Set(mappings.map(key));
  const used = new Set(mappings.filter(m => m.kind === 'bone').map(m => m.target));
  const parents = new Map(mappings.filter(m => m.kind === 'bone').map(m => [m.source, m.target]));
  const add = (mapping: SpineObjectMapping) => {
    if (present.has(key(mapping)) || (mapping.kind === 'bone' && used.has(mapping.target))) return false;
    mappings.push(mapping); present.add(key(mapping));
    if (mapping.kind === 'bone') { used.add(mapping.target); parents.set(mapping.source, mapping.target); }
    return true;
  };
  const profile = knownSpinePairs.find(p => p.sourceFingerprint === source.summary.skeletonFingerprint && p.targetFingerprint === target.summary.skeletonFingerprint && p.sourceSkin === sourceSkin && p.targetSkin === targetSkin);
  if (profile) for (const mapping of profile.mappings) add(structuredClone(mapping));
  const review: MappingReview[] = [];
  const keyed = new Set((source.animationDependencies[animation] ?? []).filter(d => d.kind === 'bone').map(d => d.source));
  const roots = targetSampled.bones.filter(b => !b.parent);
  for (const bone of sampled.bones) {
    if (present.has(`bone:${bone.name}`)) continue;
    if (!bone.parent && roots.length === 1 && sampled.bones.filter(b => !b.parent).length === 1) {
      add({ kind: 'bone', source: bone.name, target: roots[0]!.name, side: 'center', drive: 'direct' }); continue;
    }
    const candidates = targetSampled.bones.filter(b => !used.has(b.name) && !(bone.side !== 'unknown' && b.side !== 'unknown' && bone.side !== b.side)).map(b => {
      const exact = bone.name === b.name;
      const named = canonical(bone.name) === canonical(b.name);
      const parent = bone.parent !== null && parents.get(bone.parent) === b.parent;
      const distance = Math.hypot(bone.x - b.x, bone.y - b.y);
      const length = Math.abs(bone.length - b.length);
      const geometry = Math.max(0, 1 - distance * 3 - length * 2);
      const score = exact ? 1 : named ? 0.98 : (parent ? 0.55 : 0) + geometry * 0.4;
      const controlled = target.summary.constraints.some(c => c.kind === 'ik' && c.bones.includes(b.name));
      const sourceTarget = source.summary.constraints.some(c => c.kind === 'ik' && c.target === bone.name);
      const targetTarget = target.summary.constraints.some(c => c.kind === 'ik' && c.target === b.name);
      // Geometry alone cannot distinguish co-located helpers, limbs and decoration on a branching rig.
      const uniqueChain = parent && sampled.bones.filter(x => x.parent === bone.parent).length === 1
        && targetSampled.bones.filter(x => x.parent === b.parent).length === 1
        && sampled.bones.filter(x => x.parent === bone.name).length === targetSampled.bones.filter(x => x.parent === b.name).length;
      const eligible = !controlled && sourceTarget === targetTarget && (exact || named || uniqueChain);
      return { target: b.name, score, controlled, eligible, reason: exact ? '同名骨骼' : named ? '规范化名称与侧别一致' : `父链${parent ? '对应' : '待确认'}，位置/长度评分 ${geometry.toFixed(2)}${uniqueChain ? '，单一子链' : '，分支角色需确认'}` };
    }).sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
    const best = candidates[0];
    if (best && best.score >= 0.88 && best.score - (candidates[1]?.score ?? 0) >= 0.12 && best.eligible) {
      const drive = target.summary.constraints.some(c => c.kind === 'ik' && c.target === best.target) ? 'ik-target' : 'fk-bone';
      add({ kind: 'bone', source: bone.name, target: best.target, side: bone.side, drive });
    } else if (keyed.has(bone.name)) review.push({ source: bone.name, candidates: candidates.slice(0, 3).map(c => ({ ...c, reason: c.controlled ? `${c.reason}；目标受 IK 控制，需检查驱动` : c.reason })) });
  }
  for (const suggestion of suggestSpineMappings(sourceDocument, targetDocument, animation)) {
    if (suggestion.kind !== 'bone' && suggestion.kind !== 'attachment' && suggestion.status === 'exact' && suggestion.target) {
      add({ kind: suggestion.kind, source: suggestion.source, target: suggestion.target, side: suggestion.side, drive: 'direct' });
    }
  }
  review.sort((a, b) => (sampled.bones.find(x => x.name === b.source)?.motion ?? 0) - (sampled.bones.find(x => x.name === a.source)?.motion ?? 0));
  return { mappings, review, frames: sampled.frames, sampledBones: sampled.bones.length, movingBones: sampled.bones.filter(b => b.motion > 0.01).length,
    profileName: profile?.name, added: mappings.length - existing.length };
}
