'use strict';

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { PNG } = require('pngjs');

const SPEC_PATH = 'spec/asset-spec.json';
const USER_FIELDS = new Set([
  'taskId', 'title', 'description', 'styleDescription', 'widthPx', 'heightPx',
  'squareLocked', 'ppu', 'alphaRequirement', 'requirements',
  'projectStyleContract', 'taskStyleDelta', 'environmentStyle',
]);

class TaskSessionError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = 'TaskSessionError';
    this.code = code;
    if (field) this.field = field;
  }
}

function assertRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TaskSessionError('invalid-input', `${field} 必须是对象。`, field);
  }
}

function onlyKeys(value, allowed, field) {
  assertRecord(value, field);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TaskSessionError('unknown-field', `不支持 ${field}.${key}。`, `${field}.${key}`);
  }
}

function cleanValues(values, selection) {
  assertRecord(values, 'values');
  for (const key of Object.keys(values)) {
    if (!USER_FIELDS.has(key)) throw new TaskSessionError('unknown-field', `不支持 values.${key}。`, `values.${key}`);
  }
  if (selection?.mode === 'preset' && Object.hasOwn(values, 'requirements')) {
    throw new TaskSessionError('mode-field', '普通预设不接受自定义 requirements。', 'requirements');
  }
  return structuredClone(values);
}

function validRevision(revision) {
  if ((typeof revision !== 'string' || !revision || revision.length > 100)
    && (!Number.isSafeInteger(revision) || revision < 0)) {
    throw new TaskSessionError('invalid-revision', '预览修订号无效。', 'revision');
  }
  return revision;
}

function safeCoreError(error) {
  if (error?.name === 'SpecValidationError' || error?.name === 'PresetConflictError') {
    return new TaskSessionError(error.code || 'invalid-spec', error.message, error.field);
  }
  return error;
}

function thumbnailDataUrl(bytes) {
  const source = PNG.sync.read(bytes, { checkCRC: true });
  const scale = Math.min(1, 128 / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(source.height - 1, Math.floor(y * source.height / height));
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(source.width - 1, Math.floor(x * source.width / width));
      const offset = (y * width + x) * 4;
      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      source.data.copy(data, offset, sourceOffset, sourceOffset + 4);
    }
  }
  const encoded = PNG.sync.write({ width, height, data });
  if (encoded.length > 100 * 1024) throw new TaskSessionError('thumbnail-budget', '参考图预览超过大小限制。');
  return `data:image/png;base64,${encoded.toString('base64')}`;
}

function suggestedZipName(title, spec, taskId) {
  const name = String(title).normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/gu, ' ').replace(/[. ]+$/gu, '').trim();
  const concise = Array.from(name || '素材任务').slice(0, 48).join('');
  const safe = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(concise)
    ? `任务-${concise}` : concise;
  return `${safe}_${spec.output.widthPx}x${spec.output.heightPx}_${taskId}.zip`;
}

function cleanAbandonedClipboardSessions(root) {
  let canonicalRoot;
  try {
    if (!fsSync.lstatSync(root).isDirectory()) return;
    canonicalRoot = fsSync.realpathSync.native(root);
  } catch { return; }
  const samePath = (left, right) => process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase() : left === right;
  for (const entry of fsSync.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const owned = /^session-(\d+)-[a-zA-Z0-9]{4,}$/u.exec(entry.name);
    const legacy = /^session-[a-zA-Z0-9]{6}$/u.test(entry.name);
    if (!owned && !legacy) continue;
    const target = path.join(root, entry.name);
    try {
      const canonicalTarget = fsSync.realpathSync.native(target);
      if (!samePath(path.dirname(canonicalTarget), canonicalRoot)) continue;
      let abandoned = false;
      if (owned) {
        const pid = Number(owned[1]);
        if (pid !== process.pid) {
          try { process.kill(pid, 0); }
          catch (error) { abandoned = error.code !== 'EPERM'; }
        }
      } else {
        abandoned = Date.now() - fsSync.statSync(target).mtimeMs > 30 * 24 * 60 * 60 * 1000;
      }
      if (abandoned) fsSync.rmSync(target, { recursive: true, force: true });
    } catch { /* Cleanup is best effort and must not prevent the app from opening. */ }
  }
}

function createTaskSession({ base, pickReferences, pickExportPath, readClipboardReference, clipboardDirectory, styleConfigPath } = {}) {
  if (typeof base !== 'string' || !path.isAbsolute(base)) throw new Error('Absolute 2D base required');
  if (typeof pickReferences !== 'function') throw new Error('Reference picker required');
  const root = path.resolve(base);
  const requireTask = createRequire(path.join(root, 'package.json'));
  const core = requireTask(path.join(root, 'dist', 'task.cjs'));
  const archive = requireTask(path.join(root, 'archive', 'export-zip.cjs'));
  const choices = core.listPresetChoices();
  const projectStylePath = path.resolve(styleConfigPath ?? path.join(root, '.cache', 'asset-task-2d-profile', 'project-style-contract.json'));
  let projectStyleDefault;
  let projectStyleWarning;
  try {
    projectStyleDefault = fsSync.existsSync(projectStylePath)
      ? core.validateProjectStyleContract(JSON.parse(fsSync.readFileSync(projectStylePath, 'utf8')))
      : core.validateProjectStyleContract(core.DEFAULT_PROJECT_STYLE_CONTRACT);
  } catch {
    projectStyleDefault = core.validateProjectStyleContract(core.DEFAULT_PROJECT_STYLE_CONTRACT);
    projectStyleWarning = `项目默认风格配置无效或无法读取，已临时使用内置示例；原文件未改：${projectStylePath}`;
  }
  const references = [];
  const clipboardRoot = path.resolve(clipboardDirectory ?? path.join(root, '.cache', 'clipboard-references'));
  cleanAbandonedClipboardSessions(clipboardRoot);
  const managedPaths = new Set();
  let clipboardSessionDir = null;
  let disposed = false;
  let nextReference = 1;
  let generation = 0;
  let previewSequence = 0;
  let preview = null;
  let exporting = false;
  let choosing = false;
  let transitioning = false;
  const issuedTaskIds = new Set();
  function nextTaskId() {
    let id;
    do { id = `asset-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(8).toString('hex')}`; }
    while (issuedTaskIds.has(id));
    issuedTaskIds.add(id);
    return id;
  }
  let taskId = nextTaskId();

  function publicReferences() {
    return references.map(ref => ({
      token: ref.token, refId: ref.refId, sourceName: ref.sourceName,
      role: ref.role, note: ref.note,
      ...(ref.priority === undefined ? {} : { priority: ref.priority }),
      widthPx: ref.widthPx, heightPx: ref.heightPx, byteLength: ref.byteLength,
      thumbnailDataUrl: ref.thumbnailDataUrl,
    }));
  }

  function invalidate() { generation++; preview = null; }

  function removeManagedPath(sourcePath) {
    if (!managedPaths.has(sourcePath)) return;
    fsSync.rmSync(sourcePath, { force: true });
    managedPaths.delete(sourcePath);
    if (managedPaths.size === 0 && clipboardSessionDir) {
      try { fsSync.rmdirSync(clipboardSessionDir); clipboardSessionDir = null; }
      catch (error) { if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') throw error; }
    }
  }

  function releaseReferences(items) {
    for (const ref of items) if (ref.managed) removeManagedPath(ref.sourcePath);
  }

  async function storeClipboardImage(bytes, refId) {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > archive.LIMITS.referenceBytes) {
      throw new TaskSessionError('invalid-reference', '剪贴板 PNG 为空或超过 4 MB 限制。', 'references');
    }
    let sourcePath;
    try {
      await fs.mkdir(clipboardRoot, { recursive: true });
      if (!clipboardSessionDir) clipboardSessionDir = await fs.mkdtemp(path.join(clipboardRoot, `session-${process.pid}-`));
      sourcePath = path.join(clipboardSessionDir, `剪贴板图片-${refId}.png`);
      await fs.writeFile(sourcePath, bytes, { flag: 'wx' });
      managedPaths.add(sourcePath);
      return sourcePath;
    } catch {
      if (sourcePath) await fs.rm(sourcePath, { force: true }).catch(() => {});
      if (clipboardSessionDir && managedPaths.size === 0) {
        try { await fs.rmdir(clipboardSessionDir); clipboardSessionDir = null; } catch { /* Keep any unrelated files. */ }
      }
      throw new TaskSessionError('clipboard-save-failed', '无法暂存剪贴板 PNG，请检查工坊缓存目录。', 'references');
    }
  }

  function sourceInputs(items = references) {
    return items.map(ref => ({ refId: ref.refId, role: ref.role,
      sourcePath: ref.sourcePath, note: ref.note,
      ...(ref.priority === undefined ? {} : { priority: ref.priority }) }));
  }

  async function readSources(items) {
    try {
      const read = await archive.readReferenceFacts(sourceInputs(items));
      for (let i = 0; i < items.length; i++) {
        const selected = items[i], current = read.facts[i];
        if (selected.sha256 !== current.sha256 || selected.byteLength !== current.byteLength
          || selected.widthPx !== current.widthPx || selected.heightPx !== current.heightPx) {
          throw new Error('Selected reference changed');
        }
      }
      return read;
    }
    catch {
      invalidate();
      throw new TaskSessionError('reference-changed', '参考图无法读取、无效或已变化；请重新选择参考图。', 'references');
    }
  }

  function compose(selection, values, facts) {
    try {
      const spec = core.composePreset(selection, { projectStyleContract: projectStyleDefault, ...values, references: sourceInputs() }, facts);
      return { spec, entries: core.compileWorkflowTask(spec).entries };
    } catch (error) { throw safeCoreError(error); }
  }

  function referenceByToken(payload) {
    assertRecord(payload, 'reference');
    if (typeof payload.token !== 'string') throw new TaskSessionError('invalid-token', '参考图身份无效。', 'token');
    const index = references.findIndex(ref => ref.token === payload.token);
    if (index < 0) throw new TaskSessionError('unknown-reference', '参考图已不存在。', 'token');
    return { index, ref: references[index] };
  }

  async function addReferencePaths(filePaths, managedPath = null) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new TaskSessionError('clipboard-empty', '剪贴板没有可用的本地 PNG 文件。', 'references');
    }
    if (references.length + filePaths.length > archive.LIMITS.references) {
      throw new TaskSessionError('reference-budget', '参考图最多 8 张。', 'references');
    }
    const seen = new Set(references.map(ref => path.resolve(ref.sourcePath).toLowerCase()));
    const prepared = [];
    for (const sourcePath of filePaths) {
      if (typeof sourcePath !== 'string' || !path.isAbsolute(sourcePath)) {
        throw new TaskSessionError('invalid-reference', '所选参考图无效。', 'references');
      }
      const folded = path.resolve(sourcePath).toLowerCase();
      if (seen.has(folded)) throw new TaskSessionError('duplicate-reference', '这张参考图已添加。', 'references');
      seen.add(folded);
      const refId = `ref-${String(nextReference + prepared.length).padStart(2, '0')}`;
      let read;
      try { read = await archive.readReferenceFacts([{ refId, role: 'content', sourcePath, note: '' }]); }
      catch { throw new TaskSessionError('invalid-reference', '所选文件不是可用的 PNG 参考图。', 'references'); }
      const fact = read.facts[0];
      prepared.push({ token: crypto.randomUUID(), refId, sourcePath,
        sourceName: fact.sourceName,
        widthPx: fact.widthPx, heightPx: fact.heightPx,
        byteLength: fact.byteLength, sha256: fact.sha256,
        thumbnailDataUrl: thumbnailDataUrl(read.binaries[refId]),
        role: 'content', note: '', ...(managedPath === sourcePath ? { managed: true } : {}) });
    }
    const combined = [...references, ...prepared];
    const totalPixels = combined.reduce((sum, ref) => sum + ref.widthPx * ref.heightPx, 0);
    if (totalPixels > archive.LIMITS.referencePixels) {
      throw new TaskSessionError('reference-budget', '参考图总像素超过预算。', 'references');
    }
    references.push(...prepared);
    nextReference += prepared.length;
    invalidate();
    return { references: publicReferences() };
  }

  return {
    taskInfo: () => ({ taskId, references: publicReferences(), projectStyleDefault: structuredClone(projectStyleDefault),
      ...(projectStyleWarning ? { projectStyleWarning } : {}) }),
    async saveProjectStyleContract(contract) {
      if (disposed) throw new TaskSessionError('unavailable', '工坊会话已关闭。');
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '当前操作尚未完成，请稍后保存项目风格。');
      let validated;
      try { validated = core.validateProjectStyleContract(contract); }
      catch (error) { throw safeCoreError(error); }
      const temporary = `${projectStylePath}.${crypto.randomUUID()}.tmp`;
      try {
        await fs.mkdir(path.dirname(projectStylePath), { recursive: true });
        await fs.writeFile(temporary, JSON.stringify(validated, null, 2) + '\n', { flag: 'wx' });
        await fs.rename(temporary, projectStylePath);
      } catch {
        await fs.rm(temporary, { force: true }).catch(() => {});
        throw new TaskSessionError('project-style-save-failed', '无法保存项目默认风格，本次未更新。', 'projectStyleContract');
      }
      projectStyleDefault = validated;
      projectStyleWarning = undefined;
      invalidate();
      return { projectStyleDefault: structuredClone(projectStyleDefault) };
    },
    dispose() {
      disposed = true;
      releaseReferences(references);
      references.length = 0;
      invalidate();
    },
    async beginTask(payload) {
      onlyKeys(payload, ['copy'], 'payload');
      if (typeof payload.copy !== 'boolean') throw new TaskSessionError('invalid-input', '请选择新建或复制任务。', 'copy');
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '当前操作尚未完成，请稍后再开始新任务。');
      transitioning = true;
      try {
        if (payload.copy) {
          const snapshot = references.map(ref => ({ ...ref }));
          await readSources(snapshot);
        } else {
          releaseReferences(references);
          references.length = 0;
          nextReference = 1;
        }
        taskId = nextTaskId();
        invalidate();
        return { taskId, references: publicReferences() };
      } finally { transitioning = false; }
    },
    choices: () => choices,
    describeForm(payload = {}) {
      onlyKeys(payload, ['selection', 'values'], 'payload');
      const { selection, values = {} } = payload;
      const userValues = cleanValues(values, selection);
      return core.describePresetForm(selection, userValues);
    },
    async chooseReferences() {
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '参考图选择或任务切换正在进行。');
      choosing = true;
      try {
      const result = await pickReferences();
      if (!result || result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
        return { cancelled: true, references: publicReferences() };
      }
      return await addReferencePaths(result.filePaths);
      } finally { choosing = false; }
    },
    async pasteReference() {
      if (disposed) throw new TaskSessionError('unavailable', '工坊会话已关闭。');
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '参考图选择、导出或任务切换正在进行。');
      if (typeof readClipboardReference !== 'function') throw new TaskSessionError('unavailable', '当前无法读取剪贴板。');
      choosing = true;
      let managedPath = null;
      try {
        const input = await readClipboardReference();
        if (disposed) throw new TaskSessionError('unavailable', '工坊会话已关闭。');
        if (input?.kind === 'image') {
          const refId = `ref-${String(nextReference).padStart(2, '0')}`;
          managedPath = await storeClipboardImage(input.bytes, refId);
          if (disposed) throw new TaskSessionError('unavailable', '工坊会话已关闭。');
          return await addReferencePaths([managedPath], managedPath);
        }
        if (input?.kind === 'files') return await addReferencePaths(input.filePaths);
        throw new TaskSessionError('clipboard-unsupported', '剪贴板没有可用的 PNG 图片或本地 PNG 文件。');
      } catch (error) {
        if (managedPath) removeManagedPath(managedPath);
        if (error?.name === 'ClipboardReferenceError') {
          throw new TaskSessionError(error.code, error.message, 'references');
        }
        throw error;
      } finally { choosing = false; }
    },
    updateReference(payload) {
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '参考图选择、导出或任务切换正在进行。');
      const { ref } = referenceByToken(payload);
      for (const key of Object.keys(payload)) {
        if (!['token', 'role', 'note', 'priority'].includes(key)) {
          throw new TaskSessionError('unknown-field', `不支持 reference.${key}。`, `reference.${key}`);
        }
      }
      const role = payload.role === undefined ? ref.role : payload.role;
      const note = payload.note === undefined ? ref.note : payload.note;
      const hasPriority = Object.hasOwn(payload, 'priority');
      const priority = hasPriority ? payload.priority : ref.priority;
      if (role !== 'content' && role !== 'style') throw new TaskSessionError('invalid-role', '参考角色仅支持内容或风格。', 'role');
      if (typeof note !== 'string' || note.length > 4096) throw new TaskSessionError('invalid-note', '参考说明最多 4096 字。', 'note');
      if (priority !== undefined && priority !== null && (!Number.isSafeInteger(priority) || priority < 0 || priority > 100)) {
        throw new TaskSessionError('invalid-priority', '优先级须为 0–100 整数。', 'priority');
      }
      ref.role = role; ref.note = note;
      if (hasPriority && (priority === null || priority === undefined)) delete ref.priority;
      else if (hasPriority) ref.priority = priority;
      invalidate();
      return { references: publicReferences() };
    },
    removeReference(payload) {
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '参考图选择、导出或任务切换正在进行。');
      onlyKeys(payload, ['token'], 'reference');
      const { index, ref } = referenceByToken(payload);
      references.splice(index, 1);
      releaseReferences([ref]);
      invalidate();
      return { references: publicReferences() };
    },
    async previewTask(payload = {}) {
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '参考图选择、导出或任务切换正在进行。');
      onlyKeys(payload, ['selection', 'values', 'revision'], 'payload');
      const { selection, values, revision } = payload;
      const chosenRevision = validRevision(revision);
      const userValues = cleanValues(values, selection);
      if (userValues.taskId !== taskId) throw new TaskSessionError('task-identity', '任务 ID 与当前会话身份不一致。', 'taskId');
      const request = ++previewSequence;
      preview = null;
      const startingGeneration = generation;
      const snapshot = references.map(ref => ({ ...ref }));
      const { facts } = await readSources(snapshot);
      if (generation !== startingGeneration || request !== previewSequence || exporting) {
        throw new TaskSessionError('stale-preview', '预览已过期，请重新预览。');
      }
      const { spec, entries } = compose(selection, userValues, facts);
      preview = { revision: chosenRevision, selection: structuredClone(selection),
        values: userValues, generation, specJson: entries[SPEC_PATH], entries };
      return { revision: chosenRevision, spec, specJson: entries[SPEC_PATH],
        prompt: entries['prompts/codex.md'],
        workflow: JSON.parse(entries['workflow/recipe.json']),
        workflowPlan: entries['workflow/analysis-plan.md'] + '\n' + entries['workflow/decision-policy.md'] + '\n' + entries['workflow/production-plan.md'],
        workflowRecipeJson: entries['workflow/recipe.json'],
        entries: [...Object.keys(entries), 'manifest.json', ...spec.references.map(ref => ref.packagePath)].sort(),
        references: publicReferences() };
    },
    async exportTask(payload = {}) {
      if (exporting || choosing || transitioning) throw new TaskSessionError('busy', '参考图选择、导出或任务切换正在进行。');
      onlyKeys(payload, ['revision'], 'payload');
      const { revision } = payload;
      validRevision(revision);
      if (!preview || preview.revision !== revision || preview.generation !== generation) {
        throw new TaskSessionError('stale-preview', '预览已过期，请更新预览后导出。', 'revision');
      }
      if (typeof pickExportPath !== 'function') throw new TaskSessionError('unavailable', '当前无法选择 ZIP 保存位置。');
      exporting = true;
      previewSequence++;
      try {
        const fileName = suggestedZipName(preview.values.title, JSON.parse(preview.specJson), taskId);
        const selected = await pickExportPath({ defaultFileName: fileName });
        if (!selected || selected.canceled || !selected.filePath) return { cancelled: true };
        if (typeof selected.filePath !== 'string' || !path.isAbsolute(selected.filePath)
          || path.extname(selected.filePath).toLowerCase() !== '.zip') {
          throw new TaskSessionError('invalid-output', '请选择完整的 ZIP 文件路径。', 'filePath');
        }
        if (!preview || preview.revision !== revision || preview.generation !== generation) {
          throw new TaskSessionError('stale-preview', '预览已过期，请更新预览后导出。', 'revision');
        }
        const { facts, binaries } = await readSources(references);
        const { spec, entries } = compose(preview.selection, preview.values, facts);
        if (entries[SPEC_PATH] !== preview.specJson
          || Object.keys(entries).some(name => entries[name] !== preview.entries[name])) {
          throw new TaskSessionError('reference-changed', '参考图或任务内容已变化，请重新预览。');
        }
        let result;
        try {
          result = await archive.exportZip({ spec, entries, binaries,
            outputDirectory: path.dirname(selected.filePath), fileName: path.basename(selected.filePath) });
        } catch (error) {
          if (error?.code === 'EEXIST') throw new TaskSessionError('output-exists', '目标 ZIP 已存在，未覆盖。', 'filePath');
          throw new TaskSessionError('export-failed', '导出失败，任务 ZIP 未写入。');
        }
        try { archive.validateZip(await fs.readFile(result.path)); }
        catch { throw new TaskSessionError('export-verification', 'ZIP 写入后校验失败。'); }
        return { cancelled: false, path: result.path, sha256: result.sha256, entries: result.entries };
      } finally { exporting = false; }
    },
  };
}

module.exports = { createTaskSession, TaskSessionError };
