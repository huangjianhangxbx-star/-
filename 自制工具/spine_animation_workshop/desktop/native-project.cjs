const { execFile } = require('node:child_process');
const { promisify, isDeepStrictEqual } = require('node:util');
const { mkdir, mkdtemp, readFile, readdir, stat, writeFile, cp, lstat } = require('node:fs/promises');
const { basename, dirname, extname, join, resolve, relative, isAbsolute } = require('node:path');
const { createHash } = require('node:crypto');
const { loadSpineResource } = require('./package-store.cjs');
const exec = promisify(execFile);
const VERSION = '4.3.26';

async function runSpine(executable, args) {
  try {
    return await exec(executable, ['-u', VERSION, ...args], {
      windowsHide: true, shell: false, timeout: 240000, maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`Spine 后台处理失败：${String(error.stderr || error.stdout || error.message).slice(-3000)}`);
  }
}

/** Export read-only through the installed official editor. Native project bytes never enter the renderer. */
async function loadNativeProject(projectPath, label, options) {
  if ((await stat(projectPath)).size > 150 * 1024 * 1024) throw new Error(`${label}工程超过 150 MB`);
  const projectBytes = await readFile(projectPath);
  await mkdir(options.cacheRoot, { recursive: true });
  const directory = await mkdtemp(join(options.cacheRoot, 'project-'));
  const run = options.run || ((args) => runSpine(options.executable, args));
  await run(['-i', projectPath, '-o', directory, '-e', 'json+pack']);
  if (!projectBytes.equals(await readFile(projectPath))) throw new Error('读取期间原工程已变化，请保存工程后重新载入');
  const files = await readdir(directory);
  const skeletons = [];
  const documents = {};
  for (const name of files.filter((name) => name.endsWith('.json'))) {
    const json = JSON.parse(await readFile(join(directory, name), 'utf8'));
    if (Array.isArray(json.bones)) { skeletons.push(name); documents[basename(name, '.json')] = json; }
  }
  if (!skeletons.length) throw new Error('Spine 未导出骨架，请检查编辑器授权、版本及工程图片路径');
  let name = skeletons[0];
  if (skeletons.length > 1) {
    if (!options.chooseSkeleton) throw new Error('工程包含多个骨架，需要选择迁移的骨架');
    name = await options.chooseSkeleton(skeletons);
    if (name == null) return null;
    if (!skeletons.includes(name)) throw new Error('选择的骨架无效');
  }
  const atlases = files.filter((name) => name.endsWith('.atlas'));
  const exact = `${basename(name, '.json')}.atlas`;
  const atlas = atlases.includes(exact) ? exact : atlases.length === 1 ? atlases[0] : null;
  if (!atlas) throw new Error('无法确定骨架的图集，请检查工程图片和图集设置');
  const resource = await loadSpineResource(join(directory, name), label, join(directory, atlas));
  const json = JSON.parse(resource.jsonText);
  if (!String(json.skeleton?.spine).startsWith('4.3.')) throw new Error('后台导出版本不是 Spine 4.3');
  return {
    ...resource, path: projectPath, name: basename(projectPath),
    protectedPaths: [...resource.protectedPaths, projectPath],
    native: { projectPath, projectBytes, documents, skeletonName: basename(name, extname(name)), directory, executable: options.executable },
  };
}

function assertRoundtrip(expected, actual) {
  function normalize(value) {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key, value]) => !(key === 'time' && value === 0)).map(([key, value]) => [key, normalize(value)]));
  }
  function skeletonData(value) {
    const copy = structuredClone(value);
    if (copy.skeleton) for (const key of ['hash', 'images', 'audio']) delete copy.skeleton[key];
    return normalize(copy);
  }
  if (!isDeepStrictEqual(skeletonData(expected), skeletonData(actual))) throw new Error('导回校验失败：工程骨架或动画数据发生非预期变化');
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
function within(parent, child) {
  const part = relative(resolve(parent), resolve(child));
  return part === '' || (part !== '..' && !part.startsWith(`..${require('node:path').sep}`) && !isAbsolute(part));
}

async function prepareNativeHandoff({ directory, target, jsonText, animationName, run }) {
  const native = target.native;
  if (!native) throw new Error('请先载入目标 .spine 工程');
  if (!native.projectBytes.equals(await readFile(native.projectPath))) throw new Error('目标原工程已变化，请重新载入再生成');
  const candidate = JSON.parse(jsonText);
  if (!Object.hasOwn(candidate.animations || {}, animationName)) throw new Error('候选缺少待导入动画');
  const baseline = JSON.parse(target.jsonText);
  if (Object.hasOwn(baseline.animations || {}, animationName)) throw new Error('原有同名动画不能隐式覆盖，请使用新动画名称');
  const withoutAdded = structuredClone(candidate);
  delete withoutAdded.animations[animationName];
  if (!baseline.animations && !Object.keys(withoutAdded.animations).length) delete withoutAdded.animations;
  assertRoundtrip(baseline, withoutAdded);
  const documents = native.documents || { [native.skeletonName]: baseline };
  // Reserve enough nested directories to preserve ../ image and audio references without escaping this job.
  const assetPaths = [...new Set(Object.values(documents).flatMap((doc) => [doc.skeleton?.images,
    Object.values(doc.events || {}).some((event) => event.audio) ? doc.skeleton?.audio : null]).filter(Boolean))];
  const relativePaths = assetPaths.filter((path) => !isAbsolute(path));
  const depth = Math.max(0, ...relativePaths.map((path) => path.split(/[\\/]/).filter((part) => part === '..').length));
  const projectDirectory = resolve(directory, 'target-project', ...Array.from({ length: depth }, (_, i) => `level-${i + 1}`));
  const copies = [];
  for (const path of relativePaths) {
    const from = resolve(dirname(native.projectPath), path);
    const to = resolve(projectDirectory, path);
    if (!within(join(directory, 'target-project'), to)) throw new Error('工程资源相对路径超出导回目录');
    if (within(from, directory)) throw new Error('输出目录不能放在原工程的图片或音频目录内');
    try { if (!(await stat(from)).isDirectory()) continue; }
    catch { throw new Error(`工程资源目录不存在：${from}。请在 Spine 中修正图片/音频路径后重试`); }
    copies.push({ from, to });
  }
  await mkdir(projectDirectory, { recursive: true });
  const projectPath = join(projectDirectory, basename(native.projectPath));
  await writeFile(projectPath, native.projectBytes, { flag: 'wx' });
  for (const { from, to } of copies) await cp(from, to, { recursive: true, errorOnExist: true, force: false,
    filter: async (path) => { if ((await lstat(path)).isSymbolicLink()) throw new Error(`资源包含链接，请先整理为实际文件：${path}`); return true; } });
  const internal = join(directory, '_internal');
  await mkdir(internal);
  const carrier = structuredClone(candidate);
  carrier.animations = { [animationName]: candidate.animations[animationName] };
  // The carrier is not the delivered target. It only transports keys into the unchanged original project copy.
  if (carrier.skeleton.images) carrier.skeleton.images = resolve(dirname(native.projectPath), carrier.skeleton.images).replaceAll('\\', '/');
  const carrierJsonPath = join(internal, 'animation.json');
  const carrierPath = join(internal, 'animation.spine');
  await writeFile(carrierJsonPath, JSON.stringify(carrier), { flag: 'wx' });
  const invoke = run || ((args) => runSpine(native.executable, args));
  await invoke(['-i', carrierJsonPath, '-o', carrierPath, '-r', native.skeletonName]);
  if (!(await stat(carrierPath)).size) throw new Error('Spine 未创建动画导入文件');
  const expectedDocuments = { ...documents, [native.skeletonName]: candidate };
  const job = { state: 'awaiting-editor-import', directory: resolve(directory), projectDirectory, projectPath,
    carrierJsonPath, carrierPath, animationName, skeletonName: native.skeletonName,
    executable: native.executable, originalPath: native.projectPath, originalHash: sha256(native.projectBytes), expectedDocuments };
  await writeFile(join(directory, 'native-handoff.json'), JSON.stringify(job, null, 2), { flag: 'wx' });
  await writeFile(join(directory, '导入说明.txt'), [
    '状态：已准备，尚未导入动画。目标工程是原文件的逐字节副本，没有重建骨架。',
    `1. 在 Spine 打开：${projectPath}`,
    '2. 主菜单 → 导入项目 / Import Project，粘贴下方导入文件地址。',
    carrierPath,
    `3. 选择“动画 / Animation”，来源骨架和目标骨架均选 ${native.skeletonName}，勾选 ${animationName} 后导入。`,
    '4. 保存工程，回到工坊点击“校验导回结果”。校验通过后使用 target-project 中的 .spine。',
    '不要选择“骨架 / Skeleton”，否则会增加一个骨架，校验将不通过。',
    '无需导出 JSON 或解包图片。_internal 是工坊准备的中间文件，无需编辑。',
    '原工程未修改。原工程中使用绝对路径的资源仍引用原位置；相对路径资源已随副本整理。',
  ].join('\r\n'), 'utf8');
  return job;
}

async function verifyNativeHandoff(job, run) {
  if (sha256(await readFile(job.originalPath)) !== job.originalHash) throw new Error('原工程在准备后已变化；请核对原文件，当前校验不能标记为通过');
  const directory = await mkdtemp(join(job.directory, '_verify-'));
  const invoke = run || ((args) => runSpine(job.executable, args));
  await invoke(['-i', job.projectPath, '-o', directory, '-e', 'json']);
  const actualDocuments = {};
  for (const name of (await readdir(directory)).filter((name) => name.endsWith('.json'))) {
    const doc = JSON.parse(await readFile(join(directory, name), 'utf8'));
    if (Array.isArray(doc.bones)) actualDocuments[basename(name, '.json')] = doc;
  }
  if (!isDeepStrictEqual(Object.keys(actualDocuments).sort(), Object.keys(job.expectedDocuments).sort())) throw new Error('导回校验失败：骨架数量或名称发生变化，请选择“动画”导入');
  for (const [name, expected] of Object.entries(job.expectedDocuments)) {
    if (name === job.skeletonName && !Object.hasOwn(actualDocuments[name].animations || {}, job.animationName)) {
      throw new Error('尚未检测到新动画，请在 Spine 中导入指定动画并保存，再重新校验');
    }
    assertRoundtrip(expected, actualDocuments[name]);
  }
  const result = { passed: true, projectPath: job.projectPath, animationName: job.animationName, checkedAt: new Date().toISOString(), projectHash: sha256(await readFile(job.projectPath)) };
  await writeFile(join(job.directory, 'native-verification.json'), JSON.stringify(result, null, 2), 'utf8');
  return result;
}

module.exports = { loadNativeProject, runSpine, assertRoundtrip, prepareNativeHandoff, verifyNativeHandoff };
