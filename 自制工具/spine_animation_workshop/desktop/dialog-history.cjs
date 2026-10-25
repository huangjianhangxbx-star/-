const { mkdir, readFile, writeFile, rename, stat, unlink } = require('node:fs/promises');
const { dirname, isAbsolute } = require('node:path');
const { randomUUID } = require('node:crypto');

function createDialogHistory(file) {
  let pending = Promise.resolve();
  async function read() {
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch { return {}; }
  }
  async function existingDirectory(path) {
    if (typeof path !== 'string' || !isAbsolute(path)) return undefined;
    for (;;) {
      try { if ((await stat(path)).isDirectory()) return path; } catch { /* Try the nearest existing parent. */ }
      const parent = dirname(path);
      if (parent === path) return undefined;
      path = parent;
    }
  }
  return {
    async defaultPath(key, fallbackKeys = []) {
      await pending;
      const data = await read();
      for (const candidate of [key, ...fallbackKeys]) {
        const path = await existingDirectory(data[candidate]);
        if (path) return path;
      }
      return undefined;
    },
    async remember(key, directory) {
      if (typeof directory !== 'string' || !isAbsolute(directory)) return;
      pending = pending.then(async () => {
        const data = await read();
        data[key] = directory;
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          await mkdir(dirname(file), { recursive: true });
          await writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
          await rename(temporary, file);
        } finally { await unlink(temporary).catch(() => {}); }
      }).catch(error => { console.warn('无法保存工坊目录记录：', error.message); });
      await pending;
    },
  };
}

module.exports = { createDialogHistory };
