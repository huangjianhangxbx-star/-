# SPW-03 自动调查与 AI 回填标定验证

日期：2026-10-25（北京时间）。对应用户反馈：方向入口、身体锚点、共享骨和尺寸骨不应成为生成 AI 分析包的前置人工任务。

## 验证目标

直接载入两端 `.spine`，选来源动作，点击生成 AI 分析包；首次不填任何参考字段。工坊调查完整骨架及候选分支，保留全局坐标、真实父链、约束和动作证据。Codex 据此选择身体参考、提出映射，回传后供用户预览和接受。工坊的本机调查与 Codex 分析是两个环节，不声称本机名称算法已经完成通用人体识别。

离线文件交换不要求工坊配置云 API，也不默认上传母版和贴图。

## 真实输入与只读证据

| 素材 | 原生地址 | 读取结果 |
| --- | --- | --- |
| rhiny | `E:\1画画\星骸回廊\rhiny\rhiny.spine` | 235 根骨、68 槽、89 动作、23 约束；原工程 SHA-256 `ea056458d07fd7230080d4703dc367f572e74a2bb1dda2e94c2ec35b8cba7757`。 |
| rozeul | `E:\1画画\星骸回廊\rozeul\Models\rozeul.spine` | 169 根骨、88 槽、110 动作、41 约束；原工程 SHA-256 `0103b0a6d2f2a419c4453da5cd15f3aefbaf3bd9df7b9427f5fbbbc0edb5648d`。 |
| FREYCIA | `E:\正式项目模型\星骸回廊\芙蕾茜娅\芙雷茜娅.spine` | 多方向共用 root，当前身体绑定分支和母版身份由本次实际调查包确认；不使用目录内旧单 root 导出冒充当前工程。 |

本轮只读调查脚本及输出位于忽略目录 `work/SPW-03/automatic-survey-inspect.mjs`、`automatic-survey-runtime-evidence.json`。它们是两组真实素材的 Codex 分析证据，未写入生产识别器。

rhiny 的编号骨不能依编号认人体。实际骨链 `hips7 → hips49 → hips11 → hips12 → hips13`，由胸部槽、左袖槽、左前臂槽和左手槽，以及设置姿势世界坐标支持身体语义。与 rozeul 的 `chest → Z/Z_Larm1 → Larm → Larm1 → Larm2 → Lhand` 对照时保留肩辅助层的结构差异。`atk1` 的来源左腕运动范围约 740.7 × 425.2 px，两臂 IK 分段切换；复制 FK 键不等于完成 IK 烘焙。

rozeul → FREYCIA 的身体参考保留既有调查结论：来源 `flip / centroid`，目标 `侧正面 / 侧正面-Pelvis`。目标 `root` 是多方向布局祖先，不是身体锚点。正常化尺寸排除长控制线与画布布局骨；地面留空，因为控制参考不能冒充物理脚底接触点。

## 实际 UI 往返

工坊真实桌面窗口直接加载两端原生输入，未修改参考字段，未展开高级设置，直接点击“生成 AI 分析包”。两组均成功，导出前后原有映射数相同：

| 实际配对 | 全骨架调查 ID | 完整骨数 | 导出保留的本地映射 | Codex 回传后严格校验的精确参考 ID | 提案数 |
| --- | --- | --- | ---: | --- | ---: |
| rozeul → 冻结 FREYCIA | `spw-3c46694a88204e91` | 169 → 135 | 1 | `spw-5ec3ad64515e9e08` | 7 |
| 截图中的 rhiny → rozeul | `spw-721f6a78b6a48990` | 235 → 169 | 41 | `spw-3c7081f908e4cf10` | 8 |

两次本轮实际来源动作均为 `atk1`，不是沿用 SPW-03 上一轮 talk/run 验收数据。来源有 25 帧真实采样。rozeul 的 `flip` 在当前动作具有 443.37 px 水平范围，设置世界矩阵的镜像行列式在 1/-1 间变化；`Lhand` 世界运动范围约 874.22 × 603.41 px。真实镜像和位移不能当成画布布局消除。

两组文件均由工坊实际 UI 输出后，再由 Codex 读取完整 manifest、全骨架、discovery 与动作证据，写出同目录 `mapping-proposal.json`、`rig-hints.json`、`analysis-report.md`。回传只修改方向身份这一允许字段，原调查 ID、原生 SHA、导出文本指纹、骨架指纹、skin 与原对象证据绑定均通过 `parseAiSurveyReply`。派生的身体参考包只存在于后续校验上下文，原调查及回传文件保持原身份。

只读缓存按文本指纹及骨架指纹精确反查重建；验证断言调查包含双方全部真实骨骼，参考选择由 Codex 回填，没有先向用户索要方向入口、锚点、共享骨或尺寸骨列表。地面继续留空。

本地证据：

- `work/SPW-03/automatic-survey-green.log`、`automatic-survey-rhiny-green.log`：实际 UI 零表单导出结果。
- `work/SPW-03/ui-output/SPW-AI-Analysis-spw-3c46694a88204e91-c11cbbe3/`：第一组实际分析包及 AI 回传。
- `work/SPW-03/ui-output/SPW-AI-Analysis-spw-721f6a78b6a48990-2ba6c097/`：第二组实际分析包及 AI 回传。
- `work/SPW-03/automatic-survey-validation-rozeul-FREYCIA.json`、`automatic-survey-validation-rhiny-rozeul.json`：原调查到精确参考的严格身份与提案校验。

第一组在另一新进程直接加载两端，再点击“导入 AI 识别结果”，未预先导出、未输入参考、未点“应用”。7 条候选初始均未勾选；按躯干 4 项、左臂 3 项接受后，参考由 AI 回传恢复并保存配置。`atk1` 在 0、0.55、1.1 秒均有双端画面，实际复制 15 通道、略过 198、待调 7；另 1 行原有本地映射不在当前有效标定内，没有强行迁移。截图显示高级字段保持收起。此为可预览草稿，不是完整攻击动作视觉验收。

证据为 `work/SPW-03/automatic-survey-freycia-import.log`、`automatic-survey-freycia-reviewed.spw.json` 及其返回的 `ui-output/ai-automatic-import-1792918875572/` 三帧图。第二组界面导入和跨进程恢复另由本轮桌面验证补录；以上表格不把 API 校验冒充 UI 导入或视觉验收。

## 最终 0.3.2 便携包验证

最终程序为 `E:\SPW-03-release\xinghai-spine-animation-workshop-0.3.2-automatic-survey-win-x64\星骸 Spine 动画工坊.exe`。首次导出不填写参考字段；AI 结果可在另一新进程直接导入，由同目录 manifest 重建原分析上下文，既不先手填参考，也不需先再导出一次。

最终两组均执行“一次用身体建议预览”，候选个别复选框点击次数为 0，高级表单始终关闭。截图配对 rhiny→rozeul 采用 8 项 AI 身体对应并保留其他有效本地对应，实际复制40通道、略284、待调30（不能将40全部归功于这8项 AI 提案）；rozeul→FREYCIA采用7项，复制15、略198、待调7。全部未确定/不兼容项仍逐项报告，未阻止身体草稿。

证据：`work/SPW-03/automatic-survey-rhiny-delivery.log`、`automatic-survey-freycia-delivery.log`；实际保存配置为 `automatic-survey-rhiny-delivery.spw.json`、`automatic-survey-freycia-delivery.spw.json`。每组时间轴起/中/末值断言与 WebGL 检查通过，截图路径在各日志中。隐藏窗口截图不作为动作自然程度的最终视觉验收。

关闭进程后，最终 EXE 新进程载入 rhiny→rozeul 配置，未打开高级表单，恢复8项接受记录、AI给出的参考与原调查追溯ID，`atk1` 草稿再次复制40通道；证据 `work/SPW-03/automatic-survey-rhiny-restore.log`。重复导入按实际映射重建接受状态，不按候选序号盲沿用；恢复失败清内部授权与预览范围。

202项测试：193通过、9项可选本机资产环境测试跳过、0失败；类型检查与构建通过。协议负例覆盖错误原包/工程、伪造骨、非法共享控制骨、跨方向映射、左右冲突、重复目标、脚本字段及伪造调查接受状态。实际终端输出含 Chromium 磁盘缓存拒绝访问告警，功能断言、画布与时间轴均通过，未关闭用户当前窗口。

## 最终视觉边界

身体和左臂采用提案状态，头部、衣物、头发及复杂右臂/腿约束继续保留未解决项。不会要求所有骨骼匹配后才生成草稿，也不会把未迁移双腿的 `run` 称为完整跑步成品。最终原生导入仍由用户在 Spine 确认。
