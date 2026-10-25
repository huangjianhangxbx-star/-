const { app, BrowserWindow, dialog, ipcMain, clipboard } = require('electron');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { mkdir, readFile, readdir, stat, writeFile } = require('node:fs/promises');
const { join, basename, extname } = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { loadSpineResource, assertOutputSourceResource, assertOutputTargetResource, writeOutputPackage } = require('./package-store.cjs');
const { assertConfigDestination } = require('./config-destination.cjs');
const { loadNativeProject, prepareNativeHandoff, verifyNativeHandoff } = require('./native-project.cjs');
const nativeHandoffs = new Map();
let spineExecutable = '';
const spineFilters = [{ name: 'Spine 工程 / JSON 导出', extensions: ['spine', 'json'] }];

async function nativeOptions() {
  const settingsPath = join(app.getPath('userData'), 'native-spine-settings.json');
  if (!spineExecutable) {
    let saved = '';
    try { saved = JSON.parse(await readFile(settingsPath, 'utf8')).executable; } catch { /* First launch. */ }
    const candidates = [process.env.SPW_SPINE_EXECUTABLE, saved, 'E:/Spine/Spine.com',
      join(process.env.ProgramFiles || 'C:/Program Files', 'Spine', 'Spine.com')];
    spineExecutable = candidates.find((path) => typeof path === 'string' && path && existsSync(path)) || '';
    if (!spineExecutable) {
      spineExecutable = await pickFile([{ name: '选择已安装的 Spine.com 或 Spine.exe', extensions: ['com', 'exe'] }]);
      if (!spineExecutable) throw new Error('载入 .spine 需要选择已授权的 Spine 编辑器程序');
    }
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(settingsPath, JSON.stringify({ executable: spineExecutable }), 'utf8');
  }
  return {
    executable: spineExecutable,
    cacheRoot: join(app.getPath('temp'), 'xinghai-spw-native'),
    chooseSkeleton: async (names) => {
      const result = await dialog.showMessageBox(window, { type: 'question', title: '选择工程内的骨架',
        message: '这个工程包含多个骨架，请选择本次迁移使用的骨架。',
        buttons: [...names.map((name) => basename(name, '.json')), '取消'], cancelId: names.length, noLink: true });
      return names[result.response] || null;
    },
  };
}

async function loadSelectedSpine(path, label) {
  return extname(path).toLowerCase() === '.spine'
    ? loadNativeProject(path, label, await nativeOptions()) : loadSpineResource(path, label);
}

let window;
const targetResources = new Map();
const protectedInputPaths = new Set();
let activeSpineSourceResourceId = null;
let activeTargetResourceId = null;
let spineSourceOpenSerial = 0;
let targetOpenSerial = 0;
let selectedOutputDirectory = '';
const smokeTargets = process.env.SPW_SMOKE_TARGETS ? JSON.parse(process.env.SPW_SMOKE_TARGETS) : [];
let smokeTargetIndex = 0;
const spineFlowSmoke = process.env.SPW_SMOKE_SPINE_FLOW === '1';

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function pickFile(filters) {
  const result = await dialog.showOpenDialog(window, { properties: ['openFile'], filters });
  return result.canceled ? null : result.filePaths[0];
}

function registerIpc() {
  ipcMain.handle('source:open', async () => {
    const path = process.env.SPW_SMOKE_FLOW === '1' ? process.env.SPW_SMOKE_SOURCE : await pickFile([{ name: 'GLB 动作文件', extensions: ['glb'] }]);
    if (!path) return null;
    const size = (await stat(path)).size;
    if (size > 150 * 1024 * 1024) throw new Error('GLB 超过 150 MB，请先精简动作源');
    const bytes = asArrayBuffer(await readFile(path));
    protectedInputPaths.add(path);
    return { path, name: basename(path), bytes };
  });

  ipcMain.handle('spine-source:open', async () => {
    const serial = ++spineSourceOpenSerial;
    activeSpineSourceResourceId = null;
    const jsonPath = process.env.SPW_SMOKE_SPINE_SOURCE || await pickFile(spineFilters);
    if (!jsonPath || serial !== spineSourceOpenSerial) return null;
    let resource;
    try { resource = await loadSelectedSpine(jsonPath, '来源'); }
    catch (error) {
      if (serial !== spineSourceOpenSerial) return null;
      throw error;
    }
    if (!resource || serial !== spineSourceOpenSerial) return null;
    const resourceId = randomUUID();
    activeSpineSourceResourceId = resourceId;
    for (const path of resource.protectedPaths) protectedInputPaths.add(path);
    return {
      resourceId, path: resource.path, name: resource.name, nativeProject: Boolean(resource.native),
      jsonPath: resource.jsonPath, atlasPath: resource.atlasPath,
      jsonText: resource.jsonText, atlasText: resource.atlasText,
      pages: resource.pages.map(({ name, bytes }) => ({ name, bytes })),
    };
  });

  ipcMain.handle('target:open', async () => {
    const serial = ++targetOpenSerial;
    activeTargetResourceId = null;
    targetResources.clear();
    const jsonPath = process.env.SPW_SMOKE_FLOW === '1' || spineFlowSmoke
      ? (smokeTargets[smokeTargetIndex++] || process.env.SPW_SMOKE_TARGET)
      : await pickFile(spineFilters);
    if (!jsonPath || serial !== targetOpenSerial) return null;
    let resource;
    try { resource = await loadSelectedSpine(jsonPath, '目标'); }
    catch (error) {
      if (serial !== targetOpenSerial) return null;
      throw error;
    }
    if (!resource || serial !== targetOpenSerial) return null;
    const resourceId = randomUUID();
    activeTargetResourceId = resourceId;
    targetResources.set(resourceId, {
      native: resource.native,
      jsonText: resource.jsonText,
      jsonPath: resource.jsonPath,
      atlasPath: resource.atlasPath,
      atlasBytes: resource.atlasBytes,
      pages: resource.pages.map(({ name, bytes }) => ({ name, bytes })),
    });
    for (const path of resource.protectedPaths) protectedInputPaths.add(path);
    return {
      resourceId, path: resource.path, name: resource.name, nativeProject: Boolean(resource.native),
      jsonPath: resource.jsonPath, atlasPath: resource.atlasPath,
      jsonText: resource.jsonText, atlasText: resource.atlasText,
      pages: resource.pages.map(({ name, bytes }) => ({ name, bytes })),
    };
  });

  ipcMain.handle('output:choose', async () => {
    if (process.env.SPW_SMOKE_FLOW === '1' || spineFlowSmoke) {
      selectedOutputDirectory = process.env.SPW_SMOKE_OUTPUT || '';
      return selectedOutputDirectory;
    }
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    selectedOutputDirectory = result.filePaths[0];
    return selectedOutputDirectory;
  });

  ipcMain.handle('output:save', async (_event, payload) => {
    assertOutputSourceResource(payload, activeSpineSourceResourceId);
    assertOutputTargetResource(payload, activeTargetResourceId);
    const target = targetResources.get(payload?.targetResourceId);
    if (!target) throw new Error('生成结果对应的目标资源已失效，请重新载入并生成');
    if (!selectedOutputDirectory || payload.outputDirectory !== selectedOutputDirectory) throw new Error('先选择输出目录');
    if (typeof payload.jsonText !== 'string' || typeof payload.animationName !== 'string') throw new Error('生成结果格式不正确');
    const saved = await writeOutputPackage({ ...payload, target });
    if (target.native && payload.sourceKind === 'spine') {
      const job = await prepareNativeHandoff({ directory: saved.directory, target, jsonText: payload.jsonText, animationName: payload.animationName });
      const handoffId = randomUUID();
      nativeHandoffs.set(handoffId, job);
      return { ...saved, handoffId, projectPath: job.projectPath, carrierPath: job.carrierPath, skeletonName: job.skeletonName, animationName: job.animationName };
    }
    return saved;
  });

  ipcMain.handle('native:action', async (_event, { handoffId, action } = {}) => {
    const job = nativeHandoffs.get(handoffId);
    if (!job) throw new Error('导回任务无效，请重新准备');
    if (action === 'copy') { clipboard.writeText(job.carrierPath); return { copied: true }; }
    if (action === 'verify') return verifyNativeHandoff(job);
    if (action === 'open') {
      if (process.env.SPW_SMOKE === '1') return { opened: false };
      const executable = job.executable.replace(/\.com$/i, '.exe');
      await new Promise((done, fail) => {
        const child = spawn(executable, ['-u', '4.3.26', '--no-reuse-instance', job.projectPath], { detached: true, windowsHide: false, stdio: 'ignore' });
        child.once('error', fail); child.once('spawn', () => { child.unref(); done(); });
      });
      return { opened: true };
    }
    throw new Error('未知导回操作');
  });

  ipcMain.handle('config:open', async () => {
    const path = process.env.SPW_SMOKE_FLOW === '1' || spineFlowSmoke
      ? process.env.SPW_SMOKE_CONFIG
      : await pickFile([{ name: '工坊配置', extensions: ['json'] }]);
    return path ? { path, jsonText: await readFile(path, 'utf8') } : null;
  });
  ipcMain.handle('config:save', async (_event, jsonText) => {
    if (typeof jsonText !== 'string') throw new Error('配置内容无效');
    if (process.env.SPW_SMOKE_FLOW === '1' || spineFlowSmoke) {
      const path = spineFlowSmoke && process.env.SPW_SMOKE_CONFIG_SAVE
        ? process.env.SPW_SMOKE_CONFIG_SAVE
        : process.env.SPW_SMOKE_CONFIG;
      if (!path) throw new Error('未设置 smoke 配置路径');
      assertConfigDestination(path, [...protectedInputPaths]);
      await writeFile(path, jsonText, 'utf8');
      return path;
    }
    const result = await dialog.showSaveDialog(window, {
      defaultPath: 'calibration.spw.json',
      filters: [{ name: '工坊配置', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    assertConfigDestination(result.filePath, [...protectedInputPaths]);
    await writeFile(result.filePath, jsonText, 'utf8');
    return result.filePath;
  });
}

function createWindow() {
  const smoke = process.env.SPW_SMOKE === '1';
  const legacyRoute = process.env.SPW_SMOKE_LEGACY === '1' || process.env.SPW_SMOKE_FLOW === '1';
  window = new BrowserWindow({
    width: 1480, height: 900, minWidth: 1120, minHeight: 690,
    backgroundColor: '#171b1e', title: '星骸 Spine 动画工坊',
    show: !smoke,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (smoke) {
    const flow = process.env.SPW_SMOKE_FLOW === '1';
    const timeout = setTimeout(() => { console.error('SPW_SMOKE_ERROR=窗口加载超时'); app.exit(1); }, spineFlowSmoke ? 240000 : flow ? 110000 : 25000);
    window.webContents.once('did-fail-load', (_event, code, description) => {
      clearTimeout(timeout); console.error(`SPW_SMOKE_ERROR=${code} ${description}`); app.exit(1);
    });
    window.webContents.once('did-finish-load', async () => {
      try {
        if (spineFlowSmoke) {
          if (process.env.SPW_SMOKE_AUTO_MAP === '1') {
            const { runAutoMappingFlow } = require('./spine-flow-smoke.cjs');
            const result = await runAutoMappingFlow(window, process.env.SPW_SMOKE_SPINE_ANIMATION || 'atk1');
            await window.webContents.executeJavaScript("document.getElementById('mapping-analysis').scrollIntoView({block:'start'})");
            await new Promise((done) => setTimeout(done, 500));
            await writeFile(join(process.env.SPW_SMOKE_OUTPUT, 'auto-mapping.png'), (await window.webContents.capturePage()).toPNG());
            clearTimeout(timeout);
            console.log(`SPW_AUTO_MAP_SMOKE_RESULT=${JSON.stringify(result)}`);
            app.exit(result.initialAutomatic && result.mappingCount > 3 && result.reviewCount > 0 && result.optionalDirections && result.noRawError && result.unsafeSaveDisabled ? 0 : 1);
            return;
          }
          const { runSpineFlow } = require('./spine-flow-smoke.cjs');
          const result = await runSpineFlow(window, process.env.SPW_SMOKE_SPINE_ANIMATION || 'run');
          if (result.nativePrepared) {
            await window.webContents.executeJavaScript("document.getElementById('native-handoff').scrollIntoView({block:'end'})");
            await new Promise((done) => setTimeout(done, 1500));
            await writeFile(join(result.savedPath, 'workshop-handoff.png'), (await window.webContents.capturePage()).toPNG());
          }
          const inputConfigText = await readFile(process.env.SPW_SMOKE_CONFIG, 'utf8');
          const inputConfig = JSON.parse(inputConfigText);
          const savedConfigText = result.savedConfigPath ? await readFile(result.savedConfigPath, 'utf8') : '';
          const savedConfig = savedConfigText ? JSON.parse(savedConfigText) : null;
          const sha256 = (value) => createHash('sha256').update(value).digest('hex');
          const configHash = sha256(inputConfigText);
          const savedConfigHash = savedConfigText ? sha256(savedConfigText) : '';
          const configMappingCount = inputConfig.objectMappings?.length ?? -1;
          const savedConfigMappingCount = savedConfig?.objectMappings?.length ?? -1;
          const configMatches = !result.savedConfigPath || (
            savedConfigMappingCount === configMappingCount
            && savedConfig.source?.skeletonFingerprint === inputConfig.source?.skeletonFingerprint
            && savedConfig.target?.skeletonFingerprint === inputConfig.target?.skeletonFingerprint
          );
          const files = await readdir(result.savedPath);
          const report = await readFile(join(result.savedPath, 'migration-report.txt'), 'utf8');
          const jsonName = basename(targetResources.get(activeTargetResourceId).jsonPath);
          const savedDocument = jsonName ? JSON.parse(await readFile(join(result.savedPath, jsonName), 'utf8')) : null;
          const originalDocument = JSON.parse(targetResources.get(activeTargetResourceId).jsonText);
          const originalAnimations = Object.keys(originalDocument.animations || {});
          const saved = Boolean(jsonName && savedDocument?.animations?.[result.outputName])
            && originalAnimations.every((name) => Object.hasOwn(savedDocument.animations, name))
            && Array.isArray(savedDocument.bones) && savedDocument.bones.length === originalDocument.bones.length
            && files.some((name) => name.endsWith('.atlas'))
            && files.some((name) => name.endsWith('.png'))
            && files.includes('calibration.spw.json')
            && report.includes(`动作：${result.animation} →`)
            && /未映射：0；不支持：0；冲突：0/.test(report);
          clearTimeout(timeout);
          console.log(`SPW_SPINE_FLOW_SMOKE_RESULT=${JSON.stringify({
            ...result, configHash, savedConfigHash, configMappingCount, savedConfigMappingCount, configMatches, saved, files,
          })}`);
          app.exit(result.sourceLoaded && result.targetLoaded && result.configLoaded
            && result.previewReady && result.generated && result.noBlockedChannels
            && result.noUnmappedChannels && configMatches && saved ? 0 : 1);
          return;
        }
        if (flow) {
          const { runFlow } = require('./flow-smoke.cjs');
          const result = await runFlow(window, process.env.SPW_SMOKE_CASE || 'normal');
          clearTimeout(timeout);
          if (process.env.SPW_SMOKE_CASE === 'target-identity') {
            console.log(`SPW_IDENTITY_SMOKE_RESULT=${JSON.stringify(result)}`);
            app.exit(result.disabledImmediately && result.disabledAfterFailure && result.disabledDuringValidLoad && result.disabledAfterValidLoad ? 0 : 1);
          } else if (process.env.SPW_SMOKE_CASE === 'invalid-config') {
            console.log(`SPW_CONFIG_SMOKE_RESULT=${JSON.stringify(result)}`);
            app.exit(result.generateReadyAfterBadConfig && result.generatedAfterBadConfig ? 0 : 1);
          } else if (process.env.SPW_SMOKE_CASE === 'protect-config-input') {
            console.log(`SPW_CONFIG_INPUT_SMOKE_RESULT=${JSON.stringify(result)}`);
            app.exit(result.protected ? 0 : 1);
          } else {
            console.log(`SPW_FLOW_SMOKE_RESULT=${JSON.stringify(result)}`);
            app.exit(result.modelReady && result.targetPreviewReady && result.liveFeedback && result.restoredYaw === '45' && result.stepped && result.saved.includes('完整副本已保存') ? 0 : 1);
          }
          return;
        }
        clearTimeout(timeout);
        const result = await window.webContents.executeJavaScript(`({
          title: document.title,
          bridge: typeof window.spw?.${legacyRoute ? 'openSource' : 'openSpineSource'} === 'function' && typeof window.spw?.saveOutput === 'function',
          sourceCanvas: !!document.getElementById('source-canvas'),
          targetCanvas: !!document.getElementById('target-canvas'),
          timeline: !!document.getElementById('time'),
          modeSpine: !!document.getElementById('mode-spine'),
          status: document.getElementById('status')?.textContent,
        })`);
        console.log(`SPW_SMOKE_RESULT=${JSON.stringify(result)}`);
        const ready = result.bridge && result.sourceCanvas && result.targetCanvas && result.timeline;
        app.exit(ready && (legacyRoute ? result.status?.includes('先载入') : result.modeSpine && result.status?.includes('Spine')) ? 0 : 1);
      } catch (error) { console.error(`SPW_SMOKE_ERROR=${String(error)}`); app.exit(1); }
    });
  }
  const spinePage = join(__dirname, '..', 'dist', 'spine.html');
  window.loadFile(legacyRoute || !existsSync(spinePage) ? join(__dirname, '..', 'dist', 'index.html') : spinePage);
}

app.whenReady().then(() => { registerIpc(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
