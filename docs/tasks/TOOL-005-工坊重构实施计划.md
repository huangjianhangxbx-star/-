# TOOL-005 工坊四工作区 Implementation Plan

> **执行者：**先读本计划及配套设计，按任务逐段实施与审查。使用当前可用的 test-driven-development；可用 collaboration 分派独立子任务。Skill 默认提到的 superpowers 执行技能在本次环境未提供，不把不存在的入口列为执行前提。所有步骤使用复选框记录；本轮只完成规划，不提前勾选实现。

**Goal：**把已确认的四工作区接到真实模块、场景源和冻结发布上，保留 M1.2 及 Legacy 能力。

**Architecture：**新增 ProjectDocument/AssetDocument/SceneDocument 和发布包；通过 Adapter 复用既有体素事务、网格、参考、材质及交换代码。新场景独立校验，旧 xhmap/native v1 与旧 MapBaker 保留；Unity 新接收器只消费冻结依赖。

**Tech Stack：**现有 TypeScript 7.0.2、Node 22.14.0、Electron 44.5.1、Three.js 0.186.1、esbuild 0.28.2、Node test、Playwright 1.63.0；可选本机 Blender 5.1.2、团结 2022.3.62t13 Built-in。版本据本机当前文件，不升级依赖。

**Spec：**[工坊重构设计](TOOL-005-工坊重构设计.md)；UI 依据 [TOOL-004](TOOL-004-工坊工作区UI验证.md)。术语见 [计划词汇](TOOL-005-工坊术语.md)。

## Global Constraints

- 已确认：四工作区、场景私有草稿、Library独立可编辑副本、稳定Root、0.25米体素对齐、PNG辅助、保存/发布分离；新字段和下列版本机制属于本轮推荐设计。
- 源0.25米、右手Z-up；Three/GLB `(X,Z,-Y)`，团结 `(X,Z,Y)`反绕序。旧原件/附件坐标原样保留，迁移不取整；统一实例Root时只做明确记录的变换补偿。局部帧保留，原生GLB已减anchor，不能重复减。
- cells≤250000；色槽1–64；实例/贴花各≤10000；源位置/Root≤2048米；PNG≤32MiB；文件≤64MiB；90°旋转，不新增scale。
- 新Scene不调用旧地图的支撑清理。Gameplay仍由Unity authoring承担；旧map标签、事件、样本和原MapBaker不删除。
- 不覆盖旧源、美术原件、Excel或开发细则；保护未提交M1.2/TOOL-003、voxel_workbench和其他任务。公共库不会因编辑独立副本被修改。
- 新增依赖、正式格式破坏、外部发布、提交/推送不包含在本轮规划授权。实施时只触及该阶段明确文件，避免全仓格式化。
- 测试使用独立validation子目录与明确输出，原文件哈希保持；生产构建和包输出只在实现阶段执行。本计划的命令与预期均是将来的验收，不是本轮通过记录。

## 文件结构与职责

下列相对路径均相对 `自制工具/map_editor/`；标为“新增”的文件目前尚不存在。根目录任务/记录链接另按项目AGENTS维护。

| 新增文件 | 唯一职责 | 首次产生任务 |
|---|---|---|
| `core/workshop-documents.ts` | 新文档类型、构造、基础校验 | 1 |
| `core/coordinates.ts` | 源变换、轴映射、Root与网格相位 | 1 |
| `core/workshop-adapter.ts` | 新模块与旧EditorDocument/native v1桥接 | 1 |
| `core/asset-copy.ts` | 独立副本和色板身份分配 | 1 |
| `desktop/workshop-store.cjs` | 项目内路径、批量保存、日志/恢复、冲突保护 | 2 |
| `desktop/workshop-session.ts` | 模块/场景会话、提交快照、联合历史与切换 | 3/4 |
| `desktop/workshop.html / workshop.ts` | 四工作区壳与路由、实例化模块 | 3 |
| `desktop/workspaces/project.ts / module.ts` | 管理与模块页控件接线 | 3 |
| `desktop/module-interaction.ts` | 笔画、Root、PNG交互事务 | 3 |
| `core/scene-session.ts` | 装配命令、独立历史、显式重设根 | 4 |
| `desktop/assembly-view.ts / workspaces/assembly.ts` | 实例视口/拾取与装配控件 | 4 |
| `core/legacy-workshop.ts` | 旧图副本迁移与负载报告 | 5 |
| `core/workshop-glb.ts` | 新资产/场景静态GLB，复用现有编码 | 6 |
| `core/publish.ts` | 发布计划、依赖闭包、冻结manifest | 6 |
| `desktop/publish-store.cjs / workspaces/publish.ts` | staging提交与发布页真实状态 | 6 |
| `desktop/publish-fbx.cjs` | Blender进程、配方和成组输出 | 7 |
| `adapters/tuanjie/Runtime/WorkshopPublish.cs` | C#冻结类型与视觉实例身份 | 8 |
| `adapters/tuanjie/Editor/PublishReader.cs / AssetBaker.cs / SceneBaker.cs / PublishWindow.cs` | 新发布接收/单件生成/组合生成/接收UI | 8 |
| `adapters/tuanjie/Editor/WrapperUpgrade.cs` | 选中包装的显式升级预检与副本 | 8 |
| `tests/workshop-launch.mjs` | Electron新旧入口的统一启动参数 | 3 |

现有文件只在需要的阶段增量修改：`document.ts/native-asset.ts/references.ts/palette.ts/mesher.ts/rebuild.ts`优先复用，不先大改；`main.cjs/preload.cjs/catalog.cjs/view.ts/style.css/scripts/build.mjs/package.mjs`按接线需要调整。`SourceReader/MapBaker`继续旧路线；可提取可复用内部数学/网格方法，但旧公开Interface不变。

## 任务间 Interface

这是计划的最小公开Interface，不要求照搬具体内部实现。以下类型统一定义，后续任务不可自行改名；修改须同步调用者、计划和测试。

```typescript
// workshop-documents.ts 的 AssetDocument/SceneDocument/ProjectDocument/Vec3
// 完整字段见设计第3节。MaterialProfile也在那里定义。
import type { AssetDocument, SceneDocument, SceneInstance, ProjectDocument, Vec3 }
  from "./workshop-documents.ts";

export type ResolvedAsset =
  | { kind: "voxel"; document: AssetDocument }
  | { kind: "external"; revision: number; anchorM: Vec3;
      recipe: "glb-rh-y-up" | "blender-fbx-5.1.2";
      glb: Uint8Array; files: SnapshotFile[] }
  | { kind: "texture"; revision: number; png: Uint8Array };
export type SceneAssets = ReadonlyMap<string, ResolvedAsset>;
export type Issue = { code: string; documentId: string; message: string };
export type MigrationResult = {
  project: ProjectDocument; scene: SceneDocument;
  assets: AssetDocument[]; copiedFiles: SnapshotFile[];
  legacyJson: string; issues: Issue[];
};
export type IdSource = () => string;
export type SnapshotFile = { path: string; bytes: Uint8Array; sha256: string };
export type PublishTarget =
  | { kind: "asset"; document: AssetDocument }
  | { kind: "scene"; document: SceneDocument; assets: SceneAssets };
export type OutputFile = {path: string; sha256: string; byteLength: number};
export type UnityBinding =
  | {route: "native-cells"; runtimePath: string}
  | {route: "texture"; imagePath: string}
  | {route: "fbx"; modelPath: string; materialsPath: string;
      texturePaths: string[]; recipe: "blender-fbx-5.1.2"}
  | {route: "unsupported-glb"};
export type PublishDependency = {
  assetId: string; kind: "voxel" | "external" | "texture";
  sourceRevision: number; contentHash: string; sourcePath: string;
  anchorM?: Vec3; glbPath?: string; unity: UnityBinding;
};
export type FrozenBinding = {assetId: string; sourceRevision: number; contentHash: string};
export type RuntimeVoxel = Omit<AssetDocument,"editor">;
export type RuntimeScene = {
  schema: "xinghai-workshop-runtime-scene-1"; sceneId: string;
  revision: number; name: string; voxelSize: 0.25;
  bindings: FrozenBinding[]; instances: SceneInstance[];
  groups: SceneDocument["groups"]; decals: SceneDocument["decals"];
};
export type PublishManifest = {
  schema: "xinghai-workshop-publish-1"; publishId: string;
  kind: "asset" | "scene"; targetId: string; sourceRevision: number;
  unit: "meters"; sourceAxes: "RH_Z_UP"; voxelSize: 0.25;
  recipe: "glb-only" | "glb-fbx";
  runtimePath: string; dependencies: PublishDependency[];
  outputFiles: OutputFile[]; payloadFiles: OutputFile[];
  toolchain: {workshopVersion: string; sourceFingerprint: string;
    blenderVersion?: string; fbxRecipe?: "blender-fbx-5.1.2"};
};
export type PublishPlan = {manifest: PublishManifest; files: SnapshotFile[];
  expectedInputs: {path: string; sha256: string}[]};
export type PublishConverter = (staging: string, manifest: PublishManifest,
  signal?: AbortSignal) => Promise<PublishManifest>;
export type PublishCommitOptions = {signal?: AbortSignal; converter?: PublishConverter};
export type RootChange = {sceneId: string; assetId: string;
  beforeScene: SceneDocument; afterScene: SceneDocument;
  beforeAsset: AssetDocument; afterAsset: AssetDocument};
```

新模块创建时使用传入的IdSource，测试无需改变全局随机数。路径/磁盘哈希与Node能力留在desktop，core只接收解析后对象或字节。external.files是desktop读取的模型/旁车/贴图实际字节组，不仅是路径列表；texture独立提供PNG。ResolvedAsset的map键就是稳定assetId。外部GLB使用既有静态GLB验证，禁止未经验证的动画/skinning/远程纹理。

PublishManifest.runtimePath指向RuntimeVoxel或RuntimeScene；voxel依赖也提供剥离editor的runtimePath，sourcePath指向可保留PNG制作参考的快照。RuntimeScene使用独立schema与FrozenBinding，不包含可变源路径，接收不打开可变源。所有hash为SHA256小写十六进制，byteLength是实际文件字节数；负载hash在Reader逐个复算。contentHash是该依赖源负载规范化清单（包内相对路径、sha256、byteLength按路径排序）的SHA256，只含制作/外部原始依赖，不含本次生成GLB/FBX，避免转换后改变绑定键或自引用hash。输出依旧逐文件hash校验。制作/引擎负载分区固定`payload/source`与`payload/runtime`，manifest本身不纳入自己的hash清单。

## 执行与验证命令

工作目录固定为 `E:\WORLDCREATOR\XingHaiHuiLang\Origin\自制工具\map_editor`。当前可用命令：

```powershell
pnpm test
pnpm exec tsc --noEmit
pnpm build
node --experimental-strip-types --test tests/core.test.ts tests/exchange.test.ts
node tests/m12-native-ui.mjs
```

每个任务下方给出实际计划文件名与完整命令。`pnpm build`改写生成bundle和dist，必须在实现授权内执行；本轮没有运行。新UI命令使用新入口，旧回归继续旧入口，不能靠隐藏旧控件获得通过。

### Task 1：文档契约、Root变换与独立副本（首个实现段）

**Files：**新增`core/workshop-documents.ts / coordinates.ts / workshop-adapter.ts / asset-copy.ts`；新增`tests/workshop-documents.test.ts / coordinates.test.ts / asset-copy.test.ts / workshop-adapter.test.ts`。必要时只导出已有palette类型，不重写旧validateMap。

**Consumes：**既有`createMap/validateMap`、EditorDocument、validateNativeAsset、EditorMetadata、MaterialColor；native v1与合法旧样本。

**Produces：**

```typescript
createAsset(assetId: string): AssetDocument;
createScene(sceneId: string): SceneDocument;
createProject(projectId: string): ProjectDocument;
validateAsset(input: unknown): AssetDocument;
validateScene(input: unknown): SceneDocument;
checkSceneReferences(scene: SceneDocument, assets: SceneAssets): Issue[];
validateProject(input: unknown): ProjectDocument;
fromNativeV1(input: unknown): AssetDocument;
toNativeV1(asset: AssetDocument): unknown;
toEditingMap(asset: AssetDocument): unknown;
fromEditingMap(original: AssetDocument, edited: unknown): AssetDocument;
cloneAsset(source: AssetDocument, newAssetId: string): AssetDocument;
sourceToThree(point: Vec3): Vec3;
sourceToUnity(point: Vec3): Vec3;
transformPoint(point: Vec3, anchorM: Vec3, positionM: Vec3,
  rotationDeg: number): Vec3;
isVoxelAligned(anchorM: Vec3, positionM: Vec3, rotationDeg: number): boolean;
```

- [x] 写行为测试：空草稿可保存但native v1不可生成空母版；损坏schema/重复ID/越界/scale拒绝；无cells地形的纯模块Scene有效。validateScene负责结构校验，checkSceneReferences负责缺失/不对齐Issue，加载不因缺文件无法修复。
- [x] 写旧native非对称轴/Root往返、局部负坐标、材质profile/colorId、PNG/保护列编辑往返和clone深拷贝测试。材质独立paletteId，不用临时编辑mapId重新派生它。
- [x] 单独运行新测试，确认因Interface不存在或行为未实现而失败；不以语法/import路径错当成功的红灯依据。
- [x] 实现上述纯函数与Adapter：保持anchor/sourceOrigin和旧合法带点ID，格点Root与legacy Root分流；普通提交有实际变化才增加资产revision，不重定局部原点。toNativeV1非空revision0源首次转换为native revision1；legacy源保留原revision。unknown先验证后使用。
- [x] 新测试通过，运行现有exchange/references/native-rename/core/surface回归与类型检查；验证旧文件字节无改动。

核心反例测试内容：

```typescript
import {test} from "node:test";
import assert from "node:assert/strict";
import {createAsset} from "../core/workshop-documents.ts";
import {cloneAsset} from "../core/asset-copy.ts";
import {sourceToThree, transformPoint, isVoxelAligned} from "../core/coordinates.ts";
test("Root相位对齐且Three保持原轴向", () => {
  assert.deepEqual(sourceToThree([1,2,3]), [1,3,-2]);
  assert.deepEqual(transformPoint([0.25,0,0], [0.125,0,0], [0.125,0,0], 0), [0.25,0,0]);
  assert.equal(isVoxelAligned([0.125,0,0], [0.125,0,0], 0), true);
  assert.equal(isVoxelAligned([0.125,0,0], [0,0,0], 0), false);
});
test("独立副本修改不回写公共源或色板身份", () => {
  const source=createAsset("public-a");
  source.cells=[{x:0,y:0,z:0,color:0}];
  const copy=cloneAsset(source,"local-a");
  copy.cells[0].x=4; copy.palette[0]="#ffffff";
  assert.equal(source.cells[0].x,0);
  assert.notEqual(source.palette[0],copy.palette[0]);
  assert.notEqual(source.materialProfile.paletteId,copy.materialProfile.paletteId);
  assert.deepEqual(copy.anchorM,source.anchorM);
});
```

Run：`node --experimental-strip-types --test tests/workshop-documents.test.ts tests/coordinates.test.ts tests/asset-copy.test.ts tests/workshop-adapter.test.ts tests/exchange.test.ts tests/references.test.ts tests/native-rename.test.ts tests/core.test.ts tests/surface.test.ts`，随后`pnpm exec tsc --noEmit`。

**退出条件：**纯函数与兼容Adapter可被下一段调用，旧native身份/Root/材质一致，纯Scene不受Legacy支撑校验影响。旧UI/Unity不变。

### Task 2：项目持久化、跨文件事务与恢复

**Files：**新增`desktop/workshop-store.cjs`、`tests/workshop-store.test.ts`；修改`main.cjs/preload.cjs`增加workshop命名空间；修改`scripts/build.mjs`输出新core CJS入口；现有`files.cjs/native-store.cjs`保持原Interface。

**Consumes：**Task1校验器、FileStore/digest、用户选择的项目根。

**Produces：**

```typescript
type WriteIntent = { path: string; bytes: Uint8Array; expectedHash: string | null };
type CommitResult = { files: { path: string; hash: string }[] };
// 新 CJS 模块工厂的实际返回接口
interface WorkshopStore {
  load(relative: string): Promise<{bytes: Uint8Array; hash: string}>;
  commit(writes: WriteIntent[]): Promise<CommitResult>;
  recover(): Promise<void>;
}
createWorkshopStore(root: string): WorkshopStore;
```

`expectedHash=null`表示路径应当不存在；已有文件必须有读取时的hash。commit仅写选定根内路径，禁止绝对/越界/链接；新目录检查现存父目录与realpath，不通过字符串拼接猜根。按项目串行化，写前复核、生成持久事务日志和旧字节备份，写后提交标记；重开先恢复未提交事务。删除改为任务内的显式待处理引用动作，首版不做自动孤儿清理。

- [x] 测试正常创建项目/场景/空草稿三文件后重开内容相同；任何阶段写入失败，已有文件恢复，新增文件不成为有效登记。
- [x] 测试外部修改、保存中竞争、越界/链接、64MiB超限、重复目标、manifest局部成功均拒绝；所有输入不得改变原件。
- [x] 用独立子进程在“第二文件已写但未提交”点退出，再以另一个进程调用recover，检查三文件及hash回到事务前；只测catch恢复不足以覆盖此项。
- [x] 实现store和IPC，主进程验证schema与目标session/token，renderer不能直接给任意绝对路径写入；IPC继续来源检查、隔离和sandbox。
- [x] 运行新store与现有文件/native-pair回归；构建后通过实际IPC保存/重开，取消对话框不改变dirty。

测试步骤模板（测试自身临时根均放validation并在确认范围后清理）：

```typescript
// 与tests/workshop-store.test.ts同文件：root用fs.mkdtemp创建
const store=createWorkshopStore(root);
await store.commit([{path:"project.xhproject.json",bytes:new TextEncoder().encode("old"),expectedHash:null}]);
const opened=await store.load("project.xhproject.json");
await fs.writeFile(path.join(root,"project.xhproject.json"),"external");
await assert.rejects(()=>store.commit([{path:"project.xhproject.json",bytes:new TextEncoder().encode("new"),expectedHash:opened.hash}]));
assert.equal(await fs.readFile(path.join(root,"project.xhproject.json"),"utf8"),"external");
```

Run：`node --experimental-strip-types --test tests/workshop-store.test.ts tests/files.test.ts tests/m12-native-store.test.ts`；`pnpm exec tsc --noEmit`；`pnpm build`。

**退出条件：**项目文件、私有源与清单一致，中断恢复有真实子进程证据；无任意路径写入口。

### Task 3：真实四工作区壳、管理与模块编辑

**Files：**新增`workshop-session.ts / workshop.html / workshop.ts / module-interaction.ts / workspaces/project.ts / workspaces/module.ts`及`tests/workshop-session.test.ts / workshop-module-ui.mjs / workshop-launch.mjs`；修改main/preload/catalog/view/style/build、`core/rebuild.ts / desktop/mesh-worker.ts`及下列旧回放启动参数。旧index/renderer入口保留，壳的assembly/publish区域先显示阶段说明，不提供虚假完成按钮。

**Consumes：**Task1模块Adapter、Task2store；旧EditorDocument/rebuild/palette/reference-view、Catalog与mesh-worker。

**Produces：**

```typescript
import {EditorDocument} from "../core/document.ts";
type Workspace = "project" | "module" | "assembly" | "publish";
type AssetSession = { sessionId: string; asset: AssetDocument;
  editor: EditorDocument; savedRevision: number; savedHash: string | null };
interface WorkshopSession {
  openAsset(asset: AssetDocument, hash: string | null): AssetSession;
  activate(workspace: Workspace, documentId: string): void;
  assetSession(assetId: string): AssetSession;
  markSaved(sessionId: string, submittedRevision: number, hash: string): void;
  dirtyDocuments(): string[];
  commitRootChange(change: RootChange): string;
  undo(sessionId: string): void;
  redo(sessionId: string): void;
}
```

EditorDocument在本模块从`core/document.ts`导入；会话内部捕获提交时AssetDocument快照，markSaved只认实际提交revision，不把等待期间的新修改标为已保存。主进程按session保存目标，不使用nativeCurrent来决定新模块的保存路径。commitRootChange及联合undo/redo在Task4实现；Task3先完成单模块的统一命令入口。

- [x] 先测A/B模块各有独立历史、PNG和dirty；保存A revision1等待期间编辑到revision2，成功返回后A仍dirty。
- [x] 建壳和管理页，真实创建场景/空草稿、重开、Library独立副本、复制/改名、公共库登记事务；公共源不自动写入或跟随。新增Catalog对xhmodule的识别，避免scan把副本反登记为原件。迁移资产检视/源定位、保持ID的批量改名、有效重载/损坏新导出保护，保留关联GLB/FBX/Blend事务。
- [x] 接Module Adapter复用全部M1.2造型：高度/体积/六面/面积厚度/矩形/填色/重染/擦除、选区、保护列、剖切、参考、Root；色环/HEX、新画笔色与已有槽重染、侧底面色、无光照校色和已有表面Z辅助分别可验收。本地native取用先复制为私有模块；旧native原件打开/同ID更新仅在明确Legacy会话，不绕过副本保护。
- [x] main增加显式workshop/legacy入口；guarded只接受当前窗口所选入口规范化URL。workshop-launch.mjs封装launch入口参数，旧M1.1/M1.2及asset-reload回放传`--workspace=legacy`，新回放传`--workspace=workshop`；默认入口切换前后两种都验收。
- [x] 完整视口dispose：注销监听与ResizeObserver、释放不再共享的geometry/material/texture；ReferenceView继续禁普通raycast。worker由会话协调器持有，viewport切页不杀另一会话使用的worker，关闭对应会话才终止。rebuild消息增加会话身份与generation检查。
- [x] 真Electron回放大笔刷36格、桥洞保护两侧、整笔撤销、Esc/失焦、PNG有效高度/脚底、参考退出后绘制、Root跨模块不串、切页历史保留、保存重开及外部冲突。
- [x] 30次切换工作区和10次模块打开/关闭：通过测试注入的worker/observer/listener工厂计数器及Three资源计数检查不累积，不能只数canvas。测试注入不成为产品流程；固定场景只比较资源数量，不宣称FPS预算通过。

会话测试核心断言：

```typescript
const a=manager.openAsset(createAsset("asset-a"),null);
const b=manager.openAsset(createAsset("asset-b"),null);
a.editor.begin(); a.editor.volume(0,0,0,0); a.editor.commit();
manager.activate("module",b.asset.assetId);
manager.activate("module",a.asset.assetId);
assert.equal(manager.assetSession("asset-a"),a);
assert.equal(a.editor.past.length,1);
assert.equal(b.editor.doc.cells.length,0);
```

该片段中的manager是测试内创建的WorkshopSession实现，createAsset/EditorDocument用Task1与现有导入；测试通过公有Interface，不直接改内部历史。

Run：`node --experimental-strip-types --test tests/workshop-session.test.ts`；`pnpm exec tsc --noEmit`；`pnpm build`；`node tests/workshop-module-ui.mjs`。旧入口继续`node tests/m12-brush-ui.mjs`、`node tests/m12-protected-ui.mjs`、`node tests/m12-large-cancel-ui.mjs`、`node tests/m12-reference-ui.mjs`、`node tests/m12-native-ui.mjs`。

**退出条件：**模块页是真实编辑/保存，跨页和多模块不丢状态；新场景创建后可重开；新公共库独立副本磁盘内容/身份可证，M1.2旧入口仍可用。

### Task 4：场景装配、实例命令与稳定Root

**Files：**新增`core/scene-session.ts`、`desktop/assembly-view.ts / workspaces/assembly.ts`、`tests/scene-session.test.ts / workshop-assembly-ui.mjs`；workshop-session接Scene会话。

**Consumes：**SceneDocument、SceneAssets、Task1变换和Task2多文件事务。

**Produces：**

```typescript
class SceneSession {
  constructor(scene: SceneDocument, assets: SceneAssets);
  snapshot(): SceneDocument;
  transform(instanceId: string, positionM: Vec3, rotationDeg: number): void;
  duplicate(instanceId: string, newInstanceId: string): void;
  remove(instanceId: string): void;
  setGroupVisible(groupId: string, visible: boolean): void;
  prepareReanchor(assetId: string, anchorM: Vec3): RootChange;
  undo(): void; redo(): void;
}
```

prepareReanchor是无副作用候选，由WorkshopSession.commitRootChange核对before快照并统一应用两份源、标dirty和登记commandId；双方历史头均为该命令时，UI的undo/redo同步恢复Root/实例/revision。任何参与文档后续被编辑，则拒绝跨过后续历史，提示先撤销后续操作。持久化由Task2一次commit，失败仍保留内存dirty候选供重试，不冒充已保存或只撤销一半。外部资产不允许体素Root选点。普通场景拖动保留原快照，松手一次transform提交、Esc丢预览，不每pointermove增加历史。

- [x] 先测十实例树选择/复制/移除/旋转与撤销；assetId保持、instanceId独立，显隐可保存重开且不删实例。
- [x] 创建纯模块地面+高台+洞壁+道具场景，实例全部有效；绝不填入假terrain cells或调用cleanSupport。native grid变换用相位吸附，外部模型有限米坐标和90°变换。
- [x] 模块修改后各instanceId/T/rotation不变；删除局部原点体素仍保持帧。联合Root命令验证提交/撤销/重做/取消/保存失败时两份源、历史、dirty与视口一致；后续模块造型不被早期Root撤销覆盖。A场景修改local源，B场景副本不变。
- [x] 接树/视口单选、框选、数字输入、轴向拖动、旋转90、复制/删除、图层、Library拖入后实际复制、水平美术贴花。texture注册PNG→复制贴花→保存重开可验；缺失模型/图片显示占位和问题，保存拒绝且原文件不变。
- [x] 与Task6联动验收：PNG→冻结GLB内嵌→发布hash全链路与最终发布资格反馈。由Task6真实 PNG 内嵌/hash 与资格反馈回放完成，证据见Task6验证。
- [x] 回放非对称0/90/180/270度、正负坐标、半格Root、PNG不抢instance拾取；引用共享geometry，删除一实例不使另一实例消失。
- [x] 保存/重开场景与模块，检查Root/实例位置、dirty和撤销会话隔离。

```typescript
const before=session.snapshot().instances.find(x=>x.instanceId==="floor-1")!;
session.duplicate("floor-1","floor-2");
const copy=session.snapshot().instances.find(x=>x.instanceId==="floor-2")!;
assert.equal(copy.assetId,before.assetId);
assert.deepEqual(copy.positionM,before.positionM);
session.undo();
assert.equal(session.snapshot().instances.some(x=>x.instanceId==="floor-2"),false);
```

Run：`node --experimental-strip-types --test tests/scene-session.test.ts tests/coordinates.test.ts`；`pnpm exec tsc --noEmit`；`pnpm build`；`node tests/workshop-assembly-ui.mjs`；旧动态重载`node tests/asset-reload.mjs`。

**退出条件：**能编辑/保存真实模块化墓室；坐标、Root与独立副本在重开后仍正确；无需旧地图cells支撑。

### Task 5：旧地图另存迁移与Legacy回归

**Files：**新增`core/legacy-workshop.ts`、`tests/legacy-workshop.test.ts / workshop-migration-ui.mjs`；管理页增加显式“导入旧图副本”，不自动转换打开动作。

**Consumes：**旧validateMap、Catalog资产字节、Task1/2/4。

**Produces：**`migrateLegacy(json: string, assets: SceneAssets, newId: IdSource): MigrationResult`。首次输入须是旧有效地图；依赖解析由desktop完成并重映射为新场景私有身份。

- [x] 测试旧负坐标cells/owner/保护列/色板/PNG转成单件terrain模块，anchor=0保持原源坐标，不重新挪包围盒；实例/贴花保持世界几何与朝向，不要求改变Root语义后T数值仍相同。
- [x] native实例沿用母版Root时`Tnew=Told-R*旧instance.anchor`；external为`Tnew=Told+R*(新assetRoot-旧instance.anchor)`。补同assetId不同旧anchor及四旋转非对称点测试；PNG贴花的支撑原数据留legacy附件，新场景不执行支撑清理。复制既有外部FBX/旁车/贴图及texture字节到copiedFiles，保持导入根旋转和配方，报告列资产ID映射/Root补偿/缺源Issue；无配套GLB的旧源保留占位。
- [x] surfaces、event/registryKey及未知旧字段保留在完整legacyJson附件；新scene只保留事件的可识别视觉，不声称玩法已迁入；缺源占位+Issue，不无声跳过。
- [x] 另存事务写Project/Scene/资产/legacy原文附件/报告；取消或错误不写原路径；复制场景重新生成scene/local资产/实例身份，世界变换不变。
- [x] 对`遗迹双路.xhmap.json`及M1.2示例的测试副本迁移、重开、输出报告；原件hash一致。旧UI仍可打开原图并执行现有M1.1/M1.2回放。

```typescript
const result=migrateLegacy(originalJson,resolvedAssets,nextId);
assert.equal(result.legacyJson,originalJson);
assert.deepEqual(JSON.parse(result.legacyJson).surfaces,original.surfaces);
assert.equal(result.scene.instances.length,original.instances.length);
// fixture为外部GLB，canonicalRoot=[0,0,0]，旧T=[1,2,0]、旧anchor=[.25,0,0]、rotation=0
assert.deepEqual(result.scene.instances[0].positionM,[0.75,2,0]);
// 新T + (P-canonicalRoot) == 旧T + (P-旧anchor)，逐非对称点核对世界位置
```

Run：`node --experimental-strip-types --test tests/legacy-workshop.test.ts tests/migration.test.ts tests/surface.test.ts`；`pnpm build`；`node tests/workshop-migration-ui.mjs`；`node tests/m11-migration-ui.mjs`；`node tests/m11-sample-edit-ui.mjs`。

**退出条件：**新场景可继续编辑，旧玩法原文与报告可追溯；旧图/事件/稳定身份未受新入口影响。

### Task 6：GLB与不可变发布包

**Files：**新增`core/workshop-glb.ts / publish.ts`、`desktop/publish-store.cjs / workspaces/publish.ts`、`tests/workshop-glb.test.ts / publish.test.ts / publish-store.test.ts / workshop-publish-ui.mjs`；从现有scene-glb提取静态组合内部方法，原exportSceneGlb旧入口继续validateMap。

**Consumes：**Task1–5的已保存源、SceneAssets、palette/现有静态GLB编码、Task2文件/事务原则。

**Produces：**

```typescript
exportAssetGlb(asset: AssetDocument): Uint8Array;
exportWorkshopSceneGlb(scene: SceneDocument, assets: SceneAssets): Uint8Array;
createPublishPlan(target: PublishTarget, publishId: string,
  recipe: "glb-only" | "glb-fbx",
  toolchain: PublishManifest["toolchain"]): Promise<PublishPlan>;
commitPublish(root: string, plan: PublishPlan,
  options?: PublishCommitOptions): Promise<{publishId: string; directory: string}>;
```

core立即深拷贝冻结目标后异步计算WebCrypto SHA256和GLB字节；desktop从app:info提供toolchain，为来自磁盘的负载补充expectedInputs/path/hash并验证closure。manifest的dependencies记录assetId、sourceRevision、contentHash及相对负载路径；outputFiles记录文件路径/hash/byteLength。发布ID只用于新目录，没有覆盖开关。

commitPublish在glb-only时不调用converter；glb-fbx必须提供Task7的converter。先写plan负载，再调用converter得到完成的manifest，重新扫描并验证实际outputFiles/依赖闭包；转换尚未完成时不写有效manifest或列发布历史。AbortSignal在写入/进程/提交前检查，取消等待进程退出后清理，提交rename后再取消不能删除已有效版本，应返回其成功身份。

- [x] 先测publish A后修改草稿/公共库/材质不改变A字节；publish B新目录；同ID拒绝；包目标有未结束笔画或未保存源时先处理并可取消，不静默保存。
- [x] 测空资产、缺依赖、重复绑定、路径逃逸、静态GLB不支持扩展、损坏hash/图片拒绝；参考在payload可以保留，但GLB及runtime负载均无editor/参考节点。
- [x] GLB测试非对称三轴、负坐标、Root只减一次、实例共享mesh/独立node、隐藏组仍输出、水平贴花纹理内嵌；Scene不用旧支撑校验。
- [x] staging先完整写入/hash/fsync，复核expectedInputs；同盘rename提交目录。测试磁盘不足/第二输出失败/输入在发布期间改变/子进程中断，不能列为有效版本。
- [x] 发布页只根据真实Issue、输出/进程状态展示检查/成功；源保存与发布历史分开，选择单件/场景目标可返回定位出错源。
- [x] 回放实际UI生成GLB-only包，重开Project与发布历史，检查包中每个输出hash和节点变换。

```typescript
const before=structuredClone(target.document);
const plan=await createPublishPlan(target,"publish-a","glb-only",toolchain);
target.document.revision++;
assert.equal(plan.manifest.sourceRevision,before.revision);
const first=await commitPublish(root,plan);
await assert.rejects(()=>commitPublish(root,plan));
assert.equal(first.publishId,"publish-a");
```

Run：`node --experimental-strip-types --test tests/workshop-glb.test.ts tests/publish.test.ts tests/publish-store.test.ts tests/exchange.test.ts`；`pnpm exec tsc --noEmit`；`pnpm build`；`node tests/workshop-publish-ui.mjs`。

**退出条件：**真实场景/单件GLB包不可覆盖、闭包冻结、错误无半成品，PNG不进模型；保存源不会修改旧发布。

### Task 7：可选Blender/FBX成组交换

**Files：**新增`desktop/publish-fbx.cjs`、`tests/publish-fbx.test.ts / publish-fbx-blender.py`；复用`glb_to_fbx.py::convert`，增量调整publish-store和发布配方字段。

**Consumes：**Task6 staging；已安装Blender；当前FBX/材质/贴图契约。

**Produces：**

```typescript
type FbxRunner = (inputGlb: string, outputFbx: string,
  options: {blenderExecutable: string; signal?: AbortSignal; timeoutMs: number}) => Promise<void>;
convertPublishFbx(staging: string, manifest: PublishManifest,
  options: {blenderExecutable: string; signal?: AbortSignal; timeoutMs: number;
    runner?: FbxRunner}): Promise<PublishManifest>;
```

仅在recipe=glb-fbx的提交前执行；路径限定staging，进程argv用execFile，不拼shell脚本。runner默认包装当前glb_to_fbx.py，测试提供假runner来产生受控输出/失败；publish-store的converter闭包传入此options并接收AbortSignal。默认每个模型300000ms上限，超时结束本次进程并等待退出，再清理staging。

- [x] 用确定性假进程测试退出非零、缺FBX/旁车/贴图、取消/超时、晚到结果：本次staging失败且旧包hash不变；glb-only完全不启动Blender。
- [x] glb-fbx始终将目标GLB转换为`output/target.fbx`及旁车/贴图，纯原生单件/场景也须产出；另为每个外部模型依赖写`output/assets/<assetId>/<assetId>.fbx`及成组旁车/贴图，更新dependencies.unity为fbx绑定并重算完整manifest。组合目标FBX不能代替资产级绑定。真实Blender处理非对称三轴、灰/R/G/B、MASK与PNG贴图样本，两个共享外部资产各摆三次，核对尺度/Root/根节点/material/colorId与稳定实例绑定；不手改母版色值。
- [x] 不安装依赖，不写用户blend；进程取消后待退出再清理暂存，重启不把它列有效包。成功时由Task6一次提交完整FBX组。
- [x] 缺Blender给出可选择GLB-only的原因；FBX配方与版本写入manifest，不能提交后再追加FBX到旧目录。

Run：`node --experimental-strip-types --test tests/publish-fbx.test.ts`。新`publish-fbx-blender.py`接受`--output`和`--report`两个项目内绝对路径，内部只处理测试副本/输出；实际命令：

```powershell
& 'D:\steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python 'E:\WORLDCREATOR\XingHaiHuiLang\Origin\自制工具\map_editor\tests\publish-fbx-blender.py' -- --output 'E:\WORLDCREATOR\XingHaiHuiLang\Origin\自制工具\map_editor\validation\workshop-fbx' --report 'E:\WORLDCREATOR\XingHaiHuiLang\Origin\自制工具\map_editor\validation\workshop-fbx\report.json'
```

执行前核对Blender可执行路径；用本机配置实际路径替换此命令中的exe，禁止改为自动安装。保存进程日志与检查JSON，采用现有exchange.test.ts的材质断言；假进程测试不能当Blender视觉验证。

**退出条件：**可选路线真实产出完整FBX组、Root与颜色契约一致；失败不发布，也不破坏GLB-only旧版本。

### Task 8：Unity冻结接收、双Baker及包装升级

**Files：**新增文件见上表；增加正式Runtime身份/绑定类型；验证工程内新增`WorkshopPublishProof.cs / WorkshopRecoveryProof.cs / WrapperUpgradeProof.cs`（仅验证，不入插件）；包脚本登记新正式文件。旧SourceReader、MapBaker、MapRegistry、PlacementIdentity保持现有Interface。

**Consumes：**Task6/7发布manifest与负载；BakeJournal、已验证材质/Shader及轴向契约。

**Produces：**

```csharp
// 类型均由 Runtime/WorkshopPublish.cs 定义：PublishPackage含manifest与闭包，
// ReceiveOptions含receiptId（默认primary），PublishedModule/PublishedScene含publishId/receiptId/prefab/输出指纹。
// WrapperState含InstanceOverride[]，每项为instanceId/sourcePositionM/rotationDeg；UpgradeReport含冲突列表。
PublishPackage PublishReader.Read(string manifestPath);
PublishedModule AssetBaker.Bake(PublishPackage package, ReceiveOptions options);
PublishedScene SceneBaker.Bake(PublishPackage package, ReceiveOptions options);
UpgradeReport WrapperUpgrade.Preview(GameObject wrapper, PublishedScene candidate);
GameObject WrapperUpgrade.CreateCopy(GameObject wrapper, PublishedScene candidate, string destination);
```

完整冻结字段从Task6契约逐一建立C#类型并跨引擎fixture对照，不凭显示名绑定。单件/场景包都能解析本包闭包；同Scene内资产不需要先单独发布才能接收。

- [x] Reader实际拒绝错schema/hash、重复JSON字段、越界/链接依赖、空或未知轴配方、缺旁车、错误实例引用；不回退到MapRegistry的latest。没有新GLB importer：native-cells与PNG可接GLB-only；任何unsupported-glb外部依赖拒绝Unity接收并提示重新发布glb-fbx，不额外安装库。
- [x] 在`Assets/Generated/Workshop/<publishId>/<receiptId>/`下建立冻结输入副本及生成物；receiptId默认primary，可显式生成UUID作为接收副本，同receipt重收保GUID，新包/新receipt新目录。输入、meta、导入派生物与输出全部纳入受限事务；禁止复制进未被Journal保护的任意Assets目录并宣称可回滚。先通过全部文件校验，才开始AssetDatabase导入。
- [x] AssetBaker按源Root/局部帧生成视觉Prefab；SceneBaker保instanceId与源变换、共享模块和贴花，无Gameplay。受测FBX只校正一次，保留模型导入根旋转。
- [x] 重收检查生成输出指纹：内部手改/缺失资源作为冲突，另建接收副本；不能把新版等同覆盖旧Generated。BakeJournal回滚bytes/meta/内存，恢复点在验证工程的新生成目录。
- [x] 包装升级先Preview：仅支持WrapperState内instanceId/sourcePositionM/rotationDeg，按稳定instanceId匹配。用户包装自有脚本/碰撞/对象原样复制；SerializedObject的视觉根引用按instanceId重映射，指向未知视觉子节点的Object引用或未知Prefab内部override拒绝升级。源删除/改Root与已手调实例冲突阻止CreateCopy。目标只允许安全Assets内未存在的新Prefab路径，临时Prefab校验后提交；失败只清理本次临时物，不能声称BakeJournal回滚根外包装。原包装不改。
- [x] 真引擎Proof：非对称轴、四旋转、半格Root、Gamma颜色/纹理/双面绑定；A发布后源更新不改变A接收；B新接收；同版重收GUID稳定；包装副本功能标记与手调Transform保留；更新冲突明确。
- [x] 中途故障及子进程退出后恢复，上一有效生成物、meta、包装均一致；旧Reader/Integration/Axes/Recovery回归独立运行。

正常接收后的核心C#验收断言：

```csharp
var options = new ReceiveOptions { receiptId = "primary" };
var first = SceneBaker.Bake(PublishReader.Read(manifestA), options);
var guid = AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(first.prefab));
var again = SceneBaker.Bake(PublishReader.Read(manifestA), options);
if (guid != AssetDatabase.AssetPathToGUID(AssetDatabase.GetAssetPath(again.prefab)))
    throw new Exception("同发布版本重收改变GUID");
var next = SceneBaker.Bake(PublishReader.Read(manifestB), options);
if (AssetDatabase.GetAssetPath(next.prefab) == AssetDatabase.GetAssetPath(first.prefab))
    throw new Exception("新发布覆盖旧生成路径");
```

本机真实团结命令模板与计划入口：

```powershell
& 'E:\unity\Tuanjie Hub\2022.3.62t13\Editor\Tuanjie.exe' -batchmode -projectPath 'E:\WORLDCREATOR\XingHaiHuiLang\Origin\自制工具\map_editor\validation\TuanjieProject' -executeMethod Xinghai.MapEditor.Editor.WorkshopPublishProof.Run -logFile 'E:\WORLDCREATOR\XingHaiHuiLang\Origin\自制工具\map_editor\validation\workshop-publish-proof.log'
```

执行前检查该验证工程未被编辑器打开；各方法顺序启动，避免两进程同时写工程。新Proof在任务中创建；旧回归同模板替换为`IntegrationProof.Run / AxesProof.Run / ReaderM12Proof.Run / RecoveryProof.Interrupt / RecoveryProof.Verify`。Interrupt与Verify必须分进程，不能用同一内存伪装中断恢复。编辑器退出方式遵循既有Proof，超时保存日志，不杀用户正在使用的其他工程。

**退出条件：**实际引擎接收新单件/组合包，版本冻结与人工隔离可证，旧路线仍通过；透明排序/复杂光照另列视觉限制，URP/HDRP未支持。

### Task 9：全流程、便携交付与入口切换

**Files：**新增`tests/workshop-workflow-ui.mjs / workshop-package-smoke.mjs`、`docs/Validation-Workshop.md`、验证工程`Assets/XinghaiMap/Editor/WorkshopPackageProof.cs`；更新README、契约文档与package/build；根任务/项目状态/日志只追加本任务块。

**Consumes：**Task1–8全部产物；保留M1.2包与旧样本。

- [x] 先写真实工作流回放：新建项目/场景→Library独立副本→模块PNG/笔刷/Root→十实例装配→重开→发布A→修改local源→发布B→Unity接收A/B→包装副本升级，断言磁盘内容/身份/hash/Transform。
- [x] `pnpm test`、类型、构建通过后跑新UI与受影响旧回放。无新增失败/不明限制才产便携包；全套不因文件数量增加而重复跑没有变化的无关游戏测试。
- [x] package.mjs新增`--target workshop`参数，输出固定`release/星骸地图工坊-Workshop-M2.0/`及`星骸地图团结插件-Workshop-M2.0.unitypackage`，保留默认Legacy打包行为但本阶段不运行覆盖M1.2的路线。显式包含新增desktop CJS、workshop.html/workshop.js、dist新契约与转换脚本；正式插件按白名单含新旧Reader/Baker/Runtime/Shader及meta。插件由团结`WorkshopPackageProof.Export`生成，Proof本身不入包。
- [x] build-info版本为Workshop-M2.0；源指纹递归包含core/desktop/scripts的源码及workspaces子目录，排除生成bundle和验证输出。独立便携目录启动真实EXE，新旧入口各跑正常公开操作，检查实际EXE路径、源码指纹、输出依赖/插件内容；不复制本机node_modules充当发布结构。
- [x] 切换默认主进程入口为workshop，明确Legacy入口；再跑入口/保存/关闭/菜单/缩放/窗口布局回放，禁止默认入口切换后继续只测旧界面。
- [x] 捕获真实1440×900四页与墓室制作结果截图；校验五个PNG/生成bundle/包版本与源指纹。交付模型/材质与Unity视觉并列，证据区分参数/资源/实际视觉。
- [x] 文档逐项对账：已实现、测试覆盖、未实现、已知限制；保留旧格式示例、旧可玩塔防资产与插件路线。用户操作手感和长期大场景性能不得以短回放代替。

Run：`pnpm test`；`pnpm exec tsc --noEmit`；`pnpm build`；`node tests/workshop-workflow-ui.mjs`。再用Task8团结命令的executeMethod替换为`Xinghai.MapEditor.Editor.WorkshopPackageProof.Export`导出正式插件，随后`node scripts/package.mjs --target workshop`、`node tests/workshop-package-smoke.mjs`。smoke的默认EXE就是上述新目录，不复用M1.2固定路径。Task8真引擎证据复用冻结包；仅当此阶段修改Baker/输入配方时重跑受影响引擎检查。

**退出条件：**从源码构建出的便携工坊能完成真实模块化制作与发布，Legacy可回退；验收报告没有把原型、mock进程或未测配置记成生产通过。

## 需求覆盖与风险审查

| 已确认能力/约束 | 覆盖任务 | 关键失败反例 |
|---|---|---|
| 四工作区与不同尺度模块 | 3/4/9 | 只切页，保存仍共用一张地图 |
| 场景私有草稿，空草稿无强制发布 | 1/2/3 | 空源无法保存、切场景泄漏草稿 |
| 公共库独立可编辑副本 | 1/2/3/4 | 共用ID、数组或可变palette身份 |
| 稳定Root、严格几何格对齐 | 1/3/4/6/8 | 半格Root被取整、GLB重复减锚点 |
| PNG有效身高/脚底与拾取隔离 | 1/3/6/9 | 原生编辑丢PNG，发布带参考 |
| M1.2绘制/互通兼容 | 1/3/5/7/8/9 | 切页重置历史、删旧标签事件 |
| 实例关系、大场景可编辑组合 | 1/4/6/8 | 地面实例不在cells中而被旧校验清除 |
| 保存/发布分开，Unity不自动更新 | 6/7/8/9 | 接收按assetId解析latest |
| 人工修改与失败回滚 | 2/6/8 | 单文件回滚冒称跨文件/跨进程事务 |

## 本轮完成状态

Task1–9 全部完成。四工作区、独立源/库副本、模块与装配、Legacy迁移、冻结 GLB/FBX、Unity 接收/包装升级及独立便携交付均有实际证据。累计 183 项核心测试、类型与构建通过；真实 Electron、Blender5.1.2、团结2022.3.62t13及新便携 EXE 回放通过。默认入口现为工坊，Legacy显式保留，旧 M1.2 包未覆盖。

[Task1](TOOL-005-Task1-验证.md) · [Task2](TOOL-005-Task2-验证.md) · [Task3](TOOL-005-Task3-验证.md) · [Task4](TOOL-005-Task4-验证.md) · [Task5](TOOL-005-Task5-验证.md) · [Task6](TOOL-005-Task6-验证.md) · [Task7](TOOL-005-Task7-验证.md) · [Task8](TOOL-005-Task8-验证.md) · [Task9交付与边界](TOOL-005-Task9-验证.md)。PNG内嵌/hash联动已由Task6真实发布回放完成。用户手感、长期性能及复杂透明排序保持明确限制，没有未决产品取舍。本任务未提交推送。
