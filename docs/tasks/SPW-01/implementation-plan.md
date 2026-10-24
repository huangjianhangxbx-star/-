# SPW-01 星骸 Spine 动画工坊实施计划

> 实施者：逐任务执行 RED → 确认按预期失败 → GREEN → 回归 → 整理。新功能和修复遵循本环境的 `test-driven-development` Skill；真实 Spine 编辑器操作另保留人工证据。本文是执行计划，不代表任何阶段已经通过。

**目标：**用一个带骨骼动作的 GLB 和真实 `rozeul` Spine 4.3 工程的一个方向，交付可操作的 Windows 工坊，并让新增动画在 Spine 4.3 工程副本中可编辑、保存、重开、重导。

**架构：**Electron 只负责桌面文件选择、工作副本、Spine CLI 和保存；Three.js 对 GLB 求值；纯转换核心把世界关节姿态投影成目标骨架的可键控驱动数据；官方 Spine 4.3 runtime 预览完整目标数据加新增动画。预览与导出消费同一份生成结果，保留原 JSON 的全部非目标数据。

**技术栈：**Windows、Electron、TypeScript、Three.js、官方 `spine-webgl` 4.3、用户本机 Spine 4.3.26。导出数据与 runtime 的 major.minor 均为 4.3；依赖版本需先核实兼容性后固定到新工具自己的锁文件。

**依据：**`E:/迅雷下载/SPW-01_星骸Spine动画工坊_首轮执行计划_v1.0.md`，以及本工作树的 `AGENTS.md`、`design/开发细则.md`。附件中的路径和数值建议需以本机素材核实；本文不把计划中的建议当成已验收事实。

## 当前样本与工作边界

- 已由用户确认当前母版：`E:/1画画/星骸回廊/rozeul/Models/rozeul.spine`。本轮只读取原件，对工作副本操作。
- 本机 Spine 可执行文件：`E:/Spine/Spine.com`、`E:/Spine/Spine.exe`；当前编辑器版本 4.3.26。CLI `-i` 报 169 bones、5 IK、38 transform constraints；今天实际导出的 JSON `constraints` 为 41（5 IK + 36 transform）。这两个统计有差异，M0 须按实际 JSON 和目标编辑器核对，不把 38 写成测试常量；还须记录各约束真正控制的骨链及方向显示依赖。
- 工程验证动作源：Khronos CesiumMan GLB，2 秒、19 joints、1 clip。记录实际 clip 名、来源和许可；它是工程样本，不是项目正式美术。
- 本工作树已准备忽略的输入：`work/SPW-01/inputs/CesiumMan.glb`、`work/SPW-01/inputs/CesiumMan-LICENSE.md`，以及 CLI 默认 `-e json`/`json+pack` 导出的 `work/SPW-01/inputs/rozeul/packed/rozeul.json`、`.atlas`、`.png`。现已核对部分 Nonessential 字段：154 个 mesh 带 `width`/`height`，159 个骨骼带 `color`；这不证明所有导出选项。本机 `Spine.com --last-export-settings` 返回 `Unrecognized parameter`。实现者应核对导出字段、来源及副本/原件指纹，不重复下载或覆盖。
- 开发位置仅限本独立工作树的 `自制工具/spine_animation_workshop/` 与必要 `docs/tasks/SPW-01/`、项目状态记录。素材副本、导出和证据放 `work/SPW-01/` 或工具内忽略目录，不能进入默认 Git 提交。
- 保持游戏、Unity 正式工程、原角色和贴图、其他工坊、`design/用户维护/` 与 `design/开发细则.md` 不变。只做单真实方向；不启动 SPW-02。
- 5° 俯角、30 Hz 等是可调 SAMPLE。用户要求是“平视稍微偏俯视”，不能把数字写成项目美术标准。
- 本轮 B 级模块验证。技术回环与用户视觉审阅分开记；夹具、工坊预览和生成 JSON 均不能替代 Spine 编辑回环。

## 模块文件与唯一职责

| 路径 | 职责 | 依赖/使用者 |
|---|---|---|
| `自制工具/spine_animation_workshop/package.json`、`pnpm-lock.yaml`、`tsconfig.json` | 独立依赖、启动、测试、类型检查、构建与便携打包入口 | 不引用其他工坊的源码或 `node_modules` |
| `desktop/main.cjs`、`desktop/preload.cjs` | 安全文件选择、只读载入、工作副本、CLI 调用、配置与输出写入；以有限 IPC 暴露给 renderer | 所有原件保护及路径检查集中于此 |
| `src/core/contracts.ts` | 下述跨模块数据合同和单位；不包含 Electron/DOM/Three 类 | 其他模块共同引用 |
| `src/source/glb-motion.ts` | 解析 GLB、列动作和完整路径节点、按秒独立求值世界变换/绑定姿势 | 转换核心、源预览 |
| `src/target/spine-target.ts` | 解析完整 4.3 JSON，列骨骼、控制器、约束、skin、附件和已有动画；保留原文档 | 转换核心、映射 UI、输出 |
| `src/transfer/retarget.ts` | 固定视角正交投影、参考姿势、比例/根处理、FK 或实际控制器求解、连续性诊断 | `TransferConfig` → `DriverFrame` |
| `src/transfer/sample-clip.ts` | 秒制范围与首尾采样，调用同一 `poseAt` 生成完整片段 | `GeneratedClip` |
| `src/output/spine43-animation.ts` | 按本机 4.3 导出样本写新增 timeline、唯一命名、完整 JSON 无损增量与结构比较 | `GeneratedClip` → 完整输出 JSON |
| `src/preview/spine43-preview.ts` | 官方 runtime 渲染目标，按生成动画和方向显示配置求值；与导出结果一致 | renderer UI |
| `src/ui/*` | 中文窗口、映射/校准、源和目标预览、共用时间轴、配置保存与错误反馈 | 不自行计算另一套姿态 |
| `tests/*` | 接口级定向测试；实际 GLB/角色用忽略的本地样本运行验证 | RED 先于生产实现 |
| `docs/tasks/SPW-01/intake.md`、`validation.md`、`handoff.md` | 真实输入/版本与驱动边界、逐项验证证据、交付及限制 | 不把待验证项写成通过 |

### 跨模块合同（文件名与名称实施时保持一致）

```ts
// src/core/contracts.ts；路径身份使用完整节点路径，不用显示名称去重。
export type Matrix16 = readonly number[]; // 16 个有限数字，列主序；边界处断言长度。
export type JointPose = { path: string; parentPath: string | null; world: Matrix16; bindWorld: Matrix16 };
export type MotionClip = { id: string; name: string; durationSeconds: number };
export type MotionSource = {
  joints: readonly { path: string; parentPath: string | null; name: string }[];
  clips: readonly MotionClip[];
  poseAt(clipId: string, seconds: number): readonly JointPose[]; // 重复调用与调用顺序无关
};
export type TargetSummary = {
  editorVersion: string;
  bones: readonly { name: string; parent: string | null }[];
  skins: readonly string[];
  animations: readonly string[];
  constraints: readonly { kind: 'ik' | 'transform' | 'path' | 'physics'; name: string; bones: readonly string[]; target: string | null }[];
};
export type DriverMapping = {
  sourcePath: string;
  sourceEndPath?: string; // FK 骨段终点；源关节分叉时必须显式指定
  target: string;
  mode: 'fk-bone' | 'ik-target' | 'transform-control' | 'skip';
  side: 'left' | 'right' | 'center';
};
export type TransferConfig = {
  schemaVersion: 1;
  source: { file: string; clipId: string; frontAxis: string; upAxis: string; rangeSeconds: readonly [number, number]; referenceSeconds?: number };
  target: { file: string; skin: string; directionId: string; displayAnimation?: string };
  view: { yawDegrees: number; pitchDegrees: number; mirror: boolean };
  anchors: { sourceFootPath: string; sourceRootPath?: string; targetFootBone: string; scale: number; offsetX: number; offsetY: number };
  mappings: readonly DriverMapping[];
  chainCorrections: readonly { target: string; rotationDegrees?: number; offsetX?: number; offsetY?: number }[];
  rootPolicy: 'in-place-ground';
  sampleHz: number;
  output: { animationName: string; directory: string; spineVersion: string };
};
export type DriverFrame = {
  seconds: number; // 新动画从 0 秒开始
  // 键值为相对目标 setup 的 Spine timeline 增量；不是屏幕世界坐标。
  keys: readonly { target: string; property: 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'ikMix'; value: number }[];
  diagnostics: readonly { code: string; target: string; message: string }[];
};
export type GeneratedClip = { name: string; durationSeconds: number; frames: readonly DriverFrame[] };
```

这些类型是最小协作合同，不预判 `rozeul` 具体控制骨名。路径优先存项目相对路径；明确的外部绝对路径仅在必要时使用。`referenceSeconds` 是可选人工动作参考帧，必须与 GLB 绑定姿势和目标设置姿势区分。`sourceRootPath` 用于去掉地面整体行进，不能把 `sourceFootPath` 的独立脚步也清零。M0 输出的实际映射清单决定本轮 `fk-bone`、`ik-target`、`transform-control` 适用部位；一个受约束骨链只选一个权威驱动入口。若某个 4.3 timeline 无法表示上述键，先通过本机编辑器导出一个金样本确认写法，再调整合同并通知并行实现者。`DriverFrame` 只描述可写入最终工程的键，不能含预览独占的静态绑定变更。

## 执行顺序与并行边界

1. **M0 和 M1 的导回门槛在前。**先确认工作副本、Spine 4.3.26 导出格式和 Project Import Animation 的真实操作，再投入完整 UI。不能凭 CLI 文档猜测“直接给既有工程导入动画”的命令；本机帮助确实支持才自动化，否则保留 GUI 操作。
2. GLB 读取/采样、目标工程解析与安全桌面壳可由不同实现者并行，但先共用上面的合同和只读样本路径。目标约束解析交付前，不能定稿左右映射、驱动策略、方向显示或导出 timeline。
3. M1 完成一条真实动作的短时间段、关键帧可读取的工程副本后，再扩大为整段、可调视角、预览和工作流。界面可先做文件选择、源 clip 浏览、时间轴和角度操作，但不得用 UI 内临时姿态充当转换结果。
4. 并行文件归属：资产/导回实现者负责 `src/target/`、`src/output/` 与 CLI；动作实现者负责 `src/source/`、`src/transfer/`；桌面/UI 实现者负责 `desktop/`、`src/ui/`、`src/preview/`。`contracts.ts`、`package.json` 和锁文件由一人合并维护；接口变更先同步，避免并行覆盖。

## 任务 0｜M0：真实输入、工作副本和导回协议

**产物：**`docs/tasks/SPW-01/intake.md` 与忽略的 `work/SPW-01/` 输入副本、原件 SHA256 清单；写明 Spine 可执行文件的实际版本/帮助摘要，`rozeul` 的真实目标方向、skin、主要骨链和约束控制源，CesiumMan 的实际 clip 名及许可。核对 Git 工作树与远端；不 reset/clean。

- [ ] 读取适用 AGENTS、当前开发细则及任务关联记录；确认本独立工作树无他人未提交文件。只在登记路径寻找角色与动作，不全盘扫描。
- [ ] 对原 `.spine`、贴图和 GLB 建只读指纹，复核忽略工作区已备输入；核对 4.3.26 默认 `-e json`/`json+pack` 输出的完整性、atlas 页图和 `Nonessential` 实际字段。必要时从工作副本通过编辑器官方导出设置生成满足导回需求的版本；不复用本机不识别的 `--last-export-settings` 参数。
- [ ] 对实际 JSON 生成结构摘要：bones、IK/transform/path/physics、skins、animations、方向显示依赖及可键控控制源；记录 CLI `-i` 与 JSON 的 38/36 transform 差异原因或观察结论。记录一个真实方向与动作，明确其余方向结构不能裁掉。
- [ ] 在 GUI 中用副本验证 Project Import Animation 的入口；记录可以重复的具体点击步骤与一次金样本动画导出 JSON，不能把 Import Data 当成等效入口。
- [ ] 若某环节失败，在 intake 记录命令、错误、阻塞的后续任务；继续不依赖该环节的工作。原件指纹再次比对。

**门槛：**只有目标导出足以通过真实导回、金样本 timeline 和实际受约束骨链确定，任务 3、4 的目标写法才定稿；`Nonessential` 未核实时不得宣称其已导出，仅找到历史 JSON 也不满足门槛。

## 任务 1｜M1：新工程最小运行入口与真实 GLB 求值

**文件：**创建 `package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`desktop/main.cjs`、`desktop/preload.cjs`、`src/core/contracts.ts`、`src/source/glb-motion.ts`、`tests/glb-motion.test.ts`，以及最小 `src/ui/index.html` 开发入口。

**接口：**`openGlb(bytes: ArrayBuffer): Promise<MotionSource>`；无 clip、节点路径重复、时间越界返回明确错误。`poseAt` 对同一时点重复求值得到同一矩阵，不受上次取样影响。

- [ ] RED：写真实 CesiumMan 的浏览器环境测试，断言解析结果恰为 1 clip、约 2 秒、19 个 joint；在 0 秒和中点取样，至少一个非 root 关节世界矩阵改变；重复 `poseAt` 顺序 `0 → 1 → 0` 时 0 秒结果相等。另写无动画 GLB 的错误测试。
- [ ] 运行单测，确认失败原因是入口尚缺或行为不满足，而非图片解码/测试配置错误。
- [ ] GREEN：最小 Electron 入口和 GLTFLoader 求值；保留源默认/绑定矩阵，不把动画第 0 帧当绑定姿势。只读取字节，不修改 GLB。
- [ ] 运行单测、类型检查和最小窗口启动；记录真实 clip 名、精确 duration、关节路径及源坐标轴。把配置/入口问题在本任务内修到可重复。

## 任务 2｜M1：目标解析和完整 JSON 保留

**文件：**创建 `src/target/spine-target.ts`、`tests/spine-target.test.ts`；工作副本的导出 JSON 仍留 ignored，不提交用户角色二进制。

**接口：**`readSpineTarget(jsonText: string): { summary: TargetSummary; document: unknown }`；`document` 只由输出模块写新动画，UI 仅用摘要。版本非 4.3、无骨骼、关键目标缺失、atlas 页面缺失分别报可行动错误。

- [ ] RED：用本机实际导出副本测试 169 bones 和 5 IK 可读取，transform 计数与 JSON 原文一致（今天的 packed JSON 为 36；CLI `-i` 的 38 另记在 intake），已有动画数可读取；原 JSON 所有顶层字段和未知字段可保留。用删去一个 atlas 页图的临时副本验证报错包含缺失页名。
- [ ] 确认单测按预期失败，再实现最小解析和资源检查。不要用历史 4.3.26 摘要代替本次导出结果。
- [ ] GREEN 后定向复测；把目标一条身体/手臂/腿链的驱动类型、左右名称和方向显示依赖写进 intake。若约束覆盖普通骨骼，不能同时直接给该链最终旋转键。

## 任务 3｜M1：三个时点的真实目标姿态

**文件：**创建 `src/transfer/retarget.ts`、`tests/retarget.test.ts`，更新 `docs/tasks/SPW-01/intake.md` 的实际映射表。

**接口：**`createTransfer(source: MotionSource, target: TargetSummary, config: TransferConfig): { poseAt(sourceSeconds: number): DriverFrame }`。输入角度用度、时间用秒；输出位置是目标局部坐标。镜像画面与交换左右映射是两项不同配置操作。

- [ ] RED：先用两节骨链小夹具测试世界→目标父局部转换、设置姿势与源绑定姿势不相同、镜像负缩放只应用一次；缺必要映射时报具体目标链。再对真实 GLB + `rozeul` 已查明的最小身体/手臂链测试首/中/末的输出均有限数且姿态不同。
- [ ] 确认测试失败来自求解缺口，才实现本样本实际需要的 FK、IK target 或 transform 控制入口。对近零投影保留上一有效方向并给诊断；±180° 跨界取连续角。
- [ ] GREEN 后重复顺序 `首 → 末 → 首` 测相同输入得到同一结果；与 Spine runtime 中的约束实际效果核对。不能因算法难适配就静默关闭目标约束。若真实目标只能通过改静态绑定才能适配，准确记录缺口，停止该链的成功声明。

## 任务 4｜M1：新增动画 JSON 与导回证明

**文件：**创建 `src/output/spine43-animation.ts`、`tests/spine43-animation.test.ts`、`scripts/m1-proof.mjs`；实测结果写 `docs/tasks/SPW-01/validation.md`。这里的脚本只操作工作副本及 ignored 输出。

**接口：**`appendAnimation(document: unknown, clip: GeneratedClip): { jsonText: string; name: string }`；若名称已存在则递增编号，原动画、约束、skin、附件、mesh、weights 与未知字段语义不变。时间线字段参照任务 0 的本机 4.3 金样本。

- [ ] RED：基于目标完整 JSON 的临时副本，断言新增动画有实际键帧、旧动画数量和名字不变、约束/skin/附件/mesh/weights 不变、同名再次生成得到新名且不覆盖；非法时间顺序和缺目标控制器分别失败。
- [ ] 确认失败后实现最小 timeline 写入；对三个真实时点生成短动画。通过官方 4.3 reader 或临时 Spine 工程检查可读，保留 JSON 结构差异摘要。
- [ ] 在 GUI 中把新动画用 **Project Import → Animation** 导入 `rozeul.spine` 工作副本，打开并检查关键帧。复制验收副本，在其中改一个明显关键帧、保存、关闭重开、重新导出并核对改动；未测试编辑的交付副本保持原生成结果。
- [ ] 从未混入测试编辑的最终副本再次导出，在官方 4.3 runtime 中核对短动画时长与贴图。原件 SHA256 不变。只有这些证据齐全，`validation.md` 才把 M1“真实导回证明”标通过；脚本跑通或临时 JSON 能播只记部分通过。

## 任务 5｜M2：整段采样、视角和原地化

**文件：**创建 `src/transfer/sample-clip.ts`、`tests/sample-clip.test.ts`，扩展 `src/transfer/retarget.ts` 与相应定向测试。

**接口：**`generateClip(source: MotionSource, target: TargetSummary, config: TransferConfig): GeneratedClip`；从 `rangeSeconds[0]` 截取，新时间轴从 0 秒开始且精确包含两端。`sampleHz` 可调，整段固定观察角，0° 相对已校准源正面。

- [ ] RED：用 2 秒源动作和非零截取起点测试首帧 0、末帧为截取时长；角度变动实际改变关键帧；5° 与 0° 的变化可测但不强制画风判断；去掉地面整体行进仍保留身体上下起伏。
- [ ] 确认失败后做固定正交观察方向、轻微俯角、比例/脚底锚点、时间段、原地化与连续性保护。预览窗缩放不得改变 `GeneratedClip`。
- [ ] GREEN 后对真实 clip 生成全段；用官方 runtime 复看首、中、极值、末及左右，记录退化部位和需要 Spine 手工修整的姿态。不要自动生成游戏事件。

## 任务 6｜M3：桌面操作、同步预览与配置持久化

**文件：**创建 `src/preview/spine43-preview.ts`、`src/ui/app.ts`、`src/ui/style.css`、`src/config/workshop-config.ts`；扩展 `desktop/main.cjs` 与 `desktop/preload.cjs`；创建 `tests/config.test.ts` 和一个真实桌面工作流 smoke。

**接口：**UI 只调用 `MotionSource.poseAt`、`createTransfer`、`generateClip`、`appendAnimation`，不私有求解。配置 `saveConfig(config, file)`/`loadConfig(file)` 保留 schema 版本和项目相对引用；移动输入后提供重新定位；新配置更改使旧采样显示“需更新”。

- [ ] RED：配置回读测试断言源/目标、clip/范围、方向 ID 与角度、映射、校准、参考帧、链修正、原地化及输出设置一致；缺文件能重新定位；真实桌面 smoke 覆盖导入、选择 clip、调角、保存、关闭重开、生成和选择新输出目录。输入错误至少覆盖无动画 GLB、缺 atlas 页、版本不符或输出目录不可用中的一个真实失败路径。
- [ ] 确认 RED 后接入 Electron 安全 IPC、源 3D/目标 Spine 双预览与共用时间轴、骨骼树搜索和选中联动、明确跳过、角度/俯角/比例与有限修正。源相机与采样观察角一致；0°、±45°、±90°、±135°、180° 只是快捷选角，不能固化为五方向。正常操作中文；技术诊断可折叠。
- [ ] 目标预览使用官方 4.3 runtime 加载完整输出并播放生成动画；调参时的即时当前帧也从同一 `DriverFrame` 经过相同 timeline 写法求值，不在 UI 偷做另一套变换。逐帧/倒拖从确定的设置姿势和方向显示状态求值，必要物理求值按官方 4.3 API。对相同时点重复求值稳定。
- [ ] 单测及桌面 smoke 通过，实际操作检查常用窗口和约 1280×800 较窄窗口的控制可达性。长段重采样需显示进度并保持窗口可操作，参数变化实时刷新当前帧或明确旧结果失效。

## 任务 7｜M4：正式工程回环、定向修整

**文件：**更新 `docs/tasks/SPW-01/validation.md`；如发现真实转换缺陷，只改对应的 `src/transfer/` 或 `src/output/` 文件并先增回归测试。

- [ ] 按任务 4 的工作副本流程导入全段新动画，查看首、发力/极值、中间和末尾，检查左右、比例、手脚连接、根、约束、方向显示、贴图；记录可复现异常。
- [ ] 每个算法错误先写可复现 RED，再定向修复和复测；美术本身不能表达的极端姿态明确标需人工精修，不用假数值宣称自动解决。
- [ ] 另复制验收工程修改一个键并完成保存/重开/重导；交付工程仍为未掺测试编辑的版本。原动画、非目标方向、约束、附件保留，原件 hash 不变。
- [ ] 有合适且来源明确的第二动作时才试抬手/挥击；无素材不为数量寻找或采购，限制如实记录。

## 任务 8｜M5：Windows 交付与 B 级验证

**文件：**创建 `自制工具/spine_animation_workshop/README.md`、必要打包脚本和忽略规则；完成 `docs/tasks/SPW-01/validation.md`、`handoff.md` 及本任务状态/当日记录。

- [ ] 定向执行工具测试、类型检查、构建和实际 Electron 启动；用用户流程导入、保存、生成、导出。验证无动画/缺图等至少一个真实失败路径、首尾和视角变化、配置重开、重复求值、原件 hash 与新动画不覆盖。
- [ ] 打便携 Windows 程序后用最终包实际启动并走关键路径；若打包环境失败，交付可运行开发入口和完整产物，明确 EXE 未交付，不把快捷方式当便携包。
- [ ] 交付工程副本、必要贴图/atlas/JSON、配置、启动与导回说明、少量关键帧对照和短录屏；外部样本记录 Khronos 来源/许可，不默认提交原角色二进制或所有生成物。
- [ ] 验证记录逐项标“通过/失败/未执行”，说明环境、命令与证据路径。只测本工具及直接影响；发现共享模块实际受影响才扩大回归。技术通过后停在用户视觉审阅点，记录制作价值和需精修部位待用户评价。
- [ ] 核对本工作树差异、远端基线和有效授权，选择性提交本任务源码/记录并按项目规则推送 GitHub 开发分支；不强推、不推 Gitee、不混入主工作树并行内容。

## 完成判定与停点

技术完成需同时有：真实样本全段动作、可运行桌面流程、保存重开配置、Spine 4.3 中真实可编辑回环、原件保护、必要 B 级证据和可用交付。缺任一项时报告实际完成项与对应阻塞，不把“预览可播”“夹具通过”“单方向完成”写成整轮或五方向通过。最终停在 SPW-01 视觉审阅，不自动开展 SPW-02。
