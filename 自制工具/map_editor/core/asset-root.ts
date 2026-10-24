import type { AssetDocument, Vec3 } from "./workshop-documents.ts";
import { CANVAS_TICK } from "./workshop-canvases.ts";
export type RootFace = "bottom" | "top" | "front" | "back" | "left" | "right";
export type RootSnap = "free" | "vertex" | "center";
export type RootBounds = { min: readonly number[]; max: readonly number[] };
export const rootFaceAxes: Record<
  RootFace,
  { fixed: number; side: 0 | 1; u: number; v: number }
> = {
  bottom: { fixed: 2, side: 0, u: 0, v: 1 },
  top: { fixed: 2, side: 1, u: 0, v: 1 },
  front: { fixed: 1, side: 0, u: 0, v: 2 },
  back: { fixed: 1, side: 1, u: 0, v: 2 },
  left: { fixed: 0, side: 0, u: 1, v: 2 },
  right: { fixed: 0, side: 1, u: 1, v: 2 },
};
/** Asset space, in meters: hidden and locked geometry still contributes to the asset extent. */
export function assetRootBounds(asset: AssetDocument): RootBounds | null {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const canvases = asset.canvases ?? [
    { cells: asset.cells, voxelStepM: asset.voxelSize, originTicks: [0, 0, 0] },
  ];
  for (const c of canvases)
    for (const cell of c.cells) {
      const p = [cell.x, cell.y, cell.z];
      for (let i = 0; i < 3; i++) {
        const lo = c.originTicks[i] * CANVAS_TICK + p[i] * c.voxelStepM;
        min[i] = Math.min(min[i], lo);
        max[i] = Math.max(max[i], lo + c.voxelStepM);
      }
    }
  return Number.isFinite(min[0]) ? { min, max } : null;
}
export function rootFacePoint(
  bounds: RootBounds,
  face: RootFace,
  u = 0.5,
  v = 0.5,
): Vec3 {
  const axes = rootFaceAxes[face],
    p = bounds.min.map((n, i) => (n + bounds.max[i]) / 2) as Vec3;
  p[axes.fixed] = (axes.side ? bounds.max : bounds.min)[axes.fixed];
  for (const [axis, t] of [
    [axes.u, u],
    [axes.v, v],
  ])
    p[axis] =
      bounds.min[axis] +
      (bounds.max[axis] - bounds.min[axis]) * Math.max(0, Math.min(1, t));
  return p;
}
export function snapRootPoint(
  point: readonly number[],
  snap: RootSnap,
  step: number,
  origin: readonly number[],
  face?: RootFace,
  bounds?: RootBounds,
): Vec3 {
  const fixed = face ? rootFaceAxes[face].fixed : -1;
  return point.map((n, i) => {
    if (i === fixed)
      return bounds
        ? (rootFaceAxes[face!].side ? bounds.max : bounds.min)[i]
        : n;
    let value = n;
    if (snap !== "free") {
      const phase = origin[i] + (snap === "center" ? step / 2 : 0);
      value = Math.round((n - phase) / step) * step + phase;
    }
    return bounds
      ? Math.max(bounds.min[i], Math.min(bounds.max[i], value))
      : value;
  }) as Vec3;
}
/** Render model coordinates use .25 units per local voxel, independently of canvas precision. */
export function canvasPointMeters(
  point: readonly number[],
  step: number,
  originTicks: readonly number[],
): Vec3 {
  return point.map(
    (n, i) => (n * step) / 0.25 + originTicks[i] * CANVAS_TICK,
  ) as Vec3;
}
export function rootModeForPoint(
  asset: AssetDocument,
  point: Vec3,
): "grid" | "free" {
  const step = asset.canvases ? CANVAS_TICK : 0.25;
  return point.every((n) => Number.isInteger(n / step)) ? "grid" : "free";
}
