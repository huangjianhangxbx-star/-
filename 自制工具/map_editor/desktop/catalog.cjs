const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { FileStore, digest } = require("./files.cjs");
class Catalog {
  constructor(root) {
    this.root = path.resolve(root);
    this.store = new FileStore(this.root);
    this.rows = [];
    this.manifestHash = undefined;
  }
  async load() {
    try {
      const p = await this.store.safe(".xinghai-assets.json");
      const bytes = await fs.readFile(p);
      const data = JSON.parse(bytes);
      if (data.version !== 1 || !Array.isArray(data.assets))
        throw Error("不支持的资产清单");
      const ids = new Set();
      for (const row of data.assets) {
        if (
          typeof row.id !== "string" ||
          ids.has(row.id) ||
          typeof row.path !== "string"
        )
          throw Error("资产ID重复或无效");
        ids.add(row.id);
      }
      this.rows = data.assets;
      this.manifestHash = digest(bytes);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  async persist() {
    this.manifestHash = await this.store.save(
      path.join(this.root, ".xinghai-assets.json"),
      JSON.stringify({ version: 1, assets: this.rows }, null, 2),
      this.manifestHash,
    );
  }
  async scan() {
    await this.load();
    const found = new Set();
    let visited = 0;
    const walk = async (dir, depth) => {
      if (depth > 12) throw Error("目录超过12层");
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (++visited > 20000) throw Error("目录项超过2万，请选择更小的资产根");
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "Library" ||
          entry.isSymbolicLink()
        )
          continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs, depth + 1);
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (
          ![
            ".glb",
            ".png",
            ".blend",
            ".fbx",
            ".obj",
            ".gltf",
            ".jpg",
            ".jpeg",
            ".webp",
          ].includes(ext)
        )
          continue;
        const relative = path.relative(this.root, abs).replaceAll("\\", "/");
        await this.store.safe(relative);
        found.add(relative);
        let row = this.rows.find((a) => a.path === relative);
        if (!row) {
          row = {
            id: crypto.randomUUID(),
            path: relative,
            name: path.basename(entry.name, ext),
            type: ext.slice(1),
            anchor: [0, 0, 0],
          };
          this.rows.push(row);
        }
        const stat = await fs.stat(abs);
        row.status = !["glb", "png", "blend", "fbx"].includes(row.type)
          ? "unsupported"
          : stat.size > 32 * 1024 * 1024
            ? "oversize"
            : "ready";
        row.bytes = stat.size;
        if (row.status === "ready") row.hash = digest(await fs.readFile(abs));
      }
    };
    await walk(this.root, 0);
    for (const row of this.rows)
      if (!found.has(row.path)) row.status = "missing";
    for (const row of this.rows.filter((a) => a.type === "glb")) {
      const stem = row.path.slice(0, -4);
      if (!row.source && found.has(stem + ".blend"))
        row.source = stem + ".blend";
      if (!row.exchange && found.has(stem + ".fbx"))
        row.exchange = stem + ".fbx";
    }
    await this.persist();
    return this.rows;
  }
  get(id) {
    const row = this.rows.find((a) => a.id === id);
    if (!row) throw Error("未注册资产");
    return row;
  }
  async anchor(id, values) {
    if (
      !Array.isArray(values) ||
      values.length !== 3 ||
      values.some((v) => !Number.isFinite(v) || Math.abs(v) > 2048)
    )
      throw Error("锚点需要三个有限坐标");
    const row = this.get(id);
    row.anchor = values;
    await this.persist();
    return row;
  }
  async payload(id) {
    const row = this.get(id);
    if (row.status !== "ready") throw Error("资产缺失或超过32MB");
    const abs = await this.store.safe(row.path);
    const bytes = await fs.readFile(abs);
    if (bytes.length > 32 * 1024 * 1024) throw Error("资产超过32MB");
    if (row.type === "glb") {
      if (
        bytes.length < 20 ||
        bytes.readUInt32LE(0) !== 0x46546c67 ||
        bytes.readUInt32LE(4) !== 2 ||
        bytes.readUInt32LE(8) !== bytes.length
      )
        throw Error("GLB损坏");
      const len = bytes.readUInt32LE(12);
      if (len > bytes.length - 20) throw Error("GLB块损坏");
      const json = JSON.parse(bytes.subarray(20, 20 + len).toString());
      for (const item of [...(json.images ?? []), ...(json.buffers ?? [])])
        if (item.uri && !item.uri.startsWith("data:"))
          throw Error("首期仅支持自包含GLB，不读取外部依赖");
    } else if (row.type !== "png") throw Error("此类型仅支持定位源文件");
    return { row, data: bytes.toString("base64") };
  }
  async rename(id, name, physical = false) {
    const row = this.get(id);
    if (typeof name !== "string" || !name.trim() || name.length > 80)
      throw Error("名称无效");
    if (!physical) {
      row.name = name;
      await this.persist();
      return row;
    }
    if (
      !["glb", "png"].includes(row.type) ||
      /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
      /[. ]$/.test(name) ||
      /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name) ||
      name === ".."
    )
      throw Error("文件名无效或该格式不支持受控改名");
    if (row.type === "glb") await this.payload(id);
    const old = await this.store.safe(row.path),
      newRel = path.posix.join(
        path.posix.dirname(row.path),
        name + "." + row.type,
      ),
      dest = path.join(this.root, newRel);
    if (newRel === row.path) {
      row.name = name;
      await this.persist();
      return row;
    }
    try {
      await fs.lstat(dest);
      throw Error("目标文件已存在");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const previous = { ...row };
    await fs.rename(old, dest);
    row.path = newRel;
    row.name = name;
    try {
      await this.persist();
    } catch (e) {
      await fs.rename(dest, old);
      Object.assign(row, previous);
      throw e;
    }
    return row;
  }
}
module.exports = { Catalog };
