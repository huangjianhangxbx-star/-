# SPW-01 输入核对（2026-10-24）

## 本轮真实输入

- 目标：用户已确认 `E:\1画画\星骸回廊\rozeul\Models\rozeul.spine` 是本轮母版。Spine CLI 读取为 **4.3.26 Professional**、单骨架 `rozeul`、169 bones、88 slots、5 IK、110 animations。原件 SHA-256：`0103B0A6D2F2A419C4453DA5CD15F3AEFBAF3BD9DF7B9427F5FBBBC0EDB5648D`。
- 工作副本：`work/SPW-01/inputs/rozeul/rozeul.spine`，哈希与原件一致，并复制原件 `images/` 127 张 PNG。此目录被仓库 `/work/` 规则忽略。
- 目标数据：从上述工作副本使用本机 `E:\Spine\Spine.com -i <副本> -o <输出目录> -e json+pack` 导出，`skeleton.spine=4.3.26`。导出的 154 个 mesh 均有 `width`/`height`，159 个骨骼有 `color`；这些字段在官方 JSON 规范中标为 Nonessential，证明这次默认导出包含对应非必要数据。本机 CLI 未提供官方网页文档所列的 `--last-export-settings`，不能由此推断所有导出设置。
- 源动作：Khronos glTF Sample Assets 的 `CesiumMan.glb`，位于 `work/SPW-01/inputs/`，SHA-256：`B7001EAEEA8254BD44773BCD247E78696D94169388FBB2A1800FC69434E777D9`；1 个 skin、19 joints、1 条未命名的 2.0 秒动画。界面显示名暂用“动作 1”。来源与许可：[Cesium Man](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/CesiumMan/README.md)；本地许可文件同输入目录。它是公开工程测试素材，不是项目正式美术。

## 适配边界

- 目标设置姿势主要可见附件属于 `Z/`，本轮标为“rozeul 当前可见方向（Z 系）”。`B/C/Z` 贴图目录不能证明已有五面绑定。
- 目标双腿分别受 `Rleg_ik`、`Lleg_ik` 控制，目标骨为 `RlegIK_hips`、`LlegIK_hips`；右臂受 `Rarm_ik` 控制，目标骨为 `[#4E9FE8]body2`。需按实际驱动入口键控，避免同时强写被 IK 覆盖的旋转。
- 本轮 M1 证明配置仅映射并输出 `body`、`chest`、`RlegIK_hips`、`LlegIK_hips` 四条目标轨道；源手臂与目标手臂 IK、持握未进入交付动画，不能把单方向证明当作全身动作完成。
- 实际导出 JSON 有 169 bones、88 slots、5 IK、36 transform constraints、110 animations；直接读取 `.spine` 的 CLI 报 38 transform constraints。差异只确认到导出结果少 2 个，未定位具体对象或导出标记。本轮映射按 JSON 与原工程同时存在的 `body`、`chest`、双腿 IK 目标进行；不能把 JSON 导入生成的临时项目当作原工程的无损替代。
- CLI 探针：向完整 JSON 新增一条 2 帧动画后，`Spine.com -i <JSON>` 能列出 111 条动画；`Spine.com -i <JSON> -o <临时项目.spine> -r` 能创建 4.3.26 临时项目，并再读到新增动画。这是早期格式探针。后续已在 **Spine 4.3.26 GUI** 将真实 CesiumMan 映射所得的短片段与全段片段导入 `rozeul` 工程工作副本，保存为 `work/SPW-01/proofs/m1-LuytG6/target-rozeul.spine`；CLI 再导出的 `roundtrip/rozeul.json` 同时包含两条新增动画，总数 112。另在独立 `edit-check-gui.spine` 中编辑一键、保存、通过 Ctrl+O 重开，CLI 再导出的 `edit-roundtrip/rozeul.json` 保留该改动。逐项证据见 [validation.md](validation.md)。
- 仓库现有 723 个 GLB 均不含动画；登记范围内 238 个 FBX 未发现动画栈。本轮使用公开 GLB 验证转换，最终动作表现仍由用户视觉审阅。
- 本机 CLI 帮助只列骨架导入 `-r`；向现有骨架导入新动画已经在 Spine 编辑器的 Project Import → Animation 流程实测。CLI 的 `-r` 临时项目探针不充当此 GUI 证据。

## 保护与并行

实施工作树是 `Origin/work/SPW-01/checkout`，从 `github/main@b2c5aa06` 建立。本地主工作树在开工时比远端落后 123 提交，且有数百个并行改动；本轮只在独立工作树写入新工具、任务记录和忽略的工作样本。原始角色工程、贴图、游戏本体及其他工坊保持只读。

导回后重新核对原始 `E:\1画画\星骸回廊\rozeul\Models\rozeul.spine`，SHA-256 仍为 `0103B0A6D2F2A419C4453DA5CD15F3AEFBAF3BD9DF7B9427F5FBBBC0EDB5648D`。新增动画保存在独立证明工程，测试编辑仅保存在另一独立副本；工作样本及证明目录均位于被 Git 忽略的 `/work/` 下。
