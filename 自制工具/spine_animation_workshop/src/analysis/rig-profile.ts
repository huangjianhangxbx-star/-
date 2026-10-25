import { AnimationState, AnimationStateData, AtlasAttachmentLoader, Physics, Skeleton, SkeletonJson, TextureAtlas } from '@esotericsoftware/spine-webgl';
import type { Bone } from '@esotericsoftware/spine-webgl';
import type { SpineSide } from '../core/spine-contracts.ts';
import { readSpineSource } from '../source/spine-source.ts';

export interface RigSelection {
  directionId: string;
  directionRoot: string;
  bodyAnchor: string;
  groundAnchor?: string;
  sharedBones: string[];
  normalizationBones?: string[];
}
export interface RigWorldTransform { x: number; y: number; a: number; b: number; c: number; d: number }
export interface RigProfile {
  profileSchema: 'spw.rig-profile.v1';
  side: 'source' | 'target';
  skin: string;
  selection: RigSelection;
  globalRoots: string[];
  includedBones: string[];
  normalizationScale: number;
  reference: { anchor: string; setupWorld: RigWorldTransform; inverse: RigWorldTransform };
  bones: {
    name: string; parent: string | null; evidenceId: string; side: SpineSide;
    scope: 'branch' | 'ancestor' | 'shared';
    setup: { world: RigWorldTransform; local: { x: number; y: number }; normalized: { x: number; y: number }; length: number };
    slots: string[];
    control: { ikTarget: boolean; ikDriven: boolean; transformTarget: boolean; transformDriven: boolean; pathDriven: boolean; physicsDriven: boolean };
    raw: Record<string, unknown>;
  }[];
  constraints: Record<string, unknown>[];
  samples: { animation: string; time: number; evidenceId: string; bones: { name: string; world: RigWorldTransform; local: { x: number; y: number } }[] }[];
  evidenceIds: string[];
}

function sideOf(name: string): SpineSide {
  const n = name.replace(/\[[^\]]*\]/g, '').toLowerCase();
  if (/(?:^|[\/_ -])(?:l(?:arm|hand|leg|foot)|left)|(?:[_.-]l$)|(?:upperarm|lowerarm|shoulder|hand|upperleg|lowerleg|foot|foor|breast)l\d*$|左/.test(n)) return 'left';
  if (/(?:^|[\/_ -])(?:r(?:arm|hand|leg|foot)|right)|(?:[_.-]r$)|(?:upperarm|lowerarm|shoulder|hand|upperleg|lowerleg|foot|foor|breast)r\d*$|右/.test(n)) return 'right';
  return 'unknown';
}
function worldOf(bone: Bone): RigWorldTransform {
  const p = bone.appliedPose;
  const result = { x: p.worldX, y: p.worldY, a: p.a, b: p.b, c: p.c, d: p.d };
  if (Object.values(result).some(v => !Number.isFinite(v))) throw new Error(`骨骼 ${bone.data.name} 的运行时坐标不是有限数值`);
  return result;
}
function inverseOf(matrix: RigWorldTransform): RigWorldTransform {
  const { x, y, a, b, c, d } = matrix;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error('身体参考骨的设置姿势矩阵不可逆，请选择有有效缩放的身体锚点');
  return { a: d / determinant, b: -b / determinant, c: -c / determinant, d: a / determinant,
    x: (b * y - d * x) / determinant, y: (c * x - a * y) / determinant };
}
function pointIn(reference: RigWorldTransform, x: number, y: number) {
  return { x: reference.a * x + reference.b * y + reference.x, y: reference.c * x + reference.d * y + reference.y };
}

/** Metadata-only runtime evidence. The reference is fixed at setup, so real animated displacement survives. */
export function buildRigProfile(document: unknown, atlasText: string, animations: readonly string[], skin: string,
  selection: RigSelection, side: 'source' | 'target'): RigProfile {
  const source = readSpineSource(JSON.stringify(document));
  const raw = source.document as Record<string, unknown>;
  const rawBones = raw.bones as Record<string, unknown>[];
  const named = new Map(source.summary.bones.map(b => [b.name, b]));
  const requireName = (name: unknown, label: string): string => {
    if (typeof name !== 'string' || !named.has(name)) throw new Error(`${label} 引用了不存在的骨骼：${String(name)}`);
    return name;
  };
  if (!selection || typeof selection.directionId !== 'string' || !selection.directionId.trim()) throw new Error('方向标识不能为空');
  requireName(selection.directionRoot, '方向入口'); requireName(selection.bodyAnchor, '身体参考点');
  if (!Array.isArray(selection.sharedBones) || selection.sharedBones.some(n => typeof n !== 'string')) throw new Error('共享控制骨必须是骨名列表');
  const descendsFrom = (name: string, ancestor: string): boolean => {
    let current: string | null = name;
    const visited = new Set<string>();
    while (current !== null && !visited.has(current)) {
      if (current === ancestor) return true;
      visited.add(current); current = named.get(current)?.parent ?? null;
    }
    return false;
  };
  const branch = new Set([...named.keys()].filter(n => descendsFrom(n, selection.directionRoot)));
  if (!branch.has(selection.bodyAnchor)) throw new Error('身体参考点必须属于选定方向分支');
  const ancestors = new Set<string>();
  for (let n = named.get(selection.directionRoot)?.parent; n; n = named.get(n)?.parent) {
    if (ancestors.has(n)) throw new Error('方向入口存在循环父链');
    ancestors.add(n);
  }
  const shared = new Set(selection.sharedBones.map(n => requireName(n, '共享控制骨')));
  for (const name of shared) {
    const connectedControl = source.summary.constraints.some(c => (c.target === name || c.source === name) && c.bones.some(b => branch.has(b)));
    if (!branch.has(name) && !ancestors.has(name) && !connectedControl) throw new Error(`共享骨 ${name} 不是当前方向的祖先或已连接的约束控制骨`);
  }
  const included = new Set([...branch, ...ancestors, ...shared]);
  if (selection.groundAnchor !== undefined) {
    const ground = requireName(selection.groundAnchor, '脚底参考点');
    if (!branch.has(ground) && !shared.has(ground)) throw new Error('脚底参考点必须属于当前方向或已标记的共享控制骨');
  }
  if (selection.normalizationBones !== undefined && (!Array.isArray(selection.normalizationBones) || selection.normalizationBones.length === 0)) throw new Error('身体尺寸骨链必须是非空骨名列表');
  const normalNames = selection.normalizationBones ?? [...branch].filter(n => descendsFrom(n, selection.bodyAnchor));
  for (const name of normalNames) if (!branch.has(requireName(name, '身体尺寸骨链'))) throw new Error('身体尺寸骨链不能包含其他方向或外部共享骨');
  if (!source.summary.skins.some(s => s.name === skin)) throw new Error(`不存在皮肤：${skin}`);
  const data = new SkeletonJson(new AtlasAttachmentLoader(new TextureAtlas(atlasText))).readSkeletonData(document);
  const skeleton = new Skeleton(data); skeleton.setSkin(skin); skeleton.setupPose(); skeleton.updateWorldTransform(Physics.reset);
  const setupWorld = worldOf(skeleton.findBone(selection.bodyAnchor)!);
  const inverse = inverseOf(setupWorld);
  const activeBones = skeleton.bones.filter(b => included.has(b.data.name));
  const controls = source.summary.constraints.filter(c => c.bones.some(b => branch.has(b)));
  const bones: RigProfile['bones'] = activeBones.map(bone => {
    const name = bone.data.name, world = worldOf(bone), local = pointIn(inverse, world.x, world.y);
    const endpoint = pointIn(inverse, world.x + world.a * bone.data.length, world.y + world.c * bone.data.length);
    return { name, parent: bone.parent?.data.name ?? null, evidenceId: `${side}:bone:${encodeURIComponent(name)}`, side: sideOf(name),
      scope: branch.has(name) ? 'branch' : ancestors.has(name) ? 'ancestor' : 'shared',
      setup: { world, local, normalized: { x: 0, y: 0 }, length: Math.hypot(endpoint.x - local.x, endpoint.y - local.y) },
      slots: source.summary.slots.filter(s => s.bone === name).map(s => s.name),
      control: { ikTarget: controls.some(c => c.kind === 'ik' && c.target === name), ikDriven: controls.some(c => c.kind === 'ik' && c.bones.includes(name)),
        transformTarget: controls.some(c => c.kind === 'transform' && (c.target === name || c.source === name)), transformDriven: controls.some(c => c.kind === 'transform' && c.bones.includes(name)),
        pathDriven: controls.some(c => c.kind === 'path' && c.bones.includes(name)), physicsDriven: controls.some(c => c.kind === 'physics' && c.bones.includes(name)) },
      raw: structuredClone(rawBones.find(b => b.name === name)!) };
  });
  const normal = bones.filter(b => normalNames.includes(b.name));
  const extent = Math.max(...normal.map(b => b.setup.local.x)) - Math.min(...normal.map(b => b.setup.local.x));
  const height = Math.max(...normal.map(b => b.setup.local.y)) - Math.min(...normal.map(b => b.setup.local.y));
  const measured = Math.max(extent, height, ...normal.map(b => b.setup.length));
  const normalizationScale = measured > 1e-12 ? measured : 1;
  for (const bone of bones) bone.setup.normalized = { x: bone.setup.local.x / normalizationScale, y: bone.setup.local.y / normalizationScale };
  const samples: RigProfile['samples'] = [];
  for (const animationName of [...new Set(animations)]) {
    const animation = data.findAnimation(animationName);
    if (!animation) throw new Error(`不存在采样动作：${animationName}`);
    const frames = animation.duration > 0 ? 25 : 1;
    for (let i = 0; i < frames; i++) {
      skeleton.setupPose();
      const state = new AnimationState(new AnimationStateData(data)); state.setAnimation(0, animationName, false);
      const time = animation.duration * i / Math.max(1, frames - 1); state.update(time); state.apply(skeleton); skeleton.updateWorldTransform(Physics.reset);
      samples.push({ animation: animationName, time, evidenceId: `${side}:sample:${encodeURIComponent(animationName)}:${i}`,
        bones: activeBones.map(bone => { const world = worldOf(bone); return { name: bone.data.name, world, local: pointIn(inverse, world.x, world.y) }; }) });
    }
  }
  const constraints: Record<string, unknown>[] = [];
  for (const constraint of (raw.constraints ?? []) as Record<string, unknown>[]) {
    const described = source.summary.constraints.find(c => c.kind === constraint.type && c.name === constraint.name);
    if (described?.bones.some(n => branch.has(n))) constraints.push({ ...structuredClone(constraint), kind: constraint.type });
  }
  return { profileSchema: 'spw.rig-profile.v1', side, skin, selection: structuredClone(selection), globalRoots: [...named.values()].filter(b => !b.parent).map(b => b.name),
    includedBones: bones.map(b => b.name), normalizationScale, reference: { anchor: selection.bodyAnchor, setupWorld, inverse }, bones, constraints, samples,
    evidenceIds: [...bones.map(b => b.evidenceId), ...samples.map(s => s.evidenceId)] };
}
