import {
  validateAsset,
  validateScene,
  checkSceneReferences,
  type AssetDocument,
  type SceneDocument,
  type SceneAssets,
  type SnapshotFile,
  type Vec3,
  type SceneInstance,
} from "./workshop-documents.ts";
import { exportAssetGlb, exportWorkshopSceneGlb } from "./workshop-glb.ts";
export type PublishTarget =
  | { kind: "asset"; document: AssetDocument }
  | { kind: "scene"; document: SceneDocument; assets: SceneAssets };
export type OutputFile = { path: string; sha256: string; byteLength: number };
export type UnityBinding =
  | { route: "native-cells"; runtimePath: string }
  | { route: "texture"; imagePath: string }
  | {
      route: "fbx";
      modelPath: string;
      materialsPath: string;
      texturePaths: string[];
      recipe: "blender-fbx-5.1.2";
    }
  | { route: "unsupported-glb" };
export type PublishDependency = {
  assetId: string;
  kind: "voxel" | "external" | "texture";
  sourceRevision: number;
  contentHash: string;
  sourcePath: string;
  anchorM?: Vec3;
  glbPath?: string;
  unity: UnityBinding;
};
export type RuntimeScene = {
  schema: "xinghai-workshop-runtime-scene-1";
  sceneId: string;
  revision: number;
  name: string;
  voxelSize: 0.25;
  bindings: { assetId: string; sourceRevision: number; contentHash: string }[];
  instances: SceneInstance[];
  groups: SceneDocument["groups"];
  decals: SceneDocument["decals"];
};
export type PublishManifest = {
  schema: "xinghai-workshop-publish-1";
  publishId: string;
  kind: "asset" | "scene";
  targetId: string;
  sourceRevision: number;
  unit: "meters";
  sourceAxes: "RH_Z_UP";
  voxelSize: 0.25;
  recipe: "glb-only" | "glb-fbx";
  runtimePath: string;
  dependencies: PublishDependency[];
  outputFiles: OutputFile[];
  payloadFiles: OutputFile[];
  toolchain: {
    workshopVersion: string;
    sourceFingerprint: string;
    blenderVersion?: string;
    fbxRecipe?: "blender-fbx-5.1.2";
  };
};
export type PublishPlan = {
  manifest: PublishManifest;
  files: SnapshotFile[];
  expectedInputs: { path: string; sha256: string }[];
};
export async function sha256(bytes: Uint8Array): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes as BufferSource),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
export function publishPath(file: string): void {
  if (
    typeof file !== "string" ||
    file.length > 1024 ||
    /[\\:\x00-\x1f<>"|?*]/.test(file) ||
    file
      .split("/")
      .some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          /[. ]$/.test(p) ||
          /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p),
      )
  )
    throw Error("发布路径无效或越界");
}
const jsonBytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
export async function createPublishPlan(
  input: PublishTarget,
  publishId: string,
  recipe: "glb-only" | "glb-fbx",
  toolchain: PublishManifest["toolchain"],
): Promise<PublishPlan> {
  // Capture every mutable source synchronously before hashing can yield.
  const target = structuredClone(input),
    chain = structuredClone(toolchain);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(publishId)) throw Error("发布身份无效");
  if (!["glb-only", "glb-fbx"].includes(recipe)) throw Error("发布配方无效");
  if (
    !chain ||
    typeof chain.workshopVersion !== "string" ||
    !chain.workshopVersion.length ||
    chain.workshopVersion.length > 200 ||
    !/^[a-f0-9]{64}$/.test(chain.sourceFingerprint)
  )
    throw Error("工具链指纹无效");
  const doc =
      target.kind === "asset"
        ? validateAsset(target.document)
        : validateScene(target.document),
    assets: SceneAssets =
      target.kind === "asset"
        ? new Map([
            [
              (doc as AssetDocument).assetId,
              { kind: "voxel" as const, document: doc as AssetDocument },
            ],
          ])
        : target.assets;
  if (target.kind === "scene") {
    const issues = checkSceneReferences(doc as SceneDocument, assets);
    if (issues.length) throw Error(issues.map((i) => i.message).join("\n"));
  }
  const files: SnapshotFile[] = [],
    payloadFiles: OutputFile[] = [],
    outputFiles: OutputFile[] = [],
    dependencies: PublishDependency[] = [];
  async function add(file: string, bytes: Uint8Array, output = false) {
    publishPath(file);
    if (files.some((f) => f.path.toLowerCase() === file.toLowerCase()))
      throw Error("发布文件路径重复");
    const copy = bytes.slice(),
      hash = await sha256(copy),
      entry = { path: file, sha256: hash, byteLength: copy.length };
    files.push({ path: file, bytes: copy, sha256: hash });
    (output ? outputFiles : payloadFiles).push(entry);
    return entry;
  }
  for (const [assetId, a] of assets) {
    const base = `payload/source/assets/${assetId}`,
      start = payloadFiles.length;
    let dependency: PublishDependency;
    if (a.kind === "voxel") {
      const source = validateAsset(a.document);
      if (source.assetId !== assetId) throw Error("冻结源身份与绑定不符");
      const sourcePath = base + ".xhmodule.json",
        runtimePath = `payload/runtime/assets/${assetId}.json`,
        glbPath = `output/assets/${assetId}/${assetId}.glb`;
      await add(sourcePath, jsonBytes(source));
      const { editor, ...runtime } = source;
      await add(runtimePath, jsonBytes(runtime));
      await add(glbPath, exportAssetGlb(source), true);
      dependency = {
        assetId,
        kind: "voxel",
        sourceRevision: source.revision,
        contentHash: "",
        sourcePath,
        anchorM: [...source.anchorM],
        glbPath,
        unity: { route: "native-cells", runtimePath },
      };
    } else if (a.kind === "texture") {
      const sourcePath = base + ".png";
      await add(sourcePath, a.png);
      dependency = {
        assetId,
        kind: "texture",
        sourceRevision: a.revision,
        contentHash: "",
        sourcePath,
        unity: { route: "texture", imagePath: sourcePath },
      };
    } else {
      const sourcePath = base + "/asset.json",
        glbPath = `output/assets/${assetId}/${assetId}.glb`;
      await add(
        sourcePath,
        jsonBytes({
          assetId,
          revision: a.revision,
          anchorM: a.anchorM,
          recipe: a.recipe,
          files: a.files.map((f) => f.path),
        }),
      );
      await add(base + "/model.glb", a.glb);
      for (const f of a.files) {
        publishPath(f.path);
        if ((await sha256(f.bytes)) !== f.sha256)
          throw Error("外部依赖hash损坏");
        await add(base + "/files/" + f.path, f.bytes);
      }
      await add(glbPath, a.glb, true);
      dependency = {
        assetId,
        kind: "external",
        sourceRevision: a.revision,
        contentHash: "",
        sourcePath,
        anchorM: [...a.anchorM],
        glbPath,
        unity: { route: "unsupported-glb" },
      };
    }
    const sources = payloadFiles
      .slice(start)
      .filter((f) => f.path.startsWith("payload/source/"))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    dependency.contentHash = await sha256(jsonBytes(sources));
    dependencies.push(dependency);
  }
  let runtimePath: string;
  if (target.kind === "asset")
    runtimePath =
      dependencies[0].unity.route === "native-cells"
        ? dependencies[0].unity.runtimePath
        : "";
  else {
    const scene = doc as SceneDocument;
    runtimePath = "payload/runtime/scene.json";
    const runtime: RuntimeScene = {
      schema: "xinghai-workshop-runtime-scene-1",
      sceneId: scene.sceneId,
      revision: scene.revision,
      name: scene.name,
      voxelSize: 0.25,
      bindings: dependencies.map((d) => ({
        assetId: d.assetId,
        sourceRevision: d.sourceRevision,
        contentHash: d.contentHash,
      })),
      instances: scene.instances,
      groups: scene.groups,
      decals: scene.decals,
    };
    await add("payload/source/scene.xhscene.json", jsonBytes(scene));
    await add(runtimePath, jsonBytes(runtime));
  }
  await add(
    "output/target.glb",
    target.kind === "asset"
      ? exportAssetGlb(doc as AssetDocument)
      : exportWorkshopSceneGlb(doc as SceneDocument, assets),
    true,
  );
  const manifest: PublishManifest = {
    schema: "xinghai-workshop-publish-1",
    publishId,
    kind: target.kind,
    targetId:
      target.kind === "asset"
        ? (doc as AssetDocument).assetId
        : (doc as SceneDocument).sceneId,
    sourceRevision: doc.revision,
    unit: "meters",
    sourceAxes: "RH_Z_UP",
    voxelSize: 0.25,
    recipe,
    runtimePath,
    dependencies,
    outputFiles,
    payloadFiles,
    toolchain: chain,
  };
  return { manifest, files, expectedInputs: [] };
}
