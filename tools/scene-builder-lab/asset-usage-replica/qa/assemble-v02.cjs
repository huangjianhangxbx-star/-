'use strict';
// Default invocation is read-only. Only --deploy copies files. This script
// never launches an Editor, closes a user process, creates a project, or removes
// an existing asset. Run CurveDeliveryQa.Run in the existing QA Editor first.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const qaProject = path.join(root, 'qa/unity-session');
const candidateProject = path.join(root, 'candidate');
const project = path.resolve(root, '../../procedural-world-editor/LE-01/星骸地编');
const workspace = path.resolve(root, '../../../..');
const privateReports = path.join(workspace, '参考游戏研究/Tiny Glade/TG-asset-usage-20261104/v02-reference');
const br = 'Assets/BridgeReplica/';
const privatePrefix = br + 'ResearchPrivate/';
const manifestPath = path.join(root, 'reports/v02-delivery-public.json');
const args = process.argv.slice(2);
if (args.some(a => !['--check', '--deploy'].includes(a)) || (args.includes('--check') && args.includes('--deploy'))) {
  throw Error('Usage: node qa/assemble-v02.cjs [--check | --deploy]');
}
const deploy = args.includes('--deploy');
const sha = data => crypto.createHash('sha256').update(data).digest('hex').toUpperCase();
const hashFile = file => sha(fs.readFileSync(file));
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const norm = value => value.split(path.sep).join('/');
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
function inside(base, relative) {
  if (!relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(v => !v || v === '.' || v === '..')) throw Error('Unsafe relative path: ' + relative);
  const full = path.resolve(base, relative);
  if (!full.toLowerCase().startsWith(path.resolve(base).toLowerCase() + path.sep)) throw Error('Path escaped intended root: ' + relative);
  return full;
}
function walk(folder) {
  if (!fs.existsSync(folder)) return [];
  const result = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (fs.lstatSync(file).isSymbolicLink()) throw Error('Linked input preserved: ' + file);
    if (entry.isDirectory()) result.push(...walk(file)); else if (entry.isFile()) result.push(file);
  }
  return result;
}
function guid(file) {
  const match = fs.readFileSync(file, 'utf8').match(/^guid:\s*(\S+)/m);
  if (!match) throw Error('GUID metadata missing: ' + file);
  return match[1]; // Tuanjie GUIDs need not be 32 hexadecimal characters.
}
function requirePass(file) {
  const value = json(file);
  if (value.status !== 'PASS') throw Error('Required targeted check is not PASS: ' + file);
  return value;
}
function requireDocumentedNativeLimitation(file) {
  const value = json(file);
  const nativeName = 'native SaveScene actually cancels public serialization';
  const expectedPassed = [
    'actual private source mesh used by valid committed route',
    'research prefab bake refuses before export',
    'research author file refuses public location',
    'research scene refuses public path before save',
    'research native persistence refuses public derived mesh path',
    'private author and native scene preserve editable exact meshes',
    'public scene with publicly disguised research kit is rejected by actual closure',
    'temporary public privacy probes cleaned after recording actual result'
  ];
  if (value.status !== 'FAIL' || !Array.isArray(value.checks) || value.checks.length !== 9 ||
      expectedPassed.some(name => value.checks.filter(c => c.name === name && c.status === 'PASS').length !== 1) ||
      value.checks.filter(c => c.name === nativeName && c.status === 'FAIL').length !== 1 ||
      !value.nativeProbe || value.nativeProbe.attempted !== true || value.nativeProbe.fileWritten !== true ||
      value.nativeProbe.guardCancelled !== false || value.probeArtifactsCleaned !== true) {
    throw Error('Privacy report differs from the one explicitly documented native SaveScene limitation: ' + file);
  }
  const probe = inside(qaProject, value.nativeProbe.path);
  if (fs.existsSync(probe)) throw Error('Characterized native bypass probe was not cleaned: ' + probe);
  return { reportStatus: value.status, passed: 8, failed: 1, failedCheck: nativeName,
    limitation: 'Unity native SaveScene is not an isolation guarantee. Tool SaveAuthor/SaveScene/PersistScene/Bake guards and the actual public dependency whitelist are the supported boundary.' };
}
function sourceList(base) {
  return [...walk(path.join(base, 'Assets/BridgeReplica/Runtime')), ...walk(path.join(base, 'Assets/BridgeReplica/Editor'))].filter(f => f.endsWith('.cs'))
    .map(f => norm(path.relative(base, f)))
    .filter(r => !r.includes('/Editor/QA/') && !r.includes('/ResearchPrivate/'))
    .sort().map(r => ({ relativePath: r, sha256: hashFile(inside(base, r)) }));
}
const sourceHash = records => sha(Buffer.from(records.map(f => f.relativePath + '|' + f.sha256).join('\n'), 'utf8'));
function publicPath(relative) {
  return (relative.startsWith(br) || relative === 'Assets/BridgeReplica.meta') &&
    !relative.startsWith(privatePrefix) && relative !== privatePrefix.slice(0, -1) + '.meta' &&
    !relative.includes('/Editor/QA/') && !relative.endsWith('/Editor/QA.meta');
}
function privatePath(relative) { return relative.startsWith(privatePrefix) || relative === privatePrefix.slice(0, -1) + '.meta'; }
function assetDataSafe(file, relative) {
  if (!/\.(?:unity|prefab|asset|mat|json)$/i.test(relative)) return;
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('/ResearchPrivate/') || text.includes('\\ResearchPrivate\\') || text.includes('research.tinyglade.partial') || /ResearchOnly:\s*1\b/.test(text)) {
    throw Error('Public dependency contains a private research reference: ' + relative);
  }
}
function protectSnapshot() {
  const protectedFiles = walk(path.join(project, 'Assets/SB03'));
  const sbMeta = path.join(project, 'Assets/SB03.meta');
  if (fs.existsSync(sbMeta)) protectedFiles.push(sbMeta);
  // The existing project stores scenes in each module's Scenes/WorkScenes.
  // Use those small trees plus the P0 ledger; do not crawl generated terrain,
  // Library, Packages, or the rest of the user's project for a bridge delivery.
  for (const record of baseline.originalScenesAndWorkScenes.files) {
    protectedFiles.push(inside(project, record.relativePath));
    if (record.meta) protectedFiles.push(inside(project, record.meta.relativePath));
  }
  for (const entry of fs.readdirSync(path.join(project, 'Assets'), { withFileTypes: true }).filter(e => e.isDirectory())) {
    for (const name of ['Scenes', 'WorkScenes']) protectedFiles.push(...walk(path.join(project, 'Assets', entry.name, name)).filter(f => /\.unity(?:\.meta)?$/i.test(f)));
  }
  protectedFiles.push(...walk(path.join(project, 'Assets/BridgeReplica/ResearchPrivate')).filter(f => /\.unity(?:\.meta)?$/i.test(f)));
  return [...new Set(protectedFiles)].sort().map(file => ({ file, sha256: hashFile(file) }));
}
function assertProtected(snapshot) {
  for (const record of snapshot) if (!fs.existsSync(record.file) || hashFile(record.file) !== record.sha256) throw Error('Protected SB03/scene changed: ' + record.file);
}
function rootChecked(folder, label) {
  if (!fs.existsSync(folder) || !samePath(fs.realpathSync(folder), folder)) throw Error(label + ' must exist at its actual named path, without a junction: ' + folder);
}
rootChecked(project, 'Renamed user project');
rootChecked(qaProject, 'Existing QA project');
rootChecked(candidateProject, 'Candidate');
if (!fs.existsSync(path.join(project, 'ProjectSettings/ProjectVersion.txt'))) throw Error('Actual research project is missing. No project will be created.');
const baseline = requirePass(path.join(root, 'reports/v02-baseline.json'));
if (!samePath(baseline.project.realPath, project)) throw Error('P0 names a different actual research project.');
for (const f of baseline.sources.SB03.files) {
  const actual = inside(project, 'Assets/SB03/' + f.relativePath);
  if (hashFile(actual) !== f.sha256) throw Error('Protected SB03 production source differs from P0: ' + actual);
}
const requiredReports = [
  'curve-core-tests.json', 'v02-real-geometry.json', 'v02-exact-stair-green.json',
  'v02-persistence-input-green.json', 'v02-input-api.json', 'v02-curve-lifecycle.json', 'v02-curve-reopen.json'
];
for (const name of requiredReports) requirePass(path.join(root, 'reports', name));
for (const name of ['unity-import-result.json', 'source-consumption-result.json', 'source-consumption-reopen.json']) requirePass(path.join(privateReports, name));
const privacyCharacterization = requireDocumentedNativeLimitation(path.join(privateReports, 'curve-private-save-result.json'));
const manifest = requirePass(manifestPath);
if (manifest.scene !== br + 'Scenes/CurveWorkflow.unity' || manifest.researchArtifactsIncluded || manifest.physicalInput || manifest.originalGameBehavior) throw Error('Unexpected delivery manifest or unsupported completion claims.');
const candidateSources = sourceList(candidateProject), qaSources = sourceList(qaProject);
if (sourceHash(candidateSources) !== manifest.productionSourceHash || sourceHash(qaSources) !== manifest.productionSourceHash || sourceHash(manifest.productionSources.map(f => ({ relativePath: f.relativePath, sha256: f.sha256 })).sort((a,b) => a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0)) !== manifest.productionSourceHash) {
  throw Error('Production source changed after the delivery scene/whitelist was verified. Regenerate the targeted delivery evidence.');
}
const protectedBefore = protectSnapshot();
const protectedPaths = new Set(protectedBefore.map(f => path.resolve(f.file).toLowerCase()));
const oldProduction = new Map(baseline.sources.BridgeReplica.files.map(f => [br + f.relativePath, f.sha256]));
const plan = new Map();
function addCopy(source, destination, relative, scope, allowProductionChange) {
  const sourceHashValue = hashFile(source);
  const destinationExists = fs.existsSync(destination);
  if (destinationExists && fs.lstatSync(destination).isSymbolicLink()) throw Error('Linked destination preserved: ' + destination);
  if (relative.endsWith('.meta') && destinationExists) {
    if (guid(source) !== guid(destination)) throw Error('Existing GUID would change: ' + destination);
    return; // Keep the entire existing .meta, including importer settings.
  }
  if (destinationExists && hashFile(destination) === sourceHashValue) return;
  if (destinationExists) {
    if (protectedPaths.has(path.resolve(destination).toLowerCase())) throw Error('Existing scene/SB03 asset would be overwritten: ' + destination);
    if (!allowProductionChange || !oldProduction.has(relative) || hashFile(destination) !== oldProduction.get(relative)) throw Error('Existing non-baseline data preserved; inspect this conflict: ' + destination);
  }
  const key = path.resolve(destination).toLowerCase();
  const existing = plan.get(key);
  if (existing && existing.sha256 !== sourceHashValue) throw Error('Conflicting delivery inputs for ' + destination);
  plan.set(key, { source, destination, relative, scope, sha256: sourceHashValue, existed: destinationExists });
}
const whitelist = new Map();
for (const record of manifest.files) {
  if (whitelist.has(record.relativePath)) throw Error('Duplicate whitelist record: ' + record.relativePath);
  const source = inside(qaProject, record.relativePath);
  if (hashFile(source) !== record.sha256 || fs.statSync(source).size !== record.bytes) throw Error('Actual dependency changed after validation: ' + record.relativePath);
  whitelist.set(record.relativePath, record);
  if (!publicPath(record.relativePath)) {
    if (!record.relativePath.startsWith('Assets/SB03/') && record.relativePath !== 'Assets/SB03.meta' && !record.relativePath.startsWith('Assets/LE01/Rendering/') && !['Assets/LE01.meta', 'Assets/LE01/Rendering.meta'].includes(record.relativePath)) throw Error('Closure escaped allowed public dependencies: ' + record.relativePath);
    const target = inside(project, record.relativePath);
    if (!fs.existsSync(target) || (record.relativePath.endsWith('.meta') ? guid(source) !== guid(target) : hashFile(target) !== record.sha256)) throw Error('Protected external dependency differs or is missing: ' + record.relativePath);
    continue; // Never deploy into SB03 or the existing rendering pipeline.
  }
  assetDataSafe(source, record.relativePath);
  const inCandidate = inside(candidateProject, record.relativePath);
  // Candidate receives only the actual public whitelist. It never receives QA
  // fixtures, private meshes, or a broad copy of the QA Assets directory.
  addCopy(source, inCandidate, record.relativePath, 'candidate-public', false);
  const production = record.relativePath.endsWith('.cs');
  addCopy(source, inside(project, record.relativePath), record.relativePath, 'project-public', production);
}
for (const record of candidateSources) {
  if (!whitelist.has(record.relativePath) || !whitelist.has(record.relativePath + '.meta')) throw Error('Production source or its stable GUID is absent from the delivery whitelist: ' + record.relativePath);
}
const privateFolder = path.join(qaProject, 'Assets/BridgeReplica/ResearchPrivate');
if (!fs.existsSync(privateFolder)) throw Error('Actual private source-consumption assets are missing.');
let privateCount = 0;
for (const source of [...walk(privateFolder), privateFolder + '.meta']) {
  if (!fs.existsSync(source)) throw Error('Private folder GUID metadata is missing.');
  const relative = norm(path.relative(qaProject, source));
  if (!privatePath(relative)) throw Error('Private asset escaped ResearchPrivate: ' + relative);
  addCopy(source, inside(project, relative), relative, 'project-private', false);privateCount++;
}
assertProtected(protectedBefore);
const operations = [...plan.values()];
const summary = {
  status: deploy ? 'READY' : 'CHECKED_ONLY', completion: 'STAGE_DELIVERY_PHYSICAL_T3_AND_T11_DEFERRED',
  project, sourceHash: manifest.productionSourceHash, publicScene: manifest.scene,
  operations: operations.length, candidatePublicWrites: operations.filter(o => o.scope === 'candidate-public').length,
  projectPublicWrites: operations.filter(o => o.scope === 'project-public').length,
  projectPrivateWrites: operations.filter(o => o.scope === 'project-private').length,
  protectedFiles: protectedBefore.length, privateInputFiles: privateCount,
  permanentProjectCreated: false, desktopUsed: false, editorStarted: false,
  originalAssetsPublished: false, existingAssetsDeleted: false, existingMetaReplaced: false,
  researchIsolation: privacyCharacterization,
  knownLimitation: privacyCharacterization.limitation,
  deployed: false, deferred: ['T3 physical mouse continuous drawing', 'T11 original-game source usage before/after']
};
if (!deploy) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(root, 'reports/deploy-v02-backup-' + stamp);
const changed = [];
try {
  // All validation/conflict checks above finish before the first filesystem
  // mutation. Only pre-existing public production code needs a backup.
  for (const operation of operations.filter(o => o.existed)) {
    if (operation.scope !== 'project-public' || !operation.relative.endsWith('.cs')) throw Error('Unexpected overwrite request: ' + operation.destination);
    const target = inside(backup, operation.relative);fs.mkdirSync(path.dirname(target), { recursive: true });fs.copyFileSync(operation.destination, target);
  }
  for (const operation of operations) {
    fs.mkdirSync(path.dirname(operation.destination), { recursive: true });fs.copyFileSync(operation.source, operation.destination);
    changed.push(operation.destination);
    if (hashFile(operation.destination) !== operation.sha256) throw Error('Copied bytes do not match: ' + operation.destination);
  }
  assertProtected(protectedBefore);
  if (sourceHash(sourceList(project)) !== manifest.productionSourceHash || sourceHash(sourceList(candidateProject)) !== manifest.productionSourceHash) throw Error('Deployed/candidate source hash mismatch.');
  for (const record of manifest.files.filter(f => publicPath(f.relativePath) && !f.relativePath.endsWith('.meta'))) {
    if (hashFile(inside(project, record.relativePath)) !== record.sha256 || hashFile(inside(candidateProject, record.relativePath)) !== record.sha256) throw Error('Public closure was not reproduced exactly: ' + record.relativePath);
  }
  summary.status = 'PASS';summary.deployed = true;summary.backup = operations.some(o => o.existed) ? backup : null;
  summary.changedFiles = changed.map(p => norm(path.relative(workspace, p)));
} catch (error) {
  summary.status = 'FAIL';summary.error = error.stack;summary.backup = backup;summary.changedFiles = changed;
  // Preserve the exact failure and backups. No recursive cleanup or silent
  // rollback may remove user assets; the root task reviews the concrete state.
  fs.writeFileSync(path.join(root, 'reports/v02-delivery.json'), JSON.stringify(summary, null, 2));throw error;
}
fs.writeFileSync(path.join(root, 'reports/v02-delivery.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
