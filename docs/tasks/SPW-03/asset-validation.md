# SPW-03 真实角色分析与两动作验证

日期：2026-10-25。此页记录本地真实工程的证据和未通过项。角色素材、原生工程、分析包与返回数据均保存在忽略的 `work/SPW-03/`，未提交到公开仓库。

## 实际输入与冻结基准

来源为用户指定 `rozeul.spine` 的 `rozeul` 骨架、`default` skin，169 骨、88 槽、41 约束、110 动作；SHA-256 为 `0103b0a6d2f2a419c4453da5cd15f3aefbaf3bd9df7b9427f5fbbbc0edb5648d`。由本机官方 Spine 4.3.26 只读导出，分析采用官方 4.3.13 runtime。

目标为用户指定 `芙雷茜娅.spine` 的 `FREYCIA` 骨架、`default` skin。本轮初始导出为 135 骨、57 槽、8 约束，SHA-256 `193d174573323c39d9667f6e4f4a566d82f0e3b9a75d59be0f919c86603a7f14`。验证期间目标被外部保存为 `da1eef11623169fd6556a541f185a276814f85f176267307435d5937707b3f5e`，重导出为 135 骨、48 槽、8 约束；随后又观察到 `ec3ac55a3912c1f891b1d9689f99518bf1a0ee8e13e21afa38c437d79a1c97f9`。两次旧基准均被 SHA 检查拒绝，没有把旧提案当作当前原工程结果。

为允许用户继续编辑，本轮后续验证使用保存的 `da1eef…` 原生字节，复制为稳定工作副本 `work/SPW-03/frozen-target/芙雷茜娅.spine`，配套复制 44 个图片文件约 2 MB。该副本重新经官方只读导出，几何与目标当前制作进展的区别有记录。后续的“输入未变”均指来源工程和这个冻结副本，不能解释为用户持续编辑的母版未变。详见：

- `work/SPW-03/intake.json`：现行工作副本路径、`originalPath`、哈希和官方导出路径。
- `target-change-observation.json`：两次外部变化与拒绝观察。
- `intake-before-target-change-193d1745.json`、`intake-live-export-da1eef11.json`：旧基准完整保留。
- `frozen-target/snapshot-origin.json`：冻结副本与原路径的来源关系。

## 方向分支与人体主链

来源选 `flip` 分支，人体锚 `centroid`，控制参考 `flip`；方向标签 `rozeul-Z` 沿用项目附件前缀，不声称已识别相机方向。目标只选无后缀入口 `侧正面`，人体锚 `侧正面-Pelvis`，控制参考 `侧正面-RootPosition`。这个控制参考不是已证明的脚底接地点。

目标选定分支有 67 骨、26 槽、2 腿 IK 与 2 胸部变换约束；另有 `正面` 分支 67 骨、7 槽，以及 15 个直接绑定全局 root 的正面美术槽。不能声称五方向均已完成绑定。选择范围包括所选分支和只用于计算的祖先：来源 157 骨，目标 68 骨；没有授权额外共享控制骨。

官方 runtime 的目标 `侧正面` 设置世界点约 `(3500.0001,-3499.9999)`，全局 root 约 `(0,6.9971)`，身体锚约 `(3557.607,-3025.4723)`。来源身体锚约 `(68.8311,536.6812)`。比较使用固定设置姿势身体参考系，不移动原工程、不抹去动作真实位移。身体尺寸只由主身体和肢体骨测量，排除长控制线与跨方向布局骨：来源约 `768.6748`，目标约 `832.4009`。

AI 提案以真实名称、父链、可见槽绑定和实际打键为依据。8 项全部为 `proposed`，接受其中 7 项，头仍待审阅：

| 来源 | 目标 | 状态 |
| --- | --- | --- |
| `flip` | `侧正面-RootPosition` | 接受为本方向整体控制；两条正式动作没有该骨直接打键 |
| `centroid` | `侧正面-Pelvis` | 接受，躯干入口 |
| `body` | `侧正面-Spine1` | 接受，实际身体打键 |
| `chest` | `侧正面-Spine2` | 接受，实际胸段打键 |
| `[GREEN]head` | `侧正面-Head` | 暂缓；设置世界轴约相差 91° |
| `Larm1` | `侧正面-UpperArmL` | 接受，上臂/肩端 |
| `Larm2` | `侧正面-LowerArmL` | 接受，肘到腕 |
| `Lhand` | `侧正面-HandL` | 接受，手腕 |

源左臂链为 `chest → Z/Z_Larm1 → Larm → Larm1 → Larm2 → Lhand`；目标为 `Spine2 → ShoulderR → ShoulderL → UpperArmL → LowerArmL → HandL`。两源肩辅助不能同时占到一个目标肩骨，故未提议硬接肩辅助。源 `Larm` 父轴约 90°，目标 `ShoulderL` 约 -10.2757°，上臂平移不是直接等价。手长约 120.972/53.392，腕轴也不同，保留需校准报告。

来源右臂存在 `Rarm_ik → [#4E9FE8]body2`，`common/talk1` 首尾 mix1、中段 mix0，`run` mix0.005；目标两臂均为 FK。因此本轮未把来源右臂 FK 键当作已求值世界运动搬到目标，也未伪造 IK→FK 转换。源 `Lhand` 对排除的武器支的变换跟随不会把手腕误判成专用控制器。

## 工坊实际导出与 AI 回传

最终分析包 ID 为 `spw-5d9c872911f73102`。实际工坊隐藏 UI 生成的交付分析目录：

`work/SPW-03/ui-output/SPW-AI-Analysis-spw-5d9c872911f73102-c111717e/`

读取此目录的真实任务书、角色数据、50 帧来源采样、候选和通道审计后，写回 `mapping-proposal.json`、`rig-hints.json`、`analysis-report.md`。返回身份、参考选择和证据 ID 来自实际包；严格校验得到 8 个可审阅候选、6 项 unresolved。`final-analysis-pointer.json` 指向该 UI 目录，`ui-analysis-roundtrip-validation.json` 记录回传文件 SHA。

与同输入 Node API 导出对照，10 个生成文件中 4 个 SHA-256 逐字节一致；manifest 与任务书的选择字段顺序不同，角色/动作/候选数字有 Node 与 Electron runtime 的末位差：3871 处数值不同，最大绝对差 `4.547473508864641e-13`，非数值语义差 0。包 ID、输入身份、选择值一致。这里没有把“相同 ID”写成“所有文件字节一致”；详情在 `api-ui-comparison-detail.json` 与上述 UI 校验记录。

## 真实两动作与跨进程复用

`verify-config-reload.ts` 重新读取官方导出原文、重建分析身份、严格校验返回 JSON，接受候选 ID `0,1,2,3,5,6,7`。映射保存为 `rozeul-freycia-side-front.spw.json`，保留 `reviewed-ai`、bundle ID、语义角色、证据 ID 和头候选未接受状态。

第一条使用当前进程生成 `common/talk1`；随后启动独立 Node 进程，重新读保存配置并验证身份、接受列表和映射逐项不变，直接切换第二条 `run`。未重新逐骨配对。

| 来源动作 | 时长 | 真正复制 | 其中直接/需校准 | 未迁移 | 目标左手世界范围 X/Y |
| --- | ---: | ---: | --- | ---: | --- |
| `common/talk1` | 3 s | 9 通道 | 5 / 4 | 103 | 331.5211 / 174.4410 |
| `run` | 0.8 s | 8 通道 | 5 / 3 | 128 | 434.9143 / 350.2810 |

每条候选用官方 runtime 检查 25 个时点，身体、上臂、前臂和手腕均有实际动画轨道，世界矩阵为有限值；全局 root 和另一方向入口保持不动。移除新增动画后，完整目标 JSON 与冻结原导出在结构上相等；原有非空 `animation`、骨架、皮肤与约束均保留。没有为这两条草稿关闭目标腿 IK，头没有新轨道。

`run` 只交付身体与左臂摆动技术草稿，腿、右臂、头发、衣物、武器和来源显示顺序未迁移，不能称为完整跑步成品。未自动增加腕轴修正；首次局部修正和连续播放审美验收仍待人工观察。证据：

- `config-reload-validation.json` 与 `config-reload-child.json`：不同进程 ID、保存配置 SHA、映射 provenance、7 项接受及头暂缓。
- `persisted-drafts/common_talk1/`、`persisted-drafts/run/`：完整预览 JSON、逐通道报告与 runtime 样本。
- `runtime-evidence.json`、`recommended-selections.json`：M0 独立 runtime 调查和最终参考选择；M0 文件的初始目标调查属于旧快照，最终身份以 manifest/intake 为准。

## 原生导入准备及未验收项

`prepare-native-drafts.ts` 调用产品现有 `prepareNativeHandoff`，已准备两条结果：

- `work/SPW-03/native-handoff/common_talk1/`
- `work/SPW-03/native-handoff/run/`

每个目录有完整 `target-project/芙雷茜娅.spine` 和相对图片、单动画 `_internal/animation.spine`、`calibration.spw.json`、`analysis-metadata.json`、逐通道报告及导入说明。两个目标工程都是冻结目标原生字节的完整副本，尚未包含新动画；状态为 `awaiting-editor-import`。

官方载体往返保留身体骨名称、父链和设置几何；talk1 动画键没有差异，run 有 3 个 Bezier 曲线时间控制数字从 `0.7538314` 变为 `0.7538313`，最大差约 `1e-7`。产品回读检查只对本次新增动画的数值曲线数组允许 `1e-6` 内的官方序列化差异，关键帧时间/值、旧动画和骨架继续严格比较。完整载体还有图标元数据及网格权重排列变化，不能用重建的载体代替原目标副本；目标完整副本仍逐字节相等。原始差异保存在各自 `carrier-animation-differences.json`，完整载体差异首轮另行保留。

本轮没有操作 Spine GUI 确认导入、保存重开或修改关键帧，也没有调用已导入验证冒充成功。`native-handoff-validation.json` 明确为 `prepared-not-imported`。用户仍需在官方编辑器向完整目标副本导入指定动画，随后连续播放检查肩位移、手腕/遮挡、身体与腿的关系，再做新增动作精修。

技术通过的范围是实际中文角色分析包、可验证返回数据、身体与左臂非零迁移、跨进程映射复用及原生载体准备。局部姿态校准、完整动作效果、编辑器导回保存重开和用户视觉验收仍未完成。
