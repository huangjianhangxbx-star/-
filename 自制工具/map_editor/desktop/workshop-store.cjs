const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { digest } = require("./files.cjs");
const queues = new Map(),
  MAX_BYTES = 64 * 1024 * 1024;
function canonical(relative, internal = false) {
  if (
    typeof relative !== "string" ||
    relative.length > 1024 ||
    /[\\:\x00-\x1f<>"|?*]/.test(relative) ||
    relative
      .split("/")
      .some(
        (s) =>
          !s ||
          s === "." ||
          s === ".." ||
          /[. ]$/.test(s) ||
          /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(s),
      ) ||
    (!internal && relative.split("/")[0].toLowerCase() === ".workshop-txn")
  )
    throw Error("未授权的项目相对路径");
  return relative;
}
async function durable(file, bytes) {
  const handle = await fs.open(file, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
function createWorkshopStore(selectedRoot) {
  const root = path.resolve(selectedRoot),
    key = root.toLowerCase();
  async function safe(relative, makeParents = false, internal = false) {
    canonical(relative, internal);
    if (
      (await fs.lstat(root)).isSymbolicLink() ||
      path.resolve(await fs.realpath(root)).toLowerCase() !== key
    )
      throw Error("项目根目录改变或为链接");
    const segments = relative.split("/");
    let target = root;
    for (let i = 0; i < segments.length; i++) {
      target = path.join(target, segments[i]);
      const stat = await fs.lstat(target).catch((e) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
      if (stat?.isSymbolicLink()) throw Error("不读写链接项目文件");
      if (i < segments.length - 1) {
        if (stat && !stat.isDirectory()) throw Error("项目父路径不是目录");
        if (!stat && makeParents) await fs.mkdir(target);
      } else if (stat && !stat.isFile()) throw Error("项目目标不是文件");
    }
    return target;
  }
  async function read(relative, internal = false) {
    const file = await safe(relative, false, internal);
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_BYTES) throw Error("项目文件超过64MiB");
      return await fs.readFile(file);
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }
  async function removeTransaction(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Error("恢复事务身份无效");
    const directory = path.resolve(root, ".workshop-txn", id);
    if (!path.relative(root, directory).startsWith(".workshop-txn" + path.sep))
      throw Error("事务清理越界");
    if ((await fs.lstat(directory)).isSymbolicLink())
      throw Error("恢复目录不能为链接");
    await fs.rm(directory, { recursive: true, force: true });
  }
  async function restore(id, journal) {
    if (journal.version !== 1 || !Array.isArray(journal.entries))
      throw Error("恢复日志格式损坏");
    // Preflight all files before reverting any; never overwrite newer external edits.
    for (const entry of journal.entries) {
      canonical(entry.path);
      const current = await read(entry.path),
        hash = current === null ? null : digest(current);
      if (hash !== entry.oldHash && hash !== entry.newHash)
        throw Error(`恢复冲突，保留外部修改：${entry.path}`);
      if (entry.backup !== null) {
        if (!/^\d+\.old$/.test(entry.backup)) throw Error("恢复备份路径无效");
        const backup = await read(`.workshop-txn/${id}/${entry.backup}`, true);
        if (!backup || digest(backup) !== entry.oldHash)
          throw Error("恢复备份损坏");
      }
    }
    for (const entry of [...journal.entries].reverse()) {
      const current = await read(entry.path);
      const hash = current === null ? null : digest(current);
      if (hash === entry.oldHash) continue;
      if (hash !== entry.newHash)
        throw Error(`恢复冲突，保留外部修改：${entry.path}`);
      const file = await safe(entry.path, true);
      if (entry.backup === null) await fs.unlink(file);
      else {
        const backup = await read(`.workshop-txn/${id}/${entry.backup}`, true);
        const temporary = await safe(
          `${entry.path}.${crypto.randomUUID()}.recovering`,
          true,
        );
        await durable(temporary, backup);
        await fs.rename(temporary, file);
      }
    }
    await removeTransaction(id);
  }
  async function recoverInternal() {
    const sentinel = await safe(".workshop-txn/placeholder", true, true),
      directory = path.dirname(sentinel);
    for (const id of await fs.readdir(directory)) {
      if (id === "lock") continue;
      if (!/^[a-f0-9-]{36}$/.test(id))
        throw Error("未知项目恢复目录，请保留并检查");
      const journalBytes = await read(`.workshop-txn/${id}/journal.json`, true);
      if (!journalBytes) {
        await removeTransaction(id);
        continue;
      }
      const committed = await read(`.workshop-txn/${id}/committed`, true);
      if (committed) await removeTransaction(id);
      else await restore(id, JSON.parse(journalBytes.toString("utf8")));
    }
  }
  async function exclusive(action) {
    const prior = queues.get(key) ?? Promise.resolve();
    const task = prior
      .catch(() => {})
      .then(async () => {
        const lock = await safe(".workshop-txn/lock", true, true);
        let handle;
        try {
          handle = await fs.open(lock, "wx");
        } catch (e) {
          if (e.code !== "EEXIST") throw e;
          const owner = JSON.parse(await fs.readFile(lock, "utf8"));
          let alive = true;
          try {
            process.kill(owner.pid, 0);
          } catch (error) {
            if (error.code === "ESRCH") alive = false;
            else throw error;
          }
          if (alive) throw Error("另一进程正在写入该项目");
          await fs.unlink(lock);
          handle = await fs.open(lock, "wx");
        }
        try {
          await handle.writeFile(JSON.stringify({ pid: process.pid }));
          await handle.sync();
          return await action();
        } finally {
          await handle.close();
          await fs.unlink(lock);
        }
      });
    queues.set(key, task);
    try {
      return await task;
    } finally {
      if (queues.get(key) === task) queues.delete(key);
    }
  }
  return {
    async load(relative) {
      return exclusive(async () => {
        await recoverInternal();
        const bytes = await read(relative);
        if (bytes === null) throw Error(`项目文件不存在：${relative}`);
        return { bytes, hash: digest(bytes) };
      });
    },
    async recover() {
      return exclusive(recoverInternal);
    },
    async commit(writes) {
      if (!Array.isArray(writes) || !writes.length || writes.length > 10000)
        throw Error("事务文件组无效");
      const names = new Set();
      for (const intent of writes) {
        canonical(intent.path);
        if (names.has(intent.path.toLowerCase()))
          throw Error("事务目标路径重复");
        names.add(intent.path.toLowerCase());
        if (
          !(intent.bytes instanceof Uint8Array) ||
          intent.bytes.length > MAX_BYTES
        )
          throw Error("项目文件无效或超过64MiB");
        if (
          intent.expectedHash !== null &&
          !/^[a-f0-9]{64}$/.test(intent.expectedHash)
        )
          throw Error("必须提供打开时的哈希或新路径意图");
      }
      return exclusive(async () => {
        await recoverInternal();
        const id = crypto.randomUUID(),
          entries = [],
          snapshots = [];
        for (const intent of writes) {
          const previous = await read(intent.path),
            oldHash = previous === null ? null : digest(previous);
          if (oldHash !== intent.expectedHash)
            throw Error(`文件已被外部修改：${intent.path}`);
          snapshots.push(previous);
          entries.push({
            path: intent.path,
            oldHash,
            newHash: digest(intent.bytes),
            backup: previous === null ? null : `${entries.length}.old`,
          });
        }
        const journal = { version: 1, entries };
        let prepared = false;
        try {
          for (let i = 0; i < writes.length; i++) {
            if (snapshots[i] !== null)
              await durable(
                await safe(`.workshop-txn/${id}/${i}.old`, true, true),
                snapshots[i],
              );
            await durable(
              await safe(`.workshop-txn/${id}/${i}.new`, true, true),
              writes[i].bytes,
            );
          }
          await durable(
            await safe(`.workshop-txn/${id}/journal.json`, true, true),
            JSON.stringify(journal),
          );
          prepared = true;
          // Detect edits made during staging before publishing the first document.
          for (const e of entries) {
            const current = await read(e.path);
            if ((current === null ? null : digest(current)) !== e.oldHash)
              throw Error(`保存期间文件改变：${e.path}`);
          }
          for (let i = 0; i < entries.length; i++) {
            const e = entries[i],
              current = await read(e.path);
            if ((current === null ? null : digest(current)) !== e.oldHash)
              throw Error(`保存期间文件改变：${e.path}`);
            await fs.rename(
              await safe(`.workshop-txn/${id}/${i}.new`, false, true),
              await safe(e.path, true),
            );
          }
          await durable(
            await safe(`.workshop-txn/${id}/committed`, true, true),
            "committed",
          );
        } catch (error) {
          if (prepared) await restore(id, journal);
          else {
            const folder = path.join(root, ".workshop-txn", id);
            if (await fs.stat(folder).catch(() => null))
              await removeTransaction(id);
          }
          throw error;
        }
        // A committed transaction is successful even when cleanup must wait for reopening.
        await removeTransaction(id).catch(() => {});
        return {
          files: entries.map((e) => ({ path: e.path, hash: e.newHash })),
        };
      });
    },
  };
}
module.exports = { createWorkshopStore };
