import type {
  SpineChannelDependency, SpineChannelPolicy, SpineDependencyKind, SpineLocalCorrection,
  SpineObjectMapping, SpineSide, SpineTargetDrawOrderKey,
} from "../core/spine-contracts.ts";
import { readSpineSource } from "../source/spine-source.ts";

type JsonObject = Record<string, unknown>;
export type SpineChannelStatus = "direct" | "corrected" | "needs-calibration" | "explicit-skip" | "unmapped" | "unsupported" | "conflict";
export type SpineChannelDecision = {
  category: string;
  kind: SpineDependencyKind;
  source: string;
  channel: string;
  keyCount: number;
  status: SpineChannelStatus;
  reason: string;
  target?: string;
  sourceSkin?: string;
  sourceSlot?: string;
};
export type SpineMigrationReport = {
  sourceAnimation: string;
  channels: SpineChannelDecision[];
  blocked: boolean;
  totals: { direct: number; corrected: number; needsCalibration: number; explicitSkip: number; unmapped: number; unsupported: number; conflict: number };
  warnings: string[];
};

const boneChannels = new Set(["rotate", "translate", "translatex", "translatey", "scale", "scalex", "scaley",
  "shear", "shearx", "sheary", "inherit"]);
const slotChannels = new Set(["attachment", "rgba", "rgb", "alpha", "rgba2", "rgb2"]);
const constraintKinds = new Set(["ik", "transform", "path", "physics"]);

function objectAt(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as JsonObject;
}
function arrayAt(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}
function namesFor(document: JsonObject, kind: SpineDependencyKind): Set<string> {
  if (kind === "bone" || kind === "slot") {
    const entries = arrayAt(document[`${kind}s`], `${kind}s`);
    return new Set(entries.map((entry) => objectAt(entry, kind).name).filter((name): name is string => typeof name === "string"));
  }
  if (kind === "event") return new Set(Object.keys(document.events === undefined ? {} : objectAt(document.events, "events")));
  if (constraintKinds.has(kind)) {
    const entries = document.constraints === undefined ? [] : arrayAt(document.constraints, "constraints");
    return new Set(entries.filter((entry) => objectAt(entry, "constraint").type === kind)
      .map((entry) => objectAt(entry, "constraint").name).filter((name): name is string => typeof name === "string"));
  }
  return new Set();
}
function sideOf(name: string): SpineSide {
  const tokens = name.split(/[\/:_.\-\s]+/).filter(Boolean);
  if (tokens.some((token, index) => /^(?:left|l)(?:arm|leg|hand|foot)\d*$/i.test(token) ||
    (/^(?:left|l)$/i.test(token) && /^(?:arm|leg|hand|foot)/i.test(tokens[index + 1] ?? "")))) return "left";
  if (tokens.some((token, index) => /^(?:right|r)(?:arm|leg|hand|foot)\d*$/i.test(token) ||
    (/^(?:right|r)$/i.test(token) && /^(?:arm|leg|hand|foot)/i.test(tokens[index + 1] ?? "")))) return "right";
  return "unknown";
}
function matchingMappings(dep: SpineChannelDependency, mappings: readonly SpineObjectMapping[]): SpineObjectMapping[] {
  return mappings.filter((mapping) => mapping.kind === dep.kind && mapping.source === dep.source &&
    (mapping.channels === undefined || mapping.channels.includes(dep.channel)) &&
    (mapping.kind !== "attachment" ||
      (mapping.sourceSkin === dep.sourceSkin && mapping.sourceSlot === dep.sourceSlot)));
}
function matchingPolicy(dep: SpineChannelDependency, policies: readonly SpineChannelPolicy[], sourceAnimationName: string): SpineChannelPolicy | undefined {
  const matches = policies.filter((policy) => (policy.sourceAnimation === undefined || policy.sourceAnimation === sourceAnimationName) &&
    policy.kind === dep.kind && policy.source === dep.source && policy.channel === dep.channel &&
    (policy.sourceSkin === undefined || policy.sourceSkin === dep.sourceSkin) &&
    (policy.sourceSlot === undefined || policy.sourceSlot === dep.sourceSlot));
  return matches.find((policy) => policy.sourceAnimation === sourceAnimationName) ?? matches[0];
}
function decision(dep: SpineChannelDependency, status: SpineChannelStatus, reason: string, target?: string): SpineChannelDecision {
  return { category: dep.category, kind: dep.kind, source: dep.source, channel: dep.channel,
    keyCount: dep.keyCount, status, reason, ...(target === undefined ? {} : { target }),
    ...(dep.sourceSkin === undefined ? {} : { sourceSkin: dep.sourceSkin }),
    ...(dep.sourceSlot === undefined ? {} : { sourceSlot: dep.sourceSlot }) };
}
function sourceKeys(animation: JsonObject, dep: SpineChannelDependency): unknown[] {
  if (dep.category === "drawOrder") return arrayAt(animation.drawOrder, "drawOrder");
  if (dep.category === "events") return arrayAt(animation.events, "events").filter((entry) => objectAt(entry, "event").name === dep.source);
  const category = objectAt(animation[dep.category], dep.category);
  if (dep.category === "attachments") {
    return arrayAt(objectAt(objectAt(objectAt(category[dep.sourceSkin!], "source skin")[dep.sourceSlot!], "source slot")
      [dep.source], "source attachment")[dep.channel], "attachment keys");
  }
  const entry = category[dep.source];
  if (Array.isArray(entry)) return entry;
  return arrayAt(objectAt(entry, `${dep.category}.${dep.source}`)[dep.channel], "timeline keys");
}
function targetAttachmentExists(target: JsonObject, skinName: string, slotName: string, attachmentName: string): boolean {
  const skins = arrayAt(target.skins, "skins");
  const skin = skins.map((entry) => objectAt(entry, "skin")).find((entry) => entry.name === skinName);
  if (!skin) return false;
  const attachments = skin.attachments === undefined ? {} : objectAt(skin.attachments, "skin attachments");
  const slotAttachments = attachments[slotName];
  return slotAttachments !== undefined && Object.hasOwn(objectAt(slotAttachments, "slot attachments"), attachmentName);
}
function explicitAttachmentMapping(
  sourceName: string, sourceSkin: string, sourceSlot: string, mappings: readonly SpineObjectMapping[], targetSkin: string, targetSlot: string,
): Extract<SpineObjectMapping, { kind: "attachment" }> | undefined {
  const matches = mappings.filter((item): item is Extract<SpineObjectMapping, { kind: "attachment" }> =>
    item.kind === "attachment" && item.source === sourceName && item.sourceSkin === sourceSkin && item.sourceSlot === sourceSlot &&
    item.targetSkin === targetSkin && item.targetSlot === targetSlot);
  return matches.length === 1 ? matches[0] : undefined;
}
function rewriteSlotAttachment(
  keys: unknown[], dep: SpineChannelDependency, target: JsonObject, mapping: SpineObjectMapping,
  mappings: readonly SpineObjectMapping[], selectedSkins: { sourceSkin: string; targetSkin: string } | undefined,
): { keys?: unknown[]; reason?: string } {
  if (!selectedSkins) return { reason: "Select source and target skins before migrating attachment keys" };
  const copied = structuredClone(keys) as unknown[];
  for (const keyValue of copied) {
    const key = objectAt(keyValue, "slot attachment key");
    if (key.name === null || key.name === undefined) continue;
    if (typeof key.name !== "string") return { reason: "Attachment key name is malformed" };
    const attachment = explicitAttachmentMapping(key.name, selectedSkins.sourceSkin, dep.source, mappings,
      selectedSkins.targetSkin, mapping.target);
    if (!attachment) return { reason: `Attachment ${key.name} has no unique typed mapping for selected skins ${selectedSkins.sourceSkin} → ${selectedSkins.targetSkin}` };
    if (!targetAttachmentExists(target, selectedSkins.targetSkin, mapping.target, attachment.target)) {
      return { reason: `Target attachment ${selectedSkins.targetSkin}/${mapping.target}/${attachment.target} is missing` };
    }
    key.name = attachment.target;
  }
  return { keys: copied };
}

function sourceOrTargetSkin(document: JsonObject): string | undefined {
  const skins = arrayAt(document.skins, "skins");
  return skins.length === 1 && typeof objectAt(skins[0], "skin").name === "string"
    ? objectAt(skins[0], "skin").name as string : undefined;
}

function compatibleConstraint(
  source: JsonObject, target: JsonObject, dep: SpineChannelDependency, mapping: SpineObjectMapping,
  mappings: readonly SpineObjectMapping[], keys: unknown[],
): string | undefined {
  if (!constraintKinds.has(dep.kind)) return undefined;
  const sourceConstraint = arrayAt(source.constraints ?? [], "source constraints").map((entry) => objectAt(entry, "source constraint"))
    .find((entry) => entry.type === dep.kind && entry.name === dep.source);
  const targetConstraint = arrayAt(target.constraints ?? [], "target constraints").map((entry) => objectAt(entry, "target constraint"))
    .find((entry) => entry.type === dep.kind && entry.name === mapping.target);
  if (!sourceConstraint || !targetConstraint) return `Constraint ${dep.source} → ${mapping.target} is missing`;
  // An explicit time-zero, all-zero IK mix only disables the target solver; its chain need not match.
  if (dep.kind === "ik" && keys.length > 0 && Number(objectAt(keys[0], "IK key").time ?? 0) === 0 &&
      keys.every((entry) => objectAt(entry, "IK key").mix === 0)) return undefined;
  const sourceBones = Array.isArray(sourceConstraint.bones) ? sourceConstraint.bones : [];
  const targetBones = Array.isArray(targetConstraint.bones) ? targetConstraint.bones : [];
  if (sourceBones.length !== targetBones.length) return `Constraint bone chain length differs for ${dep.source} → ${mapping.target}`;
  const mapsTo = (sourceName: unknown, targetName: unknown, kind: "bone" | "slot"): boolean => {
    if (typeof sourceName !== "string" || typeof targetName !== "string") return sourceName === targetName;
    const matches = [...new Set(mappings.filter((item) => item.kind === kind && item.source === sourceName && item.drive !== "skip")
      .map((item) => item.target))];
    return matches.length === 1 ? matches[0] === targetName : matches.length === 0 && sourceName === targetName;
  };
  if (sourceBones.some((name, index) => !mapsTo(name, targetBones[index], "bone"))) {
    return `Constraint bone chain differs for ${dep.source} → ${mapping.target}; map each driven bone explicitly`;
  }
  const targetKind = dep.kind === "path" ? "slot" : "bone";
  if (!mapsTo(sourceConstraint.target, targetConstraint.target, targetKind)) {
    return `Constraint target differs for ${dep.source} → ${mapping.target}; map its control target explicitly`;
  }
  if (Number(sourceConstraint.order ?? 0) !== Number(targetConstraint.order ?? 0)) {
    return `Constraint order differs for ${dep.source} → ${mapping.target}`;
  }
  return undefined;
}

function boneCalibrationReason(
  source: JsonObject, target: JsonObject, dep: SpineChannelDependency, mapping: SpineObjectMapping,
  mappings: readonly SpineObjectMapping[],
): string | undefined {
  if (dep.kind !== "bone") return undefined;
  const sourceBone = arrayAt(source.bones, "source bones").map((entry) => objectAt(entry, "source bone"))
    .find((entry) => entry.name === dep.source);
  const targetBone = arrayAt(target.bones, "target bones").map((entry) => objectAt(entry, "target bone"))
    .find((entry) => entry.name === mapping.target);
  if (!sourceBone || !targetBone) return undefined;
  const issues: string[] = [];
  if (sourceBone.parent !== targetBone.parent) {
    const parentMappings = [...new Set(mappings.filter((item) => item.kind === "bone" && item.source === sourceBone.parent && item.drive !== "skip")
      .map((item) => item.target))];
    if (parentMappings.length !== 1 || parentMappings[0] !== targetBone.parent) issues.push("parent chain");
  }
  const numeric = (value: unknown, fallback: number): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const angle = ((numeric(sourceBone.rotation, 0) - numeric(targetBone.rotation, 0) + 540) % 360) - 180;
  if (Math.abs(angle) > 15) issues.push(`setup rotation ${angle.toFixed(1)}°`);
  const sourceReflection = Math.sign(numeric(sourceBone.scaleX, 1) * numeric(sourceBone.scaleY, 1));
  const targetReflection = Math.sign(numeric(targetBone.scaleX, 1) * numeric(targetBone.scaleY, 1));
  if (sourceReflection !== targetReflection) issues.push("setup reflection");
  if (Math.abs(numeric(sourceBone.scaleX, 1) - numeric(targetBone.scaleX, 1)) > 0.1 ||
      Math.abs(numeric(sourceBone.scaleY, 1) - numeric(targetBone.scaleY, 1)) > 0.1) issues.push("setup scale/local units");
  if ((sourceBone.inherit ?? "normal") !== (targetBone.inherit ?? "normal")) issues.push("transform inheritance");
  if (dep.channel.startsWith("translate") &&
      (Math.abs(numeric(sourceBone.x, 0) - numeric(targetBone.x, 0)) > 50 ||
        Math.abs(numeric(sourceBone.y, 0) - numeric(targetBone.y, 0)) > 50)) issues.push("setup translation/anchor");
  return issues.length ? `Needs target-local calibration: ${issues.join(", ")}` : undefined;
}
function drawOrderCompatible(source: JsonObject, target: JsonObject, mappings: readonly SpineObjectMapping[]): string | undefined {
  const sourceSlots = arrayAt(source.slots, "source slots").map((entry) => objectAt(entry, "slot").name);
  const targetSlots = arrayAt(target.slots, "target slots").map((entry) => objectAt(entry, "slot").name);
  if (sourceSlots.length !== targetSlots.length) return `Slot counts differ (${sourceSlots.length} vs ${targetSlots.length}); draw order offsets are positional`;
  const translated = sourceSlots.map((slot) => {
    const match = mappings.filter((item) => item.kind === "slot" && item.source === slot && item.drive !== "skip");
    return match.length === 1 ? match[0]!.target : undefined;
  });
  if (translated.some((name) => name === undefined)) return "Every source slot needs an unambiguous slot mapping for draw order";
  if (!translated.every((name, index) => name === targetSlots[index])) return "Mapped slot sequence differs from target slot order";
  return undefined;
}

function correctedKeys(keys: unknown[], correction: SpineLocalCorrection | undefined, dep: SpineChannelDependency): { keys?: unknown[]; corrected: boolean; reason?: string } {
  const copy = structuredClone(keys) as unknown[];
  if (!correction) return { keys: copy, corrected: false };
  const valueChannel = dep.channel.toLowerCase();
  let transforms: { property: string; factor: number; offset: number; curveGroup: number; fallback: number }[] = [];
  const rot = correction.rotationDegrees ?? 0;
  const sx = correction.scaleX ?? 1;
  const sy = correction.scaleY ?? 1;
  const ox = correction.offsetX ?? 0;
  const oy = correction.offsetY ?? 0;
  if (valueChannel === "rotate") transforms = [{ property: "value", factor: 1, offset: rot, curveGroup: 0, fallback: 0 }];
  else if (valueChannel === "translate" || valueChannel === "shear") transforms = [
    { property: "x", factor: valueChannel === "translate" ? sx : 1, offset: ox, curveGroup: 0, fallback: 0 },
    { property: "y", factor: valueChannel === "translate" ? sy : 1, offset: oy, curveGroup: 1, fallback: 0 },
  ];
  else if (valueChannel === "translatex" || valueChannel === "shearx") transforms = [
    { property: "value", factor: valueChannel === "translatex" ? sx : 1, offset: ox, curveGroup: 0, fallback: 0 },
  ];
  else if (valueChannel === "translatey" || valueChannel === "sheary") transforms = [
    { property: "value", factor: valueChannel === "translatey" ? sy : 1, offset: oy, curveGroup: 0, fallback: 0 },
  ];
  else if (valueChannel === "scale") transforms = [
    { property: "x", factor: sx, offset: 0, curveGroup: 0, fallback: 1 },
    { property: "y", factor: sy, offset: 0, curveGroup: 1, fallback: 1 },
  ];
  else if (valueChannel === "scalex" || valueChannel === "scaley") transforms = [
    { property: "value", factor: valueChannel === "scalex" ? sx : sy, offset: 0, curveGroup: 0, fallback: 1 },
  ];
  else return { corrected: false, reason: `Numeric correction is unsupported for ${dep.kind}.${dep.channel}` };
  if (!Number.isFinite(rot) || !Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(ox) || !Number.isFinite(oy)) {
    return { corrected: false, reason: "Correction must contain finite numbers" };
  }
  const changed = transforms.some((transform) => transform.factor !== 1 || transform.offset !== 0);
  if (!changed) return { keys: copy, corrected: false };
  for (const keyValue of copy) {
    const key = objectAt(keyValue, "corrected key");
    for (const transform of transforms) {
      if (transform.factor === 1 && transform.offset === 0) continue;
      const value = key[transform.property] ?? transform.fallback;
      if (typeof value !== "number" || !Number.isFinite(value)) return { corrected: false, reason: `${transform.property} is not numeric` };
      key[transform.property] = value * transform.factor + transform.offset;
      if (Array.isArray(key.curve)) {
        const curve = key.curve as unknown[];
        for (const index of [transform.curveGroup * 4 + 1, transform.curveGroup * 4 + 3]) {
          if (index >= curve.length) continue;
          if (typeof curve[index] !== "number") return { corrected: false, reason: "Bezier Y control is not numeric" };
          curve[index] = (curve[index] as number) * transform.factor + transform.offset;
        }
      }
    }
  }
  return { keys: copy, corrected: true };
}

function writeChannel(output: JsonObject, dep: SpineChannelDependency, targetName: string, keys: unknown[]): void {
  if (dep.category === "drawOrder" || dep.category === "events") {
    output[dep.category] = keys;
    return;
  }
  const category = output[dep.category] === undefined ? {} : objectAt(output[dep.category], dep.category);
  output[dep.category] = category;
  if (dep.category === "attachments") throw new Error("Mesh attachment timelines require a separate geometry audit");
  if (dep.category === "ik" || dep.category === "transform" || dep.category === "path" || dep.category === "physics") {
    if (dep.channel === dep.category) { category[targetName] = keys; return; }
  }
  const owner = category[targetName] === undefined ? {} : objectAt(category[targetName], targetName);
  category[targetName] = owner;
  owner[dep.channel] = keys;
}

function validateMappingTarget(dep: SpineChannelDependency, mapping: SpineObjectMapping, target: JsonObject): string | undefined {
  if (mapping.drive === "skip") return "Mapping marks this object as skipped; add an explicit channel skip policy";
  if (!namesFor(target, dep.kind).has(mapping.target)) return `Target ${dep.kind} ${mapping.target} is missing`;
  const inferredSource = sideOf(dep.source);
  const inferredTarget = sideOf(mapping.target);
  if ((mapping.side !== "unknown" && inferredSource !== "unknown" && mapping.side !== inferredSource) ||
      (mapping.side !== "unknown" && inferredTarget !== "unknown" && mapping.side !== inferredTarget) ||
      (inferredSource !== "unknown" && inferredTarget !== "unknown" && inferredSource !== inferredTarget)) {
    return `Left/right side conflict: ${dep.source} → ${mapping.target}`;
  }
  return undefined;
}

function ikRemainsDisabled(
  constraint: JsonObject, animation: JsonObject, deps: readonly SpineChannelDependency[],
  mappings: readonly SpineObjectMapping[], policies: readonly SpineChannelPolicy[], sourceAnimationName: string,
): boolean {
  const mapped = deps.filter((item) => item.kind === "ik" &&
    matchingMappings(item, mappings).some((mapping) => mapping.target === constraint.name && mapping.drive !== "skip") &&
    matchingPolicy(item, policies, sourceAnimationName)?.decision !== "skip" &&
    matchingPolicy(item, policies, sourceAnimationName)?.decision !== "unsupported");
  if (mapped.length === 0) return Number(constraint.mix ?? 1) === 0;
  if (mapped.length !== 1) return false;
  const keys = sourceKeys(animation, mapped[0]!);
  return keys.length > 0 && Number(objectAt(keys[0], "IK key").time ?? 0) === 0 &&
    keys.every((entry) => objectAt(entry, "IK key").mix === 0);
}

function activeIkDriverConflict(
  target: JsonObject, animation: JsonObject, deps: readonly SpineChannelDependency[],
  mappings: readonly SpineObjectMapping[], policies: readonly SpineChannelPolicy[], sourceAnimationName: string,
  dep: SpineChannelDependency, targetName: string,
): string | undefined {
  if (dep.kind !== "bone" && dep.kind !== "ik") return undefined;
  const constraints = target.constraints === undefined ? [] : arrayAt(target.constraints, "constraints");
  for (const entry of constraints) {
    const constraint = objectAt(entry, "constraint");
    if (constraint.type !== "ik") continue;
    if (ikRemainsDisabled(constraint, animation, deps, mappings, policies, sourceAnimationName)) continue;
    const coveredBones = Array.isArray(constraint.bones) ? constraint.bones : [];
    if (dep.kind === "bone" && coveredBones.includes(targetName)) {
      return `IK ${String(constraint.name)} can override FK bone ${targetName}; map an explicit zero-mix IK timeline from time zero`;
    }
    if (dep.kind === "ik" && constraint.name === targetName) {
      const mappedFk = mappings.some((mapping) => mapping.kind === "bone" && coveredBones.includes(mapping.target) && mapping.drive !== "skip");
      if (mappedFk) return `Active IK ${targetName} and mapped FK bone both drive the same chain`;
    }
  }
  return undefined;
}

/** Copy native 4.3 key structures. A blocked report is returned with a partial candidate solely for inspection. */
export function migrateSpineAnimation(
  sourceDocument: unknown,
  targetDocument: unknown,
  sourceAnimationName: string,
  mappings: readonly SpineObjectMapping[],
  corrections: readonly SpineLocalCorrection[] = [],
  policies: readonly SpineChannelPolicy[] = [],
  rangeSeconds?: readonly [number, number],
  selectedSkins?: { sourceSkin: string; targetSkin: string },
  targetDrawOrderKeys?: readonly SpineTargetDrawOrderKey[],
): { animation: Record<string, unknown>; report: SpineMigrationReport } {
  const source = objectAt(sourceDocument, "source document");
  const target = objectAt(targetDocument, "target document");
  const parsed = readSpineSource(JSON.stringify(source));
  const deps = parsed.animationDependencies[sourceAnimationName];
  if (!deps) throw new Error(`Source animation missing: ${sourceAnimationName}`);
  const animation = objectAt(objectAt(source.animations, "source animations")[sourceAnimationName], "source animation");
  const output: JsonObject = {};
  const channels: SpineChannelDecision[] = [];
  const warnings: string[] = [];
  const successful = new Map<string, number>();
  const eventKeys: { index: number; key: JsonObject }[] = [];
  const destinationOwners = new Map<string, number>();
  const activeSkins = selectedSkins ?? (() => {
    const sourceSkin = sourceOrTargetSkin(source);
    const targetSkin = sourceOrTargetSkin(target);
    return sourceSkin && targetSkin ? { sourceSkin, targetSkin } : undefined;
  })();
  for (const dep of deps) {
    const policy = matchingPolicy(dep, policies, sourceAnimationName);
    if (policy?.decision === "skip" || policy?.decision === "unsupported") continue;
    const matches = matchingMappings(dep, mappings);
    if (matches.length !== 1 || matches[0]!.drive === "skip") continue;
    const key = `${dep.kind}\0${matches[0]!.target}\0${dep.channel}`;
    destinationOwners.set(key, (destinationOwners.get(key) ?? 0) + 1);
  }

  const duration = parsed.summary.animations.find((item) => item.name === sourceAnimationName)?.durationSeconds ?? 0;
  if (rangeSeconds && (rangeSeconds[0] !== 0 || Math.abs(rangeSeconds[1] - duration) > 1e-6)) {
    if (!Number.isFinite(rangeSeconds[0]) || !Number.isFinite(rangeSeconds[1]) || rangeSeconds[0] < 0 || rangeSeconds[1] < rangeSeconds[0]) {
      throw new Error("Invalid animation range");
    }
    channels.push({ category: "range", kind: "unknown", source: sourceAnimationName, channel: "@range", keyCount: 0,
      status: "unsupported", reason: "Exact native Bezier and stepped timeline crop is not implemented; full source range is required" });
  }

  for (const dep of deps) {
    const policy = matchingPolicy(dep, policies, sourceAnimationName);
    if (policy?.decision === "skip") {
      channels.push(decision(dep, "explicit-skip", policy.reason || "Explicitly skipped"));
      continue;
    }
    if (policy?.decision === "unsupported") {
      channels.push(decision(dep, "unsupported", policy.reason || "Explicitly marked unsupported"));
      continue;
    }
    if (dep.kind === "unknown") {
      channels.push(decision(dep, "unsupported", `Unsupported Spine animation category ${dep.category}`));
      continue;
    }
    if (dep.kind === "attachment") {
      channels.push(decision(dep, "unsupported", "Attachment deform/sequence requires compatible mesh or sequence topology; no cross-character copier", undefined));
      continue;
    }
    if (dep.kind === "drawOrder") {
      const reason = drawOrderCompatible(source, target, mappings);
      if (reason) { channels.push(decision(dep, "conflict", reason)); continue; }
      const keys = structuredClone(sourceKeys(animation, dep)) as JsonObject[];
      const slotMap = new Map(mappings.filter((item) => item.kind === "slot").map((item) => [item.source, item.target]));
      for (const key of keys) {
        const offsets = key.offsets;
        if (Array.isArray(offsets)) for (const offset of offsets) {
          const item = objectAt(offset, "draw order offset");
          if (typeof item.slot === "string") item.slot = slotMap.get(item.slot) ?? item.slot;
        }
      }
      writeChannel(output, dep, "@drawOrder", keys);
      channels.push(decision(dep, "direct", "Mapped slot sequence and positional offsets are compatible", "@drawOrder"));
      continue;
    }
    if ((dep.kind === "bone" && !boneChannels.has(dep.channel)) || (dep.kind === "slot" && !slotChannels.has(dep.channel))) {
      channels.push(decision(dep, "unsupported", `Unsupported ${dep.kind} channel ${dep.channel}`));
      continue;
    }
    const matches = matchingMappings(dep, mappings);
    if (matches.length === 0) { channels.push(decision(dep, "unmapped", "No typed object mapping")); continue; }
    if (matches.length > 1) { channels.push(decision(dep, "conflict", "Multiple mappings match the same keyed source channel")); continue; }
    const mapping = matches[0]!;
    const destinationKey = `${dep.kind}\0${mapping.target}\0${dep.channel}`;
    if ((destinationOwners.get(destinationKey) ?? 0) > 1) {
      channels.push(decision(dep, "conflict", `Multiple source channels target ${mapping.target}.${dep.channel}`, mapping.target));
      continue;
    }
    const targetProblem = validateMappingTarget(dep, mapping, target);
    if (targetProblem) { channels.push(decision(dep, "conflict", targetProblem, mapping.target)); continue; }
    const driverProblem = activeIkDriverConflict(target, animation, deps, mappings, policies, sourceAnimationName, dep, mapping.target);
    if (driverProblem) { channels.push(decision(dep, "conflict", driverProblem, mapping.target)); continue; }
    const constraintProblem = compatibleConstraint(source, target, dep, mapping, mappings, sourceKeys(animation, dep));
    if (constraintProblem) { channels.push(decision(dep, "conflict", constraintProblem, mapping.target)); continue; }
    if (successful.has(destinationKey)) {
      const previous = channels[successful.get(destinationKey)!]!;
      previous.status = "conflict";
      previous.reason = `Multiple source channels target ${mapping.target}.${dep.channel}`;
      channels.push(decision(dep, "conflict", previous.reason, mapping.target));
      continue;
    }
    let keys = sourceKeys(animation, dep);
    if (dep.kind === "slot" && dep.channel === "attachment") {
      const result = rewriteSlotAttachment(keys, dep, target, mapping, mappings, activeSkins);
      if (result.reason) { channels.push(decision(dep, "conflict", result.reason, mapping.target)); continue; }
      keys = result.keys!;
    }
    const correctionMatches = corrections.filter((item) => item.kind === dep.kind && item.target === mapping.target && item.channel === dep.channel);
    if (correctionMatches.length > 1) { channels.push(decision(dep, "conflict", "Multiple corrections target one property", mapping.target)); continue; }
    const corrected = correctedKeys(keys, correctionMatches[0], dep);
    if (corrected.reason) { channels.push(decision(dep, "conflict", corrected.reason, mapping.target)); continue; }
    if (dep.kind === "event") {
      const original = arrayAt(animation.events, "events");
      for (const item of corrected.keys!) {
        const copy = objectAt(item, "event");
        copy.name = mapping.target;
        const index = original.findIndex((sourceKey) => objectAt(sourceKey, "event").name === dep.source &&
          objectAt(sourceKey, "event").time === copy.time && !eventKeys.some((placed) => placed.index === original.indexOf(sourceKey)));
        eventKeys.push({ index: index < 0 ? eventKeys.length : index, key: copy });
      }
    } else writeChannel(output, dep, mapping.target, corrected.keys!);
    const calibration = boneCalibrationReason(source, target, dep, mapping, mappings);
    channels.push(decision(dep, calibration ? "needs-calibration" : corrected.corrected ? "corrected" : "direct",
      calibration ? `${calibration}; native keys copied for visual review` :
        corrected.corrected ? "Target-local numeric correction applied" : "Native key time, value and curve preserved", mapping.target));
    successful.set(destinationKey, channels.length - 1);
    if (dep.kind === "bone") {
      const sourceBone = arrayAt(source.bones, "bones").map((item) => objectAt(item, "bone")).find((item) => item.name === dep.source);
      const targetBone = arrayAt(target.bones, "bones").map((item) => objectAt(item, "bone")).find((item) => item.name === mapping.target);
      if (sourceBone && targetBone && sourceBone.parent !== targetBone.parent) {
        const warning = `${dep.source} → ${mapping.target}: parent chain differs; inspect local axes and final pose`;
        if (!warnings.includes(warning)) warnings.push(warning);
      }
    }
  }
  if (eventKeys.length) output.events = eventKeys.sort((a, b) => a.index - b.index).map((item) => item.key);
  if (targetDrawOrderKeys?.length) {
    if (output.drawOrder !== undefined) throw new Error("Target-authored drawOrder conflicts with copied source drawOrder");
    const targetSlots = arrayAt(target.slots, "target slots").map((entry) => objectAt(entry, "target slot").name);
    let previousTime = -1;
    for (const key of targetDrawOrderKeys) {
      if (!Number.isFinite(key.time) || key.time < 0 || key.time <= previousTime ||
          (rangeSeconds && key.time > rangeSeconds[1])) throw new Error("Target-authored drawOrder key time is outside the action range or unordered");
      previousTime = key.time;
      const usedSlots = new Set<string>();
      const usedPositions = new Set<number>();
      let previousIndex = -1;
      for (const offset of key.offsets ?? []) {
        const index = targetSlots.indexOf(offset.slot);
        if (index < 0) throw new Error(`Target-authored drawOrder slot missing: ${offset.slot}`);
        if (usedSlots.has(offset.slot)) throw new Error(`Target-authored drawOrder duplicate slot: ${offset.slot}`);
        if (index <= previousIndex) throw new Error("Target-authored drawOrder offsets must follow target setup slot order");
        if (!Number.isSafeInteger(offset.offset)) throw new Error(`Target-authored drawOrder offset must be a safe integer: ${offset.slot}`);
        const position = index + offset.offset;
        if (position < 0 || position >= targetSlots.length || usedPositions.has(position)) {
          throw new Error(`Target-authored drawOrder offset outside target slot range or collides: ${offset.slot}`);
        }
        previousIndex = index;
        usedSlots.add(offset.slot);
        usedPositions.add(position);
      }
    }
    output.drawOrder = structuredClone(targetDrawOrderKeys);
    warnings.push(`Target-authored drawOrder: ${targetDrawOrderKeys.length} keys; source drawOrder remains separately audited`);
  }
  if (!channels.some((item) => item.status === "direct" || item.status === "corrected" || item.status === "needs-calibration")) {
    channels.push({ category: "output", kind: "unknown", source: sourceAnimationName, channel: "@empty", keyCount: 0,
      status: "conflict", reason: "No copied channels; an empty animation cannot count as a migration" });
  }
  const totals = { direct: 0, corrected: 0, needsCalibration: 0, explicitSkip: 0, unmapped: 0, unsupported: 0, conflict: 0 };
  for (const channel of channels) {
    if (channel.status === "explicit-skip") totals.explicitSkip++;
    else if (channel.status === "needs-calibration") totals.needsCalibration++;
    else totals[channel.status]++;
  }
  const report: SpineMigrationReport = { sourceAnimation: sourceAnimationName, channels,
    blocked: totals.unmapped + totals.unsupported + totals.conflict > 0, totals, warnings };
  return { animation: output, report };
}
