import type {
  SpineDependencyKind,
  SpineObjectKind,
  SpineTransferConfig,
  WorkshopConfig,
} from "../core/spine-contracts.ts";
import { validateConfig } from "./validate-config.ts";

type JsonObject = Record<string, unknown>;
const objectKinds = new Set<SpineObjectKind>(["bone", "slot", "ik", "transform", "path", "physics", "attachment", "event"]);
const dependencyKinds = new Set<SpineDependencyKind>([...objectKinds, "drawOrder", "unknown"]);
const sides = new Set(["left", "right", "center", "unknown"]);
const drives = new Set(["direct", "fk-bone", "ik-target", "transform-control", "skip"]);

function objectAt(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function nonempty(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonempty string`);
}

function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}

function listAt(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list`);
  return value;
}

function oneOf(value: unknown, options: ReadonlySet<string>, label: string): void {
  if (typeof value !== "string" || !options.has(value)) throw new Error(`${label} is not supported: ${String(value)}`);
}

function validateIdentity(value: unknown, label: string): void {
  const identity = objectAt(value, label);
  nonempty(identity.jsonFile, `${label}.jsonFile`);
  nonempty(identity.atlasFile, `${label}.atlasFile`);
  nonempty(identity.skeletonFingerprint, `${label}.skeletonFingerprint`);
  if (identity.fileHash !== undefined) nonempty(identity.fileHash, `${label}.fileHash`);
  const pages = listAt(identity.pageFiles, `${label}.pageFiles`);
  if (pages.length === 0) throw new Error(`${label}.pageFiles must include at least one page`);
  for (const [index, page] of pages.entries()) nonempty(page, `${label}.pageFiles[${index}]`);
}

function validateCorrection(value: unknown, label: string): void {
  const correction = objectAt(value, label);
  oneOf(correction.kind, objectKinds, `${label}.kind`);
  nonempty(correction.target, `${label}.target`);
  nonempty(correction.channel, `${label}.channel`);
  let numericCount = 0;
  for (const field of ["rotationDegrees", "scaleX", "scaleY", "offsetX", "offsetY"] as const) {
    if (correction[field] !== undefined) {
      finite(correction[field], `${label}.${field}`);
      numericCount++;
    }
  }
  if (numericCount === 0) throw new Error(`${label} needs a numeric correction`);
}

/** Validate a saved Spine→Spine config without filesystem or Electron APIs. */
export function validateSpineConfig(value: unknown): SpineTransferConfig {
  const config = objectAt(value, "Spine config");
  if (config.schemaVersion !== 2 || config.sourceKind !== "spine") {
    throw new Error("Spine config requires schemaVersion=2 and sourceKind=spine");
  }
  validateIdentity(config.source, "source");
  validateIdentity(config.target, "target");
  for (const field of ["sourceSkin", "targetSkin"] as const) {
    nonempty(config[field], field);
  }
  for (const field of ['sourceDirection', 'targetDirection'] as const) {
    if (typeof config[field] !== 'string') throw new Error('方向备注必须是文字，可留空');
  }
  if (config.targetDisplayAnimation !== undefined) nonempty(config.targetDisplayAnimation, "targetDisplayAnimation");

  for (const [index, entry] of listAt(config.objectMappings, "objectMappings").entries()) {
    const label = `objectMappings[${index}]`;
    const mapping = objectAt(entry, label);
    oneOf(mapping.kind, objectKinds, `${label}.kind`);
    nonempty(mapping.source, `${label}.source`);
    nonempty(mapping.target, `${label}.target`);
    oneOf(mapping.side, sides, `${label}.side`);
    oneOf(mapping.drive, drives, `${label}.drive`);
    if (mapping.channels !== undefined) {
      const channels = listAt(mapping.channels, `${label}.channels`);
      if (channels.length === 0) throw new Error(`${label}.channels cannot be empty`);
      for (const [channelIndex, channel] of channels.entries()) nonempty(channel, `${label}.channels[${channelIndex}]`);
      if (new Set(channels).size !== channels.length) throw new Error(`${label}.channels contains duplicates`);
    }
    if (mapping.kind === "attachment") {
      for (const field of ["sourceSkin", "sourceSlot", "targetSkin", "targetSlot"] as const) {
        nonempty(mapping[field], `${label}.${field}`);
      }
    }
  }

  const calibration = objectAt(config.calibration, "calibration");
  for (const field of ["rootScaleX", "rootScaleY"] as const) {
    finite(calibration[field], `calibration.${field}`);
    if (calibration[field] === 0) throw new Error(`calibration.${field} cannot be zero`);
  }
  for (const [index, entry] of listAt(calibration.corrections, "calibration.corrections").entries()) {
    validateCorrection(entry, `calibration.corrections[${index}]`);
  }

  const jobs = listAt(config.animationJobs, "animationJobs");
  if (jobs.length === 0) throw new Error("animationJobs must include an action");
  for (const [index, entry] of jobs.entries()) {
    const label = `animationJobs[${index}]`;
    const job = objectAt(entry, label);
    nonempty(job.sourceAnimation, `${label}.sourceAnimation`);
    nonempty(job.outputName, `${label}.outputName`);
    const range = listAt(job.rangeSeconds, `${label}.rangeSeconds`);
    if (range.length !== 2) throw new Error(`${label}.rangeSeconds must have a start and end`);
    finite(range[0], `${label}.rangeSeconds[0]`);
    finite(range[1], `${label}.rangeSeconds[1]`);
    if (range[0] < 0 || range[1] <= range[0]) throw new Error(`${label}.rangeSeconds end must follow a nonnegative start`);
    for (const [correctionIndex, correction] of listAt(job.corrections, `${label}.corrections`).entries()) {
      validateCorrection(correction, `${label}.corrections[${correctionIndex}]`);
    }
    if (job.targetDrawOrderKeys !== undefined) {
      const keys = listAt(job.targetDrawOrderKeys, `${label}.targetDrawOrderKeys`);
      if (keys.length === 0) throw new Error(`${label}.targetDrawOrderKeys cannot be empty`);
      let previousTime = -1;
      for (const [keyIndex, entry] of keys.entries()) {
        const keyLabel = `${label}.targetDrawOrderKeys[${keyIndex}]`;
        const key = objectAt(entry, keyLabel);
        finite(key.time, `${keyLabel}.time`);
        if (key.time < range[0] || key.time > range[1] || key.time <= previousTime) {
          throw new Error(`${keyLabel}.time must be strictly increasing within the action range`);
        }
        previousTime = key.time;
        if (key.offsets === undefined) continue;
        const slots = new Set<string>();
        for (const [offsetIndex, entry] of listAt(key.offsets, `${keyLabel}.offsets`).entries()) {
          const offsetLabel = `${keyLabel}.offsets[${offsetIndex}]`;
          const offset = objectAt(entry, offsetLabel);
          nonempty(offset.slot, `${offsetLabel}.slot`);
          if (slots.has(offset.slot)) throw new Error(`${keyLabel} contains duplicate slot ${offset.slot}`);
          slots.add(offset.slot);
          if (typeof offset.offset !== "number" || !Number.isSafeInteger(offset.offset)) {
            throw new Error(`${offsetLabel}.offset must be a safe integer`);
          }
        }
      }
    }
  }

  const policyKeys = new Set<string>();
  for (const [index, entry] of listAt(config.channelPolicies, "channelPolicies").entries()) {
    const label = `channelPolicies[${index}]`;
    const policy = objectAt(entry, label);
    if (policy.sourceAnimation !== undefined) nonempty(policy.sourceAnimation, `${label}.sourceAnimation`);
    oneOf(policy.kind, dependencyKinds, `${label}.kind`);
    nonempty(policy.source, `${label}.source`);
    nonempty(policy.channel, `${label}.channel`);
    oneOf(policy.decision, new Set(["copy", "skip", "unsupported"]), `${label}.decision`);
    nonempty(policy.reason, `${label}.reason`);
    if (policy.kind === "attachment") {
      nonempty(policy.sourceSkin, `${label}.sourceSkin`);
      nonempty(policy.sourceSlot, `${label}.sourceSlot`);
    }
    const key = JSON.stringify([policy.sourceAnimation ?? null, policy.kind, policy.source, policy.channel,
      policy.sourceSkin ?? null, policy.sourceSlot ?? null]);
    if (policyKeys.has(key)) throw new Error(`Duplicate channel policy: ${key}`);
    policyKeys.add(key);
  }
  return value as SpineTransferConfig;
}

/** Preserve old version 1 GLB loading while selecting the version 2 Spine contract explicitly. */
export function readWorkshopConfig(value: unknown): WorkshopConfig {
  const config = objectAt(value, "workshop config");
  if (config.schemaVersion === 1 && (config.sourceKind === undefined || config.sourceKind === "glb")) {
    return validateConfig(value);
  }
  if (config.schemaVersion === 2 && config.sourceKind === "spine") return validateSpineConfig(value);
  throw new Error(`Unsupported schemaVersion/sourceKind: ${String(config.schemaVersion)}/${String(config.sourceKind)}`);
}
