const fs = require("node:fs/promises"),
  path = require("node:path");
const { digest } = require("./files.cjs");
async function boundedRead(store, file, max = 32 * 1024 * 1024) {
  const target = await store.safe(file);
  if ((await fs.stat(target)).size > max) throw Error("迁移依赖超过大小预算");
  return fs.readFile(target);
}
async function resolveLegacyAssets(json, catalog, core, validateMap) {
  const map = validateMap(JSON.parse(json)),
    assets = new Map(),
    issues = [];
  const needed = new Set([
    ...map.instances.map((p) => p.assetId),
    ...map.decals.map((p) => p.assetId),
  ]);
  for (const id of needed) {
    try {
      if (!catalog) throw Error("未选择旧图使用的资产库");
      const row = catalog.get(id);
      if (row.nativeSource || row.type === "module") {
        const bytes = await boundedRead(
            catalog.store,
            row.nativeSource ?? row.path,
            64 * 1024 * 1024,
          ),
          input = JSON.parse(bytes),
          document =
            input.schema === "xinghai-workshop-asset-1"
              ? core.validateAsset(input)
              : core.fromNativeV1(input);
        if (document.assetId !== id) throw Error("旧资产源身份不一致");
        assets.set(id, { kind: "voxel", document });
      } else if (row.type === "png") {
        const png = await boundedRead(catalog.store, row.path);
        core.pngBytes(png);
        assets.set(id, { kind: "texture", revision: 0, png });
      } else if (["glb", "fbx"].includes(row.type)) {
        const model =
            row.type === "glb" ? row.path : row.path.replace(/\.fbx$/i, ".glb"),
          glb = await boundedRead(catalog.store, model);
        core.staticGlb(glb);
        const files = [];
        const basename = model.replace(/\.glb$/i, "");
        // Existing exchange outputs form a bounded dependency group adjacent to the GLB.
        for (const suffix of [".fbx", ".xhmaterials.json", ".xhasset.json"]) {
          try {
            const file = basename + suffix,
              bytes = await boundedRead(catalog.store, file);
            files.push({
              path: path.posix.basename(file),
              bytes,
              sha256: digest(bytes),
            });
          } catch (e) {
            if (e.code !== "ENOENT") throw e;
          }
        }
        const textureRoot = basename + ".xhtextures";
        try {
          await catalog.store.safe(textureRoot);
          const walk = async (dir, depth = 0) => {
            if (depth > 12 || files.length > 1000)
              throw Error("交换依赖组超过预算");
            for (const entry of await fs.readdir(
              await catalog.store.safe(dir),
              { withFileTypes: true },
            )) {
              const file = dir + "/" + entry.name;
              if (entry.isSymbolicLink()) throw Error("交换依赖不允许链接");
              if (entry.isDirectory()) await walk(file, depth + 1);
              else {
                const bytes = await boundedRead(catalog.store, file);
                files.push({
                  path: path.posix.relative(path.posix.dirname(model), file),
                  bytes,
                  sha256: digest(bytes),
                });
              }
            }
          };
          await walk(textureRoot);
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        if (row.type === "fbx" && !files.some((f) => f.path.endsWith(".fbx")))
          throw Error("FBX交换组缺少模型");
        assets.set(id, {
          kind: "external",
          revision: 0,
          anchorM: row.anchor ?? [0, 0, 0],
          recipe: files.some((f) => f.path.endsWith(".fbx"))
            ? "blender-fbx-5.1.2"
            : "glb-rh-y-up",
          glb,
          files,
        });
      } else throw Error("旧资产格式尚无可识别视觉，保留原文和占位");
    } catch (e) {
      issues.push({
        code: "legacy-source-unresolved",
        documentId: id,
        message: `${id}: ${e.message}`,
      });
    }
  }
  return { assets, issues };
}
module.exports = { resolveLegacyAssets };
