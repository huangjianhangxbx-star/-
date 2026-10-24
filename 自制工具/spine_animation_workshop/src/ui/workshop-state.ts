import type { MotionSource, TargetSummary, TransferConfig } from '../core/contracts.ts';
import { validateSamplingLimits } from '../core/sampling-limits.ts';

/** Start with real file/clip metadata. Bone choices remain explicit user decisions. */
export function createDraftConfig(source: MotionSource, target: TargetSummary, sourceFile: string, targetFile: string): TransferConfig {
  const clip = source.clips[0];
  if (!clip) throw new Error('源文件没有可用动作');
  return {
    schemaVersion: 1,
    source: { file: sourceFile, clipId: clip.id, frontAxis: '+Z', upAxis: '+Y', rangeSeconds: [0, clip.durationSeconds] },
    target: { file: targetFile, skin: target.skins.includes('default') ? 'default' : (target.skins[0] ?? ''), directionId: 'direction-01' },
    view: { yawDegrees: 0, pitchDegrees: 5, mirror: false },
    anchors: { sourceFootPath: '', targetFootBone: '', scale: 1, offsetX: 0, offsetY: 0 },
    mappings: [],
    chainCorrections: [],
    rootPolicy: 'in-place-ground',
    sampleHz: 30,
    output: { animationName: 'spw01_take_01', directory: '', spineVersion: target.editorVersion },
  };
}

/** Messages are also the order used by the UI's readiness list. */
export function readinessIssues(config: TransferConfig, source: MotionSource, target: TargetSummary): string[] {
  const issues: string[] = [];
  try { validateSamplingLimits(config.sampleHz, config.source.rangeSeconds); }
  catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  if (!source.clips.some((clip) => clip.id === config.source.clipId)) issues.push('重新选择源动作');
  if (!target.skins.includes(config.target.skin)) issues.push('重新选择目标皮肤');
  if (!config.anchors.sourceFootPath) issues.push('选择源脚点');
  else if (!source.joints.some((joint) => joint.path === config.anchors.sourceFootPath)) issues.push('源脚点已失效');
  if (!config.anchors.targetFootBone) issues.push('选择目标脚骨');
  else if (!target.bones.some((bone) => bone.name === config.anchors.targetFootBone)) issues.push('目标脚骨已失效');
  const active = config.mappings.filter((mapping) => mapping.mode !== 'skip');
  if (active.length === 0) issues.push('至少添加一条骨骼映射');
  for (const mapping of active) {
    if (!source.joints.some((joint) => joint.path === mapping.sourcePath)) issues.push(`映射源关节不存在：${mapping.sourcePath}`);
    if (!target.bones.some((bone) => bone.name === mapping.target)) issues.push(`映射目标骨不存在：${mapping.target}`);
  }
  const mappedTargets = new Set(active.map((mapping) => mapping.target));
  const corrected = new Set<string>();
  for (const correction of config.chainCorrections) {
    if (!mappedTargets.has(correction.target)) issues.push('局部修正需选择已映射目标骨');
    else if (corrected.has(correction.target)) issues.push(`${correction.target} 有重复的局部修正`);
    else corrected.add(correction.target);
    if (![correction.rotationDegrees, correction.offsetX, correction.offsetY].filter((value) => value !== undefined).every(Number.isFinite)) issues.push(`${correction.target} 的局部修正必须是有限数字`);
  }
  if (!config.output.directory) issues.push('选择输出目录');
  return issues;
}
