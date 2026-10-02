import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const source = path.join(root, "art", "探索地图样例", "重建-v2");
const dest = path.resolve(here, "../assets/ruins-m11");
const roster = JSON.parse(await fs.readFile(path.join(source, "data/asset_roster.json"), "utf8"));
const selected = ["AR_COLUMN_02", "AR_FRAME_01", "EX_ROCK_01", "IT_LIGHT_01", "EX_LANDMARK_01", "PT_EMBLEM_01"];
const rows = [];
await fs.mkdir(dest, { recursive: true });
for (const key of selected) {
  const info = roster.find((r) => r.asset_id === key);
  if (!info) throw Error(`原始清单缺少 ${key}`);
  const copied = {};
  for (const [ext, original] of [["glb", "asset.glb"], ["blend", "source.blend"]]) {
    const input = path.join(source, "kit", key, original);
    const output = path.join(dest, `${key}.${ext}`);
    const bytes = await fs.readFile(input);
    try {
      const old = await fs.readFile(output);
      if (!old.equals(bytes)) throw Error(`已存在且内容不同，请检查 ${output}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await fs.writeFile(output, bytes);
    }
    copied[ext] = { relative: path.relative(root, input).replaceAll("\\", "/"),
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
  }
  rows.push({ id: `ruins:${key}`, path: `${key}.glb`, name: key,
    type: "glb", status: "ready", bytes: copied.glb.bytes,
    hash: copied.glb.sha256, source: `${key}.blend`, anchor: info.pivot,
    dimensionsMeters: info.dimensions_u, original: copied });
}
const manifest = { version: 1, assets: rows };
const manifestPath = path.join(dest, ".xinghai-assets.json");
try { await fs.access(manifestPath); } catch {
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
const sourceDoc = path.join(dest, "SOURCE.md");
try { await fs.access(sourceDoc); } catch {
  await fs.writeFile(sourceDoc,
    `# M1.1 真实资产子集\n\n源目录：\`${path.relative(root, source).replaceAll("\\", "/")}\`。本目录是验证副本，原件不改。\n\n` +
    rows.map((r) => `- ${r.name}：${r.dimensionsMeters.join(" × ")} m，GLB ${r.original.glb.bytes} B，Blender 源 ${r.original.blend.bytes} B；源 SHA-256 ${r.original.glb.sha256}。`).join("\n") + "\n");
}
console.log(JSON.stringify({ dest, assets: rows.length }));
