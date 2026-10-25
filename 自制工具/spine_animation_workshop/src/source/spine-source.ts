import type {
  SpineChannelDependency,
  SpineDependencyKind,
  SpineSourceReadResult,
  SpineSourceSkin,
} from "../core/spine-contracts.ts";
import { extractDisplayInfo, readSpineTarget, type AtlasResources } from "../target/spine-target.ts";

type JsonObject = Record<string, unknown>;
export type SpineSourceResources = AtlasResources;

function objectAt(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function nameAt(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonempty string`);
  return value;
}

function uniqueNames(names: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(`Duplicate ${label}: ${name}`);
    seen.add(name);
  }
}

/** Browser-safe content identity; this is not the archival SHA-256 of the original .spine file. */
function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as JsonObject;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function timelineInfo(value: unknown, label: string): { keyCount: number; lastKeySeconds: number; chronological: boolean } {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a nonempty key list`);
  }
  let previous = -1;
  let latest = 0;
  let chronological = true;
  for (const [index, entry] of value.entries()) {
    const key = objectAt(entry, `${label}[${index}]`);
    const time = key.time === undefined ? 0 : key.time;
    if (typeof time !== "number" || !Number.isFinite(time) || time < 0) {
      throw new Error(`${label}[${index}].time must be finite and nonnegative`);
    }
    if (time < previous) chronological = false;
    previous = time;
    latest = Math.max(latest, time);
  }
  return { keyCount: value.length, lastKeySeconds: latest, chronological };
}

function readDependencies(
  animationName: string,
  animationValue: unknown,
  names: { bones: ReadonlySet<string>; slots: ReadonlySet<string>; constraints: ReadonlyMap<string, ReadonlySet<string>> },
): SpineChannelDependency[] {
  const animation = objectAt(animationValue, `animation ${animationName}`);
  const dependencies: SpineChannelDependency[] = [];
  const add = (category: string, kind: SpineDependencyKind, source: string, channel: string, value: unknown,
    context: { sourceSkin?: string; sourceSlot?: string } = {}): void => {
    dependencies.push({ category, kind, source, channel, ...timelineInfo(value, `${animationName}.${category}.${source}.${channel}`), ...context });
  };

  for (const [category, value] of Object.entries(animation)) {
    if (category === "bones" || category === "slots") {
      const kind = category === "bones" ? "bone" : "slot";
      const known = category === "bones" ? names.bones : names.slots;
      for (const [source, channels] of Object.entries(objectAt(value, `${animationName}.${category}`))) {
        if (!known.has(source)) throw new Error(`${animationName}.${category} refers to missing ${kind} ${source}`);
        for (const [channel, keys] of Object.entries(objectAt(channels, `${animationName}.${category}.${source}`))) {
          add(category, kind, source, channel, keys);
        }
      }
      continue;
    }
    if (["ik", "transform", "path", "physics"].includes(category)) {
      const kind = category as "ik" | "transform" | "path" | "physics";
      const known = names.constraints.get(kind);
      for (const [source, timelines] of Object.entries(objectAt(value, `${animationName}.${category}`))) {
        if (!known?.has(source)) throw new Error(`${animationName}.${category} refers to missing constraint ${source}`);
        if (Array.isArray(timelines)) add(category, kind, source, category, timelines);
        else for (const [channel, keys] of Object.entries(objectAt(timelines, `${animationName}.${category}.${source}`))) {
          add(category, kind, source, channel, keys);
        }
      }
      continue;
    }
    if (category === "attachments") {
      for (const [sourceSkin, slots] of Object.entries(objectAt(value, `${animationName}.attachments`))) {
        for (const [sourceSlot, attachments] of Object.entries(objectAt(slots, `${animationName}.attachments.${sourceSkin}`))) {
          if (!names.slots.has(sourceSlot)) throw new Error(`${animationName}.attachments refers to missing slot ${sourceSlot}`);
          for (const [source, channels] of Object.entries(objectAt(attachments, `${animationName}.attachments.${sourceSkin}.${sourceSlot}`))) {
            for (const [channel, keys] of Object.entries(objectAt(channels, `${animationName}.attachments.${sourceSkin}.${sourceSlot}.${source}`))) {
              add(category, "attachment", source, channel, keys, { sourceSkin, sourceSlot });
            }
          }
        }
      }
      continue;
    }
    if (category === "drawOrder") {
      add(category, "drawOrder", "@drawOrder", "drawOrder", value);
      continue;
    }
    if (category === "events") {
      if (!Array.isArray(value)) throw new Error(`${animationName}.events must be a key list`);
      const grouped = new Map<string, unknown[]>();
      for (const event of value) {
        const item = objectAt(event, `${animationName}.events key`);
        const name = nameAt(item.name, `${animationName}.events name`);
        const group = grouped.get(name) ?? [];
        group.push(event);
        grouped.set(name, group);
      }
      for (const [source, events] of grouped) add(category, "event", source, "event", events);
      continue;
    }

    // Unknown 4.3/future channels remain visible to the compatibility gate.
    const scanUnknown = (nested: unknown, path: readonly string[]): void => {
      if (Array.isArray(nested)) {
        add(category, "unknown", path.slice(0, -1).join("/") || category, path.at(-1) ?? category, nested);
      } else if (nested !== null && typeof nested === "object") {
        for (const [key, child] of Object.entries(nested)) scanUnknown(child, [...path, key]);
      } else {
        throw new Error(`${animationName}.${category}.${path.join(".")} is not an animation timeline`);
      }
    };
    scanUnknown(value, [category]);
  }
  return dependencies;
}

/** Read a full 4.3 JSON export and expose every keyed animation dependency. */
export function readSpineSource(jsonText: string, resources?: SpineSourceResources): SpineSourceReadResult {
  const { summary: target, document } = readSpineTarget(jsonText, resources);
  const raw = objectAt(document, "Spine document");
  if (!Array.isArray(raw.slots)) throw new Error("Spine source has no slots array");
  if (!Array.isArray(raw.skins)) throw new Error("Spine source has no skins array");
  const display = extractDisplayInfo(document);
  uniqueNames(display.slots.map((slot) => slot.name), "slot");
  uniqueNames(target.skins, "skin");
  const bones = new Set(target.bones.map((bone) => bone.name));
  const slots = new Set(display.slots.map((slot) => slot.name));
  for (const slot of display.slots) {
    if (!bones.has(slot.bone)) throw new Error(`Slot ${slot.name} refers to missing bone ${slot.bone}`);
  }
  const constraints = new Map<string, Set<string>>();
  for (const constraint of target.constraints) {
    const kindNames = constraints.get(constraint.kind) ?? new Set<string>();
    if (kindNames.has(constraint.name)) throw new Error(`Duplicate ${constraint.kind} constraint: ${constraint.name}`);
    kindNames.add(constraint.name);
    constraints.set(constraint.kind, kindNames);
    if (constraint.target !== null && !(constraint.kind === "path" ? slots : bones).has(constraint.target)) {
      throw new Error(`Constraint ${constraint.name} refers to missing target ${constraint.target}`);
    }
  }
  const skins: SpineSourceSkin[] = raw.skins.map((entry, index) => {
    const skin = objectAt(entry, `skins[${index}]`);
    const name = nameAt(skin.name, `skins[${index}].name`);
    const attachments = skin.attachments === undefined ? {} : objectAt(skin.attachments, `skin ${name}.attachments`);
    let attachmentCount = 0;
    for (const [slotName, slotAttachments] of Object.entries(attachments)) {
      if (!slots.has(slotName)) throw new Error(`Skin ${name} refers to missing slot ${slotName}`);
      attachmentCount += Object.keys(objectAt(slotAttachments, `skin ${name} slot ${slotName}`)).length;
    }
    return { name, slotNames: Object.keys(attachments), attachmentCount };
  });
  const animations = raw.animations === undefined ? {} : objectAt(raw.animations, "animations");
  const animationDependencies: Record<string, readonly SpineChannelDependency[]> = {};
  const animationSummaries = Object.entries(animations).map(([name, value]) => {
    if (!name.trim()) throw new Error("Animation name cannot be empty");
    const dependencies = readDependencies(name, value, { bones, slots, constraints });
    animationDependencies[name] = dependencies;
    return { name, durationSeconds: dependencies.reduce((latest, item) => Math.max(latest, item.lastKeySeconds), 0) };
  });
  const skeletonFingerprint = fnv1a64(stableJson({
    spine: target.editorVersion,
    bones: raw.bones,
    slots: raw.slots,
    constraints: raw.constraints ?? [],
    skins: raw.skins,
  }));
  return {
    summary: {
      editorVersion: target.editorVersion,
      bones: target.bones,
      slots: display.slots,
      skins,
      constraints: target.constraints,
      animations: animationSummaries,
      candidateDirectionPrefixes: display.candidateDirectionPrefixes,
      skeletonFingerprint,
      fileHash: fnv1a64(jsonText),
    },
    document,
    animationDependencies,
  };
}
