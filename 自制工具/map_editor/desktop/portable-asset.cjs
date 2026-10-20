const { createHash, randomUUID } = require("node:crypto");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const LIMIT = 96 * 1024 * 1024;
function encode(document, preview, core) {
  document = core.validateAsset(document);
  if (!preview) throw Error("请先保存资产以生成预览");
  const source = JSON.stringify(document),
    png = Buffer.from(preview, "base64");
  core.pngBytes(png);
  require("./workshop-ipc.cjs").validatePngIntegrity(png);
  const bytes = Buffer.from(
    JSON.stringify({
      schema: "xinghai-portable-asset-1",
      source,
      sourceHash: hash(source),
      preview,
      previewHash: hash(png),
    }),
  );
  if (bytes.length > LIMIT) throw Error("便携资产超出预算");
  return bytes;
}
function decode(bytes, core) {
  if (bytes.length > LIMIT) throw Error("便携资产超出预算");
  const p = JSON.parse(bytes.toString("utf8"));
  if (
    p.schema !== "xinghai-portable-asset-1" ||
    Object.keys(p).some(
      (k) =>
        !["schema", "source", "sourceHash", "preview", "previewHash"].includes(
          k,
        ),
    ) ||
    typeof p.source !== "string" ||
    typeof p.preview !== "string" ||
    p.preview.length > 4 * 1024 * 1024 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(p.preview)
  )
    throw Error("便携资产格式无效");
  const png = Buffer.from(p.preview, "base64");
  if (hash(p.source) !== p.sourceHash || hash(png) !== p.previewHash)
    throw Error("便携资产校验失败");
  const document = core.validateAsset(JSON.parse(p.source));
  core.pngBytes(png);
  require("./workshop-ipc.cjs").validatePngIntegrity(png);
  return {
    document: core.cloneAsset(document, randomUUID()),
    preview: p.preview,
  };
}
module.exports = { encode, decode, LIMIT };
