import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  core = require("../dist/workshop.cjs"),
  { commitPublish } = require("../desktop/publish-store.cjs"),
  { convertPublishFbx } = require("../desktop/publish-fbx.cjs");
const root = path.resolve("validation/workshop-task8/packages"),
  packageA = path.resolve(
    "validation/workshop-task7/real-project/releases/fbx-proof",
  );
await fs.mkdir(root, { recursive: true });
const manifest = JSON.parse(
    await fs.readFile(path.join(packageA, "manifest.json"), "utf8"),
  ),
  scene = JSON.parse(
    await fs.readFile(
      path.join(packageA, "payload/source/scene.xhscene.json"),
      "utf8",
    ),
  ),
  assets = new Map();
for (const dep of manifest.dependencies) {
  if (dep.kind === "voxel")
    assets.set(dep.assetId, {
      kind: "voxel",
      document: JSON.parse(
        await fs.readFile(path.join(packageA, dep.sourcePath), "utf8"),
      ),
    });
  else if (dep.kind === "texture")
    assets.set(dep.assetId, {
      kind: "texture",
      revision: dep.sourceRevision,
      png: await fs.readFile(path.join(packageA, dep.sourcePath)),
    });
  else {
    const source = JSON.parse(
        await fs.readFile(path.join(packageA, dep.sourcePath), "utf8"),
      ),
      prefix = path.dirname(dep.sourcePath);
    const files = await Promise.all(
      source.files.map(async (p) => {
        const bytes = await fs.readFile(
          path.join(packageA, prefix, "files", p),
        );
        return { path: p, bytes, sha256: await core.sha256(bytes) };
      }),
    );
    assets.set(dep.assetId, {
      kind: "external",
      revision: dep.sourceRevision,
      anchorM: dep.anchorM,
      recipe: source.recipe,
      glb: await fs.readFile(path.join(packageA, prefix, "model.glb")),
      files,
    });
  }
}
const chain = manifest.toolchain,
  converter = (stage, m, signal) =>
    convertPublishFbx(stage, m, {
      signal,
      blenderExecutable: "D:/steam/steamapps/common/Blender/blender.exe",
    });
async function publish(target, id, recipe = "glb-only") {
  const destination = path.join(root, "releases", id);
  if (await fs.stat(destination).catch(() => null)) return;
  return commitPublish(
    root,
    await core.createPublishPlan(target, id, recipe, chain),
    { converter: recipe === "glb-fbx" ? converter : undefined },
  );
}
const native = assets.get("native-proof").document;
await publish({ kind: "asset", document: native }, "single-proof");
await publish({ kind: "scene", document: scene, assets }, "unsupported-proof");
scene.revision++;
scene.instances.push(
  {
    instanceId: "native-90",
    assetId: "native-proof",
    positionM: [2, 3, 1],
    rotationDeg: 90,
    groupId: "base",
  },
  {
    instanceId: "native-180",
    assetId: "native-proof",
    positionM: [4, 3, 1],
    rotationDeg: 180,
    groupId: "base",
  },
  {
    instanceId: "native-270",
    assetId: "native-proof",
    positionM: [6, 3, 1],
    rotationDeg: 270,
    groupId: "base",
  },
);
native.revision++;
native.cells[0].color = 1;
await publish(
  { kind: "scene", document: scene, assets },
  "version-b",
  "glb-fbx",
);
const removed = structuredClone(scene);
removed.revision++;
removed.instances = removed.instances.filter(
  (i) => i.instanceId !== "native-instance",
);
await publish(
  { kind: "scene", document: removed, assets },
  "version-deleted",
  "glb-fbx",
);
native.anchorM = [0.125, 0, 0.125];
native.revision++;
scene.revision++;
for (const instance of scene.instances.filter(
  (i) => i.assetId === native.assetId,
)) {
  const angle = (instance.rotationDeg * Math.PI) / 180;
  instance.positionM[0] += Math.cos(angle) * 0.125;
  instance.positionM[1] += Math.sin(angle) * 0.125;
  instance.positionM[2] += 0.125;
}
await publish(
  { kind: "scene", document: scene, assets },
  "version-root",
  "glb-fbx",
);
const legacy = structuredClone(native);
legacy.assetId = "legacy.block";
await publish({ kind: "asset", document: legacy }, "legacy-id-proof");
console.log("WORKSHOP_UNITY_FIXTURES_PASS");
