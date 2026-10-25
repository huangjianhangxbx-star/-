# SPW-02 阶段交接（2026-10-25）

最新 **0.2.4 身体动作草稿与迭代预览** 见 [迭代工作流交接](iterative-draft-handoff.md)。**0.2.3 文件选择目录记忆** 见 [目录记忆交接](directory-memory.md)。**0.2.2 本地自动采样与映射** 见 [自动映射交接](auto-mapping-handoff.md)。**0.2.1 直接载入 .spine** 工作流说明见 [原生工程工作流交接](native-project-handoff.md)。以下保留 0.2.0 两动作技术验证的历史记录。

## 阶段结果

本轮以 `rhiny` 为来源、`rozeul` 为目标，在正面偏右的同一画法方向迁移两条不同实际动作：`city/interact`（0.666667 秒）与 `common/talk1`（4 秒）。来源原工程为 Spine 3.8.99，经官方 4.3.26 编辑器重新导出；目标原工程为 4.3.26。原始 `.spine` 均未修改，编辑与证明位于 Git 忽略的 `work/SPW-02/`。素材身份见 [输入核对](intake.md)，逐通道决策与视觉边界见 [映射审计](mapping-audit.md)，可复核证据见 [验证记录](validation.md)。

当前 v4 配置复用 35 个类型化对象映射和 187 条显式通道策略。`city/interact` 的 196 条源通道中，10 条直接对应、12 条需目标校准、174 条显式跳过；`common/talk1` 的 195 条中，7 条直接对应、13 条需目标校准、175 条显式跳过；两者均无阻塞或未映射通道。v4 另为 city 加了三个**目标专用** drawOrder 键，让手和袖在动作前段按目标 88 槽的层序显示，0.21666667 秒恢复默认。来源 68 槽 drawOrder 仍按显式跳过记录，不能把目标专用修正算作来源通道迁移。**需校准的键虽已进入候选，不能算直接兼容；显式跳过的通道没有迁移。**`run` 是已淘汰的试选动作，不在正式验收内。

## 便携工具与完整 JSON 流程

当前 v5 Windows 便携包：`E:\SPW-02-release\xinghai-spine-animation-workshop-0.2.0-v5-win-x64\`。运行其中的 `星骸 Spine 动画工坊.exe`；`resources/app` 全文件组合 SHA-256：`e8ffc830b683c1a791d2802bcb0d0e9c6e902ca5f41780cef973da9d5bb73e8c`，`resources/app/dist/spine-app.js` SHA-256：`aeb15a833752312a387685c455b6bde0d0aef65cf4178cebbf0731ed62951b48`。EXE 本体 SHA-256 为 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`，它与旧包相同，识别应用内容须用前述资源哈希。复制交付时需保留整个目录。包内不含角色 `.spine`、导出或贴图。对应角色素材、原生工程、共享配置与证明在 `E:\SPW-02-release\SPW-02-assets-v4\`，先读其中 `README.md`；299 个清单文件的 SHA-256 已通过 `verify-bundle.ps1` 核对。工坊操作见[工坊 README](../../../自制工具/spine_animation_workshop/README.md)。旧 v4/v3 包及证据完整保留。

v5 便携 EXE 已在隐藏 Electron 窗口完成启动、来源/目标/配置导入、双预览与时间轴、生成和保存两条动作。city 的 UI 时间轴实际定位到 0.1、0.2 秒等时点，未出现预览错误。第一轮在应用内保存 v4 配置，关闭进程后由新进程重开，配置 SHA-256 仍为 `ea84927878ae7145ab982d2582b7bd4ab6706ca56d7a8b92afa930261a92a440`，35 个映射均复用。两动作分别保存完整目标 JSON、atlas、PNG、配置及报告；再在应用中打开第一份完整 JSON 作为目标追加第二动作，得到含原 110 条和新增两条的 112 动画 JSON，city 的三键层序修正在合并输出中保持。两份独立便携输出 JSON 与各自 v4 正式候选逐字节相同，原有动画及目标其余结构未变；atlas/PNG 与输入逐字节相同，来源、目标、配置及原始 `.spine` 的前后 SHA-256 不变。v5 连续输出 JSON 与 v4 逐字节相同，最终合并 JSON SHA-256 为 `900370025DD7D83BE601788BC1863EDE440B265D2CFA228145F39D215B5DE4C3`。此连续输出验证的是完整 JSON；原生工程状态另见下节。`pnpm test`：98 通过、9 跳过、0 失败；`pnpm typecheck` 与 `pnpm build` 通过。

## 原生工程导回与改键审计

当前 v4 的两条动画已导入同一个隔离的目标 `work/SPW-02/native-v4-delivery/rozeul.spine` 并保存。官方 Spine 4.3 CLI 独立重导后，原 110 动画及除 `skeleton.hash` 外的原目标结构均相等，新动画为 112 条。`common/talk1` 与 v4 候选的键和曲线完全相同；city 仅有一处 JSON 规范化：第一个 drawOrder 键从显式 `time: 0` 变为省略 `time`。官方 4.3 runtime 将省略值读取为 0；在 0、0.15、0.184、0.2167 秒两份数据的全部 88 个槽位顺序逐一相同。因此 v4 三键层序已经进入原生工程，且在这些时点保留预期效果。原生副本 SHA-256 为 `C09D93663AE90848C71E40904EF665B8CA8EF37B80648259ED92394B547A5773`。证据见 `work/SPW-02/proofs/v4-native-structure-result.json`、`v4-zero-time-runtime-result.json`。这验证了结构和层序语义，连续播放的自然程度仍需人工审阅。

另将 v4 交付工程复制到 `work/SPW-02/native-v4-edit-proof/rozeul.spine`，在官方 GUI 打开 `city/interact`，于 `Larm2.rotate` 第 12 帧（0.2 秒）插入旋转键 `17.395506` 并保存；官方 CLI 随后独立读取该 `.spine` 重新导出。与未改键的 v4 交付工程逐对象比较，时间线 8→9 键；除该键和编辑器更新的 `skeleton.hash` 外，完整导出相等，包括 `common/talk1` 和旧 110 条动画。改键副本 SHA-256 为 `285F92CBA070BBB59307DBB1CE2451631B893486D92B712E3A50A225E167CC91`。证据见 `work/SPW-02/proofs/v4-native-keychange-audit-result.json`、`verify-v4-native-keychange.mjs`。早期 v3 另有独立改键证据，作为历史保留。

另在官方 GUI 作过来源动画直接导入目标原生工程的隔离对照：`rhiny` 的 `city/interact` 直接导入未映射的 `rozeul` 后，仅 `body3d2.translate` 的 7 键保留，左手等关键骨骼出现缺失警告；旧 110 动画未变。证据见 `work/SPW-02/proofs/native-direct-compare-result.json`。这说明必须处理异名骨骼和目标控制结构，不能将同名直接导入视作本轮迁移成果。

## 证据入口

| 用途 | 本工作树内路径 |
| --- | --- |
| 当前 v4 共享配置 | `work/SPW-02/proofs/rhiny-rozeul-front-right-talk-interact-v4.json`；SHA-256 `ea84927878ae7145ab982d2582b7bd4ab6706ca56d7a8b92afa930261a92a440` |
| v4 独立候选与报告 | `work/SPW-02/proofs/candidate-v4-city_interact/`、`candidate-v4-common_talk1/`；`report-v4-city_interact.json`、`report-v4-common_talk1.json`、`v4-talk-interact-manifest.json` |
| v5 便携包应用流程 | `work/SPW-02/proofs/portable-v5-validation.json`、`portable-v5-*-out.txt`、`run-portable-v5.mjs` |
| v5 便携包两条独立与连续输出 | `work/SPW-02/proofs/portable-v5-city-interact/`、`portable-v5-common-talk1/`、`portable-v5-combined/`；重开的配置为 `portable-v5-reopened-config.spw.json` |
| v4 原生导回与零时刻层序审计 | `work/SPW-02/native-v4-delivery/rozeul.spine`；`work/SPW-02/proofs/structure-audit-v4-native/rozeul.json`、`v4-native-structure-result.json`、`v4-zero-time-runtime-result.json` |
| v4 原生改键副本与独立审计 | `work/SPW-02/native-v4-edit-proof/rozeul.spine`；`work/SPW-02/proofs/structure-audit-v4-native-edit/rozeul.json`、`v4-native-keychange-audit-result.json` |
| v3 原生 `.spine` 导回及改键审计 | `work/SPW-02/native-baseline/target-rozeul/rozeul.spine`、`native-edit-proof/rozeul.spine`；`work/SPW-02/proofs/structure-audit-result.json`、`native-keychange-audit-result.json` |
| 原生同名直接导入对照 | `work/SPW-02/native-direct-compare/target-rozeul/rozeul.spine`；`work/SPW-02/proofs/native-direct-compare-result.json` |
| v3 历史配置及便携证据 | `work/SPW-02/proofs/rhiny-rozeul-front-right-talk-interact-v3.json`、`portable-v3-validation.json`；旧便携目录 `E:\SPW-02-release\xinghai-spine-animation-workshop-0.2.0-win-x64\` |

这些 `work/SPW-02/` 素材和证明文件为 Git 忽略项；交付源码或选择性提交时需单独传递，不能仅靠仓库文件复现真实角色证据。复核汇总可在本工作树根目录运行：

```powershell
node work/SPW-02/proofs/run-portable-v5.mjs work/SPW-02/proofs/rhiny-rozeul-front-right-talk-interact-v4.json
node work/SPW-02/proofs/verify-v4-native-structure.mjs work/SPW-02/native-v4-delivery/rozeul.spine work/SPW-02/proofs/structure-audit-v4-native/rozeul.json
node work/SPW-02/proofs/verify-v4-native-keychange.mjs
node work/SPW-02/proofs/verify-final-native-structure.mjs
node work/SPW-02/proofs/verify-native-keychange.mjs
node work/SPW-02/proofs/verify-native-direct-compare.mjs
```

## 后续验收边界

当前是同一方向两动作的**部分迁移技术结果**。来源发丝、衣摆、尾巴、长武器、不同拓扑网格 deform 和来源 drawOrder 等多数通道按报告明确跳过；v4 city 的三键层序属于目标专用修正。12/13 条需校准通道仍需针对目标骨架、右臂、头肩、手骨继承和脚步接地检查。v4 原生导回、代表时点层序和独立改键持续性均已验证。请在 Spine 编辑器连续播放，重点查看 `city/interact` 0.15–0.2167 秒手/袖衔接及 `common/talk1` 的多次抬手节奏，并由用户作最终视觉审阅。代表帧和自动结构检查不足以宣称动作美术成品通过，也不覆盖其他方向或其他角色。
