const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { readFile, readdir, stat, writeFile } = require('node:fs/promises');
const { dirname, extname, join, basename } = require('node:path');
const { randomUUID } = require('node:crypto');
const { writeOutputPackage } = require('./package-store.cjs');
const { assertConfigDestination } = require('./config-destination.cjs');

let window;
const targetResources = new Map();
const protectedInputPaths = new Set();
let selectedOutputDirectory = '';
const smokeTargets = process.env.SPW_SMOKE_TARGETS ? JSON.parse(process.env.SPW_SMOKE_TARGETS) : [];
let smokeTargetIndex = 0;

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function atlasPages(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  return lines.filter((line, index) => line && /^size\s*:/i.test(lines[index + 1] || ''));
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

  ipcMain.handle('target:open', async () => {
    const jsonPath = process.env.SPW_SMOKE_FLOW === '1' ? (smokeTargets[smokeTargetIndex++] || process.env.SPW_SMOKE_TARGET) : await pickFile([{ name: 'Spine 4.3 JSON', extensions: ['json'] }]);
    if (!jsonPath) return null;
    if ((await stat(jsonPath)).size > 150 * 1024 * 1024) throw new Error('目标 JSON 超过 150 MB');
    const directory = dirname(jsonPath);
    const stem = basename(jsonPath, extname(jsonPath));
    const atlasPath = join(directory, `${stem}.atlas`);
    let atlasText;
    try { atlasText = await readFile(atlasPath, 'utf8'); }
    catch { throw new Error(`未找到同目录贴图索引：${basename(atlasPath)}`); }
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
    const resourceId = randomUUID();
    targetResources.set(resourceId, { jsonPath, atlasPath, pages: pages.map(({ name, path }) => ({ name, path })) });
    for (const path of [jsonPath, atlasPath, ...pages.map((page) => page.path), join(directory, `${stem}.spine`)]) protectedInputPaths.add(path);
    return { resourceId, path: jsonPath, name: basename(jsonPath), jsonText, atlasText, pages: pages.map(({ name, bytes }) => ({ name, bytes })) };
  });

  ipcMain.handle('output:choose', async () => {
    if (process.env.SPW_SMOKE_FLOW === '1') {
      selectedOutputDirectory = process.env.SPW_SMOKE_OUTPUT || '';
      return selectedOutputDirectory;
    }
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    selectedOutputDirectory = result.filePaths[0];
    return selectedOutputDirectory;
  });

  ipcMain.handle('output:save', async (_event, payload) => {
    const target = targetResources.get(payload?.targetResourceId);
    if (!target) throw new Error('生成结果对应的目标资源已失效，请重新载入并生成');
    if (!selectedOutputDirectory || payload.outputDirectory !== selectedOutputDirectory) throw new Error('先选择输出目录');
    if (typeof payload.jsonText !== 'string' || typeof payload.animationName !== 'string') throw new Error('生成结果格式不正确');
    return writeOutputPackage({ ...payload, target });
  });

  ipcMain.handle('config:open', async () => {
    const path = process.env.SPW_SMOKE_FLOW === '1' ? process.env.SPW_SMOKE_CONFIG : await pickFile([{ name: '工坊配置', extensions: ['json'] }]);
    return path ? { path, jsonText: await readFile(path, 'utf8') } : null;
  });
  ipcMain.handle('config:save', async (_event, jsonText) => {
    if (typeof jsonText !== 'string') throw new Error('配置内容无效');
    if (process.env.SPW_SMOKE_FLOW === '1') {
      const path = process.env.SPW_SMOKE_CONFIG;
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
    const timeout = setTimeout(() => { console.error('SPW_SMOKE_ERROR=窗口加载超时'); app.exit(1); }, flow ? 110000 : 25000);
    window.webContents.once('did-fail-load', (_event, code, description) => {
      clearTimeout(timeout); console.error(`SPW_SMOKE_ERROR=${code} ${description}`); app.exit(1);
    });
    window.webContents.once('did-finish-load', async () => {
      try {
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
          bridge: typeof window.spw?.openSource === 'function' && typeof window.spw?.saveOutput === 'function',
          sourceCanvas: !!document.getElementById('source-canvas'),
          targetCanvas: !!document.getElementById('target-canvas'),
          timeline: !!document.getElementById('time'),
          status: document.getElementById('status')?.textContent,
        })`);
        console.log(`SPW_SMOKE_RESULT=${JSON.stringify(result)}`);
        app.exit(result.bridge && result.sourceCanvas && result.targetCanvas && result.timeline && result.status?.includes('先载入') ? 0 : 1);
      } catch (error) { console.error(`SPW_SMOKE_ERROR=${String(error)}`); app.exit(1); }
    });
  }
  window.loadFile(join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => { registerIpc(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
