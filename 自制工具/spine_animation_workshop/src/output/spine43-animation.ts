import type { DriverFrame, GeneratedClip } from "../core/contracts.ts";
import { readSpineTarget } from "../target/spine-target.ts";

type JsonObject = Record<string, unknown>;
type TimelineKey = { time?: number; x?: number; y?: number; value?: number; mix?: number };
type BoneTimelines = { rotate?: TimelineKey[]; translate?: TimelineKey[]; scale?: TimelineKey[] };

function frameTime(seconds: number): { time?: number } {
  return seconds === 0 ? {} : { time: seconds };
}

function validateClip(clip: GeneratedClip): void {
  if (typeof clip.name !== "string" || !clip.name.trim() || ["__proto__", "constructor", "prototype"].includes(clip.name)) {
    throw new Error("Animation name must be a nonempty safe string");
  }
  if (!Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0) {
    throw new Error("Animation durationSeconds must be finite and positive");
  }
  if (!Array.isArray(clip.frames) || clip.frames.length === 0) {
    throw new Error("Animation needs at least one frame");
  }
  let previous = -Infinity;
  let keyCount = 0;
  for (const frame of clip.frames) {
    if (!Number.isFinite(frame.seconds) || frame.seconds < 0 || frame.seconds > clip.durationSeconds || frame.seconds <= previous) {
      throw new Error("Animation frame seconds must be finite, ordered, and inside duration");
    }
    previous = frame.seconds;
    if (!Array.isArray(frame.keys)) throw new Error("Animation frame keys must be an array");
    const seen = new Set<string>();
    for (const key of frame.keys) {
      if (typeof key.target !== "string" || !key.target) throw new Error("Animation key needs a target");
      if (!Number.isFinite(key.value)) throw new Error(`Animation key ${key.target}.${key.property} needs a finite value`);
      if (key.property === "ikMix" && (key.value < 0 || key.value > 1)) {
        throw new Error(`IK mix for ${key.target} must be between 0 and 1`);
      }
      const identity = `${key.target}\u0000${key.property}`;
      if (seen.has(identity)) throw new Error(`Duplicate animation key ${key.target}.${key.property} at ${frame.seconds}`);
      seen.add(identity);
      keyCount++;
    }
  }
  if (clip.frames[0]?.seconds !== 0) throw new Error("Animation must begin at 0 seconds");
  if (keyCount === 0) throw new Error("Animation has no keys");
}

function uniqueName(base: string, animations: JsonObject): string {
  if (!Object.hasOwn(animations, base)) return base;
  for (let number = 2; ; number++) {
    const candidate = `${base}_${number}`;
    if (!Object.hasOwn(animations, candidate)) return candidate;
  }
}

function compileTimelines(frames: readonly DriverFrame[]): JsonObject {
  const bones: Record<string, BoneTimelines> = Object.create(null);
  const ik: Record<string, TimelineKey[]> = Object.create(null);
  const lastTranslation = new Map<string, { x: number; y: number }>();
  const lastScale = new Map<string, { x: number; y: number }>();
  for (const frame of frames) {
    const byTarget = new Map<string, Partial<Record<DriverFrame["keys"][number]["property"], number>>>();
    for (const key of frame.keys) {
      let values = byTarget.get(key.target);
      if (!values) {
        values = {};
        byTarget.set(key.target, values);
      }
      values[key.property] = key.value;
    }
    for (const [target, values] of byTarget) {
      if (values.ikMix !== undefined) {
        (ik[target] ??= []).push({ ...frameTime(frame.seconds), mix: values.ikMix });
        continue;
      }
      const timelines = (bones[target] ??= {});
      if (values.rotation !== undefined) {
        (timelines.rotate ??= []).push({ ...frameTime(frame.seconds), value: values.rotation });
      }
      if (values.x !== undefined || values.y !== undefined) {
        const previous = lastTranslation.get(target) ?? { x: 0, y: 0 };
        const next = { x: values.x ?? previous.x, y: values.y ?? previous.y };
        (timelines.translate ??= []).push({ ...frameTime(frame.seconds), ...next });
        lastTranslation.set(target, next);
      }
      if (values.scaleX !== undefined || values.scaleY !== undefined) {
        const previous = lastScale.get(target) ?? { x: 1, y: 1 };
        const next = { x: values.scaleX ?? previous.x, y: values.scaleY ?? previous.y };
        (timelines.scale ??= []).push({ ...frameTime(frame.seconds), ...next });
        lastScale.set(target, next);
      }
    }
  }
  const animation: JsonObject = { bones };
  if (Object.keys(ik).length > 0) animation.ik = ik;
  return animation;
}

/** Add an animation to a complete 4.3 export. Driver values are Spine timeline deltas from setup pose. */
export function appendAnimation(document: unknown, clip: GeneratedClip): { jsonText: string; name: string } {
  validateClip(clip);
  let copyText: string;
  try {
    copyText = JSON.stringify(document);
  } catch (error) {
    throw new Error(`Spine document is not JSON serializable: ${String(error)}`);
  }
  if (typeof copyText !== "string") throw new Error("Spine document must be an object");
  const { summary, document: parsed } = readSpineTarget(copyText);
  const copy = parsed as JsonObject;
  const boneNames = new Set(summary.bones.map((item) => item.name));
  const ikNames = new Set(summary.constraints.filter((item) => item.kind === "ik").map((item) => item.name));
  for (const frame of clip.frames) {
    for (const key of frame.keys) {
      if (key.property === "ikMix") {
        if (!ikNames.has(key.target)) throw new Error(`Missing IK constraint ${key.target}`);
      } else if (key.property === "x" || key.property === "y" || key.property === "rotation" || key.property === "scaleX" || key.property === "scaleY") {
        if (!boneNames.has(key.target)) throw new Error(`Missing target bone ${key.target}`);
      } else {
        throw new Error(`Unsupported animation property ${String(key.property)}`);
      }
    }
  }
  const animations = (copy.animations ??= {}) as JsonObject;
  const name = uniqueName(clip.name, animations);
  Object.defineProperty(animations, name, {
    value: compileTimelines(clip.frames), enumerable: true, writable: true, configurable: true,
  });
  return { jsonText: JSON.stringify(copy), name };
}
