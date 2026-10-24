const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("node:path"),
  fs = require("node:fs/promises");
const { FileStore, digest } = require("./files.cjs");
const { Catalog } = require("./catalog.cjs");
const base = path.resolve(__dirname, ".."),
  dataRoot = app.isPackaged ? path.resolve(base, "../..") : base;
app.setPath('userData', process.argv.includes('--test-hidden') && process.env.XINGHAI_TEST_PROFILE
  ? path.resolve(process.env.XINGHAI_TEST_PROFILE)
  : path.join(dataRoot, '.cache', 'desktop-profile'));
let win,
  current = null,
  catalog = null,
  dirty = false,
  closing = false;
let nativeCurrent = null;
let paintWindow=null;
let workshopBridge = null;
let workshopV2 = null;
let activeWorkshopVersion = 0;
const workshopIsDirty = () => activeWorkshopVersion === 2 ? workshopV2?.isDirty() : workshopBridge?.isDirty();
let publishOutput = null;
let lastV2Export = null;
let pendingV2Export = null;
let lastPublishedOutput = null;
let workshopBlender =
  process.env.XINGHAI_BLENDER ??
  "D:/steam/steamapps/common/Blender/blender.exe";
const defaultWorkspace =
  require("../package.json").workspaceDefault ?? "workshop";
const entryFile = process.argv.includes("--workspace=legacy")
  ? "index.html"
  : process.argv.includes("--workspace=workshop")
    ? "workshop.html"
    : defaultWorkspace === "legacy"
      ? "index.html"
      : "workshop.html";
const guarded = (name, fn) =>
  ipcMain.handle(name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !==
        require("node:url").pathToFileURL(path.join(__dirname, entryFile)).href
    )
      throw Error("拒绝未知调用");
    try {
      if(paintWindow?.active&&['workshop:choose','workshop:open-recent','map:new','map:open'].includes(name))throw Error('请先结束独立绘画，再切换项目');
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
async function routeEdit(action){const focused=BrowserWindow.getFocusedWindow();if(!focused)return;const text=await focused.webContents.executeJavaScript('!!document.activeElement?.matches("input,textarea,[contenteditable=true]")');if(text){focused.webContents[action]();return;}if(focused===paintWindow?.child)paintWindow.menu(action);else win?.webContents.send('workshop-menu',action);}
async function confirmDiscard(){if(!(dirty||workshopIsDirty()))return true;const painting=!!paintWindow?.active;const result=await dialog.showMessageBox(win,{type:'warning',message:'有未保存的工坊或地图修改',detail:painting?'绘画和主窗口共享同一份修改。保存将写入整个项目。':'继续会放弃这些修改，可以取消后先保存。',buttons:painting?['取消','保存并继续','放弃修改']:['取消','放弃修改'],defaultId:0,cancelId:0});if(result.response===0)return false;if(painting&&result.response===1){try{await paintWindow.save();return true;}catch(error){await dialog.showMessageBox(win,{type:'error',message:'保存失败，窗口保持打开',detail:error.message});return false;}}return true;}

async function start() {
  const { validateMap } = require("../dist/core.cjs");
  const recents = require('./workshop-recents.cjs').createRecentProjects(
    path.join(app.getPath('userData'), 'recent-workshop-projects.json'),
  );
  workshopBridge = require("./workshop-ipc.cjs").createWorkshopBridge(
    require("../dist/workshop.cjs"),
  );
  workshopV2 = require('./workshop-v2-store.cjs').createWorkshopV2Repository(require('../dist/workshop.cjs'));
  const openWorkshopProject = async (root) => {
    const file = path.join(root, 'project.xhproject.json');
    const stat = await fs.stat(file);
    if (stat.size > 64 * 1024 * 1024) throw Error('项目文档超过64MiB');
    const schema = JSON.parse(await fs.readFile(file, 'utf8')).schema;
    if (schema === 'xinghai-workshop-project-2') return workshopV2.open(root);
    if (schema === 'xinghai-workshop-project-1') return workshopBridge.open(root);
    throw Error('不支持的工坊项目格式');
  };
  await fs.mkdir(path.join(dataRoot, "地图文件"), { recursive: true });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
 {label:'文件',submenu:[{label:'保存',accelerator:'CmdOrCtrl+S',click:()=>{if(BrowserWindow.getFocusedWindow()===paintWindow?.child)paintWindow.menu('save');else win?.webContents.send('workshop-menu','save');}},{label:'退出',role:'quit'}]},
 {label:'编辑',submenu:[{label:'撤销',accelerator:'CmdOrCtrl+Z',click:()=>void routeEdit('undo')},{label:'重做',accelerator:'CmdOrCtrl+Shift+Z',click:()=>void routeEdit('redo')},{type:'separator'},{label:'剪切',role:'cut'},{label:'复制',role:'copy'},{label:'粘贴',role:'paste'}]},
 {label:'颜色',submenu:[{label:'色相 / 饱和度 / 亮度 / 对比度…',click:()=>{if(paintWindow?.active){paintWindow.focus();return;}win?.webContents.send('workshop-menu','color');}}]},
 {label:'设置',submenu:[{label:'快捷键与功能…',click:()=>win?.webContents.send('workshop-menu','shortcuts')}]},
 {label:'视图',submenu:[{label:'重新加载',role:'reload'},{label:'全屏',role:'togglefullscreen'}]},
 {label:'窗口',submenu:[{label:'最小化',role:'minimize'},{label:'关闭',role:'close'}]}
 ]));
  win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1000,
    minHeight: 700,
    show: !process.argv.includes("--test-hidden"),
    backgroundColor: entryFile === "workshop.html" ? "#1a1d21" : "#d9e1e4",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: process.argv.includes("--test-hidden"),
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, cb) =>
    cb(false),
  );
  win.on("closed",()=>paintWindow?.close());
  win.on("close", async (e) => {
    if (!closing && (dirty || workshopIsDirty() || paintWindow?.active)) {
      e.preventDefault();
      await paintWindow?.settle();
      if (await confirmDiscard()) {
        closing = true;
        win.close();
      }
    }
  });
  paintWindow=require('./paint-window.cjs').createPaintWindow(win,entryFile);
  const paletteFolders=new Map();
  guarded('workshop:palettes',async(token,choose=false,reset=false)=>{const defaultRoot=workshopV2.paletteRoot(token);if(reset)paletteFolders.delete(defaultRoot);if(choose){const result=await dialog.showOpenDialog(win,{title:'选择色板文件夹',properties:['openDirectory']});if(!result.canceled)paletteFolders.set(defaultRoot,result.filePaths[0]);}const root=paletteFolders.get(defaultRoot)||defaultRoot;return require('./palette-library.cjs').listPalettes(root,root===defaultRoot);});
  guarded("workshop:choose", async (mode, document) => {
    if (!["create", "open"].includes(mode)) throw Error("工坊项目操作无效");
    if (!(await confirmDiscard())) return null;
    const pick = await dialog.showOpenDialog(win, {
      title: mode === "create" ? "选择新工坊项目目录" : "打开工坊项目目录",
      properties: ["openDirectory", "createDirectory"],
    });
    if (pick.canceled) return null;
    const result = mode === 'create'
      ? document?.schema === 'xinghai-workshop-project-2'
        ? await workshopV2.create(pick.filePaths[0], {
            ...document, name: document.name || path.basename(path.resolve(pick.filePaths[0])),
          })
        : await workshopBridge.create(pick.filePaths[0], document)
      : await openWorkshopProject(pick.filePaths[0]);
    activeWorkshopVersion = result.version === 2 ? 2 : 1;
    lastV2Export = null;
    pendingV2Export = null;
    await recents.record(pick.filePaths[0], result.document.name).catch((error) => {
      result.recentError = error.message;
    });
    publishOutput = null;
    lastPublishedOutput = null;
    win.setDocumentEdited(dirty || workshopIsDirty());
    return result;
  });
  guarded('workshop:recents', async () => Promise.all((await recents.list()).map(async (row) => ({
    ...row,
    missing: !(await fs.stat(path.join(row.root, 'project.xhproject.json')).then((s) => s.isFile()).catch(() => false)),
  }))));
  guarded('workshop:open-recent', async (id) => {
    if (!(await confirmDiscard())) return null;
    const root = await recents.resolve(id);
    const result = await openWorkshopProject(root);
    activeWorkshopVersion = result.version === 2 ? 2 : 1;
    lastV2Export = null;
    pendingV2Export = null;
    await recents.record(root, result.document.name).catch((error) => {
      result.recentError = error.message;
    });
    publishOutput = null;
    lastPublishedOutput = null;
    win.setDocumentEdited(dirty || workshopIsDirty());
    return result;
  });
  guarded('workshop:forget-recent', (id) => recents.remove(id));
  guarded('workshop:v2-portable-export',async(token,id)=>{
    const loaded=await workshopV2.loadAsset(token,id),preview=await workshopV2.readPreview(token,'asset',id);
    const bytes=require('./portable-asset.cjs').encode(loaded.document,preview,require('../dist/workshop.cjs'));
    const pick=await dialog.showSaveDialog(win,{title:'导出工坊便携源文件',defaultPath:'模型.xhasset',filters:[{name:'工坊便携源',extensions:['xhasset']}]});
    if(pick.canceled||!pick.filePath)return null;
    // Exclusive creation never truncates an existing user file.
    const temp=path.join(path.dirname(pick.filePath),'.xhasset-'+require('node:crypto').randomUUID()+'.tmp');
    try {const handle=await fs.open(temp,'wx');try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await fs.link(temp,pick.filePath);}
    finally {await fs.unlink(temp).catch(()=>{});}return pick.filePath;
  });
  guarded('workshop:v2-portable-import',async(token)=>{
    workshopV2.location(token);
    const pick=await dialog.showOpenDialog(win,{title:'导入工坊便携源文件',properties:['openFile'],filters:[{name:'工坊便携源',extensions:['xhasset']}]});
    if(pick.canceled||!pick.filePaths[0])return null;
    const codec=require('./portable-asset.cjs'),stat=await fs.lstat(pick.filePaths[0]);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>codec.LIMIT)throw Error('便携文件无效或超限');
    const payload=codec.decode(await fs.readFile(pick.filePaths[0]),require('../dist/workshop.cjs'));
    const result=await workshopV2.saveAsset(token,payload.document,payload.preview);
    return {...result,asset:payload.document};
  });
  guarded('workshop:v2-load-asset', (token, id) => workshopV2.loadAsset(token, id));
  guarded('workshop:v2-list-asset-directory', (token, folder) => workshopV2.listAssetDirectory(token, folder));
  guarded('workshop:v2-list-project-directory', (token, folder) => workshopV2.listProjectDirectory(token, folder));
  guarded('workshop:v2-locate-asset', async (token, id) => {
    const loaded = await workshopV2.loadAsset(token, id);
    const file = path.join(workshopV2.location(token), loaded.path);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error('原生资产文件不存在或无效');
    shell.showItemInFolder(file);
    return file;
  });
  guarded('workshop:v2-load-scene', (token, id) => workshopV2.loadScene(token, id));
  guarded('workshop:v2-read-binary', (token, id) => workshopV2.readBinary(token, id));
  guarded('workshop:v2-save-asset', (token, document, preview, origin, folder) => workshopV2.saveAsset(token, document, preview, origin, folder));
  guarded('workshop:v2-save-scene', (token, document, preview) => workshopV2.saveScene(token, document, preview));
  guarded('workshop:v2-read-preview', (token, kind, id) => workshopV2.readPreview(token, kind, id));
  guarded('workshop:v2-export-fbx', async (token, id, fileName, resolution = null) => {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw Error('资产身份无效');
    const outputName = require('./workshop-v2-export.cjs').outputName(fileName);
    let directory;
    if (resolution === 'backup-replace' || resolution === 'new-name') {
      if (!pendingV2Export || pendingV2Export.token !== token || pendingV2Export.id !== id ||
          (resolution === 'backup-replace' && pendingV2Export.fileName !== fileName))
        throw Error('导出目标已失效，请重新选择输出文件夹');
      directory = pendingV2Export.directory;
    } else {
      if (resolution !== null) throw Error('导出选择无效');
      const pick = await dialog.showOpenDialog(win, { title: '选择单资产 FBX 输出文件夹',
        properties: ['openDirectory', 'createDirectory'] });
      if (pick.canceled) return null;
      directory = pick.filePaths[0];
    }
    const target = path.join(directory, outputName);
    if (await fs.lstat(target).then(() => true, (error) => {
      if (error.code === 'ENOENT') return false; throw error;
    }) && resolution !== 'backup-replace') {
      pendingV2Export = { token, id, fileName, directory };
      return { collision: true, directory: target };
    }
    const source = await workshopV2.loadAsset(token, id);
    const result = await require('./workshop-v2-export.cjs').exportSavedAssetFbx(source,
      directory, fileName, workshopBlender, require('../dist/workshop.cjs'),
      { replaceExisting: resolution === 'backup-replace' });
    pendingV2Export = null;
    lastV2Export = result.directory;
    return result;
  });
  guarded('workshop:v2-open-export', async () => {
    if (!lastV2Export) throw Error('本次还没有导出');
    const stat = await fs.lstat(lastV2Export);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('输出目录无效');
    const error = await shell.openPath(lastV2Export); if (error) throw Error(`无法打开输出目录：${error}`);
  });
  guarded('workshop:v2-rename-project', (token, name) => workshopV2.renameProject(token, name));
  guarded('workshop:v2-independent', (token, sceneId, instanceId, preview) => workshopV2.makeIndependent(token, sceneId, instanceId, preview));
  guarded('workshop:v2-copy-scene', (token, sceneId, name) => workshopV2.copyScene(token, sceneId, name));
  guarded('workshop:v2-trash-list', (token) => workshopV2.listTrash(token));
  guarded('workshop:v2-trash-asset', (token, id, removeReferences) => workshopV2.trashAsset(token, id, removeReferences));
  guarded('workshop:v2-trash-scene', (token, id) => workshopV2.trashScene(token, id));
  guarded('workshop:v2-trash-restore', (token, id) => workshopV2.restoreTrash(token, id));
  guarded('workshop:v2-trash-purge', (token, id) => workshopV2.purgeTrash(token, id));
  guarded('workshop:v2-dirty', (token, value) => {
    workshopV2.dirty(token, value);
    win.setDocumentEdited(dirty || workshopV2.isDirty());
  });
  guarded('workshop:v2-migrate', async (token, folderName) => {
    const sourceRoot = workshopBridge.projectLocation(token).root;
    if (typeof folderName !== 'string' || !/^[^\\/:*?"<>|. ][^\\/:*?"<>|]{0,79}$/.test(folderName) || /[. ]$/.test(folderName))
      throw Error('新项目目录名无效');
    const pick = await dialog.showOpenDialog(win, { title: '选择转换副本的上级目录', properties: ['openDirectory', 'createDirectory'] });
    if (pick.canceled) return null;
    const target = path.join(pick.filePaths[0], folderName);
    const migrated = await require('./workshop-v2-store.cjs').migrateV1Copy(sourceRoot, target, require('../dist/workshop.cjs'));
    const opened = await workshopV2.open(migrated.root);
    activeWorkshopVersion = 2;
    await recents.record(migrated.root, opened.document.name).catch(() => {});
    return { ...opened, migration: migrated.report };
  });
  guarded('workshop:v2-copy-project', async (token, folderName) => {
    if (typeof folderName !== 'string' || !/^[^\\/:*?"<>|. ][^\\/:*?"<>|]{0,79}$/.test(folderName) ||
        /[. ]$/.test(folderName) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(folderName))
      throw Error('新项目目录名无效');
    const pick = await dialog.showOpenDialog(win, { title: '选择项目副本的上级目录',
      properties: ['openDirectory', 'createDirectory'] });
    if (pick.canceled) return null;
    const copied = await workshopV2.copyProject(token, path.join(pick.filePaths[0], folderName), folderName);
    const opened = await workshopV2.open(copied.root);
    activeWorkshopVersion = 2; lastV2Export = null;
    await recents.record(copied.root, opened.document.name).catch(() => {});
    win.setDocumentEdited(dirty || workshopIsDirty());
    return opened;
  });
  guarded("workshop:load", (token, file, kind, id) =>
    workshopBridge.load(token, file, kind, id),
  );
  guarded('workshop:trash-list', (token) => workshopBridge.listTrash(token));
  guarded('workshop:trash-asset', async (token, sceneId, assetId, removeInstances) => {
    const result = await workshopBridge.trashAsset(token, sceneId, assetId, removeInstances);
    win.setDocumentEdited(dirty || workshopIsDirty());
    return result;
  });
  guarded('workshop:trash-scene', async (token, sceneId) => {
    const result = await workshopBridge.trashScene(token, sceneId);
    win.setDocumentEdited(dirty || workshopIsDirty());
    return result;
  });
  guarded('workshop:trash-restore', async (token, trashId) => {
    const result = await workshopBridge.restoreTrash(token, trashId);
    win.setDocumentEdited(dirty || workshopIsDirty());
    return result;
  });
  guarded('workshop:trash-purge', (token, trashId) => workshopBridge.purgeTrash(token, trashId));
  guarded("workshop:import-legacy", async (token) => {
    if (workshopBridge.isDirty())
      throw Error("请先保存当前项目，再导入旧图副本");
    const pick = await dialog.showOpenDialog(win, {
      title: "导入旧图副本（保留原件）",
      properties: ["openFile"],
      filters: [{ name: "旧地图", extensions: ["json"] }],
    });
    if (pick.canceled) return null;
    const file = pick.filePaths[0],
      store = new FileStore(path.dirname(file)),
      target = await store.safe(path.basename(file));
    if ((await fs.stat(target)).size > 64 * 1024 * 1024)
      throw Error("旧图超过64MiB");
    const json = await fs.readFile(target, "utf8"),
      core = require("../dist/workshop.cjs"),
      resolved = await require("./legacy-import.cjs").resolveLegacyAssets(
        json,
        catalog,
        core,
        validateMap,
      );
    const result = await workshopBridge.importLegacy(
      token,
      json,
      resolved.assets,
      resolved.issues,
    );
    return { ...result, sourceIssues: resolved.issues };
  });
  guarded("workshop:copy-scene", (token, sceneId) =>
    workshopBridge.copyScene(token, sceneId),
  );
  guarded("workshop:publishes", (token) => workshopBridge.publishes(token));
  guarded("workshop:publish-location", (token) => {
    const root=workshopBridge.publicationRoot(token),defaultRoot=path.join(root,'releases');
    return {defaultRoot,selectedRoot:publishOutput?.token===token?publishOutput.directory:defaultRoot};
  });
  guarded("workshop:publish-output-choose", async (token) => {
    const root=workshopBridge.publicationRoot(token);
    const pick=await dialog.showOpenDialog(win,{title:'选择发布输出文件夹',defaultPath:publishOutput?.token===token?publishOutput.directory:root,properties:['openDirectory','createDirectory']});
    if(pick.canceled)return null;
    const directory=path.resolve(pick.filePaths[0]),stat=await fs.lstat(directory);
    if(!stat.isDirectory()||stat.isSymbolicLink()||path.resolve(await fs.realpath(directory)).toLowerCase()!==directory.toLowerCase())throw Error('请选择真实文件夹作为输出目录');
    publishOutput={token,directory};
    return {defaultRoot:path.join(root,'releases'),selectedRoot:directory};
  });
  guarded("workshop:publish-output-reset", (token) => {
    const root=workshopBridge.publicationRoot(token);publishOutput=null;
    return {defaultRoot:path.join(root,'releases'),selectedRoot:path.join(root,'releases')};
  });
  guarded("workshop:publish-open", async (token,publishId,preferChosen=false) => {
    const item=(await workshopBridge.publishes(token)).find(p=>p.publishId===publishId);
    if(!item)throw Error('发布版本不存在或闭包校验失败');
    const directory=preferChosen&&lastPublishedOutput?.token===token&&lastPublishedOutput.publishId===publishId?lastPublishedOutput.directory:item.directory;
    const error=await shell.openPath(directory);if(error)throw Error('无法打开输出文件夹：'+error);
    return directory;
  });
  guarded("workshop:publish-cancel", (token) =>
    workshopBridge.cancelPublish(token),
  );
  guarded("workshop:blender-choose", async () => {
    const pick = await dialog.showOpenDialog(win, {
      title: "选择Blender 5.1.2可执行文件",
      properties: ["openFile"],
      filters: [{ name: "Blender", extensions: ["exe"] }],
    });
    if (pick.canceled) return null;
    workshopBlender = pick.filePaths[0];
    return path.basename(workshopBlender);
  });
  guarded(
    "workshop:publish",
    async (token, sceneId, assetId, publishId, recipe) => {
      const projectRoot=workshopBridge.publicationRoot(token),selectedRoot=publishOutput?.token===token?publishOutput.directory:path.join(projectRoot,'releases');
      const publishStore=require('./publish-store.cjs');
      await publishStore.preparePublishedOutput(projectRoot,selectedRoot,publishId);
      const info = JSON.parse(
        await fs.readFile(path.join(base, "dist/build-info.json"), "utf8"),
      );
      const blender = workshopBlender,
        converter =
          recipe === "glb-fbx"
            ? (stage, manifest, signal) =>
                require("./publish-fbx.cjs").convertPublishFbx(
                  stage,
                  manifest,
                  { blenderExecutable: blender, signal },
                )
            : undefined;
      const canonical=await workshopBridge.publish(
        token,
        sceneId,
        assetId,
        publishId,
        recipe,
        {
          workshopVersion: info.version,
          sourceFingerprint: info.sourceFingerprint,
        },
        converter,
      );
      let directory=canonical.directory,exportError=null;
      if(selectedRoot.toLowerCase()!==path.join(projectRoot,'releases').toLowerCase()){
        try{directory=await publishStore.copyPublishedOutput(projectRoot,canonical.directory,selectedRoot,publishId);}catch(e){exportError=e.message;}
      }
      lastPublishedOutput={token,publishId,directory};
      return {...canonical,directory,canonicalDirectory:canonical.directory,exportError};
    },
  );
  guarded("workshop:stage", (token, file, kind, id) =>
    workshopBridge.stage(token, file, kind, id),
  );
  guarded("workshop:read-binary", (token, sceneId, assetId) =>
    workshopBridge.readBinary(token, sceneId, assetId),
  );
  guarded("workshop:import-binary", async (token, sceneId, libraryId) => {
    if (libraryId) {
      if (!catalog) throw Error("先选择公共库");
      const payload = await catalog.payload(libraryId);
      if (!["glb", "png"].includes(payload.row.type))
        throw Error("此类型尚不支持装配取用");
      return workshopBridge.importBinary(token, sceneId, {
        kind: payload.row.type === "png" ? "texture" : "external",
        bytes: Buffer.from(payload.data, "base64"),
        anchorM: payload.row.anchor ?? [0, 0, 0],
      });
    }
    const pick = await dialog.showOpenDialog(win, {
      title: "导入自包含GLB或PNG贴花",
      properties: ["openFile"],
      filters: [{ name: "装配资产", extensions: ["glb", "png"] }],
    });
    if (pick.canceled) return null;
    const file = pick.filePaths[0],
      ext = path.extname(file).toLowerCase();
    if (![".glb", ".png"].includes(ext)) throw Error("请选择GLB或PNG");
    if ((await fs.stat(file)).size > 32 * 1024 * 1024)
      throw Error("资产超过32MiB");
    return workshopBridge.importBinary(token, sceneId, {
      kind: ext === ".png" ? "texture" : "external",
      bytes: await fs.readFile(file),
      anchorM: [0, 0, 0],
    });
  });
  guarded("workshop:commit", async (token, intents) => {
    const result = await workshopBridge.commit(token, intents);
    const location = workshopBridge.projectLocation(token);
    await recents.record(location.root, location.name).catch((error) => {
      result.recentError = error.message;
    });
    return result;
  });
  guarded("workshop:dirty", (token, value) => {
    workshopBridge.dirty(token, value);
    win.setDocumentEdited(dirty || workshopIsDirty());
  });
  guarded("workshop:library-source", async (id) => {
    if (!catalog) throw Error("先选择公共库");
    const row = catalog.get(id);
    if (row.type === "module")
      return require("./workshop-library.cjs")
        .createWorkshopLibrary(catalog.root, require("../dist/workshop.cjs"))
        .source(id);
    if (!row.nativeSource)
      throw Error("该资产没有可编辑体素源，外部模型将在装配阶段取用");
    const file = await catalog.store.safe(row.nativeSource);
    if ((await fs.stat(file)).size > 64 * 1024 * 1024)
      throw Error("源超过64MiB");
    const asset = require("../dist/workshop.cjs").fromNativeV1(
      JSON.parse(await fs.readFile(file, "utf8")),
    );
    if (asset.assetId !== id) throw Error("公共源身份改变");
    return asset;
  });
  guarded("workshop:library-register", async (asset) => {
    if (!catalog) throw Error("先选择公共库");
    const registered = await require("./workshop-library.cjs")
      .createWorkshopLibrary(catalog.root, require("../dist/workshop.cjs"))
      .register(asset);
    await catalog.scan();
    return { ...registered, assets: catalog.rows };
  });
  guarded("native:open", async () => {
    if (!(await confirmDiscard())) return null;
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "原生体素资产", extensions: ["json"] }],
    });
    if (r.canceled) return null;
    const file = r.filePaths[0],
      bytes = await fs.readFile(file);
    if (bytes.length > 64 * 1024 * 1024) throw Error("源超过64MB");
    const { validateNativeAsset, assetToMap } = require("../dist/exchange.cjs");
    const asset = validateNativeAsset(JSON.parse(bytes));
    nativeCurrent = { file, asset, hash: digest(bytes) };
    current = null;
    dirty = false;
    return { doc: assetToMap(asset), name: asset.name, assetId: asset.assetId };
  });
  guarded("native:save", async (doc, bounds, options = {}, update = false) => {
    doc = validateMap(doc);
    const ex = require("../dist/exchange.cjs");
    let file, asset;
    if (update) {
      if (!nativeCurrent) throw Error("先打开原生资产，再更新源");
      file = nativeCurrent.file;
      asset = ex.updateNativeAsset(nativeCurrent.asset, doc, bounds, {
        anchor: options.anchor,
      });
    } else {
      asset = ex.createNativeAsset(doc, bounds, options);
      const r = await dialog.showSaveDialog(win, {
        defaultPath: path.join(
          catalog?.root ?? path.join(dataRoot, "地图文件"),
          (options.name || "体素资产") + ".xhasset.json",
        ),
        filters: [{ name: "原生体素资产", extensions: ["json"] }],
      });
      if (r.canceled) return null;
      file = r.filePath;
      if (!file.endsWith(".xhasset.json"))
        file = file.replace(/\.json$/i, "") + ".xhasset.json";
      try {
        await fs.access(file);
        throw Error(
          "新资产路径已存在；请打开该原生资产后使用更新，或选择新文件名",
        );
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    }
    if (catalog && doc.instances.length) {
      const rel = path.relative(catalog.root, path.dirname(file));
      if (rel.startsWith("..") || path.isAbsolute(rel))
        throw Error("已有模型引用时，请把新资产保存到当前资产根目录内");
    }
    const result = await require("./native-store.cjs").saveNativePair(
      file,
      asset,
      ex.exportNativeAssetGlb(asset),
      update ? nativeCurrent.hash : undefined,
    );
    if (update) {
      nativeCurrent = { file: result.source, asset, hash: result.hash };
      dirty = false;
    }
    const root = path.dirname(result.source);
    if (
      !catalog ||
      path.relative(catalog.root, root).startsWith("..") ||
      path.isAbsolute(path.relative(catalog.root, root))
    )
      catalog = new Catalog(root);
    await catalog.scan();
    const relative = path
      .relative(catalog.root, result.model)
      .replaceAll("\\", "/");
    const row = catalog.rows.find((a) => a.path === relative);
    if (!row) throw Error("导出已保存，但未找到资产登记");
    if (!update) {
      if (catalog.rows.some((a) => a.id === asset.assetId && a !== row))
        throw Error("资产ID冲突");
      row.id = asset.assetId;
    }
    row.nativeSource = path
      .relative(catalog.root, result.source)
      .replaceAll("\\", "/");
    row.anchor = [0, 0, 0];
    await catalog.persist();
    return {
      ...result,
      root: catalog.root,
      assets: catalog.rows,
      assetId: row.id,
    };
  });
  guarded("model:export", async (doc, fbx = false) => {
    doc = validateMap(doc);
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.join(
        dataRoot,
        "地图文件",
        fbx ? "地图视觉.fbx" : "地图视觉.glb",
      ),
      filters: [
        {
          name: fbx ? "FBX交换" : "GLB视觉模型",
          extensions: [fbx ? "fbx" : "glb"],
        },
      ],
    });
    if (r.canceled) return null;
    const ex = require("../dist/exchange.cjs");
    const inputs = new Map();
    for (const item of [...doc.instances, ...doc.decals]) {
      if (!catalog) throw Error("请先选择地图资产目录");
      if (!inputs.has(item.assetId)) {
        const payload = await catalog.payload(item.assetId);
        inputs.set(
          item.assetId,
          new Uint8Array(Buffer.from(payload.data, "base64")),
        );
      }
    }
    const bytes = ex.exportSceneGlb(doc, inputs);
    const output = r.filePath,
      glb = fbx ? output.replace(/\.fbx$/i, "") + ".glb" : output;
    await new FileStore(path.dirname(glb)).save(glb, Buffer.from(bytes));
    if (fbx) {
      let blender = "D:/steam/steamapps/common/Blender/blender.exe";
      try {
        await fs.access(blender);
      } catch {
        const pick = await dialog.showOpenDialog(win, {
          title: "选择已安装的 Blender 程序",
          properties: ["openFile"],
          filters: [{ name: "Blender", extensions: ["exe"] }],
        });
        if (pick.canceled) return { message: "GLB已保存；取消FBX转换" };
        blender = pick.filePaths[0];
      }
      await new Promise((resolve, reject) =>
        require("node:child_process").execFile(
          blender,
          [
            "--background",
            "--factory-startup",
            "--python-exit-code",
            "1",
            "--python",
            path.join(base, "scripts/glb_to_fbx.py"),
            "--",
            "--input",
            glb,
            "--output",
            output,
          ],
          { windowsHide: true, timeout: 180000, maxBuffer: 4 * 1024 * 1024 },
          (error, stdout, stderr) =>
            error
              ? reject(
                  Error("Blender转换失败；旧FBX保留。" + stderr.slice(-800)),
                )
              : resolve(stdout),
        ),
      );
    }
    return { message: "已导出 " + output, file: output };
  });
  guarded("reference:import", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "PNG比例参考", extensions: ["png"] }],
    });
    if (r.canceled) return null;
    const file = r.filePaths[0];
    if ((await fs.stat(file)).size > 32 * 1024 * 1024)
      throw Error("PNG超过32MiB");
    const bytes = await fs.readFile(file);
    const {
        createReference,
        pngDimensions,
      } = require("../dist/references.cjs"),
      dataUrl = "data:image/png;base64," + bytes.toString("base64");
    const size = pngDimensions(dataUrl);
    const image = require("electron").nativeImage.createFromBuffer(bytes);
    if (image.isEmpty()) throw Error("PNG无法解码");
    const reference = createReference({
      id: require("node:crypto").randomUUID(),
      name: path.basename(file),
      dataUrl,
      pixelWidth: size.width,
      pixelHeight: size.height,
    });
    const bitmap = image.toBitmap();
    let x0 = size.width,
      y0 = size.height,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < size.height; y++)
      for (let x = 0; x < size.width; x++)
        if (bitmap[(y * size.width + x) * 4 + 3] > 8) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (y1 >= y0) {
      reference.contentTop = y0 / size.height;
      reference.contentBottom = (y1 + 1) / size.height;
      reference.footX = (x0 + x1 + 1) / 2 / size.width;
      reference.footY = reference.contentBottom;
    }
    return reference;
  });
  guarded("app:info", async () => ({
    ...JSON.parse(
      await fs.readFile(path.join(base, "dist/build-info.json"), "utf8"),
    ),
    resourcePath: base,
    executable: process.execPath,
  }));
  guarded("map:new", async () => {
    if (!(await confirmDiscard())) return false;
    current = null;
    nativeCurrent = null;
    dirty = false;
    return true;
  });
  guarded("map:open", async () => {
    if (!(await confirmDiscard())) return null;
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "星骸地图", extensions: ["json"] }],
    });
    if (r.canceled) return null;
    const file = r.filePaths[0],
      bytes = await fs.readFile(file);
    if (bytes.length > 64 * 1024 * 1024) throw Error("地图超过64MB");
    const doc = validateMap(JSON.parse(bytes));
    nativeCurrent = null;
    current = { file, hash: digest(bytes) };
    dirty = false;
    return { doc, name: path.basename(file) };
  });
  guarded("map:save", async (doc, saveAs = false) => {
    doc = validateMap(doc);
    let target = current;
    if (saveAs || !target) {
      const result = await dialog.showSaveDialog(win, {
        defaultPath:
          target?.file ??
          path.join(dataRoot, "地图文件", "我的地图.xhmap.json"),
        filters: [{ name: "星骸地图", extensions: ["json"] }],
      });
      if (result.canceled) return null;
      target = { file: result.filePath, hash: undefined };
    }
    const hash = await new FileStore(path.dirname(target.file)).save(
      target.file,
      JSON.stringify(doc, null, 2),
      target.hash,
    );
    current = { file: target.file, hash };
    dirty = false;
    return { name: path.basename(target.file) };
  });
  guarded("map:dirty", (value) => {
    dirty = !!value;
    win.setDocumentEdited(dirty);
  });
  guarded("assets:choose", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
      title: "选择资产根目录（将保存资产身份索引）",
    });
    if (r.canceled) return null;
    const candidate = new Catalog(r.filePaths[0]),
      assets = await candidate.scan();
    catalog = candidate;
    return { root: catalog.root, assets };
  });
  guarded("assets:reload", async () => {
    if (!catalog) throw Error("请先选择资产目录");
    return catalog.scan();
  });
  guarded("assets:anchor", async (id, values) => {
    if (!catalog) throw Error("请先选择资产目录");
    return catalog.anchor(id, values);
  });
  guarded("assets:data", async (id) => {
    if (!catalog) throw Error("请先选择资产目录");
    return catalog.payload(id);
  });
  guarded("assets:rename", async (id, name, physical) => {
    if (!catalog) throw Error("请先选择资产目录");
    if (
      physical &&
      (
        await dialog.showMessageBox(win, {
          message: "实际重命名资产文件？",
          detail: catalog.get(id).path + " → " + name,
          buttons: ["取消", "重命名"],
          defaultId: 0,
          cancelId: 0,
        })
      ).response !== 1
    )
      return null;
    return catalog.rename(id, name, physical);
  });
  guarded("assets:rename-preview", async (ids, options, physical) => {
    if (!catalog) throw Error("请先选择资产目录");
    return catalog.previewRename(ids, options, physical);
  });
  guarded("assets:rename-batch", async (ids, options, physical) => {
    if (!catalog) throw Error("请先选择资产目录");
    const plan = await catalog.previewRename(ids, options, physical);
    const detail = plan.items
      .map((item) => `${item.oldName} → ${item.newName}`)
      .join("\n");
    const result = await dialog.showMessageBox(win, {
      type: "warning",
      message: `确认批量修改 ${plan.items.length} 件资产？`,
      detail:
        detail +
        (physical
          ? `\n同时移动 ${plan.fileCount} 个 GLB/PNG/FBX/Blend 文件。`
          : "\n只改变显示名。"),
      buttons: ["取消", "确认修改"],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return null;
    await catalog.renameBatch(ids, options, physical);
    return catalog.scan();
  });
  guarded("assets:locate", async (id, source = false) => {
    if (!catalog) throw Error("请先选择资产目录");
    const row = catalog.get(id);
    const p = await catalog.store.safe(
      source ? (row.nativeSource ?? row.source ?? row.path) : row.path,
    );
    shell.showItemInFolder(p);
  });
  guarded("map:export", async (doc) => {
    doc = require("../dist/references.cjs").stripEditorMetadata(
      validateMap(doc),
    );
    if (doc.surfaces.some((s) => ["deploy", "ground"].includes(s.tag)))
      throw Error("请先迁移旧部署标签并另存副本，再导出团结源");
    if (
      doc.surfaces.some(
        (s) => ["walk", "highground"].includes(s.tag) && s.face !== 4,
      )
    )
      throw Error("站立标签存在非顶面引用，请先修正");
    if (!catalog && (doc.instances.length || doc.decals.length))
      throw Error("请载入这些实例的资产根目录");
    if (catalog)
      for (const p of [...doc.instances, ...doc.decals]) {
        const row = catalog.get(p.assetId);
        if (row.status !== "ready") throw Error("缺失资产：" + row.name);
      }
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.join(dataRoot, "地图文件", "地图交换.json"),
      filters: [{ name: "团结地图源", extensions: ["json"] }],
    });
    if (r.canceled) return null;
    const hash = await new FileStore(path.dirname(r.filePath)).save(
      r.filePath,
      JSON.stringify(doc, null, 2),
    );
    return {
      file: r.filePath,
      hash,
      message:
        "源文件已导出。在团结菜单 星骸地图 → 烘焙地图 中选择该文件，并配置资产映射。",
    };
  });
  await win.loadFile(path.join(__dirname, entryFile));
}
app.whenReady().then(start);
app.on("window-all-closed", () => app.quit());
