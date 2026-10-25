const { randomUUID } = require('node:crypto');
const { mkdir, readFile, readdir, stat, writeFile } = require('node:fs/promises');
const { basename, dirname, extname, join, resolve } = require('node:path');

function safeName(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 50) || 'animation';
}

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function atlasPages(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  return lines.filter((line, index) => line && /^size\s*:/i.test(lines[index + 1] || ''));
}

/** Read the complete Spine JSON resource bundle without changing any source file. */
async function loadSpineResource(jsonPath, label = '目标', explicitAtlasPath) {
  if ((await stat(jsonPath)).size > 150 * 1024 * 1024) throw new Error(`${label} JSON 超过 150 MB`);
  const directory = dirname(jsonPath);
  const stem = basename(jsonPath, extname(jsonPath));
  const atlasPath = explicitAtlasPath || join(directory, `${stem}.atlas`);
  let atlasBytes;
  try { atlasBytes = await readFile(atlasPath); }
  catch { throw new Error(`未找到同目录贴图索引：${basename(atlasPath)}`); }
  const atlasText = atlasBytes.toString('utf8');
  const names = atlasPages(atlasText);
  if (!names.length) throw new Error('Atlas 中没有可识别的页面');
  const available = new Set(await readdir(directory));
  const pages = [];
  for (const name of names) {
    if (basename(name) !== name || !available.has(name)) throw new Error(`Atlas 页面缺失或名称不安全：${name}`);
    const path = join(directory, name);
    pages.push({ name, path, bytes: asArrayBuffer(await readFile(path)) });
  }
  const jsonText = await readFile(jsonPath, 'utf8');
  return {
    path: jsonPath,
    name: basename(jsonPath),
    jsonPath,
    atlasPath,
    jsonText,
    atlasText,
    atlasBytes,
    pages,
    protectedPaths: [jsonPath, atlasPath, ...pages.map((page) => page.path), join(directory, `${stem}.spine`)],
  };
}

function assertOutputSourceResource(payload, activeSourceResourceId) {
  if (payload?.sourceKind !== 'spine') return;
  if (typeof payload.sourceResourceId !== 'string' || !activeSourceResourceId || payload.sourceResourceId !== activeSourceResourceId) {
    throw new Error('生成结果对应的来源资源已失效，请重新载入并生成');
  }
}

function assertOutputTargetResource(payload, activeTargetResourceId) {
  if (typeof payload?.targetResourceId !== 'string' || !activeTargetResourceId || payload.targetResourceId !== activeTargetResourceId) {
    throw new Error('生成结果对应的目标资源已失效，请重新载入并生成');
  }
}

async function writeOutputPackage({ outputDirectory, sourceKind, animationName, jsonText, configText, reportText, target }) {
  const outputRoot = resolve(outputDirectory);
  if (!(await stat(outputRoot)).isDirectory()) throw new Error(`输出位置不是目录：${outputRoot}`);
  if (!target || !target.jsonPath || !target.atlasPath || !Buffer.isBuffer(target.atlasBytes) || !Array.isArray(target.pages)) {
    throw new Error('目标 Spine 素材未完整载入');
  }
  for (const page of target.pages) {
    if (basename(page.name) !== page.name || page.name === '.' || page.name === '..') {
      throw new Error(`Atlas 页面名称不安全：${page.name}`);
    }
    if (!(page.bytes instanceof ArrayBuffer)) throw new Error(`Atlas 页面快照缺失：${page.name}`);
  }

  if (reportText !== undefined && typeof reportText !== 'string') throw new Error('迁移报告格式不正确');

  const prefix = sourceKind === 'spine' ? 'SPW-02' : 'SPW-01';
  const folder = join(outputRoot, `${prefix}_${safeName(animationName)}_${randomUUID().slice(0, 8)}`);
  await mkdir(folder);
  const jsonPath = join(folder, basename(target.jsonPath));
  await writeFile(jsonPath, jsonText, { encoding: 'utf8', flag: 'wx' });
  await writeFile(join(folder, `${basename(target.jsonPath, extname(target.jsonPath))}.atlas`), target.atlasBytes, { flag: 'wx' });
  for (const page of target.pages) await writeFile(join(folder, page.name), Buffer.from(page.bytes), { flag: 'wx' });
  if (configText) await writeFile(join(folder, 'calibration.spw.json'), configText, { encoding: 'utf8', flag: 'wx' });
  if (reportText !== undefined) await writeFile(join(folder, 'migration-report.txt'), reportText, { encoding: 'utf8', flag: 'wx' });
  return { directory: folder, jsonPath };
}

module.exports = { loadSpineResource, assertOutputSourceResource, assertOutputTargetResource, writeOutputPackage };
