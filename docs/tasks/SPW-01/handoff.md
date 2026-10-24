# SPW-01 阶段交接（2026-10-24）

## 已完成的单方向技术结果

用户确认的 `rozeul.spine` 母版和 Khronos CesiumMan 2 秒 GLB 已用于当前 Z 系方向的最小适配。短片段 0.5 秒和全段 2 秒经 Spine 4.3.26 GUI 导入同一个原工程工作副本，保存后 CLI 回导为 112 动画；另一独立工程副本完成关键帧编辑、保存、重开和再导出。官方 Spine WebGL 4.3 载入该回导 JSON，并对全段的 0、0.5、1、2 秒求值，双腿 IK 目标之一的世界位置随时间变化。原母版 SHA-256 保持不变。最终工具 54/54 测试、类型检查、构建、五条隐藏 Electron smoke 及 Windows 便携包专项 6/6 均通过。逐项文件、命令、数值和限制见 [验证记录](validation.md)，输入与骨链边界见 [输入核对](intake.md)。

| 用途 | 路径（相对本工作树） |
|---|---|
| 母版只读工作副本及导出 | `work/SPW-01/inputs/rozeul/rozeul.spine`、`work/SPW-01/inputs/rozeul/packed/` |
| 动作源与许可 | `work/SPW-01/inputs/CesiumMan.glb`、`work/SPW-01/inputs/CesiumMan-LICENSE.md` |
| 映射配置、生成 JSON、阶段摘要 | `work/SPW-01/proofs/m1-LuytG6/calibration.json`、`short.json`、`full.json`、`summary.json` |
| GUI 导入源临时工程 | `work/SPW-01/proofs/m1-LuytG6/source-short.spine`、`source-full.spine` |
| 未做测试编辑的目标工程和回导 | `work/SPW-01/proofs/m1-LuytG6/target-rozeul.spine`、`roundtrip/rozeul.json` |
| 仅用于编辑验收的工程和回导 | `work/SPW-01/proofs/m1-LuytG6/edit-check-gui.spine`、`edit-roundtrip/rozeul.json` |

上述角色、动作与证明资产均在 Git 忽略的 `/work/` 下，交接或选择性提交源码时需另行确认文件传递方式。`summary.json` 是 GUI 验证之前的快照，以 [validation.md](validation.md) 的后续记录为当前状态。没有可交付的录屏或独立截图文件。

桌面流程的最终回归已覆盖目标重选时资源身份绑定与旧生成失效、坏配置恢复、配置保存保护输入素材、1–240 Hz/至多 20,000 帧采样限制，以及调角后的目标当前帧实时预览。E: 空间清理后 M1 证明脚本也再次通过；复跑摘要位于 `work/SPW-01/proofs/m1-1E95fX/summary.json`。

## Windows 便携交付

可运行 EXE：`C:\Users\Administrator\Documents\SPW-01-release\xinghai-spine-animation-workshop-0.1.0-win-x64\星骸 Spine 动画工坊.exe`。SHA-256：`49B61A030A520FC36A4B8FA5CCE53FB4E935A7BDBBE4B80E9222F598E49CC7FA`。整个目录含 86 个文件、387,029,906 字节（约 387 MB）；交付时应复制整个目录。最新 dist、README、`packaging.md`、`config-destination.cjs` 与包内文件哈希匹配。`SPW_SMOKE=1` 隐藏启动 exit 0，包内 renderer 的标题、bridge、双 canvas 和时间轴正常，专项 6/6 通过。包内没有用户素材，许可证齐全。

## 下一步

1. 请用户在 Spine 中审阅首、中、极值、末及左右连接、比例、发力与贴图效果，标出需人工修整的帧，并判断当前转换是否节省制作时间。
2. 按真实控制链扩展源手臂、`rozeul` 手臂 IK 与持握映射。当前交付动画仅写 `body`、`chest` 与双腿 IK 目标四条轨道。5° 俯角、采样频率与当前映射是可调样本，不是美术标准。
3. 用户确认该方向的动作质量后，再逐一处理尚未验证的其他方向；本轮 B/C/Z 目录不能证明五方向骨链已齐。

**阶段判定：**真实 Spine GUI 导回、官方 4.3 runtime 求值、桌面流程、保护回归及最终 Windows 便携包均已验证；原始 JSON 的旧动画、骨骼、插槽、约束、skin/附件及 events 经深比较保留。当前是单方向四轨道技术交付，用户视觉验收仍待进行。
