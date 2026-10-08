# 2DW-02 预设组合引擎验证（2026-10-08）

本轮只交付离线任务包的数据内核，不包含动态桌面表单或生成后的 PNG。实施基准为本地与 GitHub `main` 同一个提交 `5d77f90b92ba97d1a134010e2867ac9bf879f8d1`。2D 工坊接手时干净；仓库其他目录的并行改动未清理、暂存或纳入本轮验证。实施时用户只授权执行计划；2026-10-09 后续明确授权将本轮成果推送 GitHub，Gitee 未获授权。

## 实际运行

在本目录使用 Node 24+/pnpm 11 运行：

| 检查 | 结果 |
| --- | --- |
| 实施前 `pnpm test` / `pnpm typecheck` / `pnpm build` | 51/51、通过、通过 |
| 预设 RED → GREEN | 新组合规则用例先失败，完成实现后通过；归档 0 图与新旧版本用例也先失败再通过 |
| 最终 `pnpm test` | 83/83 通过，包含三个实际导出包的重复内容检查 |
| 最终 `pnpm typecheck` / `pnpm build` | 通过 / 通过 |
| `pnpm smoke` | 旧 Electron 固定入口 8 项通过：独立身份与配置、拒绝 HTTP、真实 9 文件 ZIP、重复导出保留既有文件、冲突解释等 |
| 旧只读 `checkProof()` | Schema `1.0.0`，2 张真实参考图，100 PPU；通过 |
| Python 标准库 `zipfile` + `hashlib` | 三个新 ZIP 均可解压、CRC/manifest 条目散列和自制参考图原字节通过；记录在 `validation/2dw02/samples/independent-zip-check.json` |

样本生成命令：先 `pnpm build`，再 `node scripts/make-2dw02-samples.mjs`。脚本会先核对首轮黄金包哈希；目标已有同名文件时导出器拒绝覆盖，不能把重复生成当成更新旧文件。集成测试在两个独立临时目录用相同输入生成 A/B/C，逐一比较 ZIP 内各条目的 SHA256。本地生成证据在忽略的 `validation/2dw02/samples/`；GitHub 审阅副本及汇总报告在 `samples/2dw02/`，复制后逐个 SHA256 相同。

## 真实样本

| 样本 | 本地 ZIP | 像素 / PPU / 世界单位 | 参考图 | ZIP SHA256 |
| --- | --- | --- | --- | --- |
| A | `samples/2dw02/2dw02-A-square-zero-ref.zip` | 384×384 / 100 / 3.84×3.84 | 0；高度来源 `derived` | `826969c53217906873ad32e5388591914832dfdbd581c4602e3eee668cd3b1fc` |
| B | `samples/2dw02/2dw02-B-rectangle-two-ref.zip` | 512×256 / 显式 200 / 2.56×1.28 | 2；content/style | `ab9cff68e1559c0c8c023b82ac3839439ff499986e7989a3970631bbceca1d24` |
| C | `samples/2dw02/2dw02-C-custom-one-ref.zip` | 640×480 / 100 / 6.4×4.8 | 1；content | `900ef6c58b93b1e820387e849fababe2d2410781cc625f264cb48790e0e72006` |

A/B/C 分别包含 7/9/8 个条目；均有 `spec/asset-spec.json`、制作计划、风格档案说明、`prompts/codex.md`、验收单和 `manifest.json`。参考图是 `tests/fixtures/` 的自制 PNG，均由读图模块核验后按原字节打包。ZIP **没有** `output/asset.png`：该路径只是未来成果约定。三个 manifest 文件自身的 SHA256 及 spec/Prompt SHA256 可从 `samples-report.json` 单独核查。报告的 manifest SHA256 又用 Python 从真实 ZIP 原字节独立核对，A/B/C 均一致。

## 字段描述与冲突实例

以下值来自构建后的 `dist/task.cjs` 实际调用 `describePresetForm`，不是计划模板。选「独立静态 PNG」，填写 `widthPx=384, squareLocked=true`：`output.widthPx` 为可编辑/必填/来源 `user-override`；`output.heightPx` 显示 384、只读、来源 `derived`；`output.ppu` 显示 100、来源 `project-default`；PNG 格式和 `output/asset.png` 只读、来源 `structure-lock`；自定义硬内容要求隐藏。选「custom」后同一个硬内容要求字段可见，格式与安全路径仍锁定。字段顺序与错误均是纯数据，未创建 UI。

明确提供 `widthPx=384, heightPx=512, squareLocked=true` 时返回定位 `output.heightPx` 的 `square-locked` 冲突，保留显式高度而不暗改；未知适配器/版本、无效 PPU、九张图、坏 PNG、引用或清单不一致、路径逃逸与 ZIP 同名冲突均被测试拒绝。`render-codex` 只从已解析的同一规范派生提示文本；测试也验证规范字节与字段顺序稳定、描述文字不能取得结构规则权限。

复核时补测了可扩展注册表的真实边界：可信 PPU 硬锁在表单中变为只读；种子修订版在组合身份与顶层版本保持一致；已填写的错误任务 ID、标题与自定义要求在字段描述阶段给出定位错误，未知要求键不被静默丢弃。独立 ZIP 校验还会拒绝重新写入 manifest 后伪造的 1.1.0 方形尺寸、组合身份与风格引用矛盾；旧 1.0.0 路径保持原规则。

## 兼容与保护

- 首轮 `samples/2dw-proof-codex.zip` SHA256 仍为 `1f90a6b529c54cf3bda2fe9f1f90221fb19025b99ad113ca846aa325e663e504`。旧 Electron 烟测另生成的 `validation/2dw02/legacy-smoke-generated.zip` 与其 SHA256 相同，原固定入口未改。
- 公共旧 `resolveSpec` 与 Schema `1.0.0` 仍需 1–8 张参考图；新组合路径输出 Schema `1.1.0`，允许 0–8 张。ZIP 读取器按版本分别校验；未知 Schema 不暗中迁移。
- 旧 3D 工坊定向保护：`自制工具/map_editor/package.json` SHA256 `844376c36eb02ae09acd6571ddb4ecb9c6b4a81aa8a282cf36d07a28c1d96ad9`，旧 `release/星骸地图工坊-Workshop-M2.0/星骸地图工坊.exe` SHA256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`，与接手时一致。这是定向检查，不宣称并行工作树其他文件完全未变。
- `git diff --check` 对本轮路径通过；未修改旧 3D 工坊、游戏代码、用户维护区或开发细则。2026-10-09 的发布只涉及本任务代码、文档与自制样包；提交和远端 SHA 以发布交接为准。

## 停止点

本轮最小内核、声明式字段、三组样本和回归已交付。桌面仍显示第一轮固定证明样例；动态选预设、自由选图、保存草稿、AI 生图、拼接、正式素材和 Unity 导入属于后续阶段。先请用户审阅预设字段、默认和优先级，再决定 2DW-03 的实际表单。
