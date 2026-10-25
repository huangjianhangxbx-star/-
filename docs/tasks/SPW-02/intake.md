# SPW-02 输入核对与原生对照基线

日期：2026-10-25（北京时间）。本文件记录真实素材现状与本轮选择；实际迁移、导回和验收结果另见 `validation.md`。原始角色文件只读，以下所有导出、截图和编辑器操作均使用 Git 忽略的 `work/SPW-02/`。

## 角色对与文件身份

| 身份 | 原始工程 | 当前工程版本与内容 | 原件 SHA-256 |
| - | - | - | - |
| 来源 A：rhiny | `E:\1画画\星骸回廊\rhiny\rhiny.spine` | 工程为 Spine **3.8.99**，单骨架 `rhiny`，235 bones、68 slots、89 animations；原 `rhiny.skel/.atlas/.png` 是 2026-03 的旧导出，本轮以当前工程重新导出。 | `EA056458D07FD7230080D4703DC367F572E74A2BB1DDA2E94C2EC35B8CBA7757` |
| 目标 B：rozeul | `E:\1画画\星骸回廊\rozeul\Models\rozeul.spine` | Spine **4.3.26**，单骨架 `rozeul`，169 bones、88 slots、110 原有 animations。 | `0103B0A6D2F2A419C4453DA5CD15F3AEFBAF3BD9DF7B9427F5FBBBC0EDB5648D` |

本机 `E:\Spine\Spine.com` 启动的编辑器为 **4.3.26 Professional**。从两个原工程用官方 CLI `-e json+pack` 只读导出后，两份新 JSON 的 `skeleton.spine` 均为 **4.3.26**，与现有官方 `@esotericsoftware/spine-webgl=4.3.13` runtime 同为 4.3。rhiny 的 3.8→4.3 是编辑器实际读取并重新导出；没有手改 JSON 版本字段。来源原 `.spine` 工作副本仍须在 4.3 GUI 中保存并重开，以核对原生编辑器迁移。

| 角色 | SPW-02 独立导出路径 | JSON / atlas / 页面 SHA-256 |
| - | - | - |
| rhiny | `work/SPW-02/asset-audit/rhiny/{rhiny.json,rhiny.atlas,rhiny.png}` | `BF2B6CC55F376D0D93F3F84E8AC1AE726D4BE6818362119B68CD193213365B61` / `3A332DFA4F2BCEF1141652275D71D6F4C59E0B0AE884F40528DE7C6A689A7217` / `CB034A05AFD36FD5445E6F04B63E5EC6092DE29E716A9DD30190C3E93DC2812D` |
| rozeul | `work/SPW-02/asset-audit/rozeul/{rozeul.json,rozeul.atlas,rozeul.png}` | `EE73CA86C9113BB181C4B30E203E4E08C83622D68C4F5C7124C61E022256FB44` / `ECE86DDC4F5C390183312A1EC056EA1BD5AB54989FBE071FAC76ECA98A6E4B4A` / `F7A786CBABA4BA126475B89DD60E8ED9DFA58E558F111BCDFDDB4CB4CE7C1200` |

两者导出均只有 `default` skin。rhiny JSON 有 23 个 constraints（4 IK、18 transform、1 path）；rozeul JSON 有 41 个（5 IK、36 transform）。本轮不把 `rhiny.skel` 或 `rozeul.skel` 当成当前工程的格式证据。原工程复制前后指纹一致；可供集中原生导入对照的工程副本为：

- `work/SPW-02/native-baseline/source-rhiny/rhiny.spine` 与相对 `images/`（87 文件）；副本 `.spine` SHA 与来源原件一致。
- `work/SPW-02/native-baseline/target-rozeul/rozeul.spine` 与相对 `images/`（127 文件）；副本 `.spine` SHA 与目标原件一致。

## 对应方向与候选筛选

rhiny 没有独立命名的“方向显示动画”；`default` skin 的实际可见绘制是正面略向画面右侧的三分之四视角。rozeul 当前可见美术为 Z 系，设置姿势也是正面略向画面右侧。使用工坊已锁定的官方 Spine 4.3 runtime 在隐藏 Electron 窗口渲染，两个角色的设置姿势以及 `city/interact`、`common/talk1` 的代表帧保持这个画法方向。来源截图位于 `work/SPW-02/asset-audit/rhiny-city_interact-*.png` 与 `work/SPW-02/proofs/source-common_talk1-*.png`，目标正式候选截图见 `work/SPW-02/proofs/candidate-final-*.png`。最终视觉审阅仍以目标编辑器中的连续播放为准。

同目录另有真实 `E:\1画画\星骸回廊\小蓝\xl.spine`，当前 4.3.26，包含 776 bones、494 slots、138 animations 的 `unit` 骨架与一个 1 bone 空 `skeleton`；五方向放在单个大型骨架，`方向_下` 通过平移 `下` 根骨定位画面。其当前导出在 `work/SPW-02/asset-audit/xl/{unit.json,xl.atlas,xl.png,xl_2.png}`，原工程 SHA `CEA88B22BD2C1539AEF081D0FA0B76720B3A0AC6F6C22ED779430049B22F3196`。`小蓝\新建文件夹\unit.json` 是 4.1.23 旧导出，早于 2026-10-24 的 `xl.spine`，不使用。小蓝的单方向手臂主要为两节、动作跨多方向大量打键；相较之下 rhiny 与 rozeul 的左臂三节、画法和原动画语义更接近。本项目 `角色/` 下另外七个非 effect `.spine` 工程经 CLI 核对均为 3.8.86，不是现成的 4.3 来源。

## 正式两动作与必要通道

| 来源动作 | 时长 | 实际身体与手臂键 | 非骨骼/显示依赖 | 目标原有同名动画 |
| - | - | - | - | - |
| `city/interact`（第一条） | **0.666667 秒** | 166 个源骨骼打键。左臂 `hips11.rotate` 7、`hips12.rotate` 8（另 translate 3、scale 4）、`hips13.rotate` 9（另 translate 3）；右臂 `hips8/hips9.rotate` 各 6；`YOU IK` 在 0 秒明确 `mix:0`，右臂 FK 有效。截图可见从胸前伸手再收回。 | 4 slots、3 deform slots、4 draw order、9 transform constraint timelines、`YOU IK` timeline，无 events。`a_leftarm` 在 0 秒切 `a_leftarm3`、0.1833 秒回原；`a_lefthand` 在 0 秒切 `hand5`、0.2167 秒切 `hand7`、0.5667 秒回原。 | **无**，是目标新增的实际动作。 |
| `common/talk1`（第二条） | **4 秒** | 168 个源骨骼打键。左臂 `hips11.rotate` 9、`hips12.rotate` 8、`hips13.rotate` 13（另 translate 7），手随说话姿势反复抬起；右臂有设置姿势键且 `YOU IK` 在 0 秒明确 `mix:0`。双腿由原有脚 IK 保持站姿。 | 3 slots、2 deform、1 draw order、9 transform constraint timelines、`YOU IK` timeline，无 events。`a_lefthand` 在 0.1667 秒切张手 `Z_Lhand_zhang`，3.5667 秒恢复；目标现有 `Z/Z_Lhand2` 与目标原生 `common/give_start` 的张手用法相符。 | **有**；迁移结果使用新名字，不覆盖目标原 `common/talk1`。 |

两动作均使用 rhiny 的同一个 `default` skin 与同一视向，不借助方向显示动画。`city/interact` 的短促伸手和 `common/talk1` 的较长反复谈话手势具有不同节奏，并在同一套角色映射下生成。曾试选 `run`：源右臂采用活动 IK，而目标持械结构、视向和腿部跑姿均不相称；目标原生 `run` 补层只是目标动画本身，不能计作源迁移。该试验保留在忽略目录作淘汰证据，不属于正式两动作。

## 控制链对应与修正边界

| 功能 | rhiny 来源实际入口 | rozeul 目标实际入口 | 当前判断 |
| - | - | - | - |
| 躯干与肩锚 | `hips5`→`hips6`→`hips7`，左肩锚 `hips49`、右肩锚 `hips48` | `body`→`chest`，左臂入口 `Z/Z_Larm1`→`Larm`、右臂入口 `[#4E9FE8]chest_2`→`Rarm` | 名称与父层不同；需要参考姿势的局部/世界关系校准，不能只改名复制平移。 |
| 左上臂、前臂、手 | `hips11`→`hips12`→`hips13`；图像 slot `a_leftxiuzi`→`a_leftarm`→`a_lefthand` 分别在三节上 | `Larm1`→`Larm2`→`Lhand`；目标 Z slot `Z-Z_Larm1`→`Z-Z_Larm2`→`Z-Z_Lhand1` | 明确的同侧三节 FK 链。来源 setup 局部角约 -164.56°、-1.40°、+15.79°，目标约 -160.58°、+0.16°、+17.33°；长度来源 185.5/148.5，目标 199.5/188.3。手骨来源 `inherit=noScale`，目标默认继承，需检查缩放通道。 |
| 右上臂、前臂与控制 | `hips8`→`hips9`→`hips36`，`YOU IK` target `hips10`，来源 setup `mix=0` | `Rarm1`→`Rarm2`→`Rhand`，`Rarm_ik` target `[#4E9FE8]body2`，目标 setup mix 默认为 1 | 两条正式动作的来源 `YOU IK` 均从 0 秒明确 `mix:0`，迁移到目标 `Rarm_ik` 后右臂 FK 才有效。已在目标 4.3 runtime 代表帧中检查右臂形状。被淘汰的 `run` 省略 mix 的键在 4.3 runtime 读为 mix1，其 IK 目标轨迹不在正式映射范围。 |
| 腿与脚 | `leftfoot` 控 `hips25/hips38`，`rightfoot` 控 `hips42/hips43`；两条正式动作没有关闭脚 IK 的键 | `LlegIK_hips` 控 `Lleg1/Lleg2`，`RlegIK_hips` 控 `Rleg1/Rleg2`，目标 IK setup 有效 | 两条动作是原地站立手势；源与目标脚 IK 均有效。源腿 FK 键若直接拷入会被目标 IK 覆盖，故按动作显式跳过并保持目标接地姿势。胸/根细小位移仍迁移。 |
| 附件 | `city/interact` 的 `a_leftarm`、`a_lefthand` 选源袖和手形；`hand/hand4` 涉及源武器手形 | `Z-Z_Larm2` 有 `Z/Z_Larm2` 与 `_1`；`Z-Z_Lhand1` 有 8 种目标手形 | 目标存在候选，但对应哪一张需在目标图像上目视选定。绝不复制来源贴图或凭名称强配；未映射必要显隐时该动作不得算完整。 |

来源与目标骨骼只有 `root`、`hips`、`body3d2`、`name` 四个完整同名，且不代表这四个都语义可用。两个角色共有 65 个**动画名**是制作语义线索，不是骨架同构证明。关键链必须手工核对后保存角色映射。来源 `city/interact` 有袖和手形切换及遮挡变化；`common/talk1` 有张手与恢复键。源网格 deform（眼/左袖/武器手）因拓扑和美术不同列为排除项。源 draw order 是基于 68 个 slot 的偏移，不能套到目标 88 个 slot；v4 为 city 单独添加三个目标 88 槽层序键，talk 保持目标默认层序，目标绑定和已有动画不改。来源长发、衣摆、尾巴及长武器视觉没有迁移，最终动作外观仍须在目标编辑器审阅；逐通道依据见 [映射审计](mapping-audit.md)。

## 原生动画导入对照结果

本机 `Spine.com -h` 的 `Import` 只提供 **skeleton import**，没有 animation import CLI 参数。因此在另一组隔离副本 `work/SPW-02/native-direct-compare/{source-rhiny,target-rozeul}/` 中，用官方 Spine 4.3.26 GUI 的 `Import Project → Animation`，将来源原生 `city/interact` 直接导入未经工坊修改的目标原生工程，并保存后以官方 CLI 重新导出 JSON。4.3 编辑器可直接读取 3.8.99 来源工程副本；没有保存或升级来源原件。

编辑器导入警告列出大量同名缺失对象，例如 `hips12`、`hips13`、`hips10`、`hips36`、`hips8`、`hips11` 均为 `Bone not found`。独立重导显示，直接导入的新 `city/interact` **只剩 `body3d2.translate` 的 7 个键**；这条同名通道与来源键完全相等，但其位移值达数千像素，与目标控制语义不兼容。左肩、上臂、前臂、手、袖及必要 IK/附件轨道均未进入目标。目标原有 110 条动画和其余结构保持相等，只有保存导致 `skeleton.hash` 改变。证据与复核脚本为 `work/SPW-02/proofs/native-direct-compare-result.json`、`verify-native-direct-compare.mjs`，隔离工程为 `native-direct-compare/target-rozeul/rozeul.spine`。这项实际对照确认需要工坊的异名对象映射、逐通道判定与角色差异校准，不能把同名直导视为可用的完整动作。
