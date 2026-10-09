# 2DW-02 可组合预设契约

本阶段仍是离线静态 PNG **任务包生成器**。受信任定义位于 `core/presets/catalog.ts`，用户选择和本次填写值通过 `core/compose-preset.ts` 组合；`core/task.ts` 对外导出 `listPresetChoices`、`describePresetForm`、`composePreset`，并保留第一轮的 `resolveSpec`、`compileTask` 等 API。

## 五维与两个种子

每项身份都带明确 `id`/`version`：用途 `generic-asset@1`、结构 `standalone-static-png@1`、操作 `create-new@1`、人工风格档案 `project-neutral@1`、适配器 `codex@1`。种子为 `standalone-static-png@1` 和 `custom@1`。这是经过测试的**最小种子库**，并不代表植物、农田、建筑等专业规则已实现；其他 AI 适配器也未支持。

`listPresetChoices()` 给出两套可选的完整身份。`describePresetForm(selection, partialValues)` 返回纯数据字段顺序、显示/必填/可编辑状态、来源、默认或推导值、候选项和错误。它不创建 DOM，也不保存草稿。后续 2DW-03 可用这份声明构建界面，但应仍以 `composePreset` 结果作为实际权威校验。

字段若被可信规则硬锁，描述中标为只读并给出锁来源；已经填写的任务身份、标题、参考声明与要求文本也会进行同源校验。选中的种子版本同时写入组合身份和顶层 `presetVersion`，不能出现包内两种版本说法。

`composePreset(selection, values, referenceFacts)` 直接返回一个不可变的 `ResolvedAssetSpec`，而非第二份可修改的规范。用户值白名单仅包含任务身份、标题、内容/风格文字、宽高、正方形锁、Alpha、PPU、参考图与三个文本要求层级；用户不能传入 `presetDefaults`、`hardConstraints`、`fieldSources`、输出路径或格式。增补一种可信用途定义可通过应用代码级 `createPresetComposer(catalog)` 完成，不需要复制 Prompt，也不能把任务 ZIP/外部 Agent JSON 当成注册表加载执行。

## 合并、锁定和来源

普通值按项目默认 → 用途 → 结构 → 操作 → 种子 → 显式用户值合并。项目提供 PNG、100 PPU 和默认目标路径；结构提供 Alpha 默认透明、正方形锁默认关闭，并锁定 PNG 与安全 `output/asset.png` 路径。普通默认若与任一已声明硬锁冲突会报 `constraint-conflict`，包含字段、规则和双方来源；仅项目普通默认可让位于更具体的可信硬锁。适配器和风格档案不得改变结构化尺寸/PPU/Alpha。

勾选正方形且仅给宽度时，高度由宽度推导，来源为 `derived`；明确给出不等的高度时报 `output.heightPx` 的 `square-locked` 冲突。未勾选时接受非正方形。PPU 始终与像素尺寸分离，世界尺寸仅作宽/高 ÷ PPU 计算；显式填写 100 也标为 `user-override`。Alpha 只接受透明必需、不透明必需、允许 Alpha 三态。

风格档案保存版本化人工说明与文字约束；本次 `styleDescription` 是另一份用户值，不能悄悄改写选中档案版本。风格参考身份来自已核验的 `style` 角色参考图及 SHA256，不做自动看图识别或素材风格推断。自定义模式允许 `hard`、`preferences`、`creativeFreedom` 三层内容文本，但均不能覆盖 PNG、宽高、PPU、路径或来源事实。

## Schema 与旧包

新组合规范是 `schemaVersion=1.1.0`，增加 `composition`、`styleProfile`、`output.squareLocked` 和更细的 `fieldSources`；旧 `resolveSpec` 路径仍输出 `1.0.0`，固定六文本及黄金 ZIP 保持原字节。ZIP 读取器显式接受 1.0.0 与 1.1.0，前者保持原 1–8 图规则，后者允许 0–8 图。其他版本报错，不隐式迁移。参考图仍须由 `readReferenceFacts` 解码核实，`compileTask` 从同一规范生成六文本，`exportZip` 添加 manifest 和真实图片原字节。目标 `output/asset.png` 是未来成果，任务 ZIP 不包含它。

2DW-02 当时未做完整桌面表单。后续 2DW-03 已将上述声明式字段接入独立 Electron 工作台，主进程负责参考图令牌、真实 PNG 核验、预览和另存为 ZIP；用户可在两种 seed 间切换、编辑三层自定义要求。可信预设目录和 Schema 规则未改，旧 2DW-02 A/B/C 样包仍是当时的原件。桌面操作与本轮结果见 [工坊说明](../README.md) 和 [2DW-03 验收](VALIDATION-2DW03.md)。用户自定义注册表保存、图像生成、拼接/裁剪、Unity 导入和便携发行版仍未实现；测试图片不是正式美术资产。
