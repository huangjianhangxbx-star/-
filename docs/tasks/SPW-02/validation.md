# SPW-02 验证记录

日期：2026-10-25（北京时间）。正式来源为 `rhiny`，目标为 `rozeul`；两条实际来源动作改定为 **`city/interact` 与 `common/talk1`**。输入身份与原工程 SHA-256 见 [intake.md](./intake.md)，骨链及逐通道处理见 [mapping-audit.md](./mapping-audit.md)。原始 `.spine` 工程只读，所有导出与候选位于 Git 忽略的 `work/SPW-02/`。

## 当前验收状态

| 项目 | 状态 | 证据与限制 |
| --- | --- | --- |
| 两个真实角色、一个画法方向、两条不同来源动作 | 已核实 | rhiny 原工程为 3.8.99，rozeul 为 4.3.26；均用本机官方 4.3.26 编辑器重新只读导出。`city/interact` 0.666667 秒为短促伸手；`common/talk1` 4 秒为反复抬手谈话，两者同为正面偏右的 `default` skin。 |
| 同一类型映射和逐通道决策 | v4 已核实，含待校准通道 | 一份 v4 配置含 35 个类型化对象映射和 187 条显式策略，两个 job 只换动作、范围与输出名。`city/interact` 196 条来源通道：10 直接对应、12 需要目标校准、174 显式跳过、0 阻塞；`common/talk1` 195 条：7 直接对应、13 需要目标校准、175 显式跳过、0 阻塞。**需要目标校准的键已复制入候选，但不计作直接兼容。**显式跳过也不计作已迁移。 |
| v4 目标专用层序修正 | 已通过 JSON、官方 runtime、便携应用和原生导回验证 | `city/interact` 另有目标专用 drawOrder 三键：0 秒手/袖前置，0.18333334 秒仅手前置，0.21666667 秒恢复目标默认。偏移针对目标 88 槽确定，来源 68 槽 drawOrder 仍明确跳过；`common/talk1` 不加此修正。原生重导将首键 `time: 0` 规范化为省略字段，官方 runtime 在 0/0.15/0.184/0.2167 秒核对的 88 槽顺序与候选完全相同。 |
| 官方 Spine 4.3 runtime 求值及目标旧数据保护 | 已核实，限完整 JSON | 两条 v4 候选各有完整 `rozeul.json`/atlas/PNG。官方 `@esotericsoftware/spine-webgl` 4.3 runtime 可解析并在代表时点求值。生成器逐一验证删去新增动画后，目标 JSON 与原 4.3 导出深度相同；原有 110 条动画、skin、骨架、附件和约束没有被候选写入改动。原生导回另见下文独立审计。 |
| 主要身体与手臂动作外观 | 代表帧候选成立，完整视觉验收未完成 | `city/interact` 的左手伸出/收回、袖/手切换及 v4 前段层序可见；`common/talk1` 的抬手与张手、恢复可见。两条动作均将来源 `YOU IK mix:0` 写给目标 `Rarm_ik` 后迁移右臂 FK；脚 IK 有效时明确跳过腿 FK，目标保持站姿。右臂局部角、手骨继承、根/肩锚和头部仍由报告标记 `needs-calibration`。隐藏 runtime 静帧未见明显断臂，但不能代替编辑器连续播放和用户审阅。来源长发、衣摆、尾巴、长武器、网格 deform 与来源 drawOrder 未迁移。 |
| 在原目标 `.spine` 工作副本中导回两条、保存重导、独立改键 | v4 已通过结构、层序语义及改键持续性审计 | v4 原生目标副本经官方 CLI 重导仍为 110→112 动画；原 110 条与除 `skeleton.hash` 外的目标结构不变。talk 新动画与候选完全相同，city 仅首个 drawOrder `time: 0` 被编辑器省略，runtime 层序一致。独立 v4 副本在 Spine GUI 插入第 12 帧左臂旋转键，保存后由官方 CLI 重读，除该键和元信息哈希外与交付副本完全相等。 |
| 桌面工坊真实操作与 v4 便携包 | 已通过隐藏应用流程；人工视觉审阅待完成 | 0.2.0 v4 便携 EXE 隐藏启动、载入素材及配置、真实 UI 定位 city 0.1/0.2 秒、保存两个动作、保存配置并跨进程重开均通过；第二动作追加到前一完整 JSON 输出，city 三键层序保留。检查不等于用户逐帧观看。 |

`run` 是被淘汰的初选动作，不列入正式验收。来源活动右臂 IK 控制路径与目标持械结构不匹配；目标原生 `run` 补层虽改善目标视觉摆动，却不是来源通道迁移，而且源腿步幅和朝向仍不足。旧 v2 配置、`candidate-run/`、`candidate-run-hybrid/` 及试验截帧仅作为研究证据保留；v3 候选和便携证明继续保留作 v4 修正前对照，当前正式完整 JSON 结果以下列 v4 文件为准。

## 正式证明文件

| 文件 | 作用 |
| --- | --- |
| `work/SPW-02/proofs/rhiny-rozeul-front-right-talk-interact-v4.json` | 当前共享角色映射及 city 目标专用层序三键；SHA-256 `ea84927878ae7145ab982d2582b7bd4ab6706ca56d7a8b92afa930261a92a440`。 |
| `work/SPW-02/proofs/report-v4-city_interact.json`、`report-v4-common_talk1.json` | 逐来源通道的目标、状态、原因、键数与汇总；目标专用 drawOrder 另列 warning，不计入来源迁移数。 |
| `work/SPW-02/proofs/candidate-v4-city_interact/`、`candidate-v4-common_talk1/` | 各含完整目标 JSON、atlas、PNG；**完整目标 JSON 不等于完整动作已迁移**。 |
| `work/SPW-02/proofs/v4-talk-interact-manifest.json`、`make-v4-talk-interact.mjs` | 从保存的 v4 配置重建报告、候选与哈希，校验原目标数据未被重写。 |
| `work/SPW-02/proofs/portable-v4-validation.json`、`run-portable-v4.mjs` | v4 便携包隐藏 Electron 三次真实 UI 流程、应用资源哈希、配置跨进程复用、双动作连续输出及原素材前后哈希。原始日志在 `portable-v4-*-out.txt`。 |
| `work/SPW-02/proofs/v4-native-structure-result.json`、`verify-v4-native-structure.mjs`、`v4-zero-time-runtime-result.json` | v4 两动作保存到目标原生工程、独立 CLI 重导，与候选及原目标结构对照；零时刻层序规范化在官方 runtime 下的语义对照。 |
| `work/SPW-02/proofs/v4-native-keychange-audit-result.json`、`verify-v4-native-keychange.mjs` | v4 独立原生工程副本中改键、保存后由官方 CLI 重读，完整 JSON 仅增加指定旋转键并更新 `skeleton.hash`。 |
| `work/SPW-02/proofs/structure-audit-result.json`、`verify-final-native-structure.mjs` | v3 两动作保存到目标原生工程后与原目标、v3 候选的历史 CLI 回导结构审计。 |
| `work/SPW-02/proofs/native-keychange-audit-result.json`、`verify-native-keychange.mjs` | v3 独立原生工程副本中改键、保存重开后的官方 CLI 回导对照。 |
| `work/SPW-02/proofs/native-direct-compare-result.json`、`verify-native-direct-compare.mjs` | 不经工坊映射的来源同名动画直接导入目标原生工程后的独立对照。 |
| `work/SPW-02/proofs/portable-v3-validation.json`、`rhiny-rozeul-front-right-talk-interact-v3.json` | v4 前的便携包与配置历史证明，完整保留。 |

目标候选的官方 runtime PNG 位于 `work/SPW-02/proofs/`：v4 city 的 `candidate-v4-city_interact-spw02_rhiny_city_interact_front_right-{0,0.15,0.1667,0.1833,0.184,0.2166,0.2167}.png` 与 v4 talk 的 `candidate-v4-common_talk1-spw02_rhiny_common_talk1_front_right-1.5.png`；v3 其余代表时点帧仍保留作对照。来源相应动作的部分代表帧位于 `work/SPW-02/asset-audit/` 与 `work/SPW-02/proofs/source-common_talk1-*.png`。渲染使用 Electron 44.5.1 隐藏窗口和现有 `Spine43Preview`，没有接管桌面鼠标。

## 桌面与便携包验证

当前 v4 便携包为 `E:\SPW-02-release\xinghai-spine-animation-workshop-0.2.0-v4-win-x64\`，可执行文件是其中的 `星骸 Spine 动画工坊.exe`。`resources/app` 全文件组合 SHA-256 为 `5a26fa8cb785449bc9d812455486b3c1e07fb6f468cc300d512033f2bbe7dae7`，`resources/app/dist/spine-app.js` SHA-256 为 `53170c997442046e8f2f0dc4cf55e131290fbf488c67a6b9a6580987e387c4f4`；EXE 本体 SHA-256 为 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`，与旧包相同，单凭它不能识别 v4 内容。包内不含用户角色素材。隐藏 Electron 窗口完成启动、来源/目标/配置导入、两侧预览与时间轴、生成、保存；city 时间轴实际定位到 0.1/0.2 秒并确认无预览错误，未接管桌面鼠标。`city/interact` 运行时在应用内保存 v4 配置，退出后新进程打开同一配置并生成 `common/talk1`，配置 SHA-256 与原 v4 配置相同，35 个角色对象映射保持一致。两个动作各自保存为包含完整目标 JSON、atlas、PNG、配置及报告的独立输出目录。

随后应用打开第一次保存的 `city/interact` 完整 JSON 作为目标，追加 `common/talk1` 并再次保存。最终 JSON 含原有 110 条加两条新动画，共 112 条；v4 city 三键层序在追加后保持。两份独立输出的 JSON SHA-256 与各自 v4 正式候选逐字节相等。删除两条新动画后，目标 JSON 与原始导出深度相等；目标 atlas/PNG 与原输入 SHA-256 相同；来源、目标、v4 配置和原始 `.spine` 前后 SHA-256 一致。此项验证的是**完整 JSON 的连续输出**，不能用它代替 v4 原生 `.spine` 工程验证。详细输出目录、三次应用 exit code、资源哈希及保护指纹见 `portable-v4-validation.json`；运行脚本为 `run-portable-v4.mjs`。程序测试 101 项中 92 通过、9 跳过、0 失败；类型检查及构建通过。旧 v3 包与 `portable-v3-validation.json` 保留作对照。

## 原生工程导回与改键审计

当前 v4 的两条新动画已导入同一个隔离目标工程 `work/SPW-02/native-v4-delivery/rozeul.spine` 并保存。官方 Spine 4.3 CLI 独立重导至 `work/SPW-02/proofs/structure-audit-v4-native/rozeul.json`；`verify-v4-native-structure.mjs` 比较得原目标 169 骨、88 槽、41 约束、`default` skin、110 动画，v4 副本同数骨/槽/约束/skin、112 动画，原 110 动画逐一相等，其他原结构仅 `skeleton.hash` 元信息改变。`common/talk1` 新动画与 v4 候选完全相同；city 唯一 JSON 差异为第一个 drawOrder 键省略显式 `time: 0`。官方 4.3 runtime 读取省略值为 0，在 0、0.15、0.184、0.2167 秒核对的全部 88 个槽位顺序与 v4 候选逐一相同。原生副本 SHA-256 `C09D93663AE90848C71E40904EF665B8CA8EF37B80648259ED92394B547A5773`，原始来源与目标 `.spine` SHA-256 保持输入值。证据见 `v4-native-structure-result.json`、`v4-zero-time-runtime-result.json`。这项技术审计不代替编辑器连续播放和用户视觉审阅。

另从 v4 交付工程复制独立的 `work/SPW-02/native-v4-edit-proof/rozeul.spine`，在官方 Spine GUI 中给新增 `city/interact` 的 `Larm2.rotate` 第 12 帧（0.2 秒）插入旋转键 `17.395506` 并保存。官方 CLI 随后重新读取该 `.spine` 并导出 JSON。`verify-v4-native-keychange.mjs` 完整深度比较：该时间线 8→9 键；去除唯一新增键、还原编辑器更新的 `skeleton.hash` 后，全部导出数据与 v4 交付工程相等，`common/talk1` 与旧 110 条动画未受影响。独立改键副本 SHA-256 `285F92CBA070BBB59307DBB1CE2451631B893486D92B712E3A50A225E167CC91`；结果见 `v4-native-keychange-audit-result.json`。

先前 v3 的独立原生审计见 `work/SPW-02/proofs/structure-audit-result.json`：两动作键与曲线和 v3 候选相等，原目标旧数据保留。它是 v4 层序修正前的历史对照。

另复制 v3 交付用原生工程到 `work/SPW-02/native-edit-proof/rozeul.spine`，在官方 GUI 打开 `spw02_rhiny_city_interact_front_right`，于 `Larm2.rotate` 第 12 帧（0.2 秒）插入值 `17.395506` 的旋转键，Ctrl+S 保存，关闭重开后由官方 CLI 重新导出。该时间线从 8 键变为 9 键。`verify-native-keychange.mjs` 对两份重导的完整 JSON 深度比较：去除该唯一新增键并还原编辑器 `skeleton.hash` 后完全相等；另一个新增动作及旧 110 条动画均未改变。v3 交付用原生副本与独立改键副本的 SHA-256 分别为 `D351FFA822A37074A75A80A44F26F123C6EF1F07C75BFE7437A5B44D97BC8185`、`6CF128180E5330ED5AB2005B3DE82B9022B6E4B32D705F9908E196F095768282`。结果见 `work/SPW-02/proofs/native-keychange-audit-result.json`。这证明 v3 新动画在原生工程副本内仍可编辑，不替代对实际动作观感的审阅。

官方 GUI 的原生直接导入对照另从干净 `rozeul` 工作副本导入未映射的来源 `city/interact`：大量异名骨骼报 `Bone not found`，包括 `hips12`、`hips13`、`hips10` 等；保存后官方 CLI 重导的新动画仅剩 `body3d2.translate` 的 7 键。旧 110 动画及其余结构保持，只有 `skeleton.hash` 改变。证据见 `work/SPW-02/proofs/native-direct-compare-result.json`。该结果说明直接导入不能替代本轮异名映射与目标专用修正。

## 分时点观察与质量边界

- `city/interact`：来源 0.15→0.1667 秒前臂旋转有急促跳变，目标复制后也发生同一节奏；到 0.2167 秒左手伸出、0.4 秒保持、0.66 秒收回。目标袖和手附件真实切换。v4 在 0、0.18333334、0.21666667 秒加入目标专用层序键，使早期手/袖依次位于胸甲前、仅手在前、恢复默认；来源 4 帧 drawOrder 仍未按 68→88 slot 强行套用。官方 runtime 的 0.1667/0.1833/0.184/0.2166/0.2167 秒帧及便携 UI 的 0.1/0.2 秒 seek 可见并可求值，但瞬间遮挡过渡仍待编辑器连续播放和用户审阅。
- `common/talk1`：0 秒静止、0.17 秒开始张手、0.7/1.5/3 秒可见反复抬手谈话姿态、4 秒返回。v4 未加目标层序键，1.5 秒渲染与 v3 一致。来源右臂在此动作相对稳定，目标右手保留现存美术；目标 `Z/Z_Lhand2` 的张手形状有其原生 `common/give_start` 作为语义旁证。来源身体/头部轻微起伏可见，但长发、衣摆、尾巴和武器视觉没有跟随来源。
- 两动作的脚部维持目标脚 IK，因此报告明示跳过了源腿 FK；这适用于原地手势动作，不能推广为跑步或位移动作的腿迁移完成。目标局部轴及继承差异带来 12/13 条 `needs-calibration`，即使静帧可接受，也须在 Spine 编辑器检查节奏、头肩位置、双手局部动作和脚滑。

## 复核与尚待完成

在 `E:\WORLDCREATOR\XingHaiHuiLang\Origin\work\SPW-02\checkout\自制工具\spine_animation_workshop` 运行：

```powershell
node --import tsx ..\..\work\SPW-02\proofs\make-v4-talk-interact.mjs
Get-Content -Raw -LiteralPath '..\..\work\SPW-02\proofs\report-v4-city_interact.json' | ConvertFrom-Json | Select-Object -ExpandProperty totals
Get-Content -Raw -LiteralPath '..\..\work\SPW-02\proofs\report-v4-common_talk1.json' | ConvertFrom-Json | Select-Object -ExpandProperty totals
```

v4 便携包流程的命令与日志见 `work/SPW-02/proofs/run-portable-v4.mjs`、`portable-v4-validation.json`。它使用 `E:\SPW-02-release\xinghai-spine-animation-workshop-0.2.0-v4-win-x64\` 中的 EXE，三次隐藏启动均 exit 0。v4 原生工程、层序语义和独立改键均已重导审计。下一步须连续播放核对 0.15–0.2167 秒的手/袖遮挡、`common/talk1` 的反复手势、右臂及脚部接地；最终请用户作视觉审阅。两动作均有 `needsCalibration` 通道及大量显式跳过，不能据技术流程成功写成完整动作迁移或美术验收通过。
