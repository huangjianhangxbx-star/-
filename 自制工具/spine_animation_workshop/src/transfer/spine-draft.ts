import type {
  SpineChannelDependency, SpineChannelPolicy, SpineLocalCorrection, SpineObjectMapping, SpineTargetDrawOrderKey,
} from "../core/spine-contracts.ts";
import { readSpineSource } from "../source/spine-source.ts";
import { migrateSpineAnimation, type SpineMigrationReport } from "./spine-timelines.ts";

type JsonObject = Record<string, unknown>;
export type SpineDraftScope = "body" | "mapped";
export type SpineDraft = {
  animation: JsonObject;
  /** The audit remains incomplete when channels were omitted; this does not prevent a draft preview. */
  report: SpineMigrationReport;
  omitted: number;
  copied: number;
  disabledIk: string[];
  scope: SpineDraftScope;
};

const copiedStatuses = new Set(["direct", "corrected", "needs-calibration"]);

function matches(dep: SpineChannelDependency, mapping: SpineObjectMapping): boolean {
  return dep.kind === mapping.kind && dep.source === mapping.source &&
    (mapping.channels === undefined || mapping.channels.includes(dep.channel)) &&
    (mapping.kind !== "attachment" || (mapping.sourceSkin === dep.sourceSkin && mapping.sourceSlot === dep.sourceSlot));
}

function skip(dep: SpineChannelDependency, sourceAnimation: string, reason: string): SpineChannelPolicy {
  return { kind: dep.kind, source: dep.source, channel: dep.channel, sourceAnimation, decision: "skip", reason,
    ...(dep.sourceSkin === undefined ? {} : { sourceSkin: dep.sourceSkin }),
    ...(dep.sourceSlot === undefined ? {} : { sourceSlot: dep.sourceSlot }) };
}

/**
 * Build an inspectable partial animation without relaxing the strict copier's individual channel checks.
 * Skips created for the chosen scope exist only in this call. No source, target or saved mapping is edited.
 */
export function createSpineDraft(
  sourceDocument: unknown,
  targetDocument: unknown,
  sourceAnimationName: string,
  mappings: readonly SpineObjectMapping[],
  corrections: readonly SpineLocalCorrection[] = [],
  policies: readonly SpineChannelPolicy[] = [],
  rangeSeconds?: readonly [number, number],
  selectedSkins?: { sourceSkin: string; targetSkin: string },
  targetDrawOrderKeys?: readonly SpineTargetDrawOrderKey[],
  scope: SpineDraftScope = "body",
): SpineDraft {
  if (scope !== "body" && scope !== "mapped") throw new Error(`Unknown draft scope: ${String(scope)}`);
  const parsed = readSpineSource(JSON.stringify(sourceDocument));
  // Validate the target as well: partial drafting tolerates missing correspondence, not a broken skeleton.
  const target = readSpineSource(JSON.stringify(targetDocument)).document as JsonObject;
  const deps = parsed.animationDependencies[sourceAnimationName];
  if (!deps) throw new Error(`Source animation missing: ${sourceAnimationName}`);
  const duration = parsed.summary.animations.find((animation) => animation.name === sourceAnimationName)!.durationSeconds;
  if (rangeSeconds && (!Number.isFinite(rangeSeconds[0]) || !Number.isFinite(rangeSeconds[1]) ||
    rangeSeconds[0] !== 0 || Math.abs(rangeSeconds[1] - duration) > 1e-6)) {
    throw new Error("Draft range must cover the full source animation; exact timeline crop is not implemented");
  }

  const scopeSkips = deps.flatMap((dep) => {
    if (dep.kind === "drawOrder" && targetDrawOrderKeys?.length) {
      return [skip(dep, sourceAnimationName, "本轮使用手动设置的目标显示顺序，不复制来源显示顺序")];
    }
    if (scope === "body" && dep.kind !== "bone") {
      return [skip(dep, sourceAnimationName, "身体骨骼优先：本轮不迁移槽位、衣物变形、约束、显示顺序和事件；保留目标设置")];
    }
    const selected = mappings.filter((mapping) => matches(dep, mapping));
    return selected.length === 1 && selected[0]!.drive === "skip"
      ? [skip(dep, sourceAnimationName, "映射中已选择跳过此对象；保留目标设置")]
      : [];
  });
  const constraints = (target.constraints ?? []) as JsonObject[];
  const candidateBoneTargets = new Set(deps.filter((dep) => dep.kind === "bone").flatMap((dep) => {
    const selected = mappings.filter((mapping) => matches(dep, mapping));
    return selected.length === 1 && selected[0]!.drive !== "skip" ? [selected[0]!.target] : [];
  }));
  const potentialIk = constraints.filter((constraint) => constraint.type === "ik" &&
    Array.isArray(constraint.bones) && constraint.bones.some((bone) => candidateBoneTargets.has(String(bone))));

  const migrateWithIkDisabled = (disabled: readonly JsonObject[]) => {
    const names = new Set(disabled.map((constraint) => String(constraint.name)));
    const draftTarget = structuredClone(target);
    for (const constraint of (draftTarget.constraints ?? []) as JsonObject[]) {
      if (constraint.type === "ik" && names.has(String(constraint.name))) constraint.mix = 0;
    }
    const competingIkSkips = deps.filter((dep) => dep.kind === "ik" &&
      mappings.some((mapping) => matches(dep, mapping) && mapping.drive !== "skip" && names.has(mapping.target)))
      .map((dep) => skip(dep, sourceAnimationName, "草稿优先使用已映射骨骼动作：本轮停用覆盖同一骨链的目标 IK"));
    return migrateSpineAnimation(sourceDocument, draftTarget, sourceAnimationName, mappings, corrections,
      [...scopeSkips, ...competingIkSkips, ...policies], rangeSeconds, selectedSkins, targetDrawOrderKeys);
  };

  let result = migrateWithIkDisabled(potentialIk);
  const copiedBoneTargets = new Set(result.report.channels.filter((channel) => channel.kind === "bone" &&
    copiedStatuses.has(channel.status)).map((channel) => channel.target));
  const actualIk = potentialIk.filter((constraint) => (constraint.bones as unknown[]).some((bone) => copiedBoneTargets.has(String(bone))));
  // A conflicting FK row must not disable a valid IK-only mapping in the same draft.
  if (actualIk.length !== potentialIk.length) result = migrateWithIkDisabled(actualIk);
  const disabledIk = actualIk.map((constraint) => String(constraint.name));
  if (disabledIk.length > 0) {
    const outputIk = (result.animation.ik ?? {}) as JsonObject;
    for (const name of disabledIk) outputIk[name] = [{ mix: 0 }];
    result.animation.ik = outputIk;
    result.report.warnings.push(`草稿已为目标 IK 写入零时刻 mix=0：${disabledIk.join("、")}；只作用于新动画，骨骼动作优先，仍需检查手脚轨迹`);
  }
  const copied = result.report.channels.filter((channel) => copiedStatuses.has(channel.status)).length;
  const omitted = deps.length - copied;
  result.report.warnings.unshift(`可迭代草稿：已迁移 ${copied} 个来源通道，未迁移 ${omitted} 个；未迁移部分保留目标设置，报告中的问题可边预览边调整`);
  return { ...result, copied, omitted, disabledIk, scope };
}
