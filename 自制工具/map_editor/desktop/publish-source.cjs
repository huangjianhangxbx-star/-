async function capturePublishSource(session, core, sceneId, assetId) {
  const expectedInputs = [],
    load = async (file) => {
      const loaded = await session.store.load(file);
      expectedInputs.push({ path: file, sha256: loaded.hash });
      return Buffer.from(loaded.bytes);
    };
  const project = core.validateProject(
    JSON.parse(await load("project.xhproject.json")),
  );
  if (expectedInputs[0].sha256 !== session.projectHash)
    throw Error("项目已被外部修改，请重新打开");
  const registration = project.scenes.find((row) => row.sceneId === sceneId);
  if (!registration) throw Error("发布场景未登记");
  const scene = core.validateScene(JSON.parse(await load(registration.source))),
    prefix = `scenes/${scene.sceneId}/`,
    assets = new Map();
  const rows = assetId
    ? scene.assets.filter((row) => row.assetId === assetId)
    : scene.assets;
  if (assetId && (rows.length !== 1 || rows[0].kind !== "voxel"))
    throw Error("单件发布必须选择已保存的体素模块");
  for (const row of rows) {
    if (row.kind === "voxel") {
      const document = core.validateAsset(
        JSON.parse(await load(prefix + row.source)),
      );
      if (document.assetId !== row.assetId) throw Error("发布源身份与登记不符");
      assets.set(row.assetId, { kind: "voxel", document });
    } else if (row.kind === "texture") {
      assets.set(row.assetId, {
        kind: "texture",
        revision: row.revision,
        png: await load(prefix + row.image),
      });
    } else {
      const files = [];
      for (const file of row.files) {
        const bytes = await load(prefix + file);
        files.push({ path: file, bytes, sha256: expectedInputs.at(-1).sha256 });
      }
      assets.set(row.assetId, {
        kind: "external",
        revision: row.revision,
        anchorM: row.anchorM,
        recipe: row.recipe,
        glb: files.find((f) => f.path === row.model)?.bytes,
        files,
      });
    }
  }
  return {
    target: assetId
      ? { kind: "asset", document: assets.get(assetId).document }
      : { kind: "scene", document: scene, assets },
    expectedInputs,
  };
}
module.exports = { capturePublishSource };
