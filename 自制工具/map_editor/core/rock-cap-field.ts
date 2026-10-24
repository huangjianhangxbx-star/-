import type { RockOptions, RockSeedGroup } from "./rock-shaping.ts";

type Sample = (
  group: RockSeedGroup,
  stream: number,
  x: number,
  y?: number,
) => number;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** XY-correlated caps, independent of cap height: not a rotated vertical stripe field.
 * Shared coarse layout keeps upper/lower surfaces related. Separate seed streams
 * retain control over block layout, fractures, chips, terrace levels and contours.
 */
export function createRockCapField(o: RockOptions, sample: Sample) {
  const noise = (
    group: RockSeedGroup,
    stream: number,
    x: number,
    y: number,
  ) => {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx),
      sy = fy * fy * (3 - 2 * fy);
    return (
      (sample(group, stream, ix, iy) * (1 - sx) +
        sample(group, stream, ix + 1, iy) * sx) *
        (1 - sy) +
      (sample(group, stream, ix, iy + 1) * (1 - sx) +
        sample(group, stream, ix + 1, iy + 1) * sx) *
        sy
    );
  };
  const width = o.maxWidth - o.minWidth;
  const scaleX = o.minWidth + width * sample("layout", 20, 0),
    scaleY = o.minWidth + width * sample("layout", 20, 1);
  const weights = Array.from(
    { length: o.layers },
    (_, i) => 0.55 + sample("terraces", 6, i),
  );
  const total = weights.reduce((a, b) => a + b, 0),
    thresholds: number[] = [];
  let sum = 0;
  for (const weight of weights) {
    sum += weight;
    thresholds.push(sum / total);
  }
  return (x: number, y: number) => {
    let strength: number,
      chip = false;
    if (o.preset === "columnar-wall") {
      const coarse = noise(
        "layout",
        21,
        (x + 0.5) / scaleX,
        (y + 0.5) / scaleY,
      );
      const fracture = noise(
        "breaks",
        22,
        (x + 0.5) / Math.max(2, o.continuity / 3),
        (y + 0.5) / Math.max(2, o.continuity / 3),
      );
      const raw = clamp(
        0.08 + 0.84 * coarse + (fracture - 0.5) * o.breakStrength * 0.3,
      );
      const steps = Math.max(2, Math.round(2 + (1 - o.regularity) * 4));
      strength =
        raw * (1 - o.regularity * 0.6) +
        (Math.round(raw * steps) / steps) * o.regularity * 0.6;
      chip =
        sample("chips", 23, Math.floor(x / 2), Math.floor(y / 2)) <
        o.chips * 0.08;
    } else {
      const scale = o.contourScale;
      const contour = clamp(
        noise("contour", 24, (x + 0.5) / scale, (y + 0.5) / scale) +
          (noise(
            "terraces",
            25,
            (x + 0.5) / (scale * 0.7),
            (y + 0.5) / (scale * 0.7),
          ) -
            0.5) *
            o.layerVariation *
            0.25,
      );
      const level = thresholds.findIndex((v) => contour <= v);
      strength = o.layers > 1 ? Math.max(0, level) / (o.layers - 1) : contour;
    }
    const operation = o.operation ?? "subtract",
      limit = o.preset === "columnar-wall" ? o.maxDepth : o.bandWidth,
      maxOut = o.maxOutward ?? 3;
    let depth = 0,
      outward = 0;
    if (operation === "subtract")
      depth = Math.round(limit * strength) + (chip ? 1 : 0);
    if (operation === "grow")
      outward = Math.round(
        maxOut * clamp(strength - (chip ? 1 / Math.max(1, maxOut) : 0)),
      );
    if (operation === "both") {
      const signed =
        2 * clamp(strength - (chip ? 1 / Math.max(1, maxOut) : 0)) - 1;
      depth = Math.round(limit * Math.max(0, -signed));
      outward = Math.round(maxOut * Math.max(0, signed));
    }
    // Direction affects displacement, never the XY field or local seed identity.
    return {
      depth: Math.min(limit, depth),
      outward: Math.min(maxOut, outward),
    };
  };
}
