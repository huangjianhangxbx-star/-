import { createMap, validateMap } from "./document.ts";
import {
  paletteFromMap,
  validatePalette,
  type MaterialColor,
} from "./palette.ts";
import {
  validateEditorMetadata,
  pngDimensions,
  MAX_REFERENCE_BYTES,
  type EditorMetadata,
} from "./references.ts";
import { isVoxelAligned } from "./coordinates.ts";

export type Vec3 = [number, number, number];
export type Cell = {
  x: number;
  y: number;
  z: number;
  color: number;
  owner?: "height" | "volume";
};
export type MaterialProfile = {
  schema: "xinghai-palette-1";
  profileId: string;
  profileRevision: number;
  paletteId: string;
  paletteRevision: number;
  unit: "meters";
  axes: "RH_Z_UP";
  gridStep: 0.25;
  colors: MaterialColor[];
};
export type AssetDocument = {
  schema: "xinghai-workshop-asset-1";
  assetId: string;
  revision: number;
  name: string;
  voxelSize: 0.25;
  cells: Cell[];
  palette: string[];
  sideColor?: number;
  materialProfile: MaterialProfile;
  protectedColumns: string[];
  editor?: EditorMetadata;
  anchorM: Vec3;
  rootMode: "grid" | "legacy";
  provenance?: { assetId: string; revision: number };
  legacyNative?: { sourceOriginM: Vec3 };
};
export type SceneAsset =
  | { kind: "voxel"; assetId: string; source: string }
  | {
      kind: "external";
      assetId: string;
      revision: number;
      model: string;
      files: string[];
      anchorM: Vec3;
      recipe: "glb-rh-y-up" | "blender-fbx-5.1.2";
    }
  | { kind: "texture"; assetId: string; revision: number; image: string };
export type SceneInstance = {
  instanceId: string;
  assetId: string;
  positionM: Vec3;
  rotationDeg: number;
  groupId: string;
};
export type SceneDocument = {
  schema: "xinghai-workshop-scene-1";
  sceneId: string;
  revision: number;
  name: string;
  voxelSize: 0.25;
  assets: SceneAsset[];
  instances: SceneInstance[];
  groups: { groupId: string; name: string; visible: boolean }[];
  decals: {
    decalId: string;
    assetId: string;
    positionM: Vec3;
    rotationDeg: number;
    widthM: number;
    heightM: number;
  }[];
};
export type ProjectDocument = {
  schema: "xinghai-workshop-project-1";
  projectId: string;
  revision: number;
  name: string;
  scenes: { sceneId: string; name: string; source: string }[];
};
export type SnapshotFile = { path: string; bytes: Uint8Array; sha256: string };
export type ResolvedAsset =
  | { kind: "voxel"; document: AssetDocument }
  | {
      kind: "external";
      revision: number;
      anchorM: Vec3;
      recipe: "glb-rh-y-up" | "blender-fbx-5.1.2";
      glb: Uint8Array;
      files: SnapshotFile[];
    }
  | { kind: "texture"; revision: number; png: Uint8Array };
export type SceneAssets = ReadonlyMap<string, ResolvedAsset>;
export type Issue = { code: string; documentId: string; message: string };

function record(
  value: unknown,
  label: string,
): asserts value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(`${label}必须是对象`);
}
function fields(
  value: Record<string, any>,
  allowed: string[],
  label: string,
): void {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw Error(`${label}不支持字段 ${key}`);
}
function identity(value: unknown, label: string, legacy = false): void {
  if (
    typeof value !== "string" ||
    !(legacy ? /^[A-Za-z0-9_.-]{1,80}$/ : /^[A-Za-z0-9_-]{1,80}$/).test(
      value,
    ) ||
    value === "." ||
    value === ".."
  )
    throw Error(`${label}身份无效`);
}
function revision(value: unknown, label: string): void {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 2147483647
  )
    throw Error(`${label}修订号无效`);
}
function name(value: unknown, label: string): void {
  if (typeof value !== "string" || value.length > 200)
    throw Error(`${label}名称无效`);
}
function position(value: unknown, label: string): void {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((n) => !Number.isFinite(n) || Math.abs(n) > 2048)
  )
    throw Error(`${label}必须是范围内三个米坐标`);
}
function rotation(value: unknown): void {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) % 90 !== 0 ||
    Math.abs(value as number) > 360000
  )
    throw Error("旋转必须是90度整数倍");
}
function list(
  value: unknown,
  label: string,
  max = 10000,
): asserts value is any[] {
  if (!Array.isArray(value) || value.length > max)
    throw Error(`${label}列表或预算无效`);
}
function relativePath(value: unknown, prefix: string, label: string): void {
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    !value.startsWith(prefix + "/") ||
    /[\\:\x00-\x1f<>"|?*]/.test(value) ||
    value
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          /[. ]$/.test(part) ||
          /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part),
      )
  )
    throw Error(`${label}必须是本地范围内的规范相对路径`);
}
function unique(set: Set<string>, id: string, label: string): void {
  if (set.has(id)) throw Error(`${label}身份重复 ${id}`);
  set.add(id);
}
export function pngBytes(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_REFERENCE_BYTES)
    throw Error("PNG负载无效或超限");
  const pieces: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768)
    pieces.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  pngDimensions("data:image/png;base64," + btoa(pieces.join("")));
}
export function staticGlb(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array) || bytes.length < 28)
    throw Error("外部GLB负载无效");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    length = view.getUint32(12, true);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.length ||
    view.getUint32(16, true) !== 0x4e4f534a ||
    length % 4 ||
    length + 28 > bytes.length ||
    view.getUint32(length + 24, true) !== 0x004e4942 ||
    length + 28 + view.getUint32(length + 20, true) !== bytes.length
  )
    throw Error("外部GLB容器无效");
  const json = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + length)),
  );
  if (
    json.asset?.version !== "2.0" ||
    json.skins?.length ||
    json.animations?.length ||
    json.buffers?.length !== 1 ||
    json.buffers[0].uri ||
    json.buffers[0].byteLength > view.getUint32(length + 20, true) ||
    (json.images ?? []).some(
      (im: any) => im.uri && !im.uri.startsWith("data:"),
    ) ||
    (json.extensionsUsed ?? []).some(
      (ext: string) =>
        ![
          "KHR_materials_emissive_strength",
          "KHR_materials_unlit",
          "KHR_texture_transform",
        ].includes(ext),
    )
  )
    throw Error("外部资产必须是静态自包含GLB");
}

export function createAsset(assetId: string): AssetDocument {
  const map = createMap();
  map.mapId = assetId;
  return validateAsset({
    schema: "xinghai-workshop-asset-1",
    assetId,
    revision: 0,
    name: "",
    voxelSize: 0.25,
    cells: [],
    palette: map.palette,
    materialProfile: paletteFromMap(map),
    protectedColumns: [],
    anchorM: [0, 0, 0],
    rootMode: "grid",
  });
}
export function createScene(sceneId: string): SceneDocument {
  return validateScene({
    schema: "xinghai-workshop-scene-1",
    sceneId,
    revision: 0,
    name: "",
    voxelSize: 0.25,
    assets: [],
    instances: [],
    decals: [],
    groups: [
      { groupId: "base", name: "BASE", visible: true },
      { groupId: "platform", name: "PLATFORM", visible: true },
      { groupId: "large-env", name: "LARGE ENV", visible: true },
      { groupId: "small-env", name: "SMALL ENV", visible: true },
    ],
  });
}
export function createProject(projectId: string): ProjectDocument {
  return validateProject({
    schema: "xinghai-workshop-project-1",
    projectId,
    revision: 0,
    name: "",
    scenes: [],
  });
}
export function validateAsset(input: unknown): AssetDocument {
  record(input, "模块");
  fields(
    input,
    [
      "schema",
      "assetId",
      "revision",
      "name",
      "voxelSize",
      "cells",
      "palette",
      "sideColor",
      "materialProfile",
      "protectedColumns",
      "editor",
      "anchorM",
      "rootMode",
      "provenance",
      "legacyNative",
    ],
    "模块",
  );
  if (
    input.schema !== "xinghai-workshop-asset-1" ||
    !["grid", "legacy"].includes(input.rootMode)
  )
    throw Error("模块格式或Root模式无效");
  identity(input.assetId, "模块", input.rootMode === "legacy");
  revision(input.revision, "模块");
  name(input.name, "模块");
  position(input.anchorM, "Root");
  if (
    input.rootMode === "grid" &&
    input.anchorM.some((n: number) => !Number.isInteger(n / 0.25))
  )
    throw Error("新模块Root必须在体素格点");
  list(input.protectedColumns, "保护列", 250000);
  for (const p of input.protectedColumns)
    if (
      typeof p !== "string" ||
      !/^-?\d+,-?\d+$/.test(p) ||
      p
        .split(",")
        .some(
          (n) => !Number.isSafeInteger(Number(n)) || Math.abs(Number(n)) > 8192,
        )
    )
      throw Error("保护列无效");
  if (input.provenance !== undefined) {
    record(input.provenance, "来源");
    fields(input.provenance, ["assetId", "revision"], "来源");
    identity(input.provenance.assetId, "来源", true);
    revision(input.provenance.revision, "来源");
  }
  if (input.legacyNative !== undefined) {
    record(input.legacyNative, "旧局部帧");
    fields(input.legacyNative, ["sourceOriginM"], "旧局部帧");
    position(input.legacyNative.sourceOriginM, "旧局部原点");
  }
  // Reuse cell/reference rules, but never the Legacy placement/support rules.
  validateMap({
    ...createMap(),
    mapId: "workshop-validation",
    revision: input.revision,
    voxelSize: input.voxelSize,
    cells: input.cells,
    palette: input.palette,
    sideColor: input.sideColor,
    protectedColumns: input.protectedColumns,
    editor: input.editor,
  });
  validateEditorMetadata(input.editor);
  const profile = validatePalette(input.materialProfile);
  if (
    profile.gridStep !== 0.25 ||
    profile.colors.length !== input.palette.length
  )
    throw Error("模块材质色板不匹配");
  for (let i = 0; i < input.palette.length; i++) {
    const rgb = [1, 3, 5].map(
      (at) => parseInt(input.palette[i].slice(at, at + 2), 16) / 255,
    );
    if (
      rgb.some(
        (v, c) => Math.abs(v - profile.colors[i].baseColor_sRGB[c]) > 1e-8,
      )
    )
      throw Error("模块颜色与材质快照不匹配");
  }
  return structuredClone(input) as AssetDocument;
}
export function validateScene(input: unknown): SceneDocument {
  record(input, "场景");
  fields(
    input,
    [
      "schema",
      "sceneId",
      "revision",
      "name",
      "voxelSize",
      "assets",
      "instances",
      "groups",
      "decals",
    ],
    "场景",
  );
  if (input.schema !== "xinghai-workshop-scene-1" || input.voxelSize !== 0.25)
    throw Error("场景格式或体素规格无效");
  identity(input.sceneId, "场景");
  revision(input.revision, "场景");
  name(input.name, "场景");
  list(input.assets, "资产");
  list(input.groups, "分组");
  list(input.instances, "实例");
  list(input.decals, "贴花");
  const groups = new Set<string>(),
    assets = new Set<string>(),
    instances = new Set<string>();
  for (const g of input.groups) {
    record(g, "分组");
    fields(g, ["groupId", "name", "visible"], "分组");
    identity(g.groupId, "分组");
    name(g.name, "分组");
    if (typeof g.visible !== "boolean") throw Error("分组显隐无效");
    unique(groups, g.groupId, "分组");
  }
  for (const a of input.assets) {
    record(a, "场景资产");
    identity(a.assetId, "场景资产", true);
    unique(assets, a.assetId, "资产");
    if (a.kind === "voxel") {
      fields(a, ["kind", "assetId", "source"], "体素登记");
      relativePath(a.source, "assets", "模块源");
    } else if (a.kind === "external") {
      fields(
        a,
        ["kind", "assetId", "revision", "model", "files", "anchorM", "recipe"],
        "外部登记",
      );
      revision(a.revision, "外部资产");
      position(a.anchorM, "外部Root");
      relativePath(a.model, `external/${a.assetId}`, "外部模型");
      list(a.files, "外部文件");
      if (
        !a.files.includes(a.model) ||
        new Set(a.files).size !== a.files.length
      )
        throw Error("外部文件组缺模型或重复");
      for (const file of a.files)
        relativePath(file, `external/${a.assetId}`, "外部依赖");
      if (!["glb-rh-y-up", "blender-fbx-5.1.2"].includes(a.recipe))
        throw Error("外部轴配方无效");
    } else if (a.kind === "texture") {
      fields(a, ["kind", "assetId", "revision", "image"], "图片登记");
      revision(a.revision, "图片");
      relativePath(a.image, "textures", "图片");
    } else throw Error("场景资产类型无效");
  }
  for (const p of input.instances) {
    record(p, "实例");
    fields(
      p,
      ["instanceId", "assetId", "positionM", "rotationDeg", "groupId"],
      "实例",
    );
    identity(p.instanceId, "实例");
    identity(p.assetId, "实例资产", true);
    unique(instances, p.instanceId, "实例/贴花");
    position(p.positionM, "实例位置");
    rotation(p.rotationDeg);
    if (!groups.has(p.groupId)) throw Error("实例引用未知分组");
  }
  for (const d of input.decals) {
    record(d, "贴花");
    fields(
      d,
      ["decalId", "assetId", "positionM", "rotationDeg", "widthM", "heightM"],
      "贴花",
    );
    identity(d.decalId, "贴花");
    identity(d.assetId, "贴花资产", true);
    unique(instances, d.decalId, "实例/贴花");
    position(d.positionM, "贴花位置");
    rotation(d.rotationDeg);
    if (
      [d.widthM, d.heightM].some(
        (n) => !Number.isFinite(n) || n <= 0 || n > 256,
      )
    )
      throw Error("贴花尺寸无效");
  }
  return structuredClone(input) as SceneDocument;
}
export function validateProject(input: unknown): ProjectDocument {
  record(input, "项目");
  fields(input, ["schema", "projectId", "revision", "name", "scenes"], "项目");
  if (input.schema !== "xinghai-workshop-project-1")
    throw Error("项目格式无效");
  identity(input.projectId, "项目");
  revision(input.revision, "项目");
  name(input.name, "项目");
  list(input.scenes, "场景");
  const ids = new Set<string>();
  for (const s of input.scenes) {
    record(s, "场景入口");
    fields(s, ["sceneId", "name", "source"], "场景入口");
    identity(s.sceneId, "场景入口");
    unique(ids, s.sceneId, "场景入口");
    name(s.name, "场景入口");
    relativePath(s.source, `scenes/${s.sceneId}`, "场景入口");
  }
  return structuredClone(input) as ProjectDocument;
}
export function checkSceneReferences(
  input: SceneDocument,
  assets: SceneAssets,
): Issue[] {
  const scene = validateScene(input),
    issues: Issue[] = [],
    registry = new Map(scene.assets.map((a) => [a.assetId, a]));
  const issue = (code: string, id: string, message: string) =>
    issues.push({
      code,
      documentId: scene.sceneId,
      message: `${id}: ${message}`,
    });
  for (const row of scene.assets) {
    const resolved = assets.get(row.assetId);
    if (!resolved) {
      issue("missing-asset", row.assetId, "缺少本地资产负载");
      continue;
    }
    if (resolved.kind !== row.kind) {
      issue("kind-mismatch", row.assetId, "资产类型与登记不一致");
      continue;
    }
    if (resolved.kind === "voxel") {
      if (resolved.document.assetId !== row.assetId)
        issue("identity-mismatch", row.assetId, "源身份与登记不一致");
      try {
        validateAsset(resolved.document);
      } catch (error) {
        issue("invalid-asset", row.assetId, (error as Error).message);
      }
    } else if (row.kind !== "voxel") {
      if (resolved.revision !== row.revision)
        issue("revision-mismatch", row.assetId, "负载修订与登记不一致");
      try {
        revision(resolved.revision, "负载");
        if (resolved.kind === "texture") pngBytes(resolved.png);
        else if (row.kind === "external") {
          position(resolved.anchorM, "外部Root");
          staticGlb(resolved.glb);
          if (
            resolved.recipe !== row.recipe ||
            resolved.anchorM.some((n, i) => n !== row.anchorM[i])
          )
            issue(
              "binding-mismatch",
              row.assetId,
              "负载Root或配方与登记不一致",
            );
          if (
            !Array.isArray(resolved.files) ||
            row.files.some(
              (file) => !resolved.files.some((f) => f.path === file),
            )
          )
            issue("missing-file", row.assetId, "缺少外部文件组依赖");
        }
      } catch (error) {
        issue("invalid-asset", row.assetId, (error as Error).message);
      }
    }
  }
  for (const p of scene.instances) {
    const row = registry.get(p.assetId),
      resolved = assets.get(p.assetId);
    if (!row) issue("missing-registration", p.instanceId, "资产未在场景登记");
    else if (row.kind === "texture")
      issue("kind-mismatch", p.instanceId, "图片不能作为模型实例");
    else if (resolved?.kind === "voxel") {
      try {
        if (
          !isVoxelAligned(resolved.document.anchorM, p.positionM, p.rotationDeg)
        )
          issue("voxel-misaligned", p.instanceId, "体素几何不对齐");
      } catch {
        /* Malformed sources were reported above. */
      }
    }
  }
  for (const d of scene.decals) {
    const row = registry.get(d.assetId);
    if (!row) issue("missing-registration", d.decalId, "图片未在场景登记");
    else if (row.kind !== "texture")
      issue("kind-mismatch", d.decalId, "贴花必须引用图片");
  }
  return issues;
}
