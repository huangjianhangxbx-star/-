'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { constants } = require('node:fs');
const { zipSync, inflateSync } = require('fflate');
const { PNG } = require('pngjs');

const LIMITS = Object.freeze({ references: 8, referenceBytes: 4 * 1024 * 1024, referenceEdge: 4096, referencePixels: 16 * 1024 * 1024, archiveBytes: 32 * 1024 * 1024, entries: 64 });
const SPEC_PATH = 'spec/asset-spec.json';
const REQUIRED_TEXT = ['README_开始阅读.md', SPEC_PATH, 'spec/style-profile.md', 'plan/production-steps.md', 'prompts/codex.md', 'validation/checklist.md'];
const WORKFLOW_TEXT = ['workflow/recipe.json', 'workflow/analysis-plan.md', 'workflow/production-plan.md', 'workflow/decision-policy.md'];
const WORKFLOW_STEPS = ['verify-inputs', 'analyze-content-refs', 'analyze-style-refs', 'synthesize-brief', 'decision-gates', 'make-production-plan', 'produce-asset', 'verify-asset', 'handoff'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const abort = signal => { if (signal?.aborted) { const error = new Error('Export cancelled'); error.name = 'AbortError'; throw error; } };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const utf8 = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => { let n = i; for (let j = 0; j < 8; j++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : n >>> 1; return n >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

function safePath(name) {
  assert(typeof name === 'string' && name.length > 0 && name.length <= 240, 'Invalid package path');
  assert(name === name.normalize('NFC') && !/[\\:\x00-\x1f\x7f]/u.test(name) && !name.startsWith('/'), 'Unsafe package path');
  const parts = name.split('/');
  assert(parts.every(p => p && p !== '.' && p !== '..' && !/[. ]$/u.test(p) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(p)), 'Unsafe package path component');
  return name;
}
function identity(value) { assert(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(value), 'Unsafe reference identity'); return value; }
function taskIdentity(spec) {
  return { taskId: spec.taskId, assetSchemaVersion: spec.schemaVersion, presetId: spec.presetId, presetVersion: spec.presetVersion, adapterId: spec.adapterId, adapterVersion: spec.adapterVersion, expectedOutputPath: spec.output.relativePath,
    references: spec.references.map(({ sourcePath, ...reference }) => reference) };
}
function validateComposedSpec(spec) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validPresetIdentity = value => record(value) && typeof value.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u.test(value.id)
    && typeof value.version === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value.version);
  const output = spec.output;
  assert(typeof output.squareLocked === 'boolean', 'Invalid squareLocked flag');
  assert(Number.isSafeInteger(output.widthPx) && output.widthPx > 0 && Number.isSafeInteger(output.heightPx) && output.heightPx > 0, 'Invalid composed dimensions');
  assert(!output.squareLocked || output.widthPx === output.heightPx, 'squareLocked dimensions disagree');

  const composition = spec.composition;
  assert(record(composition) && ['preset', 'custom'].includes(composition.mode), 'Invalid composition');
  for (const axis of ['seed', 'purpose', 'structure', 'operation', 'style', 'adapter']) assert(validPresetIdentity(composition[axis]), `Invalid composition ${axis} identity`);
  assert((composition.mode === 'custom') === (composition.seed.id === 'custom'), 'Composition mode/seed disagree');
  assert(composition.seed.id === spec.presetId && composition.seed.version === spec.presetVersion, 'Composition seed disagrees with spec');
  assert(composition.adapter.id === 'codex' && composition.adapter.version === '1'
    && composition.adapter.id === spec.adapterId && composition.adapter.version === spec.adapterVersion, 'Composition adapter disagrees with spec');

  const style = spec.styleProfile;
  assert(record(style) && style.id === composition.style.id && style.version === composition.style.version, 'Style profile identity disagrees with composition');
  assert(typeof style.manualDescription === 'string' && Array.isArray(style.constraints) && Array.isArray(style.styleReferenceIds), 'Invalid style profile');
  assert(style.constraints.every(item => record(item) && ['hard', 'preferences', 'creativeFreedom'].includes(item.level) && typeof item.text === 'string' && item.text.length > 0), 'Invalid style constraint');
  const styleIds = spec.references.filter(reference => reference.role === 'style').map(reference => reference.refId);
  assert(isDeepStrictEqual(style.styleReferenceIds, styleIds), 'Style profile reference identities disagree with spec');
}
function validateWorkflowRecipe(recipe, spec) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const exactly = (value, keys) => record(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
  assert(exactly(recipe, ['schemaVersion', 'taskId', 'specPath', 'steps'])
    && recipe.schemaVersion === '2dw-workflow/1' && recipe.taskId === spec.taskId
    && recipe.specPath === SPEC_PATH && Array.isArray(recipe.steps)
    && recipe.steps.length === WORKFLOW_STEPS.length, 'Invalid workflow recipe identity');
  const roleIds = {
    content: spec.references.filter(reference => reference.role === 'content').map(reference => reference.refId),
    style: spec.references.filter(reference => reference.role === 'style').map(reference => reference.refId),
  };
  const activeIds = new Set();
  for (let index = 0; index < WORKFLOW_STEPS.length; index++) {
    const step = recipe.steps[index], expected = WORKFLOW_STEPS[index];
    assert(exactly(step, ['id', 'version', 'title', 'phase', 'dependsOn', 'activation', 'active', 'reason', 'outputs', 'trustedSource'])
      && step.id === expected && step.version === '1' && step.trustedSource === 'builtin'
      && typeof step.title === 'string' && step.title.trim().length > 0 && step.title.length <= 120
      && typeof step.phase === 'string' && step.phase.length > 0 && step.phase.length <= 64
      && typeof step.reason === 'string' && step.reason.trim().length > 0 && step.reason.length <= 1000
      && Array.isArray(step.outputs) && step.outputs.length > 0 && step.outputs.length <= 16
      && step.outputs.every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 240
        && safePath(value) && (expected === 'produce-asset'
          ? value === spec.output.relativePath : value.startsWith('reports/')))
      && Array.isArray(step.dependsOn) && step.dependsOn.length <= WORKFLOW_STEPS.length,
    `Invalid workflow step ${expected}`);
    const role = expected === 'analyze-content-refs' ? 'content' : expected === 'analyze-style-refs' ? 'style' : null;
    const expectedActivation = role === null
      ? { kind: 'always', refIds: [] }
      : { kind: 'reference-role', role, refIds: roleIds[role] };
    assert(isDeepStrictEqual(step.activation, expectedActivation)
      && step.active === (role === null || roleIds[role].length > 0), `Workflow activation disagrees with references: ${expected}`);
    const expectedDependencies = index === 0 ? [] : expected === 'handoff' ? ['verify-inputs'] : expected === 'synthesize-brief'
      ? ['verify-inputs', ...WORKFLOW_STEPS.slice(1, 3).filter(id => activeIds.has(id))]
      : role !== null ? ['verify-inputs']
        : [WORKFLOW_STEPS.slice(0, index).reverse().find(id => activeIds.has(id))];
    assert(isDeepStrictEqual(step.dependsOn, expectedDependencies)
      && step.dependsOn.every(id => activeIds.has(id)), `Invalid workflow dependencies: ${expected}`);
    if (step.active) activeIds.add(expected);
  }
}
function pngFacts(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= LIMITS.referenceBytes, 'Reference PNG byte budget exceeded');
  assert(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR', 'Invalid PNG header');
  const widthPx = bytes.readUInt32BE(16), heightPx = bytes.readUInt32BE(20);
  assert(widthPx > 0 && heightPx > 0 && widthPx <= LIMITS.referenceEdge && heightPx <= LIMITS.referenceEdge && widthPx * heightPx <= LIMITS.referencePixels, 'Reference PNG dimension budget exceeded');
  // Full decoding verifies chunk CRCs and compressed pixels, not just the IHDR dimensions.
  const decoded = PNG.sync.read(bytes, { checkCRC: true });
  assert(decoded.width === widthPx && decoded.height === heightPx && decoded.data.length === widthPx * heightPx * 4, 'Invalid decoded PNG');
  return { sha256: sha256(bytes), byteLength: bytes.length, widthPx, heightPx };
}
async function noLinks(absolute, { missing = false } = {}) {
  assert(typeof absolute === 'string' && path.isAbsolute(absolute), 'Absolute filesystem path required');
  assert(!absolute.split(/[\\/]/u).some(part => part === '.' || part === '..'), 'Filesystem dot segments are refused');
  const root = path.parse(absolute).root;
  let cursor = root;
  for (const part of path.relative(root, path.resolve(absolute)).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    let info;
    try { info = await fs.lstat(cursor); } catch (error) { if (missing && error.code === 'ENOENT') return; throw error; }
    assert(!info.isSymbolicLink(), 'Symbolic links and junctions are refused');
  }
}
async function readReferenceFacts(inputs) {
  assert(Array.isArray(inputs) && inputs.length <= LIMITS.references, 'Reference count must be 0–8');
  const ids = new Set();
  const facts = [], binaries = Object.create(null);
  let pixels = 0;
  for (const input of inputs) {
    const refId = identity(input?.refId);
    assert(!ids.has(refId.toLowerCase()), 'Duplicate reference identity'); ids.add(refId.toLowerCase());
    assert(input.role === 'content' || input.role === 'style', 'Invalid reference role');
    const source = input.sourcePath;
    assert(typeof source === 'string' && path.isAbsolute(source) && path.extname(source).toLowerCase() === '.png', 'Absolute PNG source path required');
    await noLinks(source);
    const handle = await fs.open(source, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    let bytes;
    try {
      const info = await handle.stat();
      assert(info.isFile() && info.size <= LIMITS.referenceBytes, 'Reference file byte budget exceeded');
      const bounded = Buffer.alloc(LIMITS.referenceBytes + 1);
      let length = 0;
      while (length < bounded.length) { const read = await handle.read(bounded, length, bounded.length - length, length); if (!read.bytesRead) break; length += read.bytesRead; }
      assert(length <= LIMITS.referenceBytes, 'Reference grew beyond byte budget');
      bytes = Buffer.from(bounded.subarray(0, length));
      await noLinks(source);
      const after = await fs.stat(source);
      assert(after.isFile() && after.dev === info.dev && after.ino === info.ino && after.size === info.size && after.mtimeMs === info.mtimeMs, 'Reference changed during read');
    } finally { await handle.close(); }
    const metadata = pngFacts(bytes);
    pixels += metadata.widthPx * metadata.heightPx;
    assert(pixels <= LIMITS.referencePixels, 'Total reference pixel budget exceeded');
    const sourceName = path.basename(source);
    assert(!/[\\:]/u.test(sourceName), 'Unsafe source basename');
    facts.push({ refId, ...metadata, sourceName }); binaries[refId] = bytes;
  }
  return { facts, binaries };
}

function readZip(buffer) {
  assert(Buffer.isBuffer(buffer) && buffer.length >= 22 && buffer.length <= LIMITS.archiveBytes, 'Invalid ZIP byte budget');
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { eocd = i; break; }
  assert(eocd >= 0, 'ZIP end directory missing');
  assert(buffer.readUInt16LE(eocd + 4) === 0 && buffer.readUInt16LE(eocd + 6) === 0, 'Split ZIP refused');
  const count = buffer.readUInt16LE(eocd + 10), directorySize = buffer.readUInt32LE(eocd + 12), directoryOffset = buffer.readUInt32LE(eocd + 16);
  assert(count > 0 && count <= LIMITS.entries && count === buffer.readUInt16LE(eocd + 8) && directoryOffset + directorySize === eocd, 'Invalid ZIP directory');
  const names = new Set(), ranges = [], files = Object.create(null), records = [];
  let position = directoryOffset, total = 0;
  for (let index = 0; index < count; index++) {
    assert(position + 46 <= eocd && buffer.readUInt32LE(position) === 0x02014b50, 'Invalid central directory entry');
    const flags = buffer.readUInt16LE(position + 8), method = buffer.readUInt16LE(position + 10), crc = buffer.readUInt32LE(position + 16), packedSize = buffer.readUInt32LE(position + 20), size = buffer.readUInt32LE(position + 24);
    const nameLength = buffer.readUInt16LE(position + 28), extra = buffer.readUInt16LE(position + 30), comment = buffer.readUInt16LE(position + 32), start = buffer.readUInt32LE(position + 42);
    assert(position + 46 + nameLength + extra + comment <= eocd && (flags & ~0x0800) === 0 && [0, 8].includes(method), 'Unsupported or encrypted ZIP');
    const nameBytes = buffer.subarray(position + 46, position + 46 + nameLength), name = safePath(utf8(nameBytes));
    const folded = name.toLowerCase(); assert(!names.has(folded), 'Duplicate ZIP path'); names.add(folded);
    assert((buffer.readUInt32LE(position + 38) >>> 16 & 0xf000) !== 0xa000, 'ZIP symbolic link refused');
    total += size; assert(total <= LIMITS.archiveBytes && packedSize <= LIMITS.archiveBytes, 'ZIP expanded byte budget exceeded');
    assert(start + 30 <= directoryOffset && buffer.readUInt32LE(start) === 0x04034b50, 'Local ZIP header missing');
    assert(buffer.readUInt16LE(start + 6) === flags && buffer.readUInt16LE(start + 8) === method && buffer.readUInt32LE(start + 14) === crc && buffer.readUInt32LE(start + 18) === packedSize && buffer.readUInt32LE(start + 22) === size, 'Local ZIP header mismatch');
    const localNameLength = buffer.readUInt16LE(start + 26), localExtra = buffer.readUInt16LE(start + 28), bodyStart = start + 30 + localNameLength + localExtra;
    assert(bodyStart + packedSize <= directoryOffset && buffer.subarray(start + 30, start + 30 + localNameLength).equals(nameBytes), 'ZIP path/header mismatch');
    ranges.push([start, bodyStart + packedSize]);
    const packed = buffer.subarray(bodyStart, bodyStart + packedSize);
    const body = method === 0 ? Buffer.from(packed) : Buffer.from(inflateSync(packed, { out: new Uint8Array(size + 1) }));
    assert(body.length === size && crc32(body) === crc, 'ZIP length or CRC mismatch');
    files[name] = body; records.push({ path: name, byteLength: body.length, sha256: sha256(body) });
    position += 46 + nameLength + extra + comment;
  }
  assert(position === eocd, 'Trailing ZIP directory data');
  ranges.sort((a, b) => a[0] - b[0]);
  let edge = 0; for (const [start, end] of ranges) { assert(start === edge && end >= start, 'Overlapping or hidden ZIP data'); edge = end; }
  assert(edge === directoryOffset, 'Unlisted local ZIP entry');
  return { files, records };
}
function validateZip(buffer) {
  const { files, records } = readZip(buffer);
  assert(files['manifest.json'] && REQUIRED_TEXT.every(name => files[name]), 'Required task text or manifest missing');
  const manifest = JSON.parse(utf8(files['manifest.json']));
  const workflow = manifest.schemaVersion === '2dw-zip/2';
  assert(['2dw-zip/1', '2dw-zip/2'].includes(manifest.schemaVersion)
    && manifest.specPath === SPEC_PATH && Array.isArray(manifest.entries), 'Invalid manifest');
  if (workflow) {
    assert(manifest.workflowRecipeVersion === '2dw-workflow/1'
      && WORKFLOW_TEXT.every(name => files[name] && files[name].length > 0), 'Required workflow text or version missing');
    const named = new Set([...REQUIRED_TEXT, ...WORKFLOW_TEXT, 'manifest.json']);
    assert(records.every(record => named.has(record.path) || record.path.startsWith('references/')), 'Unexpected workflow package entry');
  } else {
    assert(!Object.hasOwn(manifest, 'workflowRecipeVersion')
      && records.every(record => !record.path.startsWith('workflow/')), 'Workflow requires v2 manifest');
  }
  assert(manifest.entries.length === records.length - 1, 'Manifest entry count mismatch');
  const manifestNames = new Set();
  for (const record of manifest.entries) {
    const name = safePath(record.path); assert(name !== 'manifest.json' && !manifestNames.has(name), 'Duplicate or recursive manifest entry'); manifestNames.add(name);
    assert(files[name] && record.byteLength === files[name].length && record.sha256 === sha256(files[name]), 'Manifest hash/length mismatch');
  }
  assert(records.every(record => record.path === 'manifest.json' || manifestNames.has(record.path)), 'Unlisted package entry');
  const spec = JSON.parse(utf8(files[SPEC_PATH]));
  assert(['1.0.0', '1.1.0'].includes(spec?.schemaVersion) && spec.output?.format === 'png', 'Invalid authoritative PNG spec');
  for (const [field, expected] of Object.entries(taskIdentity(spec))) assert(isDeepStrictEqual(manifest[field], expected), `Manifest ${field} disagrees with authoritative spec`);
  const target = safePath(spec.output.relativePath); assert(target.startsWith('output/') && !files[target] && !records.some(r => r.path.startsWith('output/')), 'Future output must not be presented as produced');
  assert(Array.isArray(spec.references) && spec.references.length >= (spec.schemaVersion === '1.0.0' ? 1 : 0) && spec.references.length <= LIMITS.references, 'Invalid reference count');
  const ids = new Set(), referencePaths = new Set(); let pixels = 0;
  for (const reference of spec.references) {
    const refId = identity(reference.refId); assert(!ids.has(refId.toLowerCase()), 'Duplicate spec reference'); ids.add(refId.toLowerCase());
    assert(reference.role === 'content' || reference.role === 'style', 'Invalid reference role');
    const packagePath = `references/${reference.role}/${refId}.png`;
    assert(reference.packagePath === packagePath && !Object.hasOwn(reference, 'sourcePath') && typeof reference.sourceName === 'string' && !/[\\/:]/u.test(reference.sourceName), 'Invalid reference provenance/path');
    assert(files[packagePath], 'Referenced PNG missing');
    const actual = pngFacts(files[packagePath]);
    for (const field of ['sha256', 'byteLength', 'widthPx', 'heightPx']) assert(reference[field] === actual[field], `Reference ${field} mismatch`);
    pixels += actual.widthPx * actual.heightPx; assert(pixels <= LIMITS.referencePixels, 'Total reference pixel budget exceeded'); referencePaths.add(packagePath);
  }
  assert(records.every(record => !record.path.startsWith('references/') || referencePaths.has(record.path)), 'Unreferenced reference binary');
  if (spec.schemaVersion === '1.1.0') validateComposedSpec(spec);
  if (workflow) {
    assert(spec.schemaVersion === '1.1.0', 'Workflow requires composed 1.1 spec');
    validateWorkflowRecipe(JSON.parse(utf8(files['workflow/recipe.json'])), spec);
  }
  return { entries: records, spec, manifest };
}

async function exportZip({ spec, entries, binaries, outputDirectory, fileName, signal } = {}) {
  abort(signal);
  assert(entries && typeof entries === 'object' && binaries && typeof binaries === 'object', 'Task entries and reference bytes required');
  safePath(fileName); assert(!fileName.includes('/') && fileName.toLowerCase().endsWith('.zip'), 'ZIP output basename required');
  assert(typeof outputDirectory === 'string' && path.isAbsolute(outputDirectory), 'Absolute output directory required');
  const files = Object.create(null), folded = new Set();
  const insert = (name, body) => { safePath(name); assert(!folded.has(name.toLowerCase()), 'Duplicate package path'); folded.add(name.toLowerCase()); files[name] = Buffer.from(body); };
  for (const [name, text] of Object.entries(entries)) { assert(name !== 'manifest.json' && !name.startsWith('references/') && typeof text === 'string', 'Task text entries only'); insert(name, Buffer.from(text, 'utf8')); }
  assert(files[SPEC_PATH] && isDeepStrictEqual(JSON.parse(utf8(files[SPEC_PATH])), spec), 'Text spec and authoritative spec disagree');
  assert(Array.isArray(spec?.references), 'Authoritative references required');
  for (const reference of spec.references) { identity(reference.refId); const bytes = binaries[reference.refId]; assert(Buffer.isBuffer(bytes), 'Original reference Buffer missing'); insert(reference.packagePath, bytes); }
  assert(Object.keys(binaries).length === spec.references.length, 'Unexpected reference binaries');
  const manifestEntries = Object.keys(files).sort().map(name => ({ path: name, byteLength: files[name].length, sha256: sha256(files[name]) }));
  const isWorkflow = Object.hasOwn(files, 'workflow/recipe.json');
  insert('manifest.json', Buffer.from(JSON.stringify({ schemaVersion: isWorkflow ? '2dw-zip/2' : '2dw-zip/1', specPath: SPEC_PATH,
    ...taskIdentity(spec), ...(isWorkflow ? { workflowRecipeVersion: '2dw-workflow/1' } : {}), entries: manifestEntries }, null, 2) + '\n'));
  const expanded = Object.values(files).reduce((total, body) => total + body.length, 0); assert(expanded <= LIMITS.archiveBytes && Object.keys(files).length <= LIMITS.entries, 'Package budget exceeded');
  const bytes = Buffer.from(zipSync(files, { level: 6, mtime: new Date('2020-01-01T00:00:00Z') }));
  validateZip(bytes); abort(signal);
  await noLinks(outputDirectory, { missing: true });
  await fs.mkdir(outputDirectory, { recursive: true });
  await noLinks(outputDirectory);
  assert((await fs.stat(outputDirectory)).isDirectory(), 'Output is not a directory');
  const destination = path.join(outputDirectory, fileName), temporary = path.join(outputDirectory, `.2dw-${crypto.randomUUID()}.tmp`);
  let handle, published = false;
  try {
    abort(signal); handle = await fs.open(temporary, 'wx'); await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null;
    abort(signal); await noLinks(outputDirectory);
    const reread = await fs.readFile(temporary); const checked = validateZip(reread); assert(sha256(reread) === sha256(bytes), 'Temporary ZIP changed');
    abort(signal);
    // Atomic hard-link creation fails on EEXIST, including concurrent publishers; rename would overwrite.
    await fs.link(temporary, destination); published = true; abort(signal);
    await fs.unlink(temporary);
    return { path: destination, sha256: sha256(reread), entries: checked.entries };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (published) await fs.unlink(destination).catch(() => {});
    await fs.unlink(temporary).catch(() => {});
    throw error;
  }
}

module.exports = { readReferenceFacts, exportZip, validateZip, LIMITS };
