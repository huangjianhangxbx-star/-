const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const LIMIT = 12;
function valid(row) {
  return row && typeof row === 'object' &&
    typeof row.root === 'string' && path.isAbsolute(row.root) &&
    typeof row.name === 'string' && row.name.length <= 200 &&
    typeof row.openedAt === 'string' && !Number.isNaN(Date.parse(row.openedAt)) &&
    row.id === crypto.createHash('sha256').update(path.resolve(row.root).toLowerCase()).digest('hex');
}
function createRecentProjects(file) {
  async function list() {
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      if (parsed.version !== 1 || !Array.isArray(parsed.projects)) return [];
      return parsed.projects.filter(valid).slice(0, LIMIT);
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return [];
      throw error;
    }
  }
  async function write(rows) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify({ version: 1, projects: rows }, null, 2), { flag: 'wx' });
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  return {
    list,
    async record(root, name) {
      if (typeof root !== 'string' || !path.isAbsolute(root)) throw Error('项目目录无效');
      if (typeof name !== 'string' || name.length > 200) throw Error('项目名称无效');
      root = path.resolve(root);
      const id = crypto.createHash('sha256').update(root.toLowerCase()).digest('hex');
      await write([{ id, root, name, openedAt: new Date().toISOString() }, ...(await list()).filter((row) => row.id !== id)].slice(0, LIMIT));
    },
    async resolve(id) {
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw Error('最近项目身份无效');
      const row = (await list()).find((item) => item.id === id);
      if (!row) throw Error('最近项目不在记录中');
      return row.root;
    },
    async remove(id) {
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw Error('最近项目身份无效');
      await write((await list()).filter((row) => row.id !== id));
    },
  };
}
module.exports = { createRecentProjects };
