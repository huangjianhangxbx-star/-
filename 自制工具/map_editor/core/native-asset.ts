import { createMap, validateMap } from "./document.ts";
import { paletteFromMap, validatePalette } from "./palette.ts";
export type Bounds = { min: number[]; max: number[] };
export function createNativeAsset(
  doc: any,
  bounds: Bounds,
  options: any = {},
): any {
  validateMap(doc);
  if (
    !bounds ||
    [bounds.min, bounds.max].some(
      (v) =>
        !Array.isArray(v) ||
        v.length !== 3 ||
        v.some((n) => !Number.isSafeInteger(n)),
    ) ||
    bounds.min.some((v, i) => v > bounds.max[i])
  )
    throw Error("Invalid selection bounds");
  const cells = doc.cells.filter((c: any) =>
    [c.x, c.y, c.z].every((v, i) => v >= bounds.min[i] && v <= bounds.max[i]),
  );
  if (!cells.length) throw Error("Empty voxel selection");
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const c of cells) {
    const p = [c.x, c.y, c.z];
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  }
  const anchor =
    options.anchor === "origin"
      ? [0, 0, 0]
      : Array.isArray(options.anchor)
        ? options.anchor
        : [
            ((max[0] - min[0] + 1) * doc.voxelSize) / 2,
            ((max[1] - min[1] + 1) * doc.voxelSize) / 2,
            0,
          ];
  const asset = {
    schema: "xinghai-native-asset-1",
    kind: "native_voxel",
    assetId: options.assetId ?? crypto.randomUUID(),
    name: options.name ?? "体素资产",
    revision: 1,
    voxelSize: doc.voxelSize,
    anchor,
    sourceOrigin: min.map((v) => v * doc.voxelSize),
    palette: structuredClone(doc.palette),
    materialProfile: paletteFromMap(doc),
    sideColor: doc.sideColor,
    cells: cells.map((c: any) => ({
      x: c.x - min[0],
      y: c.y - min[1],
      z: c.z - min[2],
      color: c.color,
      owner: c.owner ?? "volume",
    })),
  };
  return validateNativeAsset(asset);
}
export function validateNativeAsset(a: any): any {
  if (
    !a ||
    a.schema !== "xinghai-native-asset-1" ||
    a.kind !== "native_voxel" ||
    typeof a.assetId !== "string" ||
    !/^[A-Za-z0-9_.-]{1,80}$/.test(a.assetId) ||
    !Number.isSafeInteger(a.revision) ||
    a.revision < 1 ||
    typeof a.name !== "string" ||
    a.name.length > 200 ||
    !Array.isArray(a.anchor) ||
    a.anchor.length !== 3 ||
    a.anchor.some((n: any) => !Number.isFinite(n) || Math.abs(n) > 2048) ||
    !Array.isArray(a.cells) ||
    !a.cells.length
  )
    throw Error("Invalid native asset");
  validatePalette(a.materialProfile);
  validateMap({
    ...createMap(),
    mapId: "asset",
    voxelSize: a.voxelSize,
    cells: a.cells,
    palette: a.palette,
    sideColor: a.sideColor,
  });
  if (
    a.materialProfile.gridStep !== a.voxelSize ||
    a.materialProfile.colors.length !== a.palette.length
  )
    throw Error("Asset palette mismatch");
  return structuredClone(a);
}
export function assetToMap(asset: any): any {
  const a = validateNativeAsset(asset);
  return {
    ...createMap(),
    cells: a.cells,
    palette: a.palette,
    sideColor: a.sideColor,
    materialProfile: a.materialProfile,
  };
}
export function updateNativeAsset(
  previous: any,
  doc: any,
  bounds: Bounds,
  options: any = {},
): any {
  const a = validateNativeAsset(previous);
  const next = createNativeAsset(doc, bounds, {
    ...options,
    assetId: a.assetId,
    name: options.name ?? a.name,
    anchor: options.anchor ?? a.anchor,
  });
  // Updates consume the local document returned by assetToMap. Keep that frame
  // even when the lowest voxel was removed or new cells extend below zero.
  const shift = next.sourceOrigin.map((v: number) => v / next.voxelSize);
  next.cells = next.cells.map((c: any) => ({
    ...c,
    x: c.x + shift[0],
    y: c.y + shift[1],
    z: c.z + shift[2],
  }));
  next.sourceOrigin = structuredClone(a.sourceOrigin);
  next.revision = a.revision + 1;
  return next;
}
