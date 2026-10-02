const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("node:path"),
  fs = require("node:fs/promises");
const { FileStore, digest } = require("./files.cjs");
const { Catalog } = require("./catalog.cjs");
const base = path.resolve(__dirname, ".."),
  dataRoot = app.isPackaged ? path.resolve(base, "../..") : base;
app.setPath("userData", path.join(dataRoot, ".cache", "desktop-profile"));
let win,
  current = null,
  catalog = null,
  dirty = false,
  closing = false;
const guarded = (name, fn) =>
  ipcMain.handle(name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      event.senderFrame.url !==
        require("node:url").pathToFileURL(path.join(__dirname, "index.html"))
          .href
    )
      throw Error("拒绝未知调用");
    try {
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
async function confirmDiscard() {
  return (
    !dirty ||
    (
      await dialog.showMessageBox(win, {
        type: "warning",
        message: "有未保存的地图修改",
        detail: "继续会放弃这些修改。可以先取消，再保存地图。",
        buttons: ["取消", "放弃修改"],
        defaultId: 0,
        cancelId: 0,
      })
    ).response === 1
  );
}
async function start() {
  const { validateMap } = require("../dist/core.cjs");
  await fs.mkdir(path.join(dataRoot, "地图文件"), { recursive: true });
  win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1000,
    minHeight: 700,
    show: !process.argv.includes("--test-hidden"),
    backgroundColor: "#d9e1e4",
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
  win.on("close", async (e) => {
    if (!closing && dirty) {
      e.preventDefault();
      if (await confirmDiscard()) {
        closing = true;
        win.close();
      }
    }
  });
  guarded("map:new", async () => {
    if (!(await confirmDiscard())) return false;
    current = null;
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
  guarded("assets:locate", async (id, source = false) => {
    if (!catalog) throw Error("请先选择资产目录");
    const row = catalog.get(id);
    const p = await catalog.store.safe(
      source && row.source ? row.source : row.path,
    );
    shell.showItemInFolder(p);
  });
  guarded("map:export", async (doc) => {
    doc = validateMap(doc);
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
  await win.loadFile(path.join(__dirname, "index.html"));
}
app.whenReady().then(start);
app.on("window-all-closed", () => app.quit());
