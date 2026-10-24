import { srgbToLinear } from "./palette.ts";
export type FaceToneValue = { gain: number; affectPaint: boolean };
export const linearToSrgb = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055;
/** Author color only: never consumes viewport lights, and never changes source paint. */
export function appearanceColor(
  base: string,
  paint?: string,
  tone?: FaceToneValue,
): string {
  const hex = paint ?? base,
    gain = paint && !tone?.affectPaint ? 1 : (tone?.gain ?? 1);
  if (gain === 1) return hex.toLowerCase();
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          Math.max(
            0,
            Math.min(
              1,
              linearToSrgb(
                srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255) * gain,
              ),
            ),
          ) * 255,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
