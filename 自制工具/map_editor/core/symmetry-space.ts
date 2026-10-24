import { type SurfacePixel } from "./paint-surface-domain.ts";
export type SymmetrySpec = {
  axes: [boolean, boolean, boolean];
  center: [number, number, number];
};
export function symmetryMasks(spec: SymmetrySpec) {
  return Array.from({ length: 8 }, (_, i) => i).filter((mask) =>
    [0, 1, 2].every((a) => !(mask & (1 << a)) || spec.axes[a]),
  );
}
export function symmetryK(
  spec: SymmetrySpec,
  origin: readonly number[],
  step: number,
) {
  return spec.center.map((d, a) => {
    const k = (2 * (d - origin[a])) / step;
    if (
      !Number.isFinite(k) ||
      (spec.axes[a] && Math.abs(k - Math.round(k)) > 1e-7)
    )
      throw Error("对称中心须对齐体素半格平面，可点击吸附");
    return Math.round(k);
  });
}
export function mirrorCell(
  p: readonly number[],
  spec: SymmetrySpec,
  origin: readonly number[],
  step: number,
): [number, number, number][] {
  const k = symmetryK(spec, origin, step);
  return [
    ...new Map(
      symmetryMasks(spec).map((mask) => {
        const q = p.map((v, a) => (mask & (1 << a) ? k[a] - v - 1 : v)) as [
          number,
          number,
          number,
        ];
        return [q.join(","), q] as const;
      }),
    ).values(),
  ];
}
export function mirrorPixel(
  p: SurfacePixel,
  spec: SymmetrySpec,
  origin: readonly number[],
  step: number,
): SurfacePixel[] {
  const n = step * 64,
    k = symmetryK(spec, origin, step),
    a = Math.floor(p.face / 2),
    t = [0, 1, 2].filter((i) => i !== a),
    out = new Map<string, SurfacePixel>();
  for (const mask of symmetryMasks(spec)) {
    const c = [p.x, p.y, p.z].map((v, i) =>
        mask & (1 << i) ? k[i] - v - 1 : v,
      ),
      face = mask & (1 << a) ? p.face ^ 1 : p.face,
      u = mask & (1 << t[0]) ? n - 1 - p.u : p.u,
      v = mask & (1 << t[1]) ? n - 1 - p.v : p.v,
      key = c.join(",") + "," + face,
      index = v * n + u;
    out.set(key + ":" + index, {
      key,
      index,
      x: c[0],
      y: c[1],
      z: c[2],
      face,
      u,
      v,
    });
  }
  return [...out.values()];
}
