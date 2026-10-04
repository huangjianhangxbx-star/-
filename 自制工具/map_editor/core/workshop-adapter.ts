import { createMap, validateMap } from "./document.ts";
import { validateNativeAsset } from "./native-asset.ts";
import { paletteFromMap } from "./palette.ts";
import {
  validateAsset,
  type AssetDocument,
  type Cell,
  type MaterialProfile,
  type Vec3,
} from "./workshop-documents.ts";
import type { EditorMetadata } from "./references.ts";

export type NativeAssetV1 = {
  schema: "xinghai-native-asset-1";
  kind: "native_voxel";
  assetId: string;
  revision: number;
  name: string;
  voxelSize: 0.25;
  anchor: Vec3;
  sourceOrigin: Vec3;
  palette: string[];
  materialProfile: MaterialProfile;
  sideColor?: number;
  cells: Cell[];
};
export type EditingMap = {
  version: 1;
  mapId: string;
  revision: number;
  voxelSize: 0.25;
  cells: Cell[];
  palette: string[];
  sideColor?: number;
  materialProfile: MaterialProfile;
  protectedColumns: string[];
  editor?: EditorMetadata;
  instances: unknown[];
  surfaces: unknown[];
  decals: unknown[];
};

export function fromNativeV1(input: unknown): AssetDocument {
  const native = validateNativeAsset(input);
  const known = [
    "schema",
    "kind",
    "assetId",
    "revision",
    "name",
    "voxelSize",
    "anchor",
    "sourceOrigin",
    "palette",
    "materialProfile",
    "sideColor",
    "cells",
  ];
  if (Object.keys(native).some((key) => !known.includes(key)))
    throw Error("原生源含未支持字段，请通过Legacy入口处理，不能静默丢弃");
  return validateAsset({
    schema: "xinghai-workshop-asset-1",
    assetId: native.assetId,
    revision: native.revision,
    name: native.name,
    voxelSize: native.voxelSize,
    cells: native.cells,
    palette: native.palette,
    ...(native.sideColor !== undefined ? { sideColor: native.sideColor } : {}),
    materialProfile: native.materialProfile,
    protectedColumns: [],
    anchorM: native.anchor,
    rootMode: "legacy",
    legacyNative: { sourceOriginM: native.sourceOrigin },
  });
}
export function toNativeV1(input: AssetDocument): NativeAssetV1 {
  const asset = validateAsset(input);
  return validateNativeAsset({
    schema: "xinghai-native-asset-1",
    kind: "native_voxel",
    assetId: asset.assetId,
    name: asset.name,
    revision: Math.max(1, asset.revision),
    voxelSize: asset.voxelSize,
    anchor: asset.anchorM,
    sourceOrigin: asset.legacyNative?.sourceOriginM ?? [0, 0, 0],
    cells: asset.cells,
    palette: asset.palette,
    ...(asset.sideColor !== undefined ? { sideColor: asset.sideColor } : {}),
    materialProfile: asset.materialProfile,
  });
}
export function toEditingMap(input: AssetDocument): EditingMap {
  const asset = validateAsset(input);
  // Synthetic mapId satisfies the Legacy reader even for old native IDs with dots.
  // Material identity is carried explicitly; it never derives from this temporary ID.
  return validateMap({
    ...createMap(),
    mapId: "workshop-edit",
    revision: asset.revision,
    voxelSize: asset.voxelSize,
    cells: asset.cells,
    palette: asset.palette,
    materialProfile: asset.materialProfile,
    protectedColumns: asset.protectedColumns,
    ...(asset.sideColor !== undefined ? { sideColor: asset.sideColor } : {}),
    ...(asset.editor !== undefined ? { editor: asset.editor } : {}),
  });
}
export function fromEditingMap(
  original: AssetDocument,
  input: unknown,
): AssetDocument {
  const asset = validateAsset(original),
    edited = validateMap(input);
  if (edited.instances.length || edited.surfaces.length || edited.decals.length)
    throw Error("模块编辑桥接不接受Gameplay、实例或贴花；请使用旧地图迁移入口");
  const candidate = {
    ...asset,
    cells: edited.cells,
    palette: edited.palette,
    protectedColumns: edited.protectedColumns,
    materialProfile: paletteFromMap({
      ...edited,
      materialProfile: asset.materialProfile,
    }),
  } as AssetDocument;
  if (edited.sideColor === undefined) delete candidate.sideColor;
  else candidate.sideColor = edited.sideColor;
  if (edited.editor === undefined) delete candidate.editor;
  else candidate.editor = edited.editor;
  const next = validateAsset(candidate);
  if (
    JSON.stringify(next) !== JSON.stringify(asset) ||
    edited.revision > asset.revision
  ) {
    if (asset.revision === 2147483647) throw Error("资产修订号溢出");
    next.revision = Math.max(asset.revision + 1, edited.revision);
  }
  return next;
}
