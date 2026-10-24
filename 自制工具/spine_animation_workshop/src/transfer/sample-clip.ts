import type { DriverFrame, GeneratedClip, MotionSource, TargetSummary, TransferConfig } from "../core/contracts.ts";
import { validateSamplingLimits } from "../core/sampling-limits.ts";
import { createTransfer } from "./retarget.ts";

type Key = DriverFrame["keys"][number];

/** Sample the selected source interval, including both endpoints, on a zero-based Spine timeline. */
export function generateClip(source: MotionSource, target: TargetSummary, config: TransferConfig): GeneratedClip {
  const { durationSeconds, sampleCount } = validateSamplingLimits(config.sampleHz, config.source.rangeSeconds);
  const transfer = createTransfer(source, target, config);
  const [start, end] = config.source.rangeSeconds;
  const sourceTimes = Array.from({ length: sampleCount + 1 }, (_, index) => start + index / config.sampleHz);
  if (sourceTimes.at(-1)! < end - 1e-9) sourceTimes.push(end);
  else sourceTimes[sourceTimes.length - 1] = end;

  const previousAngles = new Map<string, number>();
  const frames: DriverFrame[] = sourceTimes.map((seconds) => {
    const raw = transfer.poseAt(seconds);
    const degenerate = new Set(raw.diagnostics.filter((entry) => entry.code === "degenerate-projection").map((entry) => entry.target));
    const keys: Key[] = raw.keys.map((key) => {
      if (key.property !== "rotation") return key;
      const prior = previousAngles.get(key.target);
      if (degenerate.has(key.target) && prior !== undefined) return { ...key, value: prior };
      let value = key.value;
      if (prior !== undefined) {
        while (value - prior > 180) value -= 360;
        while (value - prior <= -180) value += 360;
      }
      previousAngles.set(key.target, value);
      return { ...key, value };
    });
    return { seconds: Math.abs(raw.seconds) < 1e-9 ? 0 : raw.seconds, keys, diagnostics: raw.diagnostics };
  });
  frames[frames.length - 1] = { ...frames[frames.length - 1]!, seconds: durationSeconds };
  return { name: config.output.animationName, durationSeconds, frames };
}
