import {
  createAsset,
  createScene,
  createProject,
  type ProjectDocument,
  type SceneDocument,
} from "../core/workshop-documents.ts";
import { cloneAsset } from "../core/asset-copy.ts";
import { WorkshopSession } from "./workshop-session.ts";
import { moduleEditor } from "./renderer.ts";
import { AssemblyWorkspace } from "./workspaces/assembly.ts";
import { PublishWorkspace } from "./workspaces/publish.ts";
import { snapInstancePosition } from "../core/scene-drag.ts";
import { captureWorkshopSave } from "./workshop-save.ts";
import { editorCommand } from "./shortcuts.ts";
const $ = (id: string) => document.getElementById(id)!;
const api = window.workbench.workshop;
let manager = new WorkshopSession(),
  token = "",
  project: ProjectDocument | null = null,
  sceneId = "",
  assetId = "",
  workspace = "project",
  generation = 0,
  savedGeneration = 0;
const scenes = new Map<string, SceneDocument>(),
  leases = new Map<string, any>();
const binaryAssets = new Map<string, { row: any; data: string }>();
function placeBinary(row: any) {
  const id = crypto.randomUUID(),
    session = manager.sceneSession(sceneId);
  if (row.kind === "texture")
    session.addDecal({
      decalId: id,
      assetId: row.assetId,
      positionM: [0, 0, 0],
      rotationDeg: 0,
      widthM: 1,
      heightM: 1,
    });
  else
    session.add({
      instanceId: id,
      assetId: row.assetId,
      positionM: structuredClone(row.anchorM),
      rotationDeg: 0,
      groupId: "large-env",
    });
  selectAssembly([id]);
  return id;
}
async function importAssemblyAsset(libraryId?: string) {
  currentScene();
  const capturedToken = token,
    capturedScene = sceneId;
  const row = await api.importBinary(token, sceneId, libraryId);
  if (!row) return;
  if (capturedToken !== token || capturedScene !== sceneId)
    throw Error("导入期间项目或场景改变，请重新导入");
  const payload = await api.readBinary(token, sceneId, row.assetId);
  if (capturedToken !== token || capturedScene !== sceneId)
    throw Error("读取期间项目或场景改变，请重新导入");
  binaryAssets.set(row.assetId, payload);
  const scene = currentScene();
  scene.assets.push(row);
  manager.sceneSession(sceneId).install(scene, crypto.randomUUID(), false);
  const placed = placeBinary(row);
  dirty();
  activate("assembly");
  message("已导入独立本地副本");
  return placed;
}
const summaries = new Map<
  string,
  { name: string; count: number; error?: string }
>();
let saving = false;
let library: any[] = [];
let libraryRoot = "";
async function chooseLibrary() {
  const result = await window.workbench.chooseAssets();
  if (!result) return;
  library = result.assets;
  libraryRoot = result.root;
  if (workspace === "assembly") renderAssembly();
  if (workspace === "project") renderProject();
}
async function reloadLibrary() {
  library = await window.workbench.reloadAssets();
  if (workspace === "assembly") renderAssembly();
  if (workspace === "project") renderProject();
}
function sceneHistory(redo: boolean) {
  assembly?.cancel();
  if (redo) manager.redoScene(sceneId);
  else manager.undoScene(sceneId);
  if (assetId) {
    syncFields();
    moduleEditor.refresh();
  }
  dirty();
  renderAssembly();
}
document.addEventListener("keydown", (event) => {
  if (workspace !== "assembly" || !sceneId) return;
  const command = editorCommand(event);
  if (!command) return;
  event.preventDefault();
  void run(() =>
    command === "save" ? saveAll() : sceneHistory(command === "redo"),
  );
});
function message(text: string, error = false) {
  $("workshop-message").textContent = text;
  $("workshop-message").classList.toggle("error", error);
}
async function run(fn: () => Promise<void> | void) {
  try {
    await fn();
  } catch (e: any) {
    message(e.message, true);
  }
}
function dirty() {
  if (token)
    void api
      .dirty(
        token,
        generation !== savedGeneration ||
          manager.dirtyDocuments().length > 0 ||
          manager.dirtyScenes().length > 0,
      )
      .catch((e: any) => message(e.message, true));
}
const name = (value: string) => value || "未命名";
function element(tag: string, text?: string) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(text: string, fn: () => void) {
  const b = element("button", text);
  b.onclick = () => void run(fn);
  return b;
}
let assembly: AssemblyWorkspace | undefined;
let publisher: PublishWorkspace | undefined;
async function renderPublish() {
  if (!publisher)
    publisher = new PublishWorkspace($("publish-workspace"), {
      key: () => (token && sceneId ? token + "/" + sceneId : ""),
      targets: () =>
        sceneId
          ? [
              { id: "", name: "当前场景" },
              ...currentScene()
                .assets.filter((row) => row.kind === "voxel")
                .map((row) => ({
                  id: row.assetId,
                  name: name(
                    summaries.get(row.assetId)?.name ??
                      manager.assetSession(row.assetId).asset.name,
                  ),
                })),
            ]
          : [],
      editSource: async (id) => {
        if (id) await editAsset(id);
        else activate("assembly");
      },
      history: () => (token ? api.publishes(token) : Promise.resolve([])),
      cancel: () => api.cancelPublish(token),
      configureBlender: async () => {
        const selected = await api.chooseBlender();
        if (selected) message("已选择Blender：" + selected);
      },
      run,
      publish: async (id, publishId, recipe) => {
        if (!token || !sceneId) throw Error("先打开项目并选择场景");
        if (
          generation !== savedGeneration ||
          manager.dirtyDocuments().length ||
          manager.dirtyScenes().length
        )
          throw Error("发布前请先保存草稿");
        const capturedToken = token;
        await api.publish(token, sceneId, id || undefined, publishId, recipe);
        if (token === capturedToken) message(`发布完成：${publishId}`);
      },
    });
  await publisher.render();
}
let pendingSelection: string[] = [];
function selectAssembly(ids: string[]) {
  if (assembly) assembly.select(ids);
  else pendingSelection = ids;
}
function renderAssembly() {
  if (!assembly) {
    assembly = new AssemblyWorkspace($("assembly-workspace"), {
      scene: () =>
        sceneId && scenes.has(sceneId)
          ? manager.sceneSession(sceneId).snapshot()
          : null,
      session: () => manager.sceneSession(sceneId),
      assets: () => {
        const assets = new Map();
        if (sceneId && scenes.has(sceneId))
          for (const row of currentScene().assets)
            if (row.kind === "voxel") {
              try {
                const a = manager.assetSession(row.assetId);
                assets.set(row.assetId, manager.sync(a.sessionId));
              } catch {}
            }
        return assets;
      },
      binaries: () => binaryAssets,
      key: () => `${token}/${sceneId}`,
      library: () => library,
      libraryRoot: () => libraryRoot,
      chooseLibrary,
      reloadLibrary,
      changed: dirty,
      save: saveAll,
      history: sceneHistory,
      edit: editAsset,
      import: async () => {
        await importAssemblyAsset();
      },
      drop: takeLibraryForAssembly,
      message,
      run,
    });
    window.addEventListener("beforeunload", () => assembly?.dispose(), {
      once: true,
    });
    if (pendingSelection.length) {
      assembly.select(pendingSelection);
      pendingSelection = [];
    }
  }
  assembly.render();
}
async function takeLibraryForAssembly(
  id: string,
  position: [number, number, number],
) {
  const row = library.find((row) => row.id === id);
  if (!row) throw Error("公共资产未登记");
  const capturedToken = token,
    capturedScene = sceneId;
  if (["glb", "png"].includes(row.type) && !row.nativeSource) {
    const placed = await importAssemblyAsset(id);
    if (placed && token === capturedToken && sceneId === capturedScene)
      manager.sceneSession(sceneId).transform(placed, position, 0);
  } else {
    const source = await api.librarySource(id);
    if (token !== capturedToken || sceneId !== capturedScene)
      throw Error("拖入期间项目或场景改变");
    const copy = cloneAsset(source, crypto.randomUUID());
    await addAsset(copy);
    const instanceId = crypto.randomUUID();
    manager.sceneSession(sceneId).add({
      instanceId,
      assetId: copy.assetId,
      positionM: snapInstancePosition(position, copy.anchorM, 0),
      rotationDeg: 0,
      groupId: "large-env",
    });
    selectAssembly([instanceId]);
  }
  dirty();
  activate("assembly");
  message("已拖入独立本地副本");
}
function activate(next: string) {
  assembly?.cancel();
  moduleEditor.cancel();
  if (next === "module" && !assetId) {
    message("先创建或选择一个模块草稿。");
    return;
  }
  workspace = next;
  for (const page of ["project", "module", "assembly", "publish"])
    $(page + "-workspace").hidden = page !== next;
  document
    .querySelectorAll<HTMLButtonElement>("[data-workspace]")
    .forEach((b) => {
      b.classList.toggle("active", b.dataset.workspace === next);
      b.setAttribute("aria-pressed", String(b.dataset.workspace === next));
    });
  manager.activate(next as any, next === "module" ? assetId : sceneId);
  if (next === "project") renderProject();
  if (next === "module") moduleEditor.resize();
  if (next === "assembly") void run(renderAssembly);
  if (next === "publish") void run(renderPublish);
}
document
  .querySelectorAll<HTMLButtonElement>("[data-workspace]")
  .forEach((b) => (b.onclick = () => activate(b.dataset.workspace!)));
async function choose(mode: "create" | "open") {
  if (saving) throw Error("保存正在进行，请完成后再切换项目");
  moduleEditor.cancel();
  const selected = await api.choose(
    mode,
    mode === "create" ? createProject(crypto.randomUUID()) : undefined,
  );
  if (!selected) return;
  await loadProject(selected);
}
async function loadProject(selected: any) {
  token = selected.token;
  project = selected.document;
  manager = new WorkshopSession();
  scenes.clear();
  leases.clear();
  summaries.clear();
  binaryAssets.clear();
  assembly?.clearSelection();
  assetId = "";
  generation = 0;
  savedGeneration = 0;
  const p = await api.load(
    token,
    "project.xhproject.json",
    "project",
    project!.projectId,
  );
  leases.set(p.path, p);
  for (const row of project!.scenes) {
    const loaded = await api.load(token, row.source, "scene", row.sceneId);
    scenes.set(row.sceneId, loaded.document);
    leases.set(row.source, loaded);
    for (const asset of loaded.document.assets)
      if (asset.kind === "voxel") {
        try {
          const source = await api.load(
            token,
            `scenes/${row.sceneId}/${asset.source}`,
            "asset",
            asset.assetId,
          );
          summaries.set(asset.assetId, {
            name: source.document.name,
            count: source.document.cells.length,
          });
          leases.set(source.path, source);
          manager.openAsset(source.document, source.hash);
        } catch (e: any) {
          summaries.set(asset.assetId, {
            name: "源无法读取",
            count: 0,
            error: e.message,
          });
        }
      } else {
        try {
          binaryAssets.set(
            asset.assetId,
            await api.readBinary(token, row.sceneId, asset.assetId),
          );
        } catch (e: any) {
          summaries.set(asset.assetId, {
            name: "缺失资产",
            count: 0,
            error: e.message,
          });
        }
      }
    manager.openScene(loaded.document, loaded.hash);
  }
  sceneId = project!.scenes[0]?.sceneId ?? "";
  $("project-title").textContent = name(project!.name);
  activate("project");
  message("项目已打开");
}
function newScene() {
  if (!project) throw Error("先创建或打开项目");
  const s = createScene(crypto.randomUUID());
  s.name = `场景 ${project.scenes.length + 1}`;
  scenes.set(s.sceneId, s);
  manager.openScene(s, null);
  project.scenes.push({
    sceneId: s.sceneId,
    name: s.name,
    source: `scenes/${s.sceneId}/scene.xhscene.json`,
  });
  project.revision++;
  sceneId = s.sceneId;
  assetId = "";
  generation++;
  dirty();
  renderProject();
}
function currentScene() {
  if (!scenes.has(sceneId)) throw Error("先创建或选择场景");
  return manager.sceneSession(sceneId).snapshot();
}
async function addAsset(asset = createAsset(crypto.randomUUID())) {
  const scene = currentScene();
  scene.assets.push({
    kind: "voxel",
    assetId: asset.assetId,
    source: `assets/${asset.assetId}.xhmodule.json`,
  });
  scene.revision++;
  manager.openAsset(asset, null);
  manager.sceneSession(sceneId).install(scene, crypto.randomUUID(), false);
  generation++;
  dirty();
  await editAsset(asset.assetId);
}
async function editAsset(id: string) {
  moduleEditor.cancel();
  const scene = currentScene(),
    row = scene.assets.find((a) => a.assetId === id && a.kind === "voxel");
  if (!row || row.kind !== "voxel") throw Error("模块登记不存在");
  let session;
  try {
    session = manager.assetSession(id);
  } catch {
    const file = `scenes/${sceneId}/${row.source}`,
      loaded = await api.load(token, file, "asset", id);
    leases.set(file, loaded);
    session = manager.openAsset(loaded.document, loaded.hash);
  }
  assetId = id;
  moduleEditor.bind(session.editor, name(session.asset.name), {
    sessionId: session.sessionId,
    root: () => session.asset.anchorM,
    changed() {
      manager.sync(session.sessionId);
      dirty();
    },
    undo() {
      manager.undo(session.sessionId);
      syncFields();
    },
    redo() {
      manager.redo(session.sessionId);
      syncFields();
    },
    save: saveAll,
  });
  syncFields();
  activate("module");
  message("编辑场景私有模块");
}
function syncFields() {
  if (!assetId) return;
  const s = manager.assetSession(assetId);
  ($("module-name") as HTMLInputElement).value = s.asset.name;
  ($("module-root") as HTMLInputElement).value = s.asset.anchorM.join(",");
  const tabs = $("module-tabs") as HTMLSelectElement;
  tabs.replaceChildren();
  for (const row of currentScene().assets.filter((a) => a.kind === "voxel")) {
    let n = "";
    try {
      n = manager.assetSession(row.assetId).asset.name;
    } catch {}
    const o = element("option", name(n)) as HTMLOptionElement;
    o.value = row.assetId;
    tabs.append(o);
  }
  tabs.value = assetId;
}
async function saveAll() {
  if (!project) throw Error("先创建或打开项目");
  if (saving) throw Error("保存正在进行");
  moduleEditor.cancel();
  assembly?.cancel();
  saving = true;
  message("正在保存草稿…");
  try {
    const submittedGeneration = generation,
      capture = captureWorkshopSave(project, scenes.values(), manager),
      submitted = capture.assets,
      intents: any[] = [];
    async function target(
      path: string,
      kind: string,
      id: string,
      document: any,
    ) {
      let lease = leases.get(path);
      if (!lease) {
        lease = await api.stage(token, path, kind, id);
        leases.set(path, lease);
      }
      intents.push({ leaseId: lease.leaseId, document });
    }
    for (const write of capture.writes)
      await target(write.path, write.kind, write.id, write.document);
    const result = await api.commit(token, intents);
    for (const scene of capture.scenes)
      manager.markSceneSaved(scene.sceneId, scene.revision);
    for (const s of submitted)
      manager.markSaved(
        s.sessionId,
        s.revision,
        result.files.find((f: any) => f.path === s.file).hash,
      );
    savedGeneration = submittedGeneration;
    for (const s of submitted) {
      const asset = manager.sync(s.sessionId);
      summaries.set(asset.assetId, {
        name: asset.name,
        count: asset.cells.length,
      });
    }
    dirty();
    message("草稿已保存");
    if (workspace === "project") renderProject();
  } finally {
    saving = false;
  }
}
function renderProject() {
  const host = $("project-workspace");
  host.replaceChildren(element("h1", "项目与资产"));
  const actions = element("div");
  actions.className = "actions";
  actions.append(
    button("新建项目", () => void run(() => choose("create"))),
    button("打开项目", () => void run(() => choose("open"))),
  );
  if (project)
    actions.append(
      button("新建场景", newScene),
      button("保存项目", () => void run(saveAll)),
      button("选择公共库", () => void run(chooseLibrary)),
      button("重载公共库", () => void run(reloadLibrary)),
    );
  host.append(actions);
  if (!project) {
    const hint = element(
      "p",
      "选择项目目录，分别管理场景与模块。模块可保留为空草稿，随时继续编辑。",
    );
    hint.className = "hint";
    host.append(hint);
    return;
  }
  const columns = element("div");
  actions.append(
    button(
      "导入旧图副本",
      () =>
        void run(async () => {
          if (
            generation !== savedGeneration ||
            manager.dirtyDocuments().length ||
            manager.dirtyScenes().length
          )
            throw Error("请先保存当前项目，再导入旧图副本");
          const selected = await api.importLegacy(token);
          if (!selected) return;
          await loadProject(selected);
          sceneId = selected.migration.sceneId;
          renderProject();
          message(
            `旧图副本已导入 · ${selected.migration.issues.length} 项待处理问题 · 原文和报告已保存`,
          );
        }),
    ),
  );
  columns.className = "project-columns";
  const sidebar = element("aside");
  sidebar.className = "scene-list";
  sidebar.append(element("h2", "场景"));
  for (const row of project.scenes) {
    const b = button(name(row.name), () => {
      sceneId = row.sceneId;
      assetId = "";
      renderProject();
    });
    b.classList.toggle("active", sceneId === row.sceneId);
    b.setAttribute("aria-pressed", String(sceneId === row.sceneId));
    sidebar.append(b);
  }
  columns.append(sidebar);
  const main = element("section");
  main.append(
    element(
      "h2",
      scenes.has(sceneId) ? name(currentScene().name) : "创建第一个场景",
    ),
  );
  if (scenes.has(sceneId)) {
    const actions = element("div");
    actions.className = "actions";
    actions.append(button("新建空草稿", () => void run(() => addAsset())));
    actions.append(
      button(
        "复制场景",
        () =>
          void run(async () => {
            if (
              generation !== savedGeneration ||
              manager.dirtyDocuments().length ||
              manager.dirtyScenes().length
            )
              throw Error("请先保存当前项目，再复制场景");
            const selected = await api.copyScene(token, sceneId);
            await loadProject(selected);
            sceneId = selected.migration.sceneId;
            renderProject();
            message("已创建独立场景副本，原场景保持");
          }),
      ),
    );
    main.append(actions);
    const grid = element("div");
    grid.className = "asset-grid";
    for (const row of currentScene().assets.filter((a) => a.kind === "voxel")) {
      let s: any;
      try {
        s = manager.assetSession(row.assetId);
      } catch {}
      const card = element("article");
      card.className = "module-card";
      card.classList.toggle("selected", row.assetId === assetId);
      const summary = s
        ? { name: s.asset.name, count: s.asset.cells.length, error: undefined }
        : summaries.get(row.assetId);
      card.append(
        element("h3", name(summary?.name ?? "")),
        element(
          "p",
          summary?.error
            ? "源缺失或损坏"
            : `${summary?.count ?? "—"} 体素 · 场景私有源`,
        ),
      );
      const edit = button(
        "编辑模块",
        () => void run(() => editAsset(row.assetId)),
      );
      edit.dataset.action = "edit-asset";
      edit.setAttribute("aria-pressed", String(row.assetId === assetId));
      card.append(
        edit,
        button(
          "独立副本",
          () =>
            void run(async () => {
              await editAsset(row.assetId);
              await addAsset(
                cloneAsset(
                  manager.sync(manager.assetSession(row.assetId).sessionId),
                  crypto.randomUUID(),
                ),
              );
            }),
        ),
        button(
          "登记到公共库",
          () =>
            void run(async () => {
              await editAsset(row.assetId);
              const r = await api.libraryRegister(
                manager.sync(manager.assetSession(row.assetId).sessionId),
              );
              library = r.assets;
              message("已登记独立公共副本");
            }),
        ),
      );
      grid.append(card);
    }
    main.append(grid);
  }
  main.append(element("h2", "公共库 · 取用为独立副本"));
  for (const row of library) {
    const item = element("div");
    item.append(
      element("span", `${row.name} · ${row.status} `),
      button(
        "取用到当前场景",
        () =>
          void run(async () => {
            if (["glb", "png"].includes(row.type) && !row.nativeSource) {
              await importAssemblyAsset(row.id);
              return;
            }
            const source = await api.librarySource(row.id);
            await addAsset(cloneAsset(source, crypto.randomUUID()));
          }),
      ),
      button(
        "定位源",
        () =>
          void run(() =>
            window.workbench.locateAsset(row.id, !!row.nativeSource),
          ),
      ),
    );
    main.append(item);
  }
  columns.append(main);
  host.append(columns);
}
($("module-tabs") as HTMLSelectElement).onchange = () =>
  void run(() => editAsset(($("module-tabs") as HTMLSelectElement).value));
($("module-name") as HTMLInputElement).onchange = () =>
  void run(() => {
    moduleEditor.cancel();
    manager.rename(
      manager.assetSession(assetId).sessionId,
      ($("module-name") as HTMLInputElement).value,
    );
    syncFields();
    moduleEditor.refresh();
  });
$("module-root-apply").onclick = () =>
  void run(() => {
    moduleEditor.cancel();
    const root = ($("module-root") as HTMLInputElement).value
      .split(",")
      .map(Number) as [number, number, number];
    manager.reanchor(manager.assetSession(assetId).sessionId, root);
    syncFields();
    moduleEditor.refresh();
    message("Root 已设置；体素局部坐标保持");
  });
$("save-draft").onclick = () => void run(saveAll);
$("module-root-pick").onclick = () =>
  moduleEditor.pickRoot(
    (root) =>
      void run(() => {
        manager.reanchor(manager.assetSession(assetId).sessionId, root);
        syncFields();
        moduleEditor.refresh();
        message("Root 已选定");
      }),
  );
$("close-module").onclick = () =>
  void run(() => {
    moduleEditor.cancel();
    const id = assetId;
    if (manager.dirtyDocuments().includes(id))
      throw Error("模块尚未保存，请先保存草稿");
    moduleEditor.unbind();
    manager.closeAsset(id);
    assetId = "";
    activate("project");
  });
$("duplicate").onclick = () =>
  void run(() =>
    addAsset(
      cloneAsset(
        manager.sync(manager.assetSession(assetId).sessionId),
        crypto.randomUUID(),
      ),
    ),
  );
for (const id of [
  "tag",
  "rotation",
  "decalwidth",
  "decalheight",
  "eventkey",
  "anchor",
])
  $(id).closest("label")!.hidden = true;
const selectionPanel = element("details") as HTMLDetailsElement;
selectionPanel.append(element("summary", "体素选区"));
$("tools").after(selectionPanel);
for (const id of ["native-minz", "native-maxz"])
  selectionPanel.append($(id).closest("label")!);
for (const id of ["native-select", "native-all", "native-selection"])
  selectionPanel.append($(id));
$("native-select").textContent = "框选体素";
$("native-all").textContent = "全选体素";
selectionPanel.append(
  button(
    "复制选区为模块",
    () =>
      void run(async () => {
        const bounds = moduleEditor.selection();
        if (!bounds) throw Error("先框选或全选体素");
        const copy = cloneAsset(
          manager.sync(manager.assetSession(assetId).sessionId),
          crypto.randomUUID(),
        );
        copy.cells = copy.cells.filter((c) =>
          [c.x, c.y, c.z].every(
            (v, i) => v >= bounds.min[i] && v <= bounds.max[i],
          ),
        );
        const columns = new Set(copy.cells.map((c) => `${c.x},${c.y}`));
        copy.protectedColumns = copy.protectedColumns.filter((k) =>
          columns.has(k),
        );
        if (!copy.cells.length) throw Error("选区内没有体素");
        await addAsset(copy);
      }),
  ),
);
selectionPanel.open = true;
for (const label of $("app").querySelectorAll<HTMLElement>(".section-label"))
  if (label.textContent!.startsWith("已放置内容")) label.hidden = true;
$("app").querySelectorAll<HTMLElement>(".view-label")[1].textContent =
  "模块预览";
activate("project");
