import {
  type SurfacePixel,
  pixelKey,
  PaintSurfaceDomain,
} from "./paint-surface-domain.ts";
export class PaintSelection {
  chart: string | null = null;
  keys = new Set<string>();
  active = false;
  clear() {
    this.active = false;
    this.chart = null;
    this.keys.clear();
  }
  change(
    chart: string,
    pixels: SurfacePixel[],
    mode: "replace" | "add" | "subtract",
  ) {
    if (this.active && this.chart !== chart && mode !== "replace")
      throw Error("选区仅限同一平面，请先清除");
    if (mode === "replace") this.keys.clear();
    this.active = true;
    this.chart = chart;
    for (const p of pixels)
      if (mode === "subtract") this.keys.delete(pixelKey(p));
      else this.keys.add(pixelKey(p));
  }
  allows(p: SurfacePixel) {
    return !this.active || this.keys.has(pixelKey(p));
  }
  invert(pixels: SurfacePixel[]) {
    this.keys = new Set(
      pixels.filter((p) => !this.keys.has(pixelKey(p))).map(pixelKey),
    );
    this.active = true;
  }
}
export function colorDistance(a: string, b: string) {
  return Math.max(
    ...[1, 3, 5].map((i) =>
      Math.abs(
        parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16),
      ),
    ),
  );
}
export function fillPixels(
  domain: PaintSurfaceDomain,
  start: SurfacePixel,
  range: string,
  selection: PaintSelection,
  sample: (p: SurfacePixel) => string,
  tolerance: number,
  visible: (p: SurfacePixel) => boolean,
) {
  if (range === "selection") {
    if (!selection.active || !selection.keys.size) throw Error("贴图选区为空");
    return domain
      .chartPixels(domain.chart(start))
      .filter((p) => selection.allows(p) && visible(p));
  }
  const target = sample(start);
  return domain.connected(
    start,
    (p) =>
      (range !== "face" || p.key === start.key) &&
      selection.allows(p) &&
      visible(p) &&
      colorDistance(sample(p), target) <= tolerance,
  );
}
