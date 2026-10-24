/** A practical ceiling for one generated Spine animation in the desktop workshop. */
export const MAX_GENERATED_FRAMES = 20_000;

export type SamplingPlan = {
  durationSeconds: number;
  /** Number of regular rate-spaced samples after the first sample. */
  sampleCount: number;
  /** Includes an extra exact end sample when the range is not rate-aligned. */
  frameCount: number;
};

/** Validate sampling inputs before allocating frames or constructing a transfer. */
export function validateSamplingLimits(sampleHz: number, rangeSeconds: readonly [number, number]): SamplingPlan {
  if (!Number.isFinite(sampleHz) || sampleHz < 1 || sampleHz > 240) {
    throw new Error("采样率 sampleHz 必须是有限数字且在 1–240 Hz 之间");
  }
  const [start, end] = rangeSeconds;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error("动作时间范围必须为有限数字，起点非负，终点晚于起点");
  }

  const durationSeconds = end - start;
  const stepProduct = durationSeconds * sampleHz;
  if (!Number.isFinite(stepProduct) || stepProduct >= MAX_GENERATED_FRAMES) {
    throw new Error(`采样帧数超过 ${MAX_GENERATED_FRAMES.toLocaleString("en-US")} 帧上限；缩短时间范围或降低采样率`);
  }
  const sampleCount = Math.floor(stepProduct + 1e-9);
  const lastRegularSample = start + sampleCount / sampleHz;
  const frameCount = sampleCount + 1 + Number(lastRegularSample < end - 1e-9);
  if (frameCount > MAX_GENERATED_FRAMES) {
    throw new Error(`采样帧数超过 ${MAX_GENERATED_FRAMES.toLocaleString("en-US")} 帧上限；缩短时间范围或降低采样率`);
  }
  return { durationSeconds, sampleCount, frameCount };
}
