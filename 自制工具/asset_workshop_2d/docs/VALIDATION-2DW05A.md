# 2DW-05A 项目风格契约与 PNG 剪贴板粘贴验证（2026-10-10）

本轮在独立离线 2D 工坊中实现结构化项目风格契约、任务局部偏移、`2dw-zip/3` 风格镜像和参考 PNG 粘贴。`spec/asset-spec.json` 仍是任务唯一权威规格，版本仍为 `1.1.0`；历史 ZIP `/1`、`/2` 的读取路径保留。测试环境为 Node `v24.19.0`、pnpm `11.25.0`、Windows Electron `44.5.1`。本文件只记录本地实现与验证，不代表外部 AI 已看图或生成目标素材。

## 自动检查

| 命令 | 结果 | 覆盖要点 |
| --- | --- | --- |
| `pnpm test` | **163/163 通过** | 结构化契约与空基线、偏移/预算及禁令短语提示、持久默认值与损坏配置回退、PNG 粘贴校验与清理、ZIP `/1`/`/2`/`/3`、草稿预览失效、砖块样本和桌面 UI 回归。 |
| `pnpm typecheck` | 通过 | TypeScript 类型检查。 |
| `pnpm build` | 通过 | 核心与桌面构建。 |

项目默认契约是暗部/亮部各最多 3 阶的手绘块面模板。任务偏移可留空；显式空项目基线会在导出文本中标为“无项目基线保护”。相同的冲突检查函数同时用于桌面提醒与 `style/task-style-delta.md`：它提示预算超限、缺少基线，以及 `focus`/`mustChange` 中部分明确要求采用项目禁令画法的短语。它不作完整自然语言或视觉语义判定。损坏或不可读的本机默认配置会保留原文件、临时使用内置示例并显示警告；无效的新默认值不会覆盖已保存文件。详见[风格契约说明](STYLE-CONTRACT.md)。

## Windows 桌面烟测

| 命令 | 本轮结果与回执 |
| --- | --- |
| `node scripts/desktop-clipboard-smoke.mjs` | 真实 Electron 主进程剪贴板写入 `image/png` 位图与 `text/uri-list` 本地 PNG 文件 URI；两次在参考区聚焦后按 `Ctrl+V`，均导入 32×24 PNG，列表出现两张缩略图、尺寸及可编辑参考项。此脚本直接打印结果，未另存 JSON；**未以 Windows 资源管理器人工 `Ctrl+C` 的文件对象作专项测试**。 |
| `node scripts/desktop-workflow-smoke.mjs` | 零图、内容＋风格双图、自定义参考三种实际 Electron ZIP 导出；[回执](../validation/2dw05/ui-M1r3C6/electron-workflow.json)记载 0 网络请求、三包 14/16/15 条目和对应截图。 |
| `node scripts/desktop-quick-smoke.mjs` | 384² 零图、512×256 双图、复制任务新 ID 与窄窗布局；[回执](../validation/2dw05/quick-ui-681Mj0/quick-smoke.json)记载 0 网络请求、renderer 无 Node 文件访问、独立解包逐项 SHA-256/源图字节核对。 |
| `node scripts/desktop-workflow-recipe-smoke.mjs` | A 零图、B 内容＋风格、C 仅风格、D 两张风格图且备注冲突；[回执](../validation/2dw05/recipe-ui-ojLrnz/workflow-recipe-smoke.json)记载步骤激活与参考角色、0 网络请求、独立 manifest SHA-256/CRC/原 PNG 字节核对。 |
| `node scripts/electron-smoke.mjs` | 旧证明流程仍可导出九条目 ZIP，离线 HTTP 请求被拒、重复导出不覆盖原文件；[桌面回执](../validation/2dw05a/proof-smoke-25ae0f52ebf94b07957416f092274a16/new-electron-smoke.json)与[ZIP 校验](../validation/2dw05a/proof-smoke-25ae0f52ebf94b07957416f092274a16/new-proof-validation.json)保存在本地验证目录。 |

桌面风格编辑区另保存了 [1080 px](../validation/2dw05a/style-ui-1080.png) 与 [760 px](../validation/2dw05a/style-ui-760.png) 截图，供检查折叠表单、提示和窄窗布局。这些 `validation/` 回执是本机验证证据，不是产品任务包内容。

原生剪贴板烟测的首轮运行曾在恢复测试前剪贴板内容时失败；脚本已修复并重跑通过。首轮当时的系统剪贴板内容可能被测试 PNG 文件路径替换，已无法追溯恢复。重跑的通过结果只证明上述 `ClipboardItem` MIME 路径和界面入口；普通用户从资源管理器复制文件的实际数据格式、不同来源位图及长时间使用手感仍待本人体验。

## 真实砖块样包核验

[样本说明](../samples/2dw05a/README.md)记录了关联对话两张参考图的来源与角色。图 2 原图作为内容参考，图 1 手工修改后的中间砖作为风格参考；二者均为 683×679 的真实 PNG。源文件 SHA-256 分别为 `4d4d760cfdbc233a996d83e2f0e01cbe0f7afab42a01aef0a7b2d3440c3aca29` 与 `b04d514cc1dc5efe64dd034d1ecffe7ff21aed4f96fe78c02256b54c2264e1ed`。

[`2dw05a-middle-brick-redraw.zip`](../samples/2dw05a/2dw05a-middle-brick-redraw.zip) 为 **1,416,830 字节、SHA-256 `d8aa615fc41b9ea7a5f0a13f581f2b4ea5143b1134a11820f72b58ccc0fd8467`**。脚本先校验两张输入图的固定哈希，再编译导出；现有 ZIP 经 `archive.validateZip` 校验为 `2dw-zip/3`，共有 16 条目。独立解包后，包内两张参考 PNG 与本地源文件逐字节相同；manifest 逐项记录条目长度和 SHA-256，ZIP CRC、风格镜像与权威 spec 一致。任务规格为未来输出不透明的 683×679 PNG、100 PPU（6.83×6.79 世界单位），只重绘图 2 中间大砖并保留周边关系。

归档中有 `style/` 的三份镜像、参考原件、`workflow/` 待执行步骤、Codex 适配文本及未勾选的验收清单。没有 `reports/` 的已完成视觉分析，也没有 `output/asset.png` 或其他重绘成果。工作流中“分析内容图”“分析风格图”“制作素材”等为未来外部执行端的计划，不能据此认定工坊已经看图、生图或验证美术结果。

## 尚未覆盖与交接

本轮未实测外部 AI 收包后的视觉判断、冲突裁定、真实制作和成品回流；用户本人从零操作与 2DW-04 遗留的 G32 人工验收也不能由自动烟测代替。Windows 资源管理器真实文件复制、正式便携 EXE 和 ACL 拒写专项未列入已通过项。保护旧样包/3D 工坊哈希、精确提交范围及 GitHub `main` 远端 SHA 由最终交接复核并报告；本文件不预写发布结果，不涉及 Gitee。
