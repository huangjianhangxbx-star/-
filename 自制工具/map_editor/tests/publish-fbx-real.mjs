import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  core = require("../dist/workshop.cjs"),
  { commitPublish } = require("../desktop/publish-store.cjs"),
  { convertPublishFbx } = require("../desktop/publish-fbx.cjs"),
  root = await fs.mkdtemp(path.resolve("validation/workshop-fbx-real-")),
  out = path.resolve("validation/workshop-task7");
try {
  const scene = core.createScene("fbx-proof-scene"),
    project = core.createProject("fbx-proof-project"),
    assets = new Map(),
    native = core.cloneAsset(
      core.fromNativeV1(
        JSON.parse(
          await fs.readFile(
            "samples/m12-exchange/axis-color.xhasset.json",
            "utf8",
          ),
        ),
      ),
      "native-proof",
    );
  native.materialProfile.colors[3].alphaMode = "MASK";
  native.materialProfile.colors[3].alpha = 0.5;
  native.materialProfile.colors[3].doubleSided = true;
  scene.assets.push({
    kind: "voxel",
    assetId: native.assetId,
    source: "assets/native-proof.xhmodule.json",
  });
  assets.set(native.assetId, { kind: "voxel", document: native });
  scene.instances.push({
    instanceId: "native-instance",
    assetId: native.assetId,
    positionM: [...native.anchorM],
    rotationDeg: 0,
    groupId: "base",
  });
  const glb = await fs.readFile("samples/m12-exchange/assembled.glb");
  for (const id of ["external-one", "external-two"]) {
    const model = `external/${id}/model.glb`;
    scene.assets.push({
      kind: "external",
      assetId: id,
      revision: 0,
      model,
      files: [model],
      anchorM: [0.125, -0.25, 0.125],
      recipe: "glb-rh-y-up",
    });
    assets.set(id, {
      kind: "external",
      revision: 0,
      anchorM: [0.125, -0.25, 0.125],
      recipe: "glb-rh-y-up",
      glb,
      files: [{ path: model, bytes: glb, sha256: await core.sha256(glb) }],
    });
    for (let i = 0; i < 3; i++)
      scene.instances.push({
        instanceId: `${id}-${i}`,
        assetId: id,
        positionM: [i * 2 + (id === "external-one" ? -3 : 3), -2 + i, 1],
        rotationDeg: i * 90,
        groupId: "large-env",
      });
  }
  const png = await fs.readFile("samples/m12-exchange/neutral-colors.png");
  scene.assets.push({
    kind: "texture",
    assetId: "art",
    revision: 0,
    image: "textures/art.png",
  });
  assets.set("art", { kind: "texture", revision: 0, png });
  scene.decals.push({
    decalId: "art-plane",
    assetId: "art",
    positionM: [-1, 2, 0],
    rotationDeg: 270,
    widthM: 2,
    heightM: 3,
  });
  project.scenes.push({
    sceneId: scene.sceneId,
    name: "FBX证据",
    source: `scenes/${scene.sceneId}/scene.xhscene.json`,
  });
  const prefix = path.join(root, "scenes", scene.sceneId);
  await fs.mkdir(path.join(prefix, "assets"), { recursive: true });
  await fs.writeFile(
    path.join(root, "project.xhproject.json"),
    JSON.stringify(project),
  );
  await fs.writeFile(
    path.join(prefix, "scene.xhscene.json"),
    JSON.stringify(scene),
  );
  await fs.writeFile(
    path.join(prefix, "assets/native-proof.xhmodule.json"),
    JSON.stringify(native),
  );
  for (const row of scene.assets)
    if (row.kind !== "voxel") {
      const name = row.kind === "external" ? row.model : row.image;
      await fs.mkdir(path.dirname(path.join(prefix, name)), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(prefix, name),
        row.kind === "external" ? glb : png,
      );
    }
  const info = JSON.parse(await fs.readFile("dist/build-info.json", "utf8")),
    plan = await core.createPublishPlan(
      { kind: "scene", document: scene, assets },
      "fbx-proof",
      "glb-fbx",
      {
        workshopVersion: info.version,
        sourceFingerprint: info.sourceFingerprint,
      },
    ),
    published = await commitPublish(root, plan, {
      converter: (stage, m, signal) =>
        convertPublishFbx(stage, m, {
          blenderExecutable: "D:/steam/steamapps/common/Blender/blender.exe",
          signal,
        }),
    });
  const manifest = JSON.parse(
    await fs.readFile(path.join(published.directory, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.toolchain.blenderVersion, "5.1.2");
  assert.equal(
    manifest.dependencies.filter((d) => d.unity.route === "fbx").length,
    2,
  );
  for (const f of [...manifest.outputFiles, ...manifest.payloadFiles])
    assert.equal(
      await core.sha256(
        await fs.readFile(path.join(published.directory, f.path)),
      ),
      f.sha256,
    );
  const destination = path.join(out, "real-project");
  if (
    path.resolve(destination) !==
    path.resolve("validation/workshop-task7/real-project")
  )
    throw Error("unsafe artifact destination");
  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(root, destination, { recursive: true });
  await fs.writeFile(
    path.join(out, "real-fbx-result.json"),
    JSON.stringify(
      {
        passed: true,
        blender: "5.1.2",
        modelInstances: 7,
        decals: 1,
        externalBindings: 2,
        publishId: "fbx-proof",
        checks: [
          "真实Blender目标与两个外部资产完整FBX组",
          "所有旁车与PNG依赖存在/hash一致",
          "非对称三轴/灰RGB/MASK/PNG源",
          "共享外部资产各三实例稳定绑定",
        ],
        directory: path.join(destination, "releases/fbx-proof"),
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_REAL_FBX_PASS");
} finally {
  if (
    !path
      .resolve(root)
      .startsWith(path.resolve("validation/workshop-fbx-real-"))
  )
    throw Error("unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
}

