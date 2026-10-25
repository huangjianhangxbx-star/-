import { buildRigProfile, type RigProfile, type RigSelection } from './rig-profile.ts';
import { readSpineSource } from '../source/spine-source.ts';

export interface RigReferenceCandidate {
  bone: string;
  score: number;
  evidenceIds: string[];
  reasons: string[];
}
export interface RigDirectionCandidate {
  id: string;
  bone: string;
  selection: RigSelection;
  status: 'proposed' | 'ambiguous';
  score: number;
  evidenceIds: string[];
  reasons: string[];
  metrics: {
    boneCount: number; slotCount: number; weightedSlotCount: number; movingBoneCount: number;
    extent: number; width: number; height: number; layoutOffset: number;
  };
  bodyAnchorCandidates: RigReferenceCandidate[];
  groundAnchorCandidates: RigReferenceCandidate[];
  sharedControlCandidates: RigReferenceCandidate[];
  normalizationBoneCandidates: RigReferenceCandidate[];
}
export interface RigDiscovery {
  discoverySchema: 'spw.rig-discovery.v1';
  side: 'source' | 'target';
  skin: string;
  globalRoots: string[];
  /** This is an unfiltered survey frame, never a confirmed body or direction. */
  surveySelection: RigSelection;
  surveyOnly: true;
  status: 'proposed' | 'ambiguous';
  directionCandidates: RigDirectionCandidate[];
  rootArtworkSlots: string[];
  warnings: string[];
}

type ProfileBone = RigProfile['bones'][number];
function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function rounded(value: number): number { return Number(value.toFixed(6)); }

/** Automatically gathers full-rig evidence. Candidates remain proposals; names do not determine camera direction. */
export function discoverRigReferences(document: unknown, atlasText: string, animations: readonly string[], skin: string,
  side: 'source' | 'target'): RigDiscovery {
  const source = readSpineSource(JSON.stringify(document));
  const globalRoots = source.summary.bones.filter(b => !b.parent).map(b => b.name);
  if (globalRoots.length !== 1) throw new Error('自动全骨架调查需要一个根骨；检测到多个或缺失根骨，不能只调查第一棵骨架');
  const root = globalRoots[0]!;
  const surveySelection: RigSelection = { directionId: `survey:${root}`, directionRoot: root, bodyAnchor: root, sharedBones: [] };
  const profile = buildRigProfile(document, atlasText, animations, skin, surveySelection, side);
  const named = new Map(profile.bones.map(b => [b.name, b]));
  const children = new Map(profile.bones.map(b => [b.name, profile.bones.filter(c => c.parent === b.name)]));
  const subtree = (name: string): ProfileBone[] => {
    const result: ProfileBone[] = [], queue = [named.get(name)!];
    while (queue.length) { const bone = queue.shift()!; result.push(bone); queue.push(...(children.get(bone.name) ?? [])); }
    return result;
  };
  const invertible = (bone: ProfileBone) => { const w = bone.setup.world; return Math.abs(w.a * w.d - w.b * w.c) >= 1e-12; };
  const slotCount = (bones: ProfileBone[]) => bones.reduce((n, b) => n + b.slots.length, 0);
  const motions = new Map<string, number>();
  for (const bone of profile.bones) {
    let range = 0;
    for (const sample of profile.samples) {
      const sampled = sample.bones.find(b => b.name === bone.name)!;
      range = Math.max(range, Math.hypot(sampled.world.x - bone.setup.world.x, sampled.world.y - bone.setup.world.y),
        Math.abs(Math.atan2(sampled.world.c, sampled.world.a) - Math.atan2(bone.setup.world.c, bone.setup.world.a)));
    }
    motions.set(bone.name, range);
  }
  const isControl = (b: ProfileBone) => b.control.ikTarget || b.control.transformTarget;
  const weightedSlots = new Set<string>();
  const skins = (source.document as Record<string, unknown>).skins;
  for (const item of Array.isArray(skins) ? skins : []) {
    const record = item as Record<string, unknown>;
    if (record.name !== skin) continue;
    for (const [slot, attachments] of Object.entries((record.attachments ?? {}) as Record<string, Record<string, unknown>>)) {
      if (Object.values(attachments).some(value => {
        const attachment = value as Record<string, unknown>;
        return ['mesh', 'linkedmesh'].includes(String(attachment.type)) && Array.isArray(attachment.vertices) && Array.isArray(attachment.uvs) && attachment.vertices.length !== attachment.uvs.length;
      })) weightedSlots.add(slot);
    }
  }
  // Root-bound drawings do not prove that the root itself is a fully rigged direction.
  const rootArtworkSlots = named.get(root)!.slots;
  const substantial = (b: ProfileBone) => {
    const descendants = subtree(b.name);
    return descendants.length >= 4 && (slotCount(descendants) >= 2 || descendants.length >= 8);
  };
  const directBranches = (children.get(root) ?? []).filter(substantial);
  const branchBones = directBranches.length ? [...directBranches] : [named.get(root)!];
  // Export nested dominant containers as alternatives: imported projects often wrap
  // the actual character in several layout/control bones. None becomes selected.
  for (const top of [...branchBones]) {
    const original = subtree(top.name), originalSlots = slotCount(original);
    if (original.length < 20) continue;
    let current = top;
    for (let depth = 0; depth < 5; depth++) {
      const dominant = (children.get(current.name) ?? []).filter(child => {
        const descendants = subtree(child.name);
        return descendants.length >= original.length * .75 && (!originalSlots || slotCount(descendants) >= originalSlots * .75);
      });
      if (dominant.length !== 1) break;
      current = dominant[0]!;
      if (!branchBones.some(b => b.name === current.name)) branchBones.push(current);
    }
  }
  const viableBranches = branchBones.filter(b => subtree(b.name).some(invertible));
  const status = viableBranches.length === 1 ? 'proposed' : 'ambiguous';
  const directionCandidates = viableBranches.map((branch): RigDirectionCandidate => {
    const bones = subtree(branch.name), names = new Set(bones.map(b => b.name));
    const drawable = bones.filter(b => b.slots.length), points = drawable.length ? drawable : bones;
    const center = { x: median(points.map(b => b.setup.world.x)), y: median(points.map(b => b.setup.world.y)) };
    const minX = Math.min(...bones.map(b => b.setup.world.x)), maxX = Math.max(...bones.map(b => b.setup.world.x));
    const minY = Math.min(...bones.map(b => b.setup.world.y)), maxY = Math.max(...bones.map(b => b.setup.world.y));
    const width = maxX - minX, height = maxY - minY, scale = Math.max(width, height, 1);
    const totalSlots = slotCount(bones), movingBoneCount = bones.filter(b => motions.get(b.name)! > 1e-4).length;
    const evidence = (bone: ProfileBone, score: number, reasons: string[]): RigReferenceCandidate => ({ bone: bone.name, score: rounded(score), evidenceIds: [bone.evidenceId], reasons });
    const bodyAnchorCandidates = bones.filter(b => invertible(b) && !isControl(b) && (children.get(b.name) ?? []).length > 0).map(b => {
      const descendantSlots = slotCount(subtree(b.name));
      const degree = Math.min((children.get(b.name) ?? []).length, 4) / 4;
      const centrality = 1 / (1 + Math.hypot(b.setup.world.x - center.x, b.setup.world.y - center.y) / scale);
      const nameHint = /(?:pelvis|centroid|hips?|torso|body|身体|躯干|骨盆)/i.test(b.name) ? 0.04 : 0;
      const score = .45 * (totalSlots ? descendantSlots / totalSlots : subtree(b.name).length / bones.length) + .25 * degree + .25 * centrality + nameHint;
      return evidence(b, score, [`子树含 ${descendantSlots} 个槽、${subtree(b.name).length} 根骨；直接分支 ${(children.get(b.name) ?? []).length} 个`,
        `设置姿势中心距离 ${rounded(Math.hypot(b.setup.world.x - center.x, b.setup.world.y - center.y))}；仅为身体参考候选，未确定人体语义`,
        ...(nameHint ? ['名称提供弱提示，排序仍以结构和几何为主'] : [])]);
    }).sort((a, b) => b.score - a.score || a.bone.localeCompare(b.bone)).slice(0, 6);
    if (!bodyAnchorCandidates.length) bodyAnchorCandidates.push(evidence(bones.find(invertible)!, 0, ['无可辨识关节分叉；暂用分支入口作为调查参考，身体语义未知']));
    const anchor = named.get(bodyAnchorCandidates[0]!.bone)!;
    const sharedControlCandidates = profile.bones.filter(b => !names.has(b.name) && source.summary.constraints.some(c =>
      (c.target === b.name || c.source === b.name) && c.bones.some(name => names.has(name))))
      .map(b => evidence(b, 1, ['当前分支之外的约束目标或源，实际约束连接到本分支；仅提议为共享控制']));
    const groundAnchorCandidates = bones.filter(b => b.name !== branch.name && !isControl(b)).map(b => evidence(b,
      (maxY - b.setup.world.y) / Math.max(height, 1) + ((children.get(b.name) ?? []).length === 0 ? .2 : 0),
      [`世界 Y=${rounded(b.setup.world.y)}；位置较低不等于实际脚底或物理地面，尚待动作与图像语义确认`]))
      .sort((a, b) => b.score - a.score || a.bone.localeCompare(b.bone)).slice(0, 5);
    const physical = bones.filter(b => b.name !== branch.name && !isControl(b));
    const lengths = physical.map(b => b.setup.length).filter(n => n > 0).sort((a, b) => a - b);
    const maxLength = lengths[Math.max(0, Math.ceil(lengths.length * .9) - 1)] ?? Infinity;
    const radius = Math.max(median(points.map(b => Math.hypot(b.setup.world.x - center.x, b.setup.world.y - center.y))) * 2.5, scale * .35, 1);
    const normalizationBoneCandidates = physical.filter(b => b.setup.length <= maxLength &&
      Math.hypot(b.setup.world.x - center.x, b.setup.world.y - center.y) <= radius &&
      (b.setup.length > 0 || b.name === anchor.name || (children.get(b.name) ?? []).length > 1))
      .map(b => evidence(b, 1 / (1 + Math.hypot(b.setup.world.x - center.x, b.setup.world.y - center.y) / scale),
        ['同一分支内的关节与长度证据；排除分支排版入口、外部控制和极长离群骨，人体尺寸语义仍是候选']))
      .sort((a, b) => b.score - a.score || a.bone.localeCompare(b.bone));
    const normalizationBones = normalizationBoneCandidates.map(c => c.bone);
    if (!normalizationBones.length) normalizationBones.push(anchor.name);
    return { id: `${side}:branch:${encodeURIComponent(branch.name)}`, bone: branch.name,
      selection: { directionId: `branch:${branch.name}`, directionRoot: branch.name, bodyAnchor: anchor.name,
        sharedBones: sharedControlCandidates.map(c => c.bone), normalizationBones }, status,
      score: rounded(totalSlots + bones.length / 100 + movingBoneCount / 1000),
      evidenceIds: [branch.evidenceId, ...bodyAnchorCandidates.flatMap(c => c.evidenceIds)],
      reasons: [`结构子树含 ${bones.length} 根骨、${totalSlots} 个槽、${movingBoneCount} 根采样活动骨；不是相机方向识别结论`,
        ...(branchBones.length > 1 ? ['存在多个方向容器或嵌套入口候选；全部保留，不能自动挑第一个'] : ['唯一实质顶层分支；仍须 AI 结合身体、控制与动作证据判断'])],
      metrics: { boneCount: bones.length, slotCount: totalSlots, weightedSlotCount: bones.flatMap(b => b.slots).filter(s => weightedSlots.has(s)).length,
        movingBoneCount, extent: rounded(Math.max(width, height)), width: rounded(width), height: rounded(height),
        layoutOffset: rounded(Math.hypot(branch.setup.world.x - named.get(root)!.setup.world.x, branch.setup.world.y - named.get(root)!.setup.world.y)) },
      bodyAnchorCandidates, groundAnchorCandidates, sharedControlCandidates, normalizationBoneCandidates };
  }).sort((a, b) => b.score - a.score || a.bone.localeCompare(b.bone));
  return { discoverySchema: 'spw.rig-discovery.v1', side, skin, globalRoots, surveySelection, surveyOnly: true, status, directionCandidates,
    rootArtworkSlots: [...rootArtworkSlots], warnings: [
      'surveySelection 的全局根仅用于完整调查坐标；不是已确认的身体锚点，也不应据此过滤或迁移动画。',
      ...(directionCandidates.length > 1 ? ['检测到多个可能的方向容器；保留全部骨骼和候选，未默认选择第一个。'] : []),
      ...(rootArtworkSlots.length ? [`全局根直接绑定 ${rootArtworkSlots.length} 个槽；这些画片不能单凭槽数判定为完整绑定方向。`] : []),
      '身体、地面、共享控制和尺寸骨链均为有证据的候选；相机朝向、人体语义和物理地面尚未确认。',
    ] };
}


