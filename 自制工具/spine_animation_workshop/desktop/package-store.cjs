const { randomUUID } = require('node:crypto');
const { constants } = require('node:fs');
const { access, copyFile, mkdir, stat, writeFile } = require('node:fs/promises');
const { basename, join, resolve } = require('node:path');

function safeName(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 50) || 'animation';
}

async function writeOutputPackage({ outputDirectory, animationName, jsonText, configText, target }) {
  const outputRoot = resolve(outputDirectory);
  if (!(await stat(outputRoot)).isDirectory()) throw new Error(`输出位置不是目录：${outputRoot}`);
  if (!target || !target.jsonPath || !target.atlasPath || !Array.isArray(target.pages)) {
    throw new Error('目标 Spine 素材未完整载入');
  }
  for (const path of [target.atlasPath, ...target.pages.map((page) => page.path)]) await access(path, constants.R_OK);
  for (const page of target.pages) {
    if (basename(page.name) !== page.name || page.name === '.' || page.name === '..') {
      throw new Error(`Atlas 页面名称不安全：${page.name}`);
    }
  }

  const folder = join(outputRoot, `SPW-01_${safeName(animationName)}_${randomUUID().slice(0, 8)}`);
  await mkdir(folder);
  const jsonPath = join(folder, basename(target.jsonPath));
  await writeFile(jsonPath, jsonText, { encoding: 'utf8', flag: 'wx' });
  await copyFile(target.atlasPath, join(folder, basename(target.atlasPath)), constants.COPYFILE_EXCL);
  for (const page of target.pages) await copyFile(page.path, join(folder, page.name), constants.COPYFILE_EXCL);
  if (configText) await writeFile(join(folder, 'calibration.spw.json'), configText, { encoding: 'utf8', flag: 'wx' });
  return { directory: folder, jsonPath };
}

module.exports = { writeOutputPackage };
