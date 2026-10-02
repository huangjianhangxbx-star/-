const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
const saves = new Map();
class FileStore {
  constructor(root) {
    this.root = path.resolve(root);
  }
  async safe(relative) {
    if (
      typeof relative !== "string" ||
      path.isAbsolute(relative) ||
      relative.includes("\0")
    )
      throw Error("资源路径无效");
    const target = path.resolve(this.root, relative),
      rel = path.relative(this.root, target);
    if (rel.startsWith("..") || path.isAbsolute(rel))
      throw Error("路径超出所选目录");
    const rootReal = await fs.realpath(this.root),
      targetReal = await fs.realpath(target),
      realRel = path.relative(rootReal, targetReal);
    if (realRel.startsWith("..") || path.isAbsolute(realRel))
      throw Error("符号链接指向目录之外");
    let walk = this.root;
    for (const segment of rel.split(path.sep)) {
      walk = path.join(walk, segment);
      if ((await fs.lstat(walk)).isSymbolicLink())
        throw Error("不读取链接资产");
    }
    return target;
  }
  async save(file, text, expected) {
    const key = path.resolve(file).toLowerCase(),
      prior = saves.get(key) ?? Promise.resolve();
    const task = prior
      .catch(() => {})
      .then(() => this.write(file, text, expected));
    saves.set(key, task);
    try {
      return await task;
    } finally {
      if (saves.get(key) === task) saves.delete(key);
    }
  }
  async write(file, text, expected) {
    const rel = path.relative(this.root, path.resolve(file));
    if (rel.startsWith("..") || path.isAbsolute(rel) || !rel)
      throw Error("未授权保存路径");
    await this.safe(path.dirname(rel));
    if (Buffer.byteLength(text) > 64 * 1024 * 1024) throw Error("文件超过64MB");
    let previous = null;
    try {
      await this.safe(rel);
      previous = await fs.readFile(file);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (
      expected !== undefined &&
      digest(previous ?? Buffer.alloc(0)) !== expected
    )
      throw Error("文件已被外部修改，请另存或重新打开");
    const temp = file + "." + crypto.randomUUID() + ".writing";
    try {
      const handle = await fs.open(temp, "wx");
      try {
        await handle.writeFile(text);
        await handle.sync();
      } finally {
        await handle.close();
      }
      let latest = null;
      try {
        await this.safe(rel);
        latest = await fs.readFile(file);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (
        digest(latest ?? Buffer.alloc(0)) !==
        digest(previous ?? Buffer.alloc(0))
      )
        throw Error("保存期间文件被其他程序修改，未覆盖原文件");
      if (previous !== null) {
        try {
          await this.safe(rel + ".bak");
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        await fs.writeFile(file + ".bak", previous);
      }
      await fs.rename(temp, file);
      return digest(text);
    } finally {
      await fs.unlink(temp).catch(() => {});
    }
  }
}
module.exports = { FileStore, digest };
