# 2DW-TILE-01 验证与交接

2026-10-11；工坊0.3.0；模板candidate0.1.0。本轮按原型期B级受影响模块验证，没有运行无关游戏/3D全量回归。

## 结果

| 项目 | 实际结果 |
|---|---|
| 条件角、47状态、连续取样窗、尺寸与PPU | 语义测试通过 |
| 实际像素来源、Alpha轮廓、石材越格、缺状态错误定位 | 语义/篡改测试通过 |
| ZIP v5唯一权威、风格镜像、引用SHA、像素预算、身份 | 篡改后即使重新manifest也拒绝 |
| 返回图/风格图导入、旧产物失效、取消、不覆盖导出 | 会话测试通过 |
| Alpha/越格诊断、导引窗 | 初始RED，再GREEN；不改编译PNG字节 |
| 受影响模块及旧归档 | `export-zip`、`environment-archive-2dw05b`、`tile-*`，45/45通过 |
| 类型与构建 | TypeScript noEmit通过；本工坊dist构建通过 |
| 桌面实际流程 | 真实Electron窗口、文件读取、剪贴板、编译、切换场景、导出写盘通过；pageErrors空 |
| 历史样包 | 16个实际已存在ZIP全部可读；对HEAD二进制SHA/字节相同 |
| 受保护文件 | 开发细则、批准风格catalog、石砖V1的3项SHA不变 |
| AI分层B | 草地/石质v2与风格v3各47/47、九场景各9/9 |
| AI直接47弱对照、连续A | 两类都做了真实尝试，尺寸不符拒绝；没有缩放或假通过 |
| 人工美术、引擎Sorting | pending / 未验证 |

定向命令：`node --test tests/export-zip.test.mjs tests/environment-archive-2dw05b.test.mjs tests/tile-*.test.mjs`；`pnpm run typecheck`；`pnpm run build`；`pnpm run smoke:tile`。语义测试覆盖像素和状态，而非只检查源文件含某段文字。

`pnpm run proof:tile`处理本机已保存的真实AI原件，不调用工具或生图。需要ignored的十张原图及两张连续输入；新机器缺这些时会明确失败，不能把固定夹具算AI。它更新本轮示例包，勿用于覆盖人工维护的其他成果。

## 桌面验证边界和失败历史

最终证据`validation/2dw-tile01/desktop-cSAae0/`：工作台截图、实际参考/任务/编译ZIP、result.json。对话框返回由自动化注入，但主进程读原图、校验和写盘真实执行；不是人工操作系统对话框验收。OS图片剪贴板真实写入/读取，并恢复测试前剪贴板。十场景及格线、Pivot、Alpha、越格、mask标签、返回/空画板切换和旧流程恢复均实际执行。

前几轮Playwright截图在此Windows环境超时；改用Electron原生capturePage。旧clipboard.writeImage与本机Electron44 API不匹配导致一次失败；改用ClipboardItem后重测通过。未将失败轮次删除或伪装最终成功证据。测试图为原创结构夹具；实际AI结构/风格证据另行统计。

## AI事实

共10次真实内置imagegen操作：每类首轮、分层v2、直接47、风格v3、连续A各一次。模型标识工具未返回，人工手修工时未实测。初始分层要求1024却返回1254；明确新增并锁定1254契约后重新生成，v2/v3通过。直接47分别返回1448×1086、1280×1229而非约定画布；连续896两类均返回1254。拒绝原件保留，没有事后用修改契约吞掉失败。

四区同相位取样与程序轮廓降低了状态排布失控风险，但还会产生重复。九场景Alpha/拓扑检查不能证明成熟手绘风格、黑边/高亮合理或所有石质排序正确。连续A仅自制夹具技术通过，真实生成失败；弱对照没有合格终态，不据此作统计稳定性结论。

[草地报告](AI-GRASS-2DW-TILE01.md) · [石质报告](AI-STONE-2DW-TILE01.md)。人工优先验收重复感、叶缘、石沿亮度/厚度与内角，之后才决定是否正式批准候选。

## 文件与发布边界

新增grammar四模块、独立tile-session/panel/css、四幅原创解释PNG、四个测试文件、两个证明脚本、两任务ZIP和空模板副本。现有main/preload/index/build/task-session与归档验证只作接入；package升级0.3.0，未新增依赖。旧v1–v4解析保留；v5单独dispatch。

运行不读原作研究库，不import3D工坊。AI与编译原图只留ignored本机；Git范围只含本轮代码、文字、原创说明/空模板/任务ZIP及记录追加块。游戏、3D、用户原稿、开发细则、批准规则及既有dirty内容不混入提交。不推Gitee，不强推。

远端2098d58→c8cc482来自并行背包任务，共享checkout已推进到相同HEAD；无工坊文件冲突。最终发布再次检查远端，发布结果以任务handoff为准。
