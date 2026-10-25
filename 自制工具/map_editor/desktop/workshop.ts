import {CanvasListPanel} from './canvas-list-panel.ts';
import {WorkshopShell} from './workshop-shell.ts';
import {PaintWindowController} from './paint-window-controller.ts';
import {assetRootBounds,rootFacePoint,type RootFace,type RootSnap} from '../core/asset-root.ts';
import {mergeSceneInstances} from '../core/scene-join.ts';
import {getShortcuts,setShortcut,resetShortcuts,shortcutKey,type SelectionCommand} from './selection-shortcuts.ts';
import {toolIcon} from './tool-icons.ts';
import {ensureModelObjects,assetCellCount,alignCanvas,CANVAS_TICK} from "../core/workshop-canvases.ts";
import {
  createAsset,
  createScene,
  createProject,
  type ProjectDocument,
  type SceneDocument,
} from "../core/workshop-documents.ts";
import { createProjectV2, createSceneV2, assetSourcePath, type ProjectV2, type SceneV2 } from '../core/workshop-v2.ts';
import { cloneAsset } from "../core/asset-copy.ts";
import { WorkshopSession } from "./workshop-session.ts";
import { moduleEditor } from "./renderer.ts";
import { ModelObjectTools } from "./model-object-tools.ts";
import { AssemblyWorkspace } from "./workspaces/assembly.ts";
import { PublishWorkspace } from "./workspaces/publish.ts";
import { snapInstancePosition } from "../core/scene-drag.ts";
import { captureWorkshopSave } from "./workshop-save.ts";
import { editorCommand } from "./shortcuts.ts";
import { assetPreviewImage, drawAssetPreview, drawScenePreview } from './workshop-preview.ts';
import { ProjectAssetBrowser, type ProjectEntry } from './project-asset-browser.ts';
const $ = (id: string) => document.getElementById(id)!;
const api = window.workbench.workshop;
let paintController:PaintWindowController|null=null;let workshopShell:WorkshopShell|null=null;
let manager = new WorkshopSession(),
  token = "",
  project: ProjectDocument | ProjectV2 | null = null,
  sceneId = "",
  assetId = "",
  workspace = "project",
  generation = 0,
  savedGeneration = 0;
let modelObjectTools: ModelObjectTools | null = null;
let savedProjectName = '';
let projectRoot = '';
let assetSearch = '', assetSort: 'name' | 'cells' = 'name', assetView: 'cards' | 'list' = 'cards';
const projectBrowsers = new Map<string, ProjectAssetBrowser>();
function chosenAssetFolder(scope = 'project'): string {
  const folder = projectBrowsers.get(scope)?.activeFolder() ?? '';
  if (!folder.startsWith('assets/')) return '';
  const category = folder.slice(7);
  if (isV2() && (project as ProjectV2).assets.some((row) =>
    row.kind === 'voxel' && row.source === `${folder}/asset.xhmodule.json`))
    return category.split('/').slice(0, -1).join('/');
  return category;
}
function projectBrowser(scope: string): ProjectAssetBrowser {
  let browser = projectBrowsers.get(scope);
  if (!browser) {
    browser = new ProjectAssetBrowser(`xinghai-project-browser:${(project as ProjectV2).projectId}:${scope}`, {
      list: (folder) => api.v2ListProjectDirectory(token, folder) as Promise<ProjectEntry[]>,
      preview: (id) => {
        try { const session = manager.assetSession(id); return assetPreviewImage(manager.sync(session.sessionId)); }
        catch { return null; }
      },
      open: (id) => void run(() => editAsset(id)),
      context: showAssetContextMenu,
    });
    projectBrowsers.set(scope, browser);
  }
  return browser;
}
const scenes = new Map<string, SceneDocument>(),
  leases = new Map<string, any>();
const binaryAssets = new Map<string, { row: any; data: string }>();
const isV2 = (): boolean => project?.schema === 'xinghai-workshop-project-2';
function sceneView(scene: SceneV2): SceneDocument {
  const assets = (project as ProjectV2).assets.map((row): any => row.kind === 'voxel'
    ? { kind: 'voxel', assetId: row.assetId, source: `assets/${row.assetId}.xhmodule.json` }
    : row.kind === 'texture'
      ? { kind: 'texture', assetId: row.assetId, revision: row.revision, image: `textures/${row.assetId}.png` }
      : { kind: 'external', assetId: row.assetId, revision: row.revision,
          model: `external/${row.assetId}/model.glb`, files: [`external/${row.assetId}/model.glb`],
          anchorM: row.anchorM, recipe: row.recipe });
  return { ...scene, schema: 'xinghai-workshop-scene-1', assets };
}
function sceneSource(view: SceneDocument): SceneV2 {
  const { assets: _assets, ...rest } = view;
  return { ...rest, schema: 'xinghai-workshop-scene-2' };
}
function refreshV2Registries() {
  if (!isV2()) return;
  const empty = createSceneV2('registry');
  const rows = sceneView(empty).assets;
  for (const id of scenes.keys()) manager.sceneSession(id).setRegistryRows(rows);
}
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
  refreshV2Registries();
  if (!isV2()) {
    const session = manager.sceneSession(sceneId), rows = session.snapshot().assets;
    const existing = new Set(rows.map(row => row.assetId));
    for (const row of retainedSceneJoinRows.get(`${token}/${sceneId}`) ?? [])
      if (!existing.has(row.assetId)) { rows.push(row); existing.add(row.assetId); }
    session.setRegistryRows(rows);
  }
  const row = project?.scenes.find((entry) => entry.sceneId === sceneId);
  if (row && row.name !== manager.sceneSession(sceneId).snapshot().name) {
    row.name = manager.sceneSession(sceneId).snapshot().name;
    project!.revision++;
    generation++;
  }
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
    void (isV2() ? api.v2Dirty : api.dirty)(
        token,
        generation !== savedGeneration ||
          manager.dirtyDocuments().length > 0 ||
          manager.dirtyScenes().length > 0,
      )
      .catch((e: any) => message(e.message, true));
}
const name = (value: string) => value || "未命名";
function askName(label: string, current: string): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'name-dialog';
    const heading = element('h2', label);
    const input = document.createElement('input');
    input.setAttribute('aria-label', label);
    input.maxLength = 200;
    input.value = current;
    const actions = element('div');
    actions.className = 'actions';
    const cancel = element('button', '取消') as HTMLButtonElement;
    const accept = element('button', '确定') as HTMLButtonElement;
    let result: string | null = null;
    cancel.onclick = () => dialog.close();
    accept.onclick = () => {
      const value = input.value.trim();
      if (!value) { input.setCustomValidity('名称不能为空'); input.reportValidity(); return; }
      result = value;
      dialog.close();
    };
    input.oninput = () => input.setCustomValidity('');
    input.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); accept.click(); } };
    actions.append(cancel, accept);
    dialog.append(heading, input, actions);
    dialog.onclose = () => { dialog.remove(); resolve(result); };
    document.body.append(dialog);
    dialog.showModal();
    input.focus(); input.select();
  });
}
function confirmAction(title: string, detail: string, acceptText = '确认移入回收区'): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'name-dialog';
    dialog.append(element('h2', title), element('p', detail));
    const actions = element('div'); actions.className = 'actions';
    const cancel = element('button', '取消') as HTMLButtonElement;
    const accept = element('button', acceptText) as HTMLButtonElement;
    let confirmed = false;
    cancel.onclick = () => dialog.close();
    accept.onclick = () => { confirmed = true; dialog.close(); };
    actions.append(cancel, accept); dialog.append(actions);
    dialog.onclose = () => { dialog.remove(); resolve(confirmed); };
    document.body.append(dialog); dialog.showModal(); cancel.focus();
  });
}
function chooseSwitchAction(): Promise<'save' | 'discard' | 'cancel'> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog'); dialog.className = 'name-dialog project-switch-dialog';
    dialog.append(element('h2', '切换项目'), element('p', '当前项目有未保存的修改。'));
    const actions = element('div'); actions.className = 'actions';
    let choice: 'save' | 'discard' | 'cancel' = 'cancel';
    for (const [value, label] of [['cancel', '取消'], ['discard', '放弃修改'], ['save', '保存并继续']] as const) {
      const b = element('button', label) as HTMLButtonElement;
      b.onclick = () => { choice = value; dialog.close(); };
      actions.append(b);
    }
    dialog.append(actions);
    dialog.onclose = () => { dialog.remove(); resolve(choice); };
    document.body.append(dialog); dialog.showModal();
    (actions.firstElementChild as HTMLButtonElement).focus();
  });
}
async function prepareProjectSwitch(): Promise<'proceed' | 'discard' | 'cancel'> {
  if(paintController?.active){const decision=await chooseSwitchAction();if(decision==='cancel')return 'cancel';if(decision==='save')await saveAll();await paintController.close();if(decision==='save')return 'proceed';await api.dirty(token,false);return 'discard';}if(!(await moduleEditor.resolveDraft('切换项目')))return 'cancel';
  if (!project || !hasUnsavedChanges()) return 'proceed';
  const choice = await chooseSwitchAction();
  if (choice === 'cancel') return 'cancel';
  if (choice === 'save') { await saveAll(); return 'proceed'; }
  await api.dirty(token, false);
  return 'discard';
}
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
      location: () => token ? api.publishLocation(token) : Promise.resolve(null),
      chooseOutput: () => api.choosePublishOutput(token),
      resetOutput: () => api.resetPublishOutput(token),
      openOutput: async (id,preferChosen) => {const directory=await api.openPublishedOutput(token,id,preferChosen);message('已打开输出文件夹：'+directory);return directory;},
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
        const result=await api.publish(token, sceneId, id || undefined, publishId, recipe);
        if (token === capturedToken) message(result.exportError?`项目内发布完成，但复制到自选目录失败：${result.exportError}`:`发布完成：${publishId}`);
        return result;
      },
    });
  await publisher.render();
}
let pendingSelection: string[] = [];
const retainedSceneJoinRows = new Map<string, SceneDocument['assets']>();
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
      createScene: newScene,
      history: sceneHistory,
      edit: editAsset,
      projectAssetsMode: isV2,
      join: async (ids: string[]) => {
        if (saving) throw Error('请等待保存完成后合并');
        assembly?.cancel();
        const session = manager.sceneSession(sceneId), before = session.snapshot();
        const selectedIds = new Set(ids);
        const selectedAssets = new Set(before.instances.filter(instance => selectedIds.has(instance.instanceId)).map(instance => instance.assetId));
        const sources = new Map(before.assets.filter(row => row.kind === 'voxel' && selectedAssets.has(row.assetId)).map(row => {
          const asset = manager.assetSession(row.assetId);
          return [row.assetId, manager.sync(asset.sessionId)] as const;
        }));
        // Validate the complete result before changing any session or registry.
        const result = mergeSceneInstances(before, sources, ids, crypto.randomUUID(), crypto.randomUUID());
        manager.openAsset(result.asset, null);
        if (isV2()) {
          (project as ProjectV2).assets.push({kind:'voxel',assetId:result.asset.assetId,
            name:result.asset.name,revision:result.asset.revision,preview:null,
            source:assetSourcePath(result.asset.assetId,chosenAssetFolder('assembly'))});
          refreshV2Registries();
          result.scene.assets = session.snapshot().assets;
        } else {
          // Registration survives undo because the new asset may have been edited or reused.
          const key = `${token}/${sceneId}`, retained = retainedSceneJoinRows.get(key) ?? [];
          retained.push(result.scene.assets.find(row => row.assetId === result.asset.assetId)!);
          retainedSceneJoinRows.set(key, retained);
          session.setRegistryRows(result.scene.assets);
        }
        session.install(result.scene, crypto.randomUUID(), false);
        summaries.set(result.asset.assetId,{name:result.asset.name,count:assetCellCount(result.asset)});
        generation++; dirty(); void refreshAssetBrowser();
        message('已合并为独立物体 · Ctrl+Z 可恢复原实例');
        return result.instance.instanceId;
      },
      independent: async (instanceId: string) => {
        if (!isV2()) throw Error('旧项目请先转换副本');
        await saveAllV2();
        const activeSceneId = sceneId;
        const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140;
        drawScenePreview(canvas, sceneSource(manager.sceneSession(activeSceneId).snapshot()));
        const result = await api.v2Independent(token, activeSceneId, instanceId,
          canvas.toDataURL('image/png').split(',')[1]);
        project = result.project;
        manager.openAsset(result.asset, result.assetHash);
        const session = manager.sceneSession(activeSceneId);
        session.install(sceneView(result.scene), crypto.randomUUID(), false);
        manager.markSceneSaved(activeSceneId, result.scene.revision);
        scenes.set(activeSceneId, session.snapshot());
        refreshV2Registries(); dirty(); renderAssembly();
        message('所选实例已指向新的独立项目资产；其他实例仍引用原源');
      },
      import: async () => {
        await importAssemblyAsset();
      },
      drop: takeLibraryForAssembly,
      dropProject: async (id, position) => {
        if (!isV2()) throw Error('请打开项目资产工程');
        const row = (project as ProjectV2).assets.find((item) => item.assetId === id && item.kind === 'voxel');
        if (!row) throw Error('项目原生资产不存在');
        const asset = manager.sync(manager.assetSession(id).sessionId);
        if (!sceneId || !scenes.has(sceneId)) newScene();
        const instanceId = crypto.randomUUID();
        manager.sceneSession(sceneId).add({ instanceId, assetId: id,
          positionM: snapInstancePosition(position, asset.anchorM, 0), rotationDeg: 0, groupId: 'base' });
        selectAssembly([instanceId]); dirty(); renderAssembly();
      },
      mountProjectBrowser: (host) => projectBrowser('assembly').mount(host),
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
  if (isV2()) {
    if (['glb', 'png'].includes(row.type) && !row.nativeSource)
      throw Error('此条目不是可编辑体素源；请先准备工坊原生资产');
    await saveAllV2();
    const source = await api.librarySource(id);
    const input = new TextEncoder().encode(JSON.stringify(source));
    const sourceHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', input)),
      (value) => value.toString(16).padStart(2, '0')).join('');
    let local = (project as ProjectV2).assets.find((item) => item.kind === 'voxel' &&
      item.origin?.libraryId === id && item.origin.sourceHash === sourceHash);
    if (!local) {
      const copy = cloneAsset(source, crypto.randomUUID());
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140;
      drawAssetPreview(canvas, copy);
      const preview = assetCellCount(copy) > 20000 ? null : canvas.toDataURL('image/png').split(',')[1];
      const result = await api.v2SaveAsset(token, copy, preview, { libraryId: id, sourceHash });
      project = result.document; local = (project as ProjectV2).assets.find((item) => item.assetId === copy.assetId)!;
      manager.openAsset(copy, result.hash);
      refreshV2Registries();
    }
    const asset = manager.assetSession(local.assetId).asset;
    const instanceId = crypto.randomUUID();
    manager.sceneSession(sceneId).add({ instanceId, assetId: local.assetId,
      positionM: snapInstancePosition(position, asset.anchorM, 0), rotationDeg: 0, groupId: 'large-env' });
    selectAssembly([instanceId]); dirty(); activate('assembly');
    message('公共库资产已复制到项目；后续试摆共享此项目副本');
    return;
  }
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
  cancelCanvasAlignment();
  assembly?.cancel();
  moduleEditor.cancel();
  if (isV2() && next === 'publish') { message('项目资产请在模块编辑中单件导出 FBX'); return; }
  if (next === "module" && !assetId) {
    message("先创建或选择一个模块草稿。");
    return;
  }
  workspace = next;
  if(next==='module')renderCanvasPanel();
  $('export-asset-fbx').hidden = !isV2();
  $('save-asset-as').hidden = !isV2();
  $('asset-folder').hidden = !isV2();
  $('migrate-module').hidden = isV2();
  $('save-draft').textContent = isV2() ? '保存资产' : '保存草稿';
  const publishTab = document.querySelector<HTMLElement>('[data-workspace="publish"]');
  if (publishTab) publishTab.hidden = isV2();
  const assemblyTab = document.querySelector<HTMLElement>('[data-workspace="assembly"]');
  if (assemblyTab) assemblyTab.textContent = '场景试摆';
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
  if (next === "module") { renderModuleProjectAssets(); moduleEditor.resize(); }
  if (isV2() && (next === 'project' || next === 'module')) void refreshAssetBrowser();
  if (next === "assembly") void run(renderAssembly);
  if (next === "publish") void run(renderPublish);
}
document
  .querySelectorAll<HTMLButtonElement>("[data-workspace]")
  .forEach((b) => (b.onclick = () => activate(b.dataset.workspace!)));
async function choose(mode: "create" | "open") {
  if (saving) throw Error("保存正在进行，请完成后再切换项目");
  const decision = await prepareProjectSwitch();
  if (decision === 'cancel') return;
  moduleEditor.cancel();
  let selected;
  try {
    selected = await api.choose(
      mode,
      mode === "create" ? createProjectV2(crypto.randomUUID()) : undefined,
    );
  } finally { if (!selected && decision === 'discard') dirty(); }
  if (!selected) return;
  await loadProject(selected);
}
async function openRecent(id: string) {
  if (saving) throw Error('保存正在进行，请完成后再切换项目');
  const decision = await prepareProjectSwitch();
  if (decision === 'cancel') return;
  let selected;
  try { selected = await api.openRecent(id); }
  finally { if (!selected && decision === 'discard') dirty(); }
  if (selected) await loadProject(selected);
}
async function renderRecents(host: HTMLElement) {
  const section = element('details') as HTMLDetailsElement;
  section.className = 'recent-projects';
  section.open = !project;
  const summary = element('summary', '最近项目');
  section.append(summary);
  host.append(section);
  try {
    const rows = await api.recents();
    if (!section.isConnected) return;
    summary.textContent = `最近项目 · ${rows.length}`;
    if (!rows.length) { section.append(element('p', '还没有最近打开的项目。')); return; }
    for (const row of rows) {
      const item = element('div'); item.className = 'recent-project';
      const details = element('div');
      details.append(element('strong', name(row.name)), element('small', row.root));
      item.append(details);
      if (row.missing) {
        item.append(element('span', '目录已移动或缺失'));
        item.append(button('重新定位', () => void run(async () => {
          const before = token;
          await choose('open');
          if (token !== before) await api.forgetRecent(row.id);
          renderProject();
        })));
      }
      else item.append(button('打开', () => void run(() => openRecent(row.id))));
      item.append(button('从历史移除', () => void run(async () => { await api.forgetRecent(row.id); renderProject(); })));
      section.append(item);
    }
  } catch (error: any) { if (section.isConnected) section.append(element('p', `最近项目读取失败：${error.message}`)); }
}
async function loadProject(selected: any) {
  moduleEditor.cancel();
  moduleEditor.unbind();
  const previousToken = token;
  token = selected.token;
  project = selected.document;
  projectRoot = selected.root ?? (selected.token === previousToken ? projectRoot : '');
  await loadPaletteLibrary();
  if (selected.token !== previousToken) projectBrowsers.clear();
  savedProjectName = project!.name;
  manager = new WorkshopSession();
  scenes.clear();
  leases.clear();
  summaries.clear();
  binaryAssets.clear();
  assembly?.clearSelection();
  assetId = "";
  generation = 0;
  savedGeneration = 0;
  if (isV2()) {
    for (const row of (project as ProjectV2).assets) {
      if (row.kind === 'voxel') {
        try {
          const loaded = await api.v2LoadAsset(token, row.assetId);
          manager.openAsset(loaded.document, loaded.hash);
          summaries.set(row.assetId, { name: loaded.document.name, count: assetCellCount(loaded.document) });
        } catch (e: any) {
          summaries.set(row.assetId, { name: row.name, count: 0, error: e.message });
        }
      } else {
        try { binaryAssets.set(row.assetId, await api.v2ReadBinary(token, row.assetId)); }
        catch (e: any) { summaries.set(row.assetId, { name: row.name, count: 0, error: e.message }); }
      }
    }
    for (const row of (project as ProjectV2).scenes) {
      const loaded = await api.v2LoadScene(token, row.sceneId);
      const view = sceneView(loaded.document);
      scenes.set(row.sceneId, view);
      manager.openScene(view, loaded.hash);
    }
    sceneId = (project as ProjectV2).scenes[0]?.sceneId ?? '';
    $('project-title').textContent = name(project!.name);
    activate('project'); message('项目级资产库已打开'); return;
  }
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
            count: assetCellCount(source.document),
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
  if (isV2()) {
    const native = createSceneV2(crypto.randomUUID());
    native.name = `试摆场景 ${(project as ProjectV2).scenes.length + 1}`;
    const view = sceneView(native);
    scenes.set(view.sceneId, view); manager.openScene(view, null);
    (project as ProjectV2).scenes.push({ sceneId: view.sceneId, name: view.name,
      revision: view.revision, source: `scenes/${view.sceneId}/scene.xhscene.json`, preview: null });
    sceneId = view.sceneId; generation++; dirty(); renderProject(); return;
  }
  const s = createScene(crypto.randomUUID());
  s.name = `场景 ${project.scenes.length + 1}`;
  scenes.set(s.sceneId, s);
  manager.openScene(s, null);
  (project as ProjectDocument).scenes.push({
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
async function renameProject() {
  if (!project) return;
  const value = await askName('项目名称', project.name);
  if (value === null || value === project.name) return;
  project.name = value;
  project.revision++;
  generation++;
  $('project-title').textContent = value;
  dirty(); renderProject();
}
async function renameScene(id: string) {
  const row = project?.scenes.find((entry) => entry.sceneId === id);
  if (!row) throw Error('场景不存在');
  const value = await askName('场景名称', row.name);
  if (value === null || value === row.name) return;
  const scene = manager.sceneSession(id).snapshot();
  scene.name = value;
  manager.sceneSession(id).install(scene, crypto.randomUUID(), false);
  row.name = value;
  project!.revision++;
  generation++;
  dirty(); renderProject();
}
async function renameAsset(id: string) {
  const session = manager.assetSession(id);
  const value = await askName('资产名称', session.asset.name);
  if (value === null || value === session.asset.name) return;
  manager.rename(session.sessionId, value);
  if (assetId === id) syncFields();
  dirty(); renderProject();
}
function hasUnsavedChanges() {
  return generation !== savedGeneration || manager.dirtyDocuments().length > 0 || manager.dirtyScenes().length > 0;
}
async function deleteAsset(id: string) {
  const scene = currentScene();
  const row = scene.assets.find((item) => item.assetId === id && item.kind === 'voxel');
  if (!row) throw Error('资产不存在');
  const count = scene.instances.filter((item) => item.assetId === id).length;
  const session = manager.assetSession(id);
  const description = count
    ? `此资产被 ${count} 个试摆实例引用。确认后会一起移除这些实例；可从回收区恢复。`
    : '资产会从项目列表移除，可以从回收区恢复。';
  if (!(await confirmAction(`移入回收区：${name(session.asset.name)}`, description))) return;
  if (session.savedHash === null) {
    manager.closeAsset(id, true);
    const next = manager.sceneSession(sceneId).snapshot();
    next.assets = next.assets.filter((item) => item.assetId !== id);
    next.instances = next.instances.filter((item) => item.assetId !== id);
    if(next.collections){const live=new Set([...next.instances.map(p=>p.instanceId),...next.decals.map(d=>d.decalId)]);next.collections=next.collections.map(c=>({...c,memberIds:c.memberIds.filter(id=>live.has(id))})).filter(c=>c.memberIds.length);}
    manager.sceneSession(sceneId).install(next, crypto.randomUUID(), false);
    if (assetId === id) { moduleEditor.unbind(); assetId = ''; }
    generation++;
    dirty(); renderProject(); message('未保存草稿已移除');
    return;
  }
  if (hasUnsavedChanges()) throw Error('请先保存其他更改，再移入回收区');
  const selectedScene = sceneId;
  const selected = await api.trashAsset(token, sceneId, id, count > 0);
  await loadProject(selected);
  sceneId = selectedScene;
  renderProject(); message('资产已移入回收区');
}
async function deleteScene(id: string) {
  const row = project?.scenes.find((item) => item.sceneId === id);
  if (!row) throw Error('场景不存在');
  const scene = manager.sceneSession(id).snapshot();
  if (!(await confirmAction(`移入回收区：${name(row.name)}`, `此场景含 ${scene.assets.length} 个资产和 ${scene.instances.length} 个实例；历史发布版本会保留。`))) return;
  if (manager.sceneSession(id).savedRevision < 0) {
    for (const asset of scene.assets.filter((item) => item.kind === 'voxel'))
      manager.closeAsset(asset.assetId, true);
    manager.closeScene(id);
    scenes.delete(id);
    project!.scenes = project!.scenes.filter((item) => item.sceneId !== id);
    project!.revision++;
    generation++;
    if (sceneId === id) sceneId = project!.scenes[0]?.sceneId ?? '';
    assetId = '';
    dirty(); renderProject(); message('未保存场景已移除');
    return;
  }
  if (hasUnsavedChanges()) throw Error('请先保存其他更改，再移入回收区');
  const selected = await api.trashScene(token, id);
  await loadProject(selected);
  message('场景已移入回收区');
}
async function renderTrash(host: HTMLElement) {
  const section = element('details'); section.className = 'project-trash';
  const summary = element('summary', '回收区'); section.append(summary); host.append(section);
  try {
    const rows = await api.listTrash(token);
    if (!section.isConnected) return;
    summary.textContent = `回收区 · ${rows.length}`;
    if (!rows.length) { section.append(element('p', '回收区为空')); return; }
    for (const row of rows) {
      const item = element('div'); item.className = 'trash-entry';
      item.append(element('span', `${row.kind === 'scene' ? '场景' : '资产'} · ${name(row.name)}`));
      item.append(button('恢复', () => void run(async () => {
        if (hasUnsavedChanges()) throw Error('请先保存当前更改，再恢复');
        const selected = await api.restoreTrash(token, row.trashId);
        await loadProject(selected);
        sceneId = row.sceneId;
        renderProject(); message('已从回收区恢复');
      })));
      item.append(button('彻底删除', () => void run(async () => {
        if (hasUnsavedChanges()) throw Error('请先保存当前更改，再清理回收区');
        if (!(await confirmAction(`彻底删除：${name(row.name)}`, '此操作会删除回收区内的源文件。', '下一步'))) return;
        if (!(await confirmAction('再次确认永久删除', '删除后无法在工坊内恢复；已有发布输出不会被删除。', '确认永久删除'))) return;
        await api.purgeTrash(token, row.trashId);
        renderProject(); message('回收区条目已彻底删除');
      })));
      section.append(item);
    }
  } catch (error: any) { if (section.isConnected) section.append(element('p', `回收区读取失败：${error.message}`)); }
}
async function deleteAssetV2(id: string) {
  const projectV2 = project as ProjectV2;
  const row = projectV2.assets.find((item) => item.assetId === id);
  if (!row) throw Error('资产不存在');
  const references = [...scenes.keys()].reduce((total, key) => {
    const scene = manager.sceneSession(key).snapshot();
    return total + scene.instances.filter((item) => item.assetId === id).length +
      scene.decals.filter((item) => item.assetId === id).length;
  }, 0);
  if (!(await confirmAction(`移入回收区：${name(row.name)}`,
    references ? `被 ${references} 个试摆实例引用。确认后同时移除实例，恢复资产时会尝试恢复这些引用。`
      : '资产源会移入项目回收区，可恢复。'))) return;
  if (row.kind === 'voxel') {
    const session = manager.assetSession(id);
    if (session.savedHash === null) {
      if (references) throw Error('请先保存引用它的试摆场景，再删除');
      manager.closeAsset(id, true);
      projectV2.assets = projectV2.assets.filter((item) => item.assetId !== id);
      refreshV2Registries(); generation++; dirty(); renderProject(); return;
    }
  }
  if (hasUnsavedChanges()) throw Error('请先保存更改，再移入回收区');
  const selected = await api.v2TrashAsset(token, id, references > 0);
  await loadProject(selected); message('资产已移入回收区');
}
async function deleteSceneV2(id: string) {
  const row = (project as ProjectV2).scenes.find((item) => item.sceneId === id);
  if (!row) throw Error('场景不存在');
  if (!(await confirmAction(`移入回收区：${name(row.name)}`,
    '试摆场景会移入项目回收区；项目原生资产和旧发布记录保留。'))) return;
  if (manager.sceneSession(id).savedRevision < 0) {
    manager.closeScene(id); scenes.delete(id);
    (project as ProjectV2).scenes = (project as ProjectV2).scenes.filter((item) => item.sceneId !== id);
    if (sceneId === id) sceneId = (project as ProjectV2).scenes[0]?.sceneId ?? '';
    generation++; dirty(); renderProject(); return;
  }
  if (hasUnsavedChanges()) throw Error('请先保存更改，再移入回收区');
  const selected = await api.v2TrashScene(token, id);
  await loadProject(selected); message('试摆场景已移入回收区');
}
async function updateScenePreviewV2(id: string) {
  if (hasUnsavedChanges()) await saveAllV2();
  const source = sceneSource(manager.sceneSession(id).snapshot());
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140;
  drawScenePreview(canvas, source);
  const result = await api.v2SaveScene(token, source, canvas.toDataURL('image/png').split(',')[1]);
  project = result.document; renderProject(); message('试摆预览已更新');
}
async function renderTrashV2(host: HTMLElement) {
  const section = element('details') as HTMLDetailsElement; section.className = 'project-trash';
  const summary = element('summary', '回收区'); section.append(summary); host.append(section);
  try {
    const rows = await api.v2ListTrash(token);
    if (!section.isConnected) return;
    summary.textContent = `回收区 · ${rows.length}`;
    if (!rows.length) { section.append(element('p', '回收区为空')); return; }
    for (const row of rows) {
      const item = element('div'); item.className = 'trash-entry';
      item.append(element('span', `${row.kind === 'scene' ? '试摆场景' : '项目资产'} · ${name(row.name)}`),
        button('恢复', () => void run(async () => {
          if (hasUnsavedChanges()) throw Error('请先保存更改，再恢复');
          const selected = await api.v2RestoreTrash(token, row.trashId);
          await loadProject(selected); message('回收区内容已恢复');
        })),
        button('彻底删除', () => void run(async () => {
          if (!(await confirmAction(`彻底删除：${name(row.name)}`, '源文件将无法从工坊回收区恢复。', '下一步'))) return;
          if (!(await confirmAction('再次确认永久删除', '请确认不再需要该资产或场景。', '确认永久删除'))) return;
          await api.v2PurgeTrash(token, row.trashId); renderProject();
        })));
      section.append(item);
    }
  } catch (error: any) { if (section.isConnected) section.append(element('p', `回收区读取失败：${error.message}`)); }
}
function currentScene() {
  if (!scenes.has(sceneId)) throw Error("先创建或选择场景");
  return manager.sceneSession(sceneId).snapshot();
}
async function addAsset(asset = ensureModelObjects(createAsset(crypto.randomUUID()))) {
  if (isV2()) {
    const projectV2 = project as ProjectV2;
    if (!asset.name) asset.name = `新资产 ${String(projectV2.assets.length + 1).padStart(2, '0')}`;
    projectV2.assets.push({ kind: 'voxel', assetId: asset.assetId, name: asset.name,
      revision: asset.revision, source: assetSourcePath(asset.assetId, chosenAssetFolder(workspace)), preview: null });
    manager.openAsset(asset, null); refreshV2Registries(); generation++; dirty();
    await editAsset(asset.assetId); return;
  }
  const scene = currentScene();
  if (!asset.name) asset.name = `新模块 ${String(scene.assets.filter((row) => row.kind === 'voxel').length + 1).padStart(2, '0')}`;
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
async function editAsset(id: string, preserveView = false) {
  paintController?.requireClosed();if(!(await moduleEditor.resolveDraft("切换资产")))return;
  const savedViews=preserveView?moduleEditor.canvasViews.map(v=>v.captureView()):null;
  cancelCanvasAlignment();
  moduleEditor.cancel();
  if (isV2()) {
    const row = (project as ProjectV2).assets.find((a) => a.assetId === id && a.kind === 'voxel');
    if (!row) throw Error('项目资产不存在');
    let session;
    try { session = manager.assetSession(id); }
    catch { const loaded = await api.v2LoadAsset(token, id); session = manager.openAsset(loaded.document, loaded.hash); }
    session = manager.ensureObjects(id);
    assetId = id;
    modelObjectTools?.prepare();
    moduleEditor.bind(session.editor, name(session.asset.name), {
      canvases:session.canvases,sessionId: session.sessionId, root: () => session.canvases ? session.asset.anchorM.map((n,i)=>(n-session.canvases!.active.originTicks[i]*CANVAS_TICK)*.25/session.canvases!.active.voxelStepM) as [number,number,number] : session.asset.anchorM,
      changed() { manager.sync(session.sessionId); modelObjectTools?.update(); dirty(); },
      undo() { const active=session.canvases?.activeId;manager.undo(session.sessionId); if(active!==session.canvases?.activeId)moduleEditor.clearSelection(); syncFields(); renderCanvasPanel(); },
      redo() { const active=session.canvases?.activeId;manager.redo(session.sessionId); if(active!==session.canvases?.activeId)moduleEditor.clearSelection(); syncFields(); renderCanvasPanel(); },
      save: saveAll,
    });
    syncFields(); renderCanvasPanel(); activate('module');
    if(savedViews)moduleEditor.canvasViews.forEach((v,i)=>v.restoreView(savedViews[i]));
    message('编辑项目原生资产'); return;
  }
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
  session = manager.ensureObjects(id);
  assetId = id;
  modelObjectTools?.prepare();
  moduleEditor.bind(session.editor, name(session.asset.name), {
    canvases: session.canvases, sessionId: session.sessionId,
    root: () => session.asset.anchorM.map((n,i)=>(n-session.canvases!.active.originTicks[i]*CANVAS_TICK)*.25/session.canvases!.active.voxelStepM) as [number,number,number],
    changed() {
      manager.sync(session.sessionId);
      modelObjectTools?.update();
      dirty();
    },
    undo() {
      const active=session.canvases?.activeId;manager.undo(session.sessionId);
      if(active!==session.canvases?.activeId)moduleEditor.clearSelection();syncFields();renderCanvasPanel();
    },
    redo() {
      const active=session.canvases?.activeId;manager.redo(session.sessionId);
      if(active!==session.canvases?.activeId)moduleEditor.clearSelection();syncFields();renderCanvasPanel();
    },
    save: saveAll,
  });
  syncFields();
  activate("module");
  if(savedViews)moduleEditor.canvasViews.forEach((v,i)=>v.restoreView(savedViews[i]));
  message("编辑场景私有模块");
}
function syncFields() {
  if (!assetId) return;
  const s = manager.assetSession(assetId);
  ($("module-name") as HTMLInputElement).value = s.asset.name;
  ($("module-root") as HTMLInputElement).value = s.asset.anchorM.join(",");
  $("module-root-menu").querySelector("summary")!.title="资产根点（米）："+s.asset.anchorM.join(", ");
  if (isV2()) {
    const row = (project as ProjectV2).assets.find((item) => item.assetId === assetId);
    if (row?.kind === 'voxel') $('asset-folder').textContent = `保存文件夹：${assetFolder(row.source) || '默认'}`;
  }
  const tabs = $("module-tabs") as HTMLSelectElement;
  tabs.replaceChildren();
  for (const row of (isV2() ? (project as ProjectV2).assets : currentScene().assets).filter((a) => a.kind === "voxel")) {
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
function assetFolder(source: string): string {
  const parts = source.split('/');
  return parts.slice(1, -2).join('/');
}
function refreshAssetBrowser() {
  if (!isV2()) return;
  for (const browser of projectBrowsers.values()) browser.refresh();
}
let legacyExternalShown = false;
let assetContextMenu: HTMLElement | null = null;
function showAssetContextMenu(event: MouseEvent, id: string) {
  event.preventDefault();
  assetContextMenu?.remove();
  const menu = element('div');
  menu.className = 'project-asset-context-menu';
  menu.setAttribute('role', 'menu');
  const item = (label: string, action: () => Promise<void> | void) => {
    const control = element('button', label) as HTMLButtonElement;
    control.type = 'button'; control.setAttribute('role', 'menuitem');
    control.onclick = () => { close(); void run(action); };
    menu.append(control);
  };
  item('编辑原生资产', () => editAsset(id));
  item('另存为新资产', async () => { await editAsset(id); await saveCurrentAsNewAsset(); });
  item('导出 FBX', async () => { await editAsset(id); await exportCurrentAssetFbx(); });
  item('改名', () => renameAsset(id));
  const locate = element('button', '在文件管理器中定位') as HTMLButtonElement;
  locate.type = 'button';
  locate.setAttribute('role', 'menuitem');
  locate.disabled = manager.assetSession(id).savedHash === null;
  locate.title = locate.disabled ? '请先保存资产' : '在文件管理器中选中工坊原生文件';
  locate.onclick = () => {
    close();
    void run(async () => {
      const file = await api.v2LocateAsset(token, id);
      message(`已定位原生资产：${file}`);
    });
  };
  menu.append(locate);
  item('移入回收区', () => deleteAssetV2(id));
  document.body.append(menu);
  menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
  assetContextMenu = menu;
  function close() {
    menu.remove();
    if (assetContextMenu === menu) assetContextMenu = null;
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', escape, true);
  }
  function outside(e: PointerEvent) { if (!menu.contains(e.target as Node)) close(); }
  function escape(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', escape, true);
  locate.focus();
}
function renderModuleProjectAssets() {
  const libraryHost = document.querySelector<HTMLElement>('#app .library');
  if (!libraryHost) return;
  const native = isV2();
  const showExternal = !native && legacyExternalShown;
  for (const selector of ['.library-bar', '#assets']) {
    const old = libraryHost.querySelector<HTMLElement>(selector);
    if (old) old.hidden = !showExternal;
  }
  let panel = libraryHost.querySelector<HTMLElement>('#module-project-assets');
  if (!panel) {
    panel = element('section'); panel.id = 'module-project-assets';
    libraryHost.prepend(panel);
  }
  panel.hidden = false;
  panel.replaceChildren();
  if (!native) {
    panel.append(element('strong', '旧项目 · 当前是场景私有草稿'),
      element('p', '“保存草稿”会写入旧场景目录。若要使用项目根目录的原生资产库，请保存并转换为项目资产；工坊会创建新项目副本，原项目保持不变。'),
      button(legacyExternalShown ? '收起旧式外部素材库' : '显示旧式外部素材库（GLB/PNG）', () => {
        legacyExternalShown = !legacyExternalShown; renderModuleProjectAssets();
      }));
    return;
  }
  const header = element('div'); header.className = 'module-project-header';
  header.append(element('strong', '项目资产库'), element('span', projectRoot));
  panel.append(header);
  const current = (project as ProjectV2).assets.find((item) => item.assetId === assetId);
  if (current?.kind === 'voxel') {
    const separator = projectRoot.includes('\\') ? '\\' : '/';
    const location = element('p', `当前模型保存位置：${projectRoot}${separator}${current.source.replaceAll('/', separator)}`);
    location.className = 'module-asset-location'; panel.append(location);
  }
  const browserHost = element('div');
  panel.append(browserHost);
  projectBrowser('module').mount(browserHost);
}
$('migrate-module').onclick = () => void run(() => migrateLegacyProject(true));
$('asset-folder').onclick = () => void run(async () => {
  if (!isV2() || !assetId) return;
  const row = (project as ProjectV2).assets.find((item) => item.assetId === assetId);
  if (!row || row.kind !== 'voxel') throw Error('原生资产未登记');
  if (manager.assetSession(assetId).savedHash !== null)
    throw Error('已保存资产的文件夹保持稳定；请使用“另存为新资产”选择另一文件夹');
  const choice = await askName('项目内分类文件夹（可用 / 分层）', chosenAssetFolder('module') || assetFolder(row.source) || '默认');
  if (choice === null) return;
  row.source = assetSourcePath(assetId, choice === '默认' ? '' : choice);
  generation++; dirty(); syncFields(); message(`资产将保存到 ${row.source}`);
});
async function saveAllV2() {
  cancelCanvasAlignment();
  if (!project || !isV2()) throw Error('先打开项目级资产工程');
  if (saving) throw Error('保存正在进行');
  moduleEditor.cancel(); assembly?.cancel(); saving = true;
  const local = project as ProjectV2;
  const requestedName = local.name;
  const submittedGeneration = generation;
  const assetQueue = local.assets.filter((row) => row.kind === 'voxel').map((row) => {
    const session = manager.assetSession(row.assetId);
    return { session, document: structuredClone(manager.sync(session.sessionId)) };
  }).filter(({ session, document }) => session.savedHash === null || session.savedRevision !== document.revision);
  const sceneQueue = local.scenes.map((row) => {
    const session = manager.sceneSession(row.sceneId);
    return { session, document: sceneSource(session.snapshot()) };
  }).filter(({ session, document }) => session.savedRevision < 0 || session.savedRevision !== document.revision);
  try {
    let latest: ProjectV2 = local;
    for (const item of assetQueue) {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140;
      drawAssetPreview(canvas, item.document);
      const preview = assetCellCount(item.document) > 20000 ? null : canvas.toDataURL('image/png').split(',')[1];
      const row = local.assets.find((entry) => entry.assetId === item.document.assetId);
      const folder = row?.kind === 'voxel' ? assetFolder(row.source) : '';
      const result = await api.v2SaveAsset(token, item.document, preview, null, folder);
      manager.markSaved(item.session.sessionId, item.document.revision, result.hash);
      latest = result.document;
      summaries.set(item.document.assetId, { name: item.document.name, count: assetCellCount(item.document) });
    }
    for (const item of sceneQueue) {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140;
      drawScenePreview(canvas, item.document);
      const preview = canvas.toDataURL('image/png').split(',')[1];
      const result = await api.v2SaveScene(token, item.document, preview);
      manager.markSceneSaved(item.document.sceneId, item.document.revision);
      latest = result.document;
    }
    if (requestedName !== savedProjectName) latest = (await api.v2RenameProject(token, requestedName)).document;
    project = latest; savedGeneration = submittedGeneration;
    savedProjectName = latest.name;
    refreshV2Registries(); dirty();
    if (workspace === 'project') renderProject();
    if (workspace === 'module') renderModuleProjectAssets();
    void refreshAssetBrowser();
    message('原生资产与试摆草稿已保存');
  } finally { saving = false; }
}
async function saveAll(fromPaint=false) {
  if(paintController?.active&&!fromPaint){await (api as any).paintRequestSave();return;}
  if(!(await moduleEditor.resolveDraft("保存项目")))return;
  if (!project) throw Error("先创建或打开项目");
  if (isV2()) return saveAllV2();
  if (saving) throw Error("保存正在进行");
  moduleEditor.cancel();
  assembly?.cancel();
  saving = true;
  message("正在保存草稿…");
  try {
    const submittedGeneration = generation,
      capture = captureWorkshopSave(project as ProjectDocument, scenes.values(), manager),
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
        count: assetCellCount(asset),
      });
    }
    dirty();
    message("草稿已保存");
    if (workspace === "project") renderProject();
  } finally {
    saving = false;
  }
}
function renderProjectV2() {
  const host = $('project-workspace');
  const projectV2 = project as ProjectV2;
  host.replaceChildren(element('h1', '项目与资产'));
  const projectLocation = element('div');
  projectLocation.append(element('strong', `当前项目：${name(projectV2.name)}`),
    element('code', projectRoot));
  projectLocation.className = 'project-location'; host.append(projectLocation);
  const intro = element('p', '在项目中保存可编辑的原生资产；试摆场景引用这些资产，不会生成整张场景的发布包。');
  intro.className = 'hint'; host.append(intro);
  const actions = element('div'); actions.className = 'actions';
  actions.append(
    button('新建项目', () => void run(() => choose('create'))),
    button('打开项目', () => void run(() => choose('open'))),
    button('新建资产', () => void run(() => addAsset())),
    button('导入便携源', () => void run(importPortableAsset)),
    button('新建试摆场景', newScene),
    button('保存项目', () => void run(saveAll)),
    button('另存项目副本', () => void run(async () => {
      await saveAllV2();
      const title = await askName('副本目录及项目名称', `${name(projectV2.name)} 副本`);
      if (!title) return;
      const selected = await api.v2CopyProject(token, title);
      if (!selected) return;
      await loadProject(selected); message('项目副本已创建；当前打开的是新副本');
    })),
    button('重命名项目', () => void run(renameProject)),
  );
  host.append(actions); void renderRecents(host);
  const columns = element('div'); columns.className = 'project-columns';
  const sidebar = element('aside'); sidebar.className = 'scene-list';
  sidebar.append(element('h2', '试摆场景'));
  for (const row of projectV2.scenes) {
    const entry = element('div'); entry.className = 'scene-entry';
    const preview = element('div'); preview.className = 'scene-card-preview';
    try {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140;
      drawScenePreview(canvas, sceneSource(manager.sceneSession(row.sceneId).snapshot()));
      const image = document.createElement('img'); image.src = canvas.toDataURL('image/png');
      image.alt = `试摆预览：${name(row.name)}`; preview.append(image);
    } catch { preview.textContent = '预览不可用'; }
    entry.append(preview);
    if (row.preview) {
      const currentToken = token;
      void api.v2ReadPreview(currentToken, 'scene', row.sceneId).then((base64: string | null) => {
        if (!base64 || !preview.isConnected || currentToken !== token) return;
        const image = document.createElement('img'); image.alt = `试摆预览：${name(row.name)}`;
        image.src = `data:image/png;base64,${base64}`; preview.replaceChildren(image);
      }).catch(() => { preview.textContent = '预览不可用'; });
    }
    const select = button(name(row.name), () => { sceneId = row.sceneId; renderProject(); });
    select.classList.toggle('active', sceneId === row.sceneId);
    select.setAttribute('aria-pressed', String(sceneId === row.sceneId));
    entry.append(select, button('试摆', () => { sceneId = row.sceneId; activate('assembly'); }),
      button('改名', () => void run(() => renameScene(row.sceneId))),
      button('更新预览', () => void run(() => updateScenePreviewV2(row.sceneId))),
      button('另存场景', () => void run(async () => {
        await saveAllV2();
        const title = await askName('新试摆场景名称', `${name(row.name)} 副本`);
        if (!title) return;
        const selected = await api.v2CopyScene(token, row.sceneId, title);
        await loadProject(selected); sceneId = selected.sceneId; renderProject();
      })),
      button('移入回收区', () => void run(() => deleteSceneV2(row.sceneId))));
    sidebar.append(entry);
  }
  if (!projectV2.scenes.length) sidebar.append(element('p', '尚无试摆场景。资产可以先独立制作和保存。'));
  columns.append(sidebar);
  const main = element('main');
  main.append(element('h2', `项目资产 · ${projectV2.assets.length}`));
  const browserHost = element('div');
  main.append(browserHost); columns.append(main); host.append(columns);
  projectBrowser('project').mount(browserHost);
  void renderTrashV2(host);
}
async function migrateLegacyProject(openCurrentAsset = false) {
  if (!project || isV2()) throw Error('请先打开旧项目');
  const oldSceneId = sceneId, oldAssetId = assetId;
  if (hasUnsavedChanges()) await saveAll();
  const folder = await askName('新项目文件夹名', `${name(project.name)}-资产版`);
  if (!folder) return;
  const selected = await api.v2Migrate(token, folder);
  if (!selected) return;
  const mapped = selected.migration.mappings.find((row: any) =>
    row.sceneId === oldSceneId && row.oldAssetId === oldAssetId && row.kind === 'voxel');
  await loadProject(selected);
  if (openCurrentAsset && mapped) await editAsset(mapped.newAssetId);
  message(`旧项目保持原样；转换了 ${selected.migration.mappings.length} 个资产`);
}
function renderProject() {
  if (isV2()) { renderProjectV2(); return; }
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
      button('重命名项目', () => void run(renameProject)),
      button("选择公共库", () => void run(chooseLibrary)),
      button("重载公共库", () => void run(reloadLibrary)),
    );
  if (project) actions.append(button('备份并转换为项目资产', () => void run(() => migrateLegacyProject())));
  host.append(actions);
  void renderRecents(host);
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
    const item = element('div'); item.className = 'scene-entry';
    const b = button(name(row.name), () => {
      sceneId = row.sceneId;
      assetId = "";
      renderProject();
    });
    b.classList.toggle("active", sceneId === row.sceneId);
    b.setAttribute("aria-pressed", String(sceneId === row.sceneId));
    item.append(b, button('改名', () => void run(() => renameScene(row.sceneId))), button('移入回收区', () => void run(() => deleteScene(row.sceneId))));
    sidebar.append(item);
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
    const browse = element('div'); browse.className = 'asset-browse actions';
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = '搜索当前场景资产';
    search.setAttribute('aria-label', '搜索当前场景资产'); search.value = assetSearch;
    const sort = document.createElement('select'); sort.setAttribute('aria-label', '资产排序');
    for (const [value, label] of [['name', '按名称'], ['cells', '按体素数量']] as const) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; sort.append(option);
    }
    sort.value = assetSort;
    sort.onchange = () => { assetSort = sort.value as 'name' | 'cells'; renderProject(); };
    const view = button(assetView === 'cards' ? '列表视图' : '卡片视图', () => {
      assetView = assetView === 'cards' ? 'list' : 'cards'; renderProject();
    });
    view.setAttribute('aria-pressed', String(assetView === 'list'));
    browse.append(search, sort, view); main.append(browse);
    const grid = element("div");
    grid.className = "asset-grid";
    grid.classList.toggle('list-view', assetView === 'list');
    search.oninput = () => {
      assetSearch = search.value;
      for (const card of grid.querySelectorAll<HTMLElement>('.module-card'))
        card.hidden = !card.dataset.searchText?.includes(assetSearch.trim().toLocaleLowerCase());
    };
    const rows = currentScene().assets.filter((a) => a.kind === 'voxel').sort((a, b) => {
      const detail = (id: string) => {
        try { const asset = manager.assetSession(id).asset; return { name: asset.name, count: assetCellCount(asset) }; }
        catch { return summaries.get(id) ?? { name: '', count: 0 }; }
      };
      const left = detail(a.assetId), right = detail(b.assetId);
      return assetSort === 'cells' ? right.count - left.count : name(left.name).localeCompare(name(right.name), 'zh-CN');
    });
    for (const row of rows) {
      let s: any;
      try {
        s = manager.assetSession(row.assetId);
      } catch {}
      const card = element("article");
      card.className = "module-card";
      card.classList.toggle("selected", row.assetId === assetId);
      const summary = s
        ? { name: s.asset.name, count: assetCellCount(s.asset), error: undefined }
        : summaries.get(row.assetId);
      card.dataset.searchText = name(summary?.name ?? '').toLocaleLowerCase();
      card.hidden = !card.dataset.searchText.includes(assetSearch.trim().toLocaleLowerCase());
      card.append(
        (() => {
          const preview = element('div'); preview.className = 'module-card-preview';
          if (s) {
            const canvas = document.createElement('canvas');
            canvas.width = 240; canvas.height = 140;
            drawAssetPreview(canvas, manager.sync(s.sessionId));
            const image = document.createElement('img');
            image.src = canvas.toDataURL('image/png');
            image.alt = `资产预览：${name(s.asset.name)}`;
            preview.append(image);
          } else preview.append(element('span', '预览不可用'));
          return preview;
        })(),
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
      const cardActions = element('div'); cardActions.className = 'module-card-actions';
      cardActions.append(
        edit,
        button('改名', () => void run(() => renameAsset(row.assetId))),
        button('移入回收区', () => void run(() => deleteAsset(row.assetId))),
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
      card.append(cardActions);
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
  void renderTrash(host);
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
    dirty();
    syncFields();
    moduleEditor.refresh();
  });
function rootSettings(){
 const session=manager.assetSession(assetId),asset=manager.sync(session.sessionId),bounds=assetRootBounds(asset);
 if(!bounds)throw Error('请先绘制体素，再定位根点');
 const active=session.canvases?.active;
 return {session,bounds,face:($('module-root-face') as HTMLSelectElement).value as RootFace,snap:($('module-root-snap') as HTMLSelectElement).value as RootSnap,step:active?.voxelStepM??asset.voxelSize,origin:active?.originTicks.map(n=>n*CANVAS_TICK)??[0,0,0]};
}
function applyRootPoint(point:[number,number,number]){
 moduleEditor.cancel();manager.reanchor(manager.assetSession(assetId).sessionId,point);syncFields();moduleEditor.refresh();
 ($('module-root-menu') as HTMLDetailsElement).open=false;message('资产根点已设置');
}
$('module-root-apply').onclick=()=>void run(()=>{
 const input=($('module-root') as HTMLInputElement).value.trim(),parts=input.split(/[,，\s]+/).map(Number);
 if(parts.length!==3||parts.some(n=>!Number.isFinite(n)))throw Error('请输入三个有效坐标：X, Y, Z');
 applyRootPoint(parts as [number,number,number]);
});
$('module-root-bottom').onclick=()=>void run(()=>{const r=rootSettings();applyRootPoint(rootFacePoint(r.bounds,'bottom'));});
$('module-root-center').onclick=()=>void run(()=>{const r=rootSettings();applyRootPoint(r.bounds.min.map((n,i)=>(n+r.bounds.max[i])/2) as [number,number,number]);});
for(const v of [1,.5,0])for(const u of [0,.5,1]){
 const b=document.createElement('button');b.dataset.rootU=String(u);b.dataset.rootV=String(v);b.textContent=u===.5&&v===.5?'中心':'•';b.title='面上位置 '+u+' / '+v;b.setAttribute('aria-label',b.title);
 b.onclick=()=>void run(()=>{const r=rootSettings();applyRootPoint(rootFacePoint(r.bounds,r.face,u,v));});$('module-root-anchors').append(b);
}
$('module-root-cancel').onclick=()=>moduleEditor.cancel();
for(const id of ['module-root-face','module-root-snap'])$(id).onchange=()=>moduleEditor.cancel();
$("save-draft").onclick = () => void run(saveAll);
function askExportSource(hasSaved: boolean): Promise<'save' | 'saved' | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog'); dialog.className = 'name-dialog';
    dialog.append(element('h2', '当前资产尚有未保存修改'),
      element('p', '选择本次 FBX 的来源。已导出的文件不会随原生资产变化。'));
    const actions = element('div'); actions.className = 'actions';
    let result: 'save' | 'saved' | null = null;
    actions.append(button('取消', () => dialog.close()),
      ...(hasSaved ? [button('仅导出已保存版', () => { result = 'saved'; dialog.close(); })] : []),
      button('先保存并导出', () => { result = 'save'; dialog.close(); }));
    dialog.append(actions); document.body.append(dialog);
    dialog.onclose = () => { dialog.remove(); resolve(result); };
    dialog.showModal();
  });
}
function askExportCollision(target: string): Promise<'rename' | 'backup' | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog'); dialog.className = 'name-dialog';
    dialog.append(element('h2', '同名 FBX 输出已存在'), element('p', target),
      element('p', '可换名称，或保留旧版备份后用本次结果覆盖。'));
    const actions = element('div'); actions.className = 'actions';
    let choice: 'rename' | 'backup' | null = null;
    actions.append(button('取消', () => dialog.close()),
      button('另存新名', () => { choice = 'rename'; dialog.close(); }),
      button('备份并覆盖', () => { choice = 'backup'; dialog.close(); }));
    dialog.append(actions); document.body.append(dialog);
    dialog.onclose = () => { dialog.remove(); resolve(choice); };
    dialog.showModal();
  });
}
async function exportCurrentAssetFbx() {
  if (!isV2() || !assetId) throw Error('先打开项目原生资产');
  const session = manager.assetSession(assetId);
  if (session.savedHash === null || manager.dirtyDocuments().includes(assetId)) {
    const choice = await askExportSource(session.savedHash !== null);
    if (!choice) return;
    if (choice === 'save') await saveAllV2();
  }
  const saved = manager.assetSession(assetId).asset;
  let fileName = await askName('FBX 文件名', name(saved.name));
  if (!fileName) return;
  let resolution: 'backup-replace' | 'new-name' | null = null;
  let result;
  for (;;) {
    result = await api.v2ExportFbx(token, assetId, fileName, resolution);
    if (!result || !result.collision) break;
    const choice = await askExportCollision(result.directory);
    if (!choice) return;
    if (choice === 'backup') resolution = 'backup-replace';
    else {
      const renamed = await askName('FBX 文件名', fileName);
      if (!renamed) return;
      fileName = renamed; resolution = 'new-name';
    }
  }
  if (!result) return;
  const host = $('module-export-result'); host.hidden = false;
  host.replaceChildren(element('strong', 'FBX 已导出 · Blender ' + result.blenderVersion),
    element('code', result.file),
    element('span', `源修订 r${result.revision} · ${result.outputs.length} 个文件`),
    ...(result.backupDirectory ? [element('span', `旧版备份：${result.backupDirectory}`)] : []),
    button('打开输出文件夹', () => void run(() => api.v2OpenExport())));
  message(`单资产 FBX 已输出：${result.file}`);
}
$('export-asset-fbx').onclick = () => void run(exportCurrentAssetFbx);
async function saveCurrentAsNewAsset() {
  if (!isV2() || !assetId) throw Error('先打开项目原生资产');
  if (generation !== savedGeneration || manager.dirtyScenes().length ||
      manager.dirtyDocuments().some((id) => id !== assetId))
    throw Error('请先保存其他项目或场景更改，再另存当前资产');
  const source = manager.assetSession(assetId);
  const copy = cloneAsset(manager.sync(source.sessionId), crypto.randomUUID());
  const newName = await askName('新资产名称', `${name(copy.name)} 副本`);
  if (!newName) return;
  copy.name = newName;
  const currentRow = (project as ProjectV2).assets.find((row) => row.assetId === assetId);
  const folderName = await askName('项目内分类文件夹（可用 / 分层）',
    chosenAssetFolder('module') || (currentRow?.kind === 'voxel' ? assetFolder(currentRow.source) || '默认' : '默认'));
  if (folderName === null) return;
  const folder = folderName === '默认' ? '' : folderName;
  assetSourcePath(copy.assetId, folder);
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 140;
  drawAssetPreview(canvas, copy);
  const preview = assetCellCount(copy) > 20000 ? null : canvas.toDataURL('image/png').split(',')[1];
  const result = await api.v2SaveAsset(token, copy, preview, null, folder);
  project = result.document;
  const opened = manager.openAsset(copy, null);
  manager.markSaved(opened.sessionId, copy.revision, result.hash);
  summaries.set(copy.assetId, { name: copy.name, count: assetCellCount(copy) });
  refreshV2Registries(); dirty();
  await editAsset(copy.assetId);
  void refreshAssetBrowser();
  message('已另存为新的项目资产；原资产未被覆盖');
}
$('save-asset-as').onclick = () => void run(saveCurrentAsNewAsset);
$('module-root-pick').onclick=()=>void run(()=>{
 const r=rootSettings();moduleEditor.pickRoot(point=>void run(()=>applyRootPoint(point)),{bounds:r.bounds,face:r.face,snap:r.snap});
 ($('module-root-menu') as HTMLDetailsElement).open=false;
});
$("close-module").onclick = () =>
  void run(() => {
    paintController?.requireClosed();moduleEditor.cancel();
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
document.querySelector<HTMLElement>('[data-mode="height"]')!.style.display='none';
$('height').closest('label')!.style.display='none';
const selectionPanel = element("details") as HTMLDetailsElement;
selectionPanel.id='model-voxel-selection';
selectionPanel.append(element("summary", "体素选区"));
$("tools").after(selectionPanel);
for (const id of ["native-minz", "native-maxz"])
  selectionPanel.append($(id).closest("label")!);
for (const id of ["native-select", "native-all", "native-selection"])
  selectionPanel.append($(id));
$("native-select").textContent = "框选体素";
$("native-all").textContent = "全选体素";
moduleEditor.selectionPanel(selectionPanel);
for(const id of ['selection-copy','selection-paste','selection-move','placement-confirm','placement-cancel'])$(id).style.display='none';
const shortcuts=document.createElement('details');shortcuts.id='selection-shortcut-settings';
const shortcutTitle=document.createElement('summary');shortcutTitle.textContent='设置 · 体素快捷键';shortcuts.append(shortcutTitle);
const shortcutFields=document.createElement('div');shortcuts.append(shortcutFields);
function renderShortcutFields(){shortcutFields.replaceChildren();for(const [command,label] of [['copy','复制选区'],['paste','粘贴选区'],['move','移动选区']] as const){const row=document.createElement('label');row.className='field';row.textContent=label;const input=document.createElement('input');input.value=getShortcuts()[command];input.readOnly=true;input.setAttribute('aria-label',label+'快捷键');input.title='点击后按下新的快捷键';input.onkeydown=event=>{event.preventDefault();event.stopPropagation();if(['Control','Shift','Alt','Meta'].includes(event.key))return;try{setShortcut(command,shortcutKey(event));input.value=getShortcuts()[command];message('快捷键已保存');}catch(e:any){message(e.message,true);}};row.append(input);shortcutFields.append(row);}}
renderShortcutFields();shortcuts.append(button('恢复默认快捷键',()=>{resetShortcuts();renderShortcutFields();}),element('p','视口：左键 / Enter 确认，Esc 退出当前操作；XYZ 按钮直接按格移动。画布列表的 Ctrl+C/V 用于复制画布。'));selectionPanel.append(shortcuts);

// Keep drawing tools beside the viewport; the sidebar contains their parameters.
const brushToolbar=document.createElement('div');brushToolbar.className='viewport-brush-toolbar';brushToolbar.setAttribute('aria-label','视口工具栏');
const brushMenu=document.createElement('details');brushMenu.id='viewport-brush-menu';
const brushToggle=document.createElement('summary');brushToggle.textContent='▸';brushToggle.title='画笔工具';brushToggle.setAttribute('aria-label','画笔工具');brushMenu.append(brushToggle);
const drawingTools=$('tools');drawingTools.append($('tool-eyedropper'));$('tool-eyedropper').textContent='吸管';
for(const id of ['pick-color','recolor-selected','replace-color'])$(id).style.display='none';$('replace-slot').closest('label')!.style.display='none';$('color-panel').querySelector('small')!.textContent='点击色轮设置画笔色；吸管位于画笔菜单。';drawingTools.previousElementSibling?.classList.contains('section-label')&&drawingTools.previousElementSibling.remove();brushMenu.append(drawingTools);
const modeMenu=document.createElement('details');modeMenu.id='viewport-mode-menu';
const modeToggle=document.createElement('summary');modeToggle.textContent='▸';modeToggle.title='建模方式';modeToggle.setAttribute('aria-label','建模方式');modeMenu.append(modeToggle);
const modes=$('modes');modes.previousElementSibling?.classList.contains('section-label')&&modes.previousElementSibling.remove();modeMenu.append(modes);
modes.addEventListener('click',event=>{if((event.target as Element).closest('[data-mode]')){modeMenu.open=false;modeToggle.title='建模方式 · '+(event.target as HTMLElement).textContent;}});
$('selection-brush').remove();
const currentBrush=button('🖌',()=>moduleEditor.toggleDrawing());currentBrush.id='brush-current';currentBrush.innerHTML=toolIcon('brush');currentBrush.title='笔刷 · 启用';currentBrush.setAttribute('aria-label','笔刷 · 启用');
const modeRow=document.createElement('div');modeRow.className='viewport-tool-row';
const currentMode=button('▦',()=>{modeMenu.open=!modeMenu.open;brushMenu.open=false;});currentMode.id='mode-current';currentMode.innerHTML=toolIcon('volume');currentMode.title='三维';currentMode.setAttribute('aria-label','当前建模方式：三维');
modeRow.append(currentMode,modeMenu);
const brushRow=document.createElement('div');brushRow.className='viewport-tool-row';brushRow.append(currentBrush,brushMenu);
const precision=document.createElement('details');precision.id='viewport-precision';const precisionToggle=document.createElement('summary');precisionToggle.textContent='↔';precisionToggle.title='XYZ 精确移动';precision.append(precisionToggle);const nudge=document.querySelector('.selection-nudge')!;precision.append(nudge);
const boxTool=$('native-select');boxTool.textContent='▧';boxTool.title='框选体素';boxTool.setAttribute('aria-label','框选体素');
for(const id of ['native-all','native-selection','selection-clear','placement-status','selection-fill','selection-erase','selection-replace'])$(id).style.display='none';
for(const group of selectionPanel.querySelectorAll<HTMLElement>('.selection-actions'))if(!group.querySelector('#step-scale-start')){if(group.querySelector('#selection-copy')||group.querySelector('#selection-fill'))group.style.display='none';}
selectionPanel.querySelector<HTMLElement>('.selection-tools')!.style.display='none';
brushToolbar.append(modeRow,brushRow,boxTool,precision);$('editview').append(brushToolbar);
modeMenu.addEventListener('toggle',()=>{if(modeMenu.open)brushMenu.open=false;});brushMenu.addEventListener('toggle',()=>{if(brushMenu.open)modeMenu.open=false;});

currentBrush.addEventListener('click',()=>{brushMenu.open=false;});
drawingTools.addEventListener('click',event=>{if((event.target as Element).closest('[data-tool]'))brushMenu.open=false;});
brushToolbar.addEventListener('pointerdown',event=>event.stopPropagation());
brushToolbar.addEventListener('wheel',event=>event.stopPropagation());
brushToolbar.addEventListener('keydown',event=>{if(event.key==='Escape'){brushMenu.open=false;modeMenu.open=false;}});
const alignTool=button('点对点对齐',()=>void run(startPointAlignment));alignTool.id='canvas-align';$('editview').parentElement!.querySelector('.view-actions')!.append(alignTool);
const keyDialog=document.createElement('dialog');keyDialog.className='shortcut-dialog';
keyDialog.append(element('h3','快捷键与功能'),shortcuts);
shortcuts.open=true;
const map=document.createElement('table');map.innerHTML='<thead><tr><th>操作</th><th>按键 / 入口</th></tr></thead><tbody>'+[
['物体 / 编辑模式','Tab 或视窗左上角切换'],['合并物体','物体模式 Ctrl+J'],['复制物体 / 直接复制','Ctrl+C、Ctrl+V / Ctrl+D'],['分离所选体素','编辑模式 → 物体菜单'],['默认点选/刷选','未启用画笔时左键'],['框选','框选体素按钮后拖动'],['加选 / 减选','Shift / Ctrl'],['选取穿透','视口选取穿透开关'],['全部选择','Ctrl+A'],['撤销 / 重做','Ctrl+Z / Ctrl+Shift+Z、Ctrl+Y'],['保存','Ctrl+S'],['步进缩放','S，X / Y / Z 限定方向'],['吸管','I'],['相机旋转 / 平移 / 缩放','右键拖动 / 中键拖动 / 滚轮'],['点对点对齐','视口按钮 → 源点 → 目标点立即完成'],['确认 / 退出操作','左键、Enter / Esc'],['画布复制粘贴','画布列表 Ctrl+C / Ctrl+V'],['画布排序','拖动画布名称'],['精确移动','视口 ↔ 菜单中的 XYZ 加减按钮'],['清除选中体素','Delete'],['选区填充 / 替换颜色','Ctrl+Shift+F / Ctrl+Shift+R']
].map(([a,b])=>'<tr><td>'+a+'</td><td>'+b+'</td></tr>').join('')+'</tbody>';keyDialog.append(map,button('关闭',()=>keyDialog.close()));document.body.append(keyDialog);
(api as any).onMenuAction((action:string)=>{if(action==='shortcuts')keyDialog.showModal();if(action==='color'){paintController?.requireClosed();void run(()=>moduleEditor.openColorAdjustment());}if(action==='undo'||action==='redo'){if(paintController?.active){message('绘画期间请在独立窗口撤销或重做');return;}moduleEditor.history(action);}if(action==='save')void run(saveAll);});
const keyButton=button('快捷键与功能',()=>keyDialog.showModal());keyButton.id='shortcut-map-open';$('duplicate').parentElement!.append(keyButton);
// Display preferences now own voxel lines; no startup override.
$('voxel-clarity').textContent='体素清晰 · 开启';$('voxel-clarity').setAttribute('aria-pressed','true');$('voxel-clarity').classList.add('active');
selectionPanel.open = true;
for (const label of $("app").querySelectorAll<HTMLElement>(".section-label"))
  if (label.textContent!.startsWith("已放置内容")) label.hidden = true;
$("app").querySelectorAll<HTMLElement>(".view-label")[1].textContent =
  "模块预览";
activate("project");
window.addEventListener('focus', () => {
  if (isV2() && (workspace === 'project' || workspace === 'module')) void refreshAssetBrowser();
});
let alignment:{source:[number,number,number]|null;target:[number,number,number]|null;selection:boolean}|null=null;
function startPointAlignment(){moduleEditor.cancel();const session=manager.assetSession(assetId);session.canvases?.editable();const selected=moduleEditor.selection().size>0;if(!selected&&!session.canvases)throw Error('请先选择需要对齐的体素');cancelCanvasAlignment();alignment={source:null,target:null,selection:selected};message((selected?'移动选区':'移动当前画布')+'：点击源点，再点击目标点即完成；Esc 取消');}
function cancelCanvasAlignment(){alignment=null;moduleEditor.canvasViews.forEach(v=>v.preview(null));}
let canvasListPanel:CanvasListPanel|null=null;
function renderCanvasPanel(){
 let panel=document.getElementById('model-canvases');if(!panel){panel=element('section');panel.id='model-canvases';panel.className='model-canvases';document.querySelector('#app .layout > aside')!.prepend(panel);}if(!assetId){panel.hidden=true;return;}panel.hidden=false;
 let objectHost=document.getElementById('hierarchy-objects');if(!objectHost){objectHost=element('section');objectHost.id='hierarchy-objects';panel.append(objectHost);}objectHost.replaceChildren(element('strong','物体与集合'));modelObjectTools?.mount(objectHost);
 let canvasHost=document.getElementById('hierarchy-canvases');if(!canvasHost){canvasHost=element('section');canvasHost.id='hierarchy-canvases';panel.append(canvasHost);}const session=manager.assetSession(assetId);if(!session.canvases||!workshopShell)return;
 if(!canvasListPanel)canvasListPanel=new CanvasListPanel({current:()=>assetId?manager.assetSession(assetId):null,refresh:async()=>{const s=manager.assetSession(assetId);s.asset=s.canvases!.model;dirty();await editAsset(assetId,true);},objectMode:()=>!!modelObjectTools?.objectMode,exitEdit:()=>modelObjectTools?.useObjectMode(),requireClosed:()=>paintController?.requireClosed(),message,confirm:confirmAction,menus:workshopShell.menus});canvasListPanel.update(canvasHost);
 const more=document.getElementById('asset-document-more');if(more&&isV2()&&!document.getElementById('canvas-export-source')){const pack=button('导出便携源',()=>void run(async()=>{await saveAll();const file=await api.v2PortableExport(token,assetId);if(file)message('已导出可编辑源与预览：'+file);}));pack.id='canvas-export-source';const unpack=button('导入便携源',()=>void run(importPortableAsset));unpack.id='canvas-import-source';more.append(pack,unpack);}
 for(const id of ['canvas-export-source','canvas-import-source']){const control=document.getElementById(id);if(control)control.hidden=!isV2();}
}
async function commitCanvasAlignment(){
 if(!alignment?.source||!alignment.target)return;
 const state=alignment,s=manager.assetSession(assetId),multi=s.canvases;
 if(state.selection){const step=multi?.active.voxelStepM??.25;const delta=state.target!.map((n,i)=>(n-state.source![i])/step);if(delta.some(n=>Math.abs(n-Math.round(n))>1e-6))throw Error('目标偏移不在当前画布整数格上，请选择对应格点');moduleEditor.alignSelection(delta.map(Math.round));cancelCanvasAlignment();message('选区已对齐 · 可撤销');}
 else {multi!.editable();const origin=alignCanvas(multi!.model,multi!.activeId,state.source!,state.target!);cancelCanvasAlignment();moduleEditor.cancel();multi!.patch({originTicks:origin});s.asset=multi!.model;dirty();await editAsset(assetId,true);message('画布已对齐 · 可撤销');}
}
document.addEventListener('pointerdown',(event)=>{
 if(!alignment||event.button!==0||event.target!==moduleEditor.views[0].renderer.domElement)return;
 event.preventDefault();event.stopImmediatePropagation();
 const point=moduleEditor.canvasViews[0].pick(event,!alignment.source);if(!point){message(alignment.source?'请选择可见模型表面':'请选择当前画布表面',true);return;}
 if(!alignment.source){alignment.source=point;message('源点已选择，点击目标点立即完成（允许同一画布）；Esc 取消');}
 else {alignment.target=point;void run(commitCanvasAlignment);}
},true);
document.addEventListener('keydown',(event)=>{
 if(!alignment||!['Escape','Enter'].includes(event.key))return;
 event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape'){cancelCanvasAlignment();message('已取消画布对齐');}else void run(commitCanvasAlignment);
},true);

async function importPortableAsset(){
 await saveAll();const result=await api.v2PortableImport(token);if(!result)return;
 project=result.document;const opened=manager.openAsset(result.asset,null);
 manager.markSaved(opened.sessionId,result.asset.revision,result.hash);refreshV2Registries();
 await editAsset(result.asset.assetId);refreshAssetBrowser();message('便携源已导入为新资产');
}

// Palette files are independent from the asset's indexed color storage.
const paletteLibrary=document.createElement('div');paletteLibrary.className='palette-library';
paletteLibrary.innerHTML='<div class="palette-modes"><button data-palette-mode="fixed" class="active">固定色板</button><button data-palette-mode="wheel">色轮</button></div><div class="palette-files"><select aria-label="选择色板"></select><div><button id="palette-folder">选择文件夹</button><button id="palette-project">项目色板</button><button id="palette-refresh" title="刷新色板">↻</button></div><small></small></div>';
$('palette').before(paletteLibrary);
$('palette-toggle').hidden=true;$('color-hex').closest('label')!.setAttribute('hidden','');$('color').closest('label')!.setAttribute('hidden','');$('color-panel').querySelector('small')!.setAttribute('hidden','');
moduleEditor.setFixedPalette([]);moduleEditor.setPaletteMode('fixed');
for(const button of paletteLibrary.querySelectorAll<HTMLButtonElement>('[data-palette-mode]'))button.onclick=()=>{const mode=button.dataset.paletteMode as 'fixed'|'wheel';moduleEditor.setPaletteMode(mode);paletteLibrary.querySelector<HTMLElement>('.palette-files')!.hidden=mode==='wheel';paletteLibrary.querySelectorAll('[data-palette-mode]').forEach(b=>b.classList.toggle('active',b===button));};
async function loadPaletteLibrary(choose=false,reset=false){if(!token)return;try{const result=await (api as any).palettes(token,choose,reset);const select=paletteLibrary.querySelector('select')!;const key='xh-palette:'+projectRoot;const saved=localStorage.getItem(key);select.replaceChildren(...result.palettes.map((p:any)=>new Option(p.name,p.name)));if(result.palettes.some((p:any)=>p.name===saved))select.value=saved!;const apply=()=>{const entry=result.palettes.find((p:any)=>p.name===select.value);moduleEditor.setFixedPalette(entry?.colors??[]);localStorage.setItem(key,select.value);};select.onchange=apply;apply();const hint=paletteLibrary.querySelector('small')!;hint.textContent=result.palettes.length?'': '文件夹内没有可用的 JSON / GPL 色板';hint.title=[result.root,...result.errors].join('\n');$('palette-folder').title=result.root;if(result.errors.length)hint.textContent=result.errors.join('；');}catch(error:any){message(error.message,true);}}
$('palette-folder').onclick=()=>void loadPaletteLibrary(true);$('palette-project').onclick=()=>void loadPaletteLibrary(false,true);$('palette-refresh').onclick=()=>void loadPaletteLibrary();
const sectionLabel=$('section').closest('label')!;sectionLabel.className='viewport-section';sectionLabel.querySelector('span')!.lastChild!.textContent=' 剖切';sectionLabel.title='隐藏当前工作层上方的体素';document.querySelector('#editview')!.parentElement!.querySelector('.view-actions')!.prepend(sectionLabel);

const modelTools=document.createElement('details');modelTools.className='modeling-tools';modelTools.innerHTML='<summary title="绘制平面与随机化">建模</summary><div><label>绘制平面<select id="work-plane"><option value="2">XY · 水平</option><option value="1">XZ · 正面</option><option value="0">YZ · 侧面</option></select></label><label>平面位置（格）<input id="work-plane-depth" type="range" min="-128" max="128" value="0"><input id="work-plane-number" type="number" min="-8192" max="8192" value="0"></label><button id="random-tone">色阶随机化</button><button id="random-edge">边缘随机化</button></div>';$('editview').querySelector('.viewport-brush-toolbar')!.append(modelTools);
function setWorkPlane(){moduleEditor.setWorkPlane(Number(($('work-plane') as HTMLSelectElement).value),Number(($('work-plane-number') as HTMLInputElement).value));}
$('work-plane').onchange=setWorkPlane;$('work-plane-depth').oninput=()=>{($('work-plane-number') as HTMLInputElement).value=($('work-plane-depth') as HTMLInputElement).value;setWorkPlane();};$('work-plane-number').onchange=()=>{($('work-plane-depth') as HTMLInputElement).value=($('work-plane-number') as HTMLInputElement).value;setWorkPlane();};$('layer').addEventListener('change',()=>{($('work-plane-number') as HTMLInputElement).value=($('layer') as HTMLInputElement).value;setWorkPlane();});
$('random-tone').onclick=()=>moduleEditor.randomize('tone');$('random-edge').onclick=()=>moduleEditor.randomize('edge');
const rockButton=document.createElement('button');rockButton.id='rock-shaping';rockButton.textContent='岩体塑形';rockButton.title='选中单个合并物体，预览柱状岩壁或层阶崖岸';rockButton.onclick=()=>{modelTools.open=false;moduleEditor.rockShaping();};modelTools.querySelector('div')!.append(rockButton);

const snapChoice=document.createElement('select');snapChoice.setAttribute('aria-label','对齐吸附点');snapChoice.innerHTML='<option value="center">体素中心</option><option value="corner">体素角点</option>';modelTools.querySelector('div')!.append(snapChoice);snapChoice.onchange=()=>moduleEditor.canvasViews.forEach(v=>v.pointMode=snapChoice.value as 'center'|'corner');

const deleteSelected=document.createElement('button');deleteSelected.id='delete-selection';deleteSelected.textContent='删除选区';deleteSelected.title='删除全部选中体素（包含穿透选中） · Delete';deleteSelected.onclick=()=>void moduleEditor.deleteSelection();$('editview').querySelector('.viewport-brush-toolbar')!.append(deleteSelected);

modelObjectTools=new ModelObjectTools({
 session:()=>workspace==='module'&&assetId?manager.assetSession(assetId):null,
 refresh:async()=>{if(assetId)await editAsset(assetId,true);},
 changed:()=>{if(assetId)manager.sync(manager.assetSession(assetId).sessionId);dirty();},
 history:redo=>{const session=manager.assetSession(assetId);redo?manager.redo(session.sessionId):manager.undo(session.sessionId);},
 save:()=>void run(saveAll),message
});

paintController=new PaintWindowController({session:()=>assetId?manager.assetSession(assetId):null,save:()=>saveAll(true),changed:()=>{if(assetId){manager.sync(manager.assetSession(assetId).sessionId);dirty();}},message});
workshopShell=new WorkshopShell({session:()=>assetId?manager.assetSession(assetId):null,paintButton:paintController.button});
