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
let nativeCurrent = null;
let workshopBridge = null;
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
      return { ok: true, value: await fn(...args) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
async function confirmDiscard() {
  return (
    !(dirty || workshopBridge?.isDirty()) ||
    (
      await dialog.showMessageBox(win, {
        type: "warning",
        message: "有未保存的工坊或地图修改",
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
  workshopBridge = require("./workshop-ipc.cjs").createWorkshopBridge(
    require("../dist/workshop.cjs"),
  );
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
    if (!closing && (dirty || workshopBridge.isDirty())) {
      e.preventDefault();
      if (await confirmDiscard()) {
        closing = true;
        win.close();
      }
    }
  });
  guarded("workshop:choose", async (mode, document) => {
    if (!["create", "open"].includes(mode)) throw Error("工坊项目操作无效");
    if (!(await confirmDiscard())) return null;
    const pick = await dialog.showOpenDialog(win, {
      title: mode === "create" ? "选择新工坊项目目录" : "打开工坊项目目录",
      properties: ["openDirectory", "createDirectory"],
    });
    if (pick.canceled) return null;
    const result =
      mode === "create"
        ? await workshopBridge.create(pick.filePaths[0], document)
        : await workshopBridge.open(pick.filePaths[0]);
    win.setDocumentEdited(dirty || workshopBridge.isDirty());
    return result;
  });
  guarded("workshop:load", (token, file, kind, id) =>
    workshopBridge.load(token, file, kind, id),
  );
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
      return workshopBridge.publish(
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
  guarded("workshop:commit", (token, intents) =>
    workshopBridge.commit(token, intents),
  );
  guarded("workshop:dirty", (token, value) => {
    workshopBridge.dirty(token, value);
    win.setDocumentEdited(dirty || workshopBridge.isDirty());
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
