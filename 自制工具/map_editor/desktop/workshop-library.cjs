const crypto = require("node:crypto");
const { createWorkshopStore } = require("./workshop-store.cjs");
function createWorkshopLibrary(root, core) {
  const store = createWorkshopStore(root);
  async function index() {
    try {
      const loaded = await store.load(".xinghai-assets.json"),
        manifest = JSON.parse(Buffer.from(loaded.bytes).toString("utf8"));
      if (manifest.version !== 1 || !Array.isArray(manifest.assets))
        throw Error("公共库清单损坏");
      return { manifest, hash: loaded.hash };
    } catch (e) {
      if (!e.message.startsWith("项目文件不存在：")) throw e;
      return { manifest: { version: 1, assets: [] }, hash: null };
    }
  }
  return {
    async register(source) {
      const asset = core.cloneAsset(source, crypto.randomUUID()),
        file = `${asset.assetId}.xhmodule.json`,
        { manifest, hash } = await index();
      manifest.assets.push({
        id: asset.assetId,
        name: asset.name || "未命名模块",
        path: file,
        type: "module",
        anchor: asset.anchorM,
        status: "ready",
      });
      await store.commit([
        {
          path: file,
          bytes: Buffer.from(JSON.stringify(asset, null, 2)),
          expectedHash: null,
        },
        {
          path: ".xinghai-assets.json",
          bytes: Buffer.from(JSON.stringify(manifest, null, 2)),
          expectedHash: hash,
        },
      ]);
      return { assetId: asset.assetId, path: file };
    },
    async source(id) {
      const { manifest } = await index(),
        row = manifest.assets.find((a) => a.id === id);
      if (!row || row.type !== "module") throw Error("公共库模块不存在");
      const loaded = await store.load(row.path),
        asset = core.validateAsset(
          JSON.parse(Buffer.from(loaded.bytes).toString("utf8")),
        );
      if (asset.assetId !== id) throw Error("公共模块身份改变");
      return asset;
    },
  };
}
module.exports = { createWorkshopLibrary };
