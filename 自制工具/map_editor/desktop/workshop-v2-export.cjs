const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { digest } = require('./files.cjs');
const { blenderRunner } = require('./publish-fbx.cjs');

function outputName(name) {
  if (typeof name !== 'string' || name.length < 1 || name.length > 100 ||
      /[\\/:*?"<>|\x00-\x1f]/.test(name) || /^[. ]|[. ]$/.test(name) ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))
    throw Error('FBX文件名无效');
  return name.replace(/\.fbx$/i, '');
}

async function exportSavedAssetFbx(source, directory, fileName, blenderExecutable, core, options = {}) {
  const name = outputName(fileName);
  const parent = path.resolve(directory);
  const stat = await fs.lstat(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      path.resolve(await fs.realpath(parent)).toLowerCase() !== parent.toLowerCase())
    throw Error('请选择真实的输出文件夹');
  const destination = path.join(parent, name);
  const existing = await fs.lstat(destination).then((stat) => stat,
    (e) => { if (e.code === 'ENOENT') return null; throw e; });
  if (existing && !options.replaceExisting)
    throw Error('同名输出已存在；请修改文件名，原文件不会被覆盖');
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink()))
    throw Error('同名目标不是可备份的普通目录');
  const document = core.validateAsset(source.document);
  const glb = Buffer.from(core.exportAssetGlb(document));
  core.validatePublishGlb(glb);
  const stage = await fs.mkdtemp(path.join(parent, '.xh-fbx-'));
  try {
    const input = path.join(stage, 'input.glb');
    const model = path.join(stage, `${name}.fbx`);
    await fs.writeFile(input, glb, { flag: 'wx' });
    const report = await (options.runner ?? blenderRunner)(input, model, {
      blenderExecutable, signal: options.signal,
    });
    if (report?.blenderVersion !== '5.1.2') throw Error('导出需要 Blender 5.1.2');
    const fbx = await fs.readFile(model);
    if (fbx.length < 27 || !fbx.subarray(0, 23).equals(Buffer.from('Kaydara FBX Binary  \0\x1a\0')))
      throw Error('Blender未生成有效FBX');
    const sidecarPath = path.join(stage, `${name}.xhmaterials.json`);
    const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
    if (sidecar.schema !== 'xinghai-fbx-materials-1' || !Array.isArray(sidecar.colors) ||
        !Array.isArray(sidecar.textureDependencies)) throw Error('材质旁车无效');
    const outputs = [`${name}.fbx`, `${name}.xhmaterials.json`];
    for (const relative of new Set(sidecar.textureDependencies)) {
      core.publishPath(relative);
      if (!relative.startsWith(`${name}.xhtextures/`)) throw Error('贴图依赖不属于当前FBX');
      const file = path.join(stage, ...relative.split('/'));
      const texture = await fs.readFile(file);
      if (file.toLowerCase().endsWith('.png')) {
        core.pngBytes(texture); require('./workshop-ipc.cjs').validatePngIntegrity(texture);
      }
      outputs.push(relative);
    }
    await fs.rm(input);
    const current = await fs.lstat(destination).then((stat) => stat,
      (e) => { if (e.code === 'ENOENT') return null; throw e; });
    if ((!existing && current) || (existing && (!current || !current.isDirectory() ||
        current.isSymbolicLink() || current.ino !== existing.ino)))
      throw Error('同名输出在转换期间发生变化，未覆盖原件');
    let backupDirectory = null;
    if (current) {
      backupDirectory = path.join(parent, `${name}.backup-${crypto.randomUUID()}`);
      await fs.rename(destination, backupDirectory);
    }
    try { await fs.rename(stage, destination); }
    catch (error) {
      if (backupDirectory) await fs.rename(backupDirectory, destination).catch((restoreError) => {
        throw Error(`新文件放置失败，旧版保存在 ${backupDirectory}：${restoreError.message}`);
      });
      throw error;
    }
    return { directory: destination, file: path.join(destination, `${name}.fbx`),
      sourceHash: source.hash, revision: document.revision, blenderVersion: report.blenderVersion,
      backupDirectory,
      outputs: await Promise.all(outputs.map(async (relative) => ({ path: relative,
        sha256: digest(await fs.readFile(path.join(destination, ...relative.split('/')))) }))) };
  } catch (error) {
    if (path.dirname(stage).toLowerCase() === parent.toLowerCase() && path.basename(stage).startsWith('.xh-fbx-'))
      await fs.rm(stage, { recursive: true, force: true });
    throw error;
  }
}
module.exports = { exportSavedAssetFbx, outputName };
