const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { runtimePaths, isTrustedSender } = require('./runtime.cjs');
const { createTaskSession, TaskSessionError } = require('./task-session.cjs');
const paths = runtimePaths(path.resolve(__dirname, '..'));
const entryUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
app.setName('星骸 2D 素材任务工坊');
app.setPath('userData', paths.userData);
app.commandLine.appendSwitch('disable-background-networking');
let win;
let exporting = false;

app.whenReady().then(async () => {
  // The app only loads local files; deny remote protocols at the session boundary too.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_request, done) => done({ cancel: true }),
  );
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, done) => done(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  win = new BrowserWindow({
    title: '星骸 2D 素材任务工坊', width: 1080, height: 820,
    minWidth: 760, minHeight: 640, show: !process.argv.includes('--test-hidden'),
    backgroundColor: '#1a1d21',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== entryUrl) event.preventDefault(); });
  const taskSession = createTaskSession({
    base: paths.base,
    pickReferences: () => dialog.showOpenDialog(win, {
      title: '添加参考 PNG', properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PNG 图像', extensions: ['png'] }],
    }),
    pickExportPath: ({ defaultFileName }) => dialog.showSaveDialog(win, {
      title: '保存任务 ZIP', defaultPath: defaultFileName,
      filters: [{ name: 'ZIP 任务包', extensions: ['zip'] }],
      showOverwriteConfirmation: false,
    }),
  });
  const guarded = (name, fn, safeErrors = false) => ipcMain.handle(name, async (event, ...args) => {
    if (!isTrustedSender(event, win.webContents, entryUrl)) throw Error('拒绝未知调用');
    try { return { ok: true, value: await fn(...args) }; }
    catch (error) {
      if (safeErrors) {
        if (error instanceof TaskSessionError) {
          return { ok: false, error: error.message, code: error.code, field: error.field };
        }
        return { ok: false, error: '操作失败，请检查输入后重试。', code: 'internal-error' };
      }
      return { ok: false, error: error.message };
    }
  });
  guarded('2dw:info', () => ({
    name: app.getName(), version: app.getVersion(), userData: app.getPath('userData'),
    outputDirectory: paths.outputDirectory, electron: process.versions.electron,
  }));
  const proof = () => import(pathToFileURL(path.join(paths.base, 'scripts', 'make-proof.mjs')).href);
  guarded('2dw:check', async () => (await proof()).checkProof(paths.base));
  guarded('2dw:export', async () => {
    if (exporting) throw Error('导出正在进行，请等待结果。');
    exporting = true;
    try { return await (await proof()).makeProof(paths.base); }
    finally { exporting = false; }
  });
  guarded('2dw:choices', () => taskSession.choices(), true);
  guarded('2dw:describe-form', payload => taskSession.describeForm(payload), true);
  guarded('2dw:choose-references', () => taskSession.chooseReferences(), true);
  guarded('2dw:update-reference', payload => taskSession.updateReference(payload), true);
  guarded('2dw:remove-reference', payload => taskSession.removeReference(payload), true);
  guarded('2dw:preview-task', payload => taskSession.previewTask(payload), true);
  guarded('2dw:export-task', payload => taskSession.exportTask(payload), true);
  await win.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
