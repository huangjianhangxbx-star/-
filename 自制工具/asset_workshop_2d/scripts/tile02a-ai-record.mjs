import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {createTilePipeline} = require('../desktop/tile-pipeline.cjs');
const {readZip, validateZip} = require('../archive/export-zip.cjs');
const {assertLockedSpec, specHash} = require('../workflow/package-v7.cjs');
const {sha} = require('../workflow/store.cjs');
const {decodeSample} = require('../workflow/session.cjs');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const labels = {grass: '草地', stone: '石质边界', standard: '标准', extreme: '极端'};
const source = 'builtin image_gen imagegen; guide-edit derivation';
const observations = {
  'grass-standard': '整体更接近平面俯视，未见明显草土台；碎叶、花与石子仍较多。四区外角仍趋向方形平面分区，不能据此认为联通形式合格。',
  'grass-extreme': '叶片细节有所减弱，但仍零碎；外角仍被画成方形平面分区，未自动接受。极端档是独立导引重绘，不是标准图的风格收口版本。',
  'stone-standard': '主要前暗面统一朝画面下方，但外角趋向完整方块；孔洞内壁仍呈透视体块，连续亮边与材质斑驳较多。不能宣布母版视角合格。',
  'stone-extreme': '部分结构黑暗有所合并，顶沿连续亮边仍违反极端档约束；右侧样品分块与孔洞仍像立体展块，未自动接受。'
};

function inside(file, directory) {
  const relative = path.relative(directory, file);
  return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
async function originalFile(file, directory) {
  assert(path.isAbsolute(file) && inside(path.resolve(file), directory), 'Original input must be inside its declared local evidence/resources directory');
  const stat = await fs.lstat(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 32 * 1024 * 1024, 'Original input must be a bounded regular file');
  const real = await fs.realpath(file);
  assert(inside(real, directory), 'Original input resolves outside its allowed directory');
  return fs.readFile(real);
}
async function notExisting(file) {
  try { await fs.lstat(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw Error('Refusing to overwrite prior evidence: ' + file);
}
function originalZip(bytes) {
  const archive = readZip(bytes);
  const manifest = JSON.parse(archive.files['manifest.json']);
  const {publicKey, signature, ...authority} = manifest;
  assert.equal(manifest.schemaVersion, '2dw-zip/7');
  assert.equal(manifest.issuerFingerprint, sha(Buffer.from(publicKey)));
  assert(crypto.verify(null, json(authority), publicKey, Buffer.from(signature, 'base64')), 'Original task signature does not verify');
  assert.equal(manifest.entries.length, Object.keys(archive.files).length - 1);
  const names = new Set();
  for (const item of manifest.entries) {
    assert(!names.has(item.path) && item.path !== 'manifest.json', 'Duplicate or self-referential task entry');
    names.add(item.path);
    assert.equal(sha(archive.files[item.path]), item.sha256);
    assert.equal(archive.files[item.path].length, item.byteLength);
  }
  assert(Object.keys(archive.files).every(name => name === 'manifest.json' || names.has(name)));
  const spec = JSON.parse(archive.files['spec/asset-spec.json']);
  assert.equal(spec.schemaVersion, '1.5.0');
  assert.equal(spec.protocolVersion, 7);
  assert.equal(spec.stage, 'sample-task');
  assertLockedSpec(spec.lockedSpec);
  assert.equal(specHash(spec.lockedSpec), spec.specHash);
  validateZip(bytes);
  return {archive, spec, integrity: {manifestSha256: sha(archive.files['manifest.json']), signatureVerified: true, allEntryHashesVerified: true, currentCanonical: {passed: true, error: null}}};
}
async function currentPublicProof() {
  const base = await fs.realpath(path.join(root, 'samples', '2dw-tile02a'));
  const names = (await fs.readdir(base, {withFileTypes: true})).filter(entry => entry.isDirectory() && /^proof-\d+-[a-f0-9]+$/.test(entry.name)).map(entry => entry.name).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  assert(names.length, 'Expected an existing public proof containing eight original technical task ZIPs');
  const directory = await fs.realpath(path.join(base, names[0])); assert(inside(directory, base));
  const manifestPath = path.join(directory, 'SHA256.json'), manifestBytes = await originalFile(manifestPath, directory), manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.schemaVersion, '2dw-tile02a-public-fixtures/1'); assert.equal(manifest.files.length, 8);
  const files = [], seen = new Set();
  for (const entry of manifest.files) {
    assert(typeof entry.path === 'string' && path.basename(entry.path) === entry.path && entry.path.endsWith('.zip') && !seen.has(entry.path)); seen.add(entry.path);
    const file = path.join(directory, entry.path), bytes = await originalFile(file, directory);
    assert.equal(sha(bytes), entry.sha256); assert.equal(bytes.length, entry.fileBytes);
    const checked = validateZip(bytes); assert.equal(checked.manifest.schemaVersion, '2dw-zip/7'); assert.equal(checked.spec.schemaVersion, '1.5.0');
    assert.equal(checked.spec.specHash, entry.specHash); assert.equal(checked.spec.taskId, entry.taskId);
    if (checked.spec.stage !== 'sample-task') { assert.equal(checked.spec.sample.testOnly, true); assert.equal(checked.spec.formReview.reviewedBy, 'synthetic/test-only'); }
    if (checked.spec.stage === 'formal-master-task') assert.equal(checked.spec.approval.approvedBy, 'synthetic/test-only');
    files.push({path: file, sha256: sha(bytes), fileBytes: bytes.length, canonicalValidated: true, taskId: entry.taskId, specHash: entry.specHash, stage: checked.spec.stage});
  }
  return {directory, manifestPath, manifestSha256: sha(manifestBytes), localFilesModified: false, count: files.length, currentCanonicalPassed: files.length, files};
}
function optionsFor(spec) {
  const g = spec.grammar;
  return {protocolVersion: 7, templateId: g.template.id, cellPixels: g.cellPixels, ppu: g.ppu,
    strategy: spec.strategy, seed: g.seed ?? 17, description: spec.description,
    viewContractId: spec.viewContract.id, stylePressure: spec.stylePressure.mode,
    ...(spec.strategy === 'layered' ? {masterPixels: g.master.width} : {})};
}
const htmlEscape = value => String(value).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const localLink = relative => relative.split(path.sep).map(encodeURIComponent).join('/');
function page(report) {
  const card = record => `<article><h3>${labels[record.mode]}</h3><img src="${encodeURIComponent(record.original.filename)}" alt="${labels[record.kind]}${labels[record.mode]}原始 AI 返回图"><p>${record.original.widthPx} × ${record.original.heightPx}px · ${record.original.fileBytes.toLocaleString('en-US')} bytes · ${record.original.alphaClass}</p><p class="sha">SHA256 ${record.original.sha256}</p><p>${htmlEscape(record.observation.notes)}</p><p class="links"><a href="${encodeURIComponent(path.basename(record.task.zipPath))}">实际调用任务 ZIP</a><a href="${encodeURIComponent(path.basename(record.task.promptPath))}">实际调用提示</a><a href="${localLink(path.relative(report.inputDirectory, record.project.path))}">未批准工程 ZIP</a></p>${record.task.integrity.currentCanonical.passed ? '' : `<p class="warning">当前规范校验未通过：${htmlEscape(record.task.integrity.currentCanonical.error)}。原始文件和签名保留，未改包以迎合新版提示。</p>`}</article>`;
  const sections = ['grass', 'stone'].map(kind => `<section data-family="${kind}"><h2>${labels[kind]}</h2><div class="pair">${report.records.filter(record => record.kind === kind).map(card).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>2DW-TILE-02A 真实 AI 原图对照</title><style>body{margin:0;background:#172023;color:#e4e6de;font:16px/1.6 system-ui,sans-serif}main{max-width:1450px;margin:auto;padding:28px}h1{font-size:26px}h2{margin-top:36px}h3{margin-top:0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:22px}article{padding:18px;background:#222e31;border:1px solid #53605f}img{display:block;width:100%;height:auto;background:#101416}.sha{font:12px/1.5 ui-monospace,monospace;overflow-wrap:anywhere}.links{display:flex;gap:16px;flex-wrap:wrap}a{color:#bcd8ca}.warning{color:#f0c19c}.banner{padding:14px;border-left:4px solid #d1a773;background:#293537}select{padding:8px;background:#222e31;color:#e4e6de;border:1px solid #74857e}@media(max-width:800px){.pair{grid-template-columns:1fr}main{padding:16px}}[hidden]{display:none!important}</style><main><h1>2DW-TILE-02A：真实 AI 原图标准 / 极端对照</h1><p class="banner">四张图均未获得用户形式确认或美术批准。Agent 观察不等于用户检查，正式生产门禁全部拒绝；Unity Sorting 未验。此页直接引用原始 PNG，仅使用浏览器 CSS 适配显示，没有裁切、拉伸写回或改图。</p><p>工具：${htmlEscape(report.tool)}；模型：${htmlEscape(report.model)}。实际工具输入为留存 prompt.txt 文本及两张图像参考，工具未直接解读 ZIP。ZIP 保留对应规范来源与输入身份。两种模式各自从相同导引与石砖 V1 风格参考独立生成；extreme 没有标准图父版本，不能报告为 style-refine 编辑。V1 仅代表质感方向，不授权继承其颜色、裂缝、构图。</p><label>查看 <select id="family"><option value="all">全部</option><option value="grass">草地</option><option value="stone">石质边界</option></select></label><p><a href="report.json">完整身份、输入哈希、门禁及工程记录</a></p>${sections}<p>语义和成熟手绘质感仍待用户审阅；未制作或编译正式 AI 母版，不以技术通过替代视觉合格。</p></main><script>document.getElementById('family').addEventListener('change',event=>document.querySelectorAll('[data-family]').forEach(section=>section.hidden=event.target.value!=='all'&&section.dataset.family!==event.target.value));</script></html>`;
}

export async function recordAiOutputs(inputDirectory) {
  assert(typeof inputDirectory === 'string' && inputDirectory.length, 'Usage: node scripts/tile02a-ai-record.mjs <AI evidence directory>');
  const allowed = await fs.realpath(path.join(root, 'validation', '2dw-tile02a'));
  const destination = await fs.realpath(path.resolve(inputDirectory));
  assert(inside(destination, allowed), 'AI output must remain in ignored validation/2dw-tile02a');
  const reportPath = path.join(destination, 'report.json'), indexPath = path.join(destination, 'originalindex.html');
  await notExisting(reportPath); await notExisting(indexPath);
  const plannedBytes = await originalFile(path.join(destination, 'calls-planned.json'), destination);
  const planned = JSON.parse(plannedBytes);
  assert.equal(planned.version, '2dw-tile02a-real-ai/1');
  assert.equal(planned.records.length, 4);
  const resources = await fs.realpath(path.join(root, 'resources'));
  const prepared = [], seen = new Set();
  for (const record of planned.records) {
    const key = `${record.kind}-${record.mode}`;
    assert(Object.hasOwn(observations, key) && !seen.has(key), 'Expected precisely four unique grass/stone standard/extreme calls'); seen.add(key);
    const bytes = await originalFile(path.join(destination, `${key}.png`), destination);
    const info = decodeSample(bytes);
    const zipBytes = await originalFile(record.zipPath, destination), promptBytes = await originalFile(record.promptPath, destination);
    assert.equal(sha(zipBytes), record.zipSha256); assert.equal(sha(promptBytes), record.promptSha256);
    const task = originalZip(zipBytes), spec = task.spec.lockedSpec;
    assert.equal(task.spec.specHash, record.specHash);
    assert.equal(spec.stylePressure.mode, record.mode); assert.equal(spec.viewContract.id, record.viewContractId); assert.equal(spec.stylePressure.id, record.stylePressureId);
    const guide = await originalFile(record.guidePath, resources), reference = await originalFile(record.referencePath, resources);
    assert.equal(sha(guide), record.guideSha256); assert.equal(sha(reference), record.referenceSha256);
    assert.equal(sha(task.archive.files['guides/view-guide.png']), record.guideSha256);
    assert.equal(sha(task.archive.files['refs/style/approved-stone-v1.png']), record.referenceSha256);
    prepared.push({key, record, bytes, info, task, spec, zipBytes, promptBytes});
  }
  for (const kind of ['grass', 'stone']) assert.equal(new Set(prepared.filter(item => item.record.kind === kind).map(item => item.record.guideSha256)).size, 1);
  assert.equal(new Set(prepared.map(item => item.record.referenceSha256)).size, 1);
  const publicProof = await currentPublicProof();
  const recordingDirectory = path.join(destination, `unapproved-recording-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
  await fs.mkdir(recordingDirectory);
  const records = [];
  for (const item of prepared) {
    const {key, record, bytes, info, task, spec} = item;
    const profile = path.join(recordingDirectory, key, 'profile'), directory = path.join(profile, 'tile-workflow');
    const projectPath = path.join(recordingDirectory, `${key}-unapproved-project.zip`);
    const pipeline = await createTilePipeline({directory, projectStyle: () => spec.projectStyleContract, pickSave: async () => projectPath});
    await pipeline.action('new', {options: optionsFor(spec)}); await pipeline.action('lock');
    assert.equal((await pipeline.state()).specHash, record.specHash);
    await pipeline.workflow.importSample(bytes, {kind: 'sample', source, label: `${labels[record.kind]} ${labels[record.mode]}：真实 AI 原图`, purpose: '真实AI导引派生小样；仅供观察，未进行用户形式确认或美术批准；两种模式独立重画。'});
    const state = await pipeline.state(), sample = await pipeline.workflow.getSample();
    assert.equal(sample.sha256, sha(bytes)); assert.equal(sample.parentId, null); assert.equal(sample.testOnly, false);
    assert.equal(state.versions.length, 1); assert.equal(state.formReview.status, 'unchecked'); assert.equal(state.approval, null);
    assert.equal(state.gates.styleReady, false); assert.equal(state.gates.approveReady, false); assert.equal(state.gates.formalReady, false);
    let formalGuard;
    try { await pipeline.workflow.productionGuard(); formalGuard = {blocked: false}; }
    catch (error) { formalGuard = {blocked: true, error: error.message}; }
    assert(formalGuard.blocked, 'A real AI observation cannot pass the production gate without user form review and approval');
    const saved = await pipeline.action('saveProject');
    const projectBytes = await fs.readFile(saved.path); assert.equal(saved.sha256, sha(projectBytes));
    const manifest = JSON.parse(readZip(projectBytes, {entries: 512, archiveBytes: 64 * 1024 * 1024}).files['manifest.json']);
    assert.equal(manifest.session.formReview, null); assert.equal(manifest.session.approval, null); assert.equal(manifest.session.versions.length, 1);
    const restored = await createTilePipeline({directory, projectStyle: () => spec.projectStyleContract});
    const restoredState = await restored.state(); assert.equal(restoredState.selectedSampleId, sample.id); assert.equal(restoredState.gates.formalReady, false);
    records.push({kind: record.kind, mode: record.mode, taskId: state.taskId, specHash: state.specHash,
      tool: planned.tool, model: planned.model ?? 'unknown (not exposed by tool)', parent: null, parentSampleId: null,
      derivation: {mode: 'guide-edit derivation', independentModeGeneration: true, styleRefineStage: false, directImageParent: null, guidePath: record.guidePath, guideSha256: record.guideSha256, positiveReferencePath: record.referencePath, positiveReferenceSha256: record.referenceSha256, referenceScope: 'mature hand-painted environment quality direction only; not its color, cracks, composition, or stone rules on grass'},
      original: {path: path.join(destination, `${key}.png`), filename: `${key}.png`, sha256: sha(bytes), fileBytes: bytes.length, widthPx: info.width, heightPx: info.height, alphaClass: info.alphaClass, unchanged: true},
      task: {zipPath: record.zipPath, zipSha256: sha(item.zipBytes), zipFileBytes: item.zipBytes.length, promptPath: record.promptPath, promptSha256: sha(item.promptBytes), promptFileBytes: item.promptBytes.length, zipProtocol: '2dw-zip/7', specSchemaVersion: '1.5.0', viewContractId: spec.viewContract.id, stylePressureId: spec.stylePressure.id, integrity: task.integrity},
      sample: {id: sample.id, revision: sample.revision, sha256: sample.sha256, source: sample.source, parentId: sample.parentId, kind: sample.kind, testOnly: sample.testOnly},
      project: {path: projectPath, sha256: sha(projectBytes), fileBytes: projectBytes.length, profile, directory, sameMachineRestartVerified: true},
      formReview: {status: 'unchecked', persistedReview: false, userCheck: false, automaticRecognition: false}, approval: null, formalGuard,
      observation: {by: 'Codex root visual observation supplied to this recording script', authority: 'agent-observation-only; not a user form review', notes: observations[key], formAccepted: false, humanArtApproval: false},
      artAcceptance: 'pending-human-review', unitySorting: 'unverified'});
  }
  const report = {schemaVersion: '2dw-tile02a-real-ai-observation/1', recordedAt: new Date().toISOString(), inputDirectory: destination, recordingDirectory,
    tool: planned.tool, model: planned.model ?? 'unknown (not exposed by tool)', actualAiGeneration: true,
    invocationEvidence: 'Four local image_gen returned files supplied by the root task. The tool consumed the stored prompt.txt text, including the outer actual-tool explanation, plus the guide/V1 image references; it did not directly unpack the ZIP. Actual prompts and corresponding task ZIPs are preserved, and model identity is not exposed.',
    plannedCalls: {path: path.join(destination, 'calls-planned.json'), sha256: sha(plannedBytes), fileBytes: plannedBytes.length},
    sameInputComparison: {sameGuideWithinEachFamily: true, sameV1ReferenceForAllCalls: true, independentStandardAndExtremeGeneration: true, extremeIsStyleRefine: false},
    policy: {originalImagesEdited: false, originalPromptsEdited: false, originalTaskZipsEdited: false, noCropOrReencode: true, projectsLocalOnly: true, formalMastersCreated: false, autoApproval: false, artAcceptance: 'pending-human-review', unitySorting: 'unverified'},
    publicProof, records, warnings: records.filter(record => !record.task.integrity.currentCanonical.passed).map(record => `${record.kind}-${record.mode}: original signature/hashes verify, but current canonical validator rejects: ${record.task.integrity.currentCanonical.error}`)};
  await fs.writeFile(reportPath, json(report), {flag: 'wx'});
  await fs.writeFile(indexPath, page(report), {flag: 'wx'});
  return {reportPath, indexPath, recordingDirectory, recordCount: records.length, formalProductionBlocked: records.filter(record => record.formalGuard.blocked).length, originalTaskCanonicalPassed: records.filter(record => record.task.integrity.currentCanonical.passed).length, publicProofCanonicalPassed: publicProof.currentCanonicalPassed, projects: records.map(record => record.project.path)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await recordAiOutputs(process.argv[2]), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
