# SPW-01 验证记录（2026-10-24）

本记录仅描述本独立工作树的 **rozeul 当前可见 Z 系方向**与公开 CesiumMan 动作。证明文件位于被 Git 忽略的 `work/SPW-01/proofs/m1-LuytG6/`；本文件中的相对路径均从仓库根目录 `Origin/work/SPW-01/checkout` 起算。短片段和全段分别导入同一个 `rozeul` 工程工作副本，测试编辑另存一份，原始母版未参与写入。

## 本轮可复核结果

| 检查 | 结果 | 持久证据 |
|---|---|---|
| 输入与版本 | 母版为 Spine 4.3.26；原件 SHA-256 在导回后仍为 `0103B0A6D2F2A419C4453DA5CD15F3AEFBAF3BD9DF7B9427F5FBBBC0EDB5648D`。 | 原件 `E:\1画画\星骸回廊\rozeul\Models\rozeul.spine`；[输入核对](intake.md) |
| 生成数据可读 | `short.json` 为 0.5 秒、16 采样帧；`full.json` 为 2 秒、61 采样帧。两者各自经 Spine CLI 读取，动画数分别从 110 增至 111。 | `work/SPW-01/proofs/m1-LuytG6/{short.json,full.json,summary.json,calibration.json}` |
| M1 脚本复跑 | E: 空间清理后重新执行真实样本证明脚本，短段与全段均为 CLI exit 0、`Complete`、111 动画；此复跑是生成/可读性验证，GUI 导回证据仍以上述 `m1-LuytG6` 工程为准。 | `work/SPW-01/proofs/m1-1E95fX/summary.json` |
| GUI 导入和保存 | Spine 4.3.26 中，打开目标工程副本，依次经“文件 → 导入项目 → 动画”选择 `source-short.spine`、`source-full.spine`，将两条 `workshop/` 动画导入 `rozeul`，保存为 `target-rozeul.spine`。 | `work/SPW-01/proofs/m1-LuytG6/{source-short.spine,source-full.spine,target-rozeul.spine}`；目标工程 SHA-256 `187A6C0726323C1285591236293D5C438BF8A9796445F0184D7E23D0948C9BF8` |
| GUI 保存后 CLI 回导 | `roundtrip/rozeul.json` 为 Spine 4.3.26、112 条动画；保留原 110 个动画名称，新增 `workshop/cesium_rozeul_Z_short_001` 和 `workshop/cesium_rozeul_Z_full_001`。分别有 64、244 个键，涉及 `body.rotate`、`chest.rotate`、双腿 IK 目标的 `translate`；时长分别为 0.5、2 秒。骨骼 169、插槽 88、JSON 约束 41（5 IK、36 transform），与本轮原始 packed JSON 计数相同。 | `work/SPW-01/proofs/m1-LuytG6/roundtrip/rozeul.json` |
| 原数据保留对比 | 对本轮原始 `packed/rozeul.json` 与 GUI 保存后回导 JSON 做 Node 对象深比较：旧 110 个动画对象逐一相等，骨骼、插槽、41 条约束、1 个 skin（含 158 个附件：154 mesh、4 region）以及 events 相等；附件身份无缺失或新增。顶层除新增动画外仅 `skeleton.hash` 由 `zjiL8qwV5Bs` 变为 `PXmKIMpRemE`。 | `work/SPW-01/inputs/rozeul/packed/rozeul.json` 与 `work/SPW-01/proofs/m1-LuytG6/roundtrip/rozeul.json`；下方 Node 复核命令 |
| 官方 runtime 复看 | `@esotericsoftware/spine-webgl` 4.3 使用原 atlas 载入 GUI 回导的 `roundtrip/rozeul.json`，识别 112 条动画；全段 clip 时长 2 秒，在 0、0.5、1、2 秒分别求值，`LlegIK_hips` 的世界位置随时间变化。此项核对数据可解析和目标控制骨可播放，未作逐帧美术审阅。 | 本轮一次性 Node 命令输出（未单独归档）；输入为上述回导 JSON 与 `work/SPW-01/inputs/rozeul/packed/rozeul.atlas` |
| 可编辑、保存和重开 | 另存 `edit-check-gui.spine`，在全段动画第 30 帧、0.5 秒的 `body` 旋转键于 GUI 中由显示值 97.352° 改为 98.352°，Ctrl+S 保存；再 Ctrl+O 从最近项目重开，返回设置视图，窗口标题为 `Spine - edit-check-gui`，无报错；重开后回到动画模式，该值仍为 98.352°。CLI 再导出的同一 timeline 键由 1.3187764° 变为 2.3184204°（相对 setup 的数值，约 +1°），动画总数仍为 112。 | `work/SPW-01/proofs/m1-LuytG6/{edit-check-gui.spine,edit-roundtrip/rozeul.json}`；编辑副本 SHA-256 `C921BB6DAB714592702CC54566283B54ED682122285EC7B900167B7ED37F4EF3` |
| 工具自动与桌面流程 | 最终修复后在 `自制工具/spine_animation_workshop/` 执行 `pnpm test` **54/54**、`pnpm run typecheck`、`pnpm run build` 均通过。隐藏 Electron 的启动、正常流程、目标身份、坏配置与配置输入保护五条 smoke 均 PASS。先前正常流程输出在临时目录 `C:\Users\ADMINI~1\AppData\Local\Temp\spw-electron-flow-Jy3FUs\SPW-01_spw01_take_01_7ff975e8`；最终命令输出未单独归档为日志。 | 下方列出五条可复跑命令。 |
| 桌面回归修复 | 目标 JSON 重选后，资源按新目标身份绑定，旧生成立即失效；错误目标后不得保存旧结果。坏配置载入失败可恢复；保存配置拒绝覆盖已载入素材。采样限于 1–240 Hz 且总帧数不超过 20,000；调整观察角后目标当前帧预览实时更新。 | 上述定向单测与目标身份、坏配置、配置输入保护及正常流程 smoke；具体边界见 `src/core/sampling-limits.ts`、`src/config/validate-config.ts`。 |
| 最终 Windows 便携包 | 包含 86 个文件、共 387,029,906 字节（约 387 MB）；EXE SHA-256 `49B61A030A520FC36A4B8FA5CCE53FB4E935A7BDBBE4B80E9222F598E49CC7FA`。最新 dist、README、`packaging.md`、`config-destination.cjs` 哈希与包内对应文件匹配；`SPW_SMOKE=1` 隐藏启动 exit 0，包内 renderer 标题、bridge、双 canvas、时间轴正常，专项 6/6 通过。包内无用户角色/动作素材，所需许可证齐全。 | `C:\Users\Administrator\Documents\SPW-01-release\xinghai-spine-animation-workshop-0.1.0-win-x64\星骸 Spine 动画工坊.exe`；本机 `Get-FileHash` 与文件清点再次核对同值。 |

`summary.json` 创建于 GUI 导入之前，因此其 `status: cli-readable` 与“GUI 尚未验证”的 limitation 是当时的阶段记录；以上工作副本和两份回导 JSON 是后续证据。GUI 截图目前仅在本会话中，未作为单独文件归档。

## 可复核命令

以下 PowerShell 命令均以本工作树为当前目录；重导时使用新的输出目录，以保留上述证据原貌。

```powershell
$proof = 'work\SPW-01\proofs\m1-LuytG6'
$original = 'E:\1画画\星骸回廊\rozeul\Models\rozeul.spine'
Get-FileHash -LiteralPath $original -Algorithm SHA256
& 'E:\Spine\Spine.com' -i (Join-Path $proof 'target-rozeul.spine')
& 'E:\Spine\Spine.com' -i (Join-Path $proof 'edit-check-gui.spine')
& 'E:\Spine\Spine.com' -i (Join-Path $proof 'target-rozeul.spine') -o (Join-Path $proof 'roundtrip-recheck') -e json
& 'E:\Spine\Spine.com' -i (Join-Path $proof 'edit-check-gui.spine') -o (Join-Path $proof 'edit-roundtrip-recheck') -e json

$saved = Get-Content -LiteralPath (Join-Path $proof 'roundtrip\rozeul.json') -Raw | ConvertFrom-Json -AsHashtable
$edited = Get-Content -LiteralPath (Join-Path $proof 'edit-roundtrip\rozeul.json') -Raw | ConvertFrom-Json -AsHashtable
$name = 'workshop/cesium_rozeul_Z_full_001'
$saved.animations.Count
$saved.animations[$name].bones.body.rotate[15]
$edited.animations[$name].bones.body.rotate[15]
```

必须使用 `ConvertFrom-Json -AsHashtable`：原角色 JSON 含仅大小写不同的字段名，普通 `ConvertFrom-Json` 会拒绝解析。`roundtrip-recheck` 只是复核时的新目录，本轮持久证据仍是上表中的 `roundtrip/` 和 `edit-roundtrip/`。

最终工具验证可在 `自制工具/spine_animation_workshop/` 重跑：

```powershell
pnpm test
pnpm run typecheck
pnpm run build
node scripts/electron-smoke.mjs
node scripts/electron-flow-smoke.mjs
node scripts/electron-target-identity-smoke.mjs
node scripts/electron-invalid-config-smoke.mjs
node scripts/electron-config-input-smoke.mjs
```

最终便携包的只读指纹与文件清点：

```powershell
$release = 'C:\Users\Administrator\Documents\SPW-01-release\xinghai-spine-animation-workshop-0.1.0-win-x64'
Get-FileHash -LiteralPath (Join-Path $release '星骸 Spine 动画工坊.exe') -Algorithm SHA256
Get-ChildItem -LiteralPath $release -File -Recurse | Measure-Object -Property Length -Sum
```

原数据对象对比可从本工作树根目录只读重跑：

```powershell
@'
const fs = require('fs');
const assert = require('node:assert/strict');
const before = JSON.parse(fs.readFileSync('work/SPW-01/inputs/rozeul/packed/rozeul.json', 'utf8'));
const after = JSON.parse(fs.readFileSync('work/SPW-01/proofs/m1-LuytG6/roundtrip/rozeul.json', 'utf8'));
for (const name of Object.keys(before.animations)) assert.deepStrictEqual(after.animations[name], before.animations[name]);
for (const key of ['bones', 'slots', 'constraints', 'skins', 'events']) assert.deepStrictEqual(after[key], before[key]);
assert.equal(Object.keys(before.animations).length, 110);
assert.equal(Object.keys(after.animations).length, 112);
console.log('旧动画 110 项及 bones/slots/constraints/skins/events 对象深比较通过');
'@ | node -
```

## 范围与待验

- 已证明两条新增动画能进入真实 Spine 工程副本、保存、重开编辑副本并由 CLI 回导；编辑验证发生在独立副本，未混入未编辑的 `target-rozeul.spine`。
- 本轮生成结果只有四条目标轨道：`body`、`chest`、`LlegIK_hips`、`RlegIK_hips`。CesiumMan 源手臂与 `rozeul` 手臂 IK 尚未映射到交付动画；手臂、持握及全身动作表现仍需扩展映射和用户视觉审阅。
- 本轮两份 **JSON** 中旧动画与上述数据对象深比较相等；这不能证明二进制 `.spine` 完全同构。原工程 CLI 信息显示 38 个 transform constraints，而原始导出 JSON 与导回 JSON 均为 36 个，差异原因仍未定位。
- 已用官方 Spine 4.3 runtime 对 GUI 回导 JSON 做全段求值；尚未做贴图/约束逐帧视觉回归，也未完成用户的动作质量、左右、比例、发力姿态视觉审阅。这个技术回环不等于美术验收。
- 仅验证 CesiumMan 一条 2 秒动作与当前 Z 系方向；桌面流程、上述回归 smoke 与最终 Windows 便携包已通过。其他方向、更多动作及用户视觉审阅仍不在此证据覆盖范围。后续按 [实施计划](implementation-plan.md) 与 [交接](handoff.md) 继续。
