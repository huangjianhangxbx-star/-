# TOOL-006 桌面工坊 UX 修正实施与验证

基线：GitHub main 与本地 HEAD 均为 7575cdf44507aa3cde7cbd2e1dc3b5cd4dc3b26b（2026-10-04实际查询）。用户明确批准四项 UX 修正，本轮仅本地实施和验证，不推送。

## 边界与设计

沿用 WorkshopSession / SceneSession / 模块 history 和原 cloneAsset / takeLibraryForAssembly，不改 core 文档、发布、交换配方、Unity Baker、Legacy 格式或游戏规则。深灰黑默认主题，不新增主题选择；无需主题持久化。Legacy 保留其原浅色默认值。

装配三列：左侧场景层级与 Inspector，中间视口，右侧可放入资产。右侧明确区分当前场景资产 / 公共库；同页选择、重载、搜索，公共条目拖入创建独立副本。较小窗口收窄两侧，并允许各面板独立滚动。工具/资产/颜色开关用展开状态、pressed 和视觉共同表达，已存在的选择高亮保持。

暗色语义变量覆盖背景、面板、Inspector、卡片、输入、下拉、按钮、Dialog、状态、公共库、编辑视口及其周边。暖铜强调选择/主操作，冷青辅助状态，不改变源材质/色板颜色、灯光、输出或交换。

## 实际基线

真实 Electron：复制后 Ctrl+Z 仍2实例，按钮撤销后 Ctrl+Shift+Z / Ctrl+Y 仍1实例；Ctrl+S 后新场景未落盘。输入框 Ctrl+Z 未误撤销场景。无库时装配选择入口/空状态均0，公共库位于左栏 y≈987（1440×900窗口底部之外）。工具/资产只有 aria-pressed 翻转；色环无 pressed 或明确状态标签。Workspace、工具/模式、色板槽、实例和轴拖拽已有部分 active 反馈。截图/JSON在 map_editor/validation/workshop-ux。

## 实施步骤

- [x] 快捷键：先写实际 Electron Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Ctrl+S及输入框、select、textarea、模块/场景隔离回放，观察红测试。desktop/workshop.ts 路由场景，desktop/renderer.ts 保证隐藏模块不收快捷键，输入控件和对话框内保持编辑行为。不在 core 新建历史。
- [x] 资产浏览：先断言无库空状态、同页选择/重载/搜索、右侧布局与拖入后不同assetId/paletteId/源字节保持。desktop/workspaces/assembly.ts 调整布局与浏览；workshop.ts 共享已有库选择与重载入口。公共拖入仍调用原 Context.drop，不修改 clone。
- [x] 状态：先比较移开鼠标后的展开/关闭视觉与属性，检查工具/模式/色槽/选中实例/资产/轴拖拽/Workspace。renderer.ts 统一开关状态，assembly.ts 与 workshop.ts 补齐 pressed/selected。CSS 不让 aria 只有语义而无样式。
- [x] 暗色：在真实 Electron 对四 Workspace、模块周边、装配、HTML Dialog检查实际 computed colors 与截图（1440×900和1000×700），观察基线失败。style.css 原样式位置改用语义变量并保持Legacy默认值，workshop-theme.css定义暗色token，workshop.css按布局组织，不堆尾部临时覆盖。视口只换UI背景/网格，不改资产材质或灯光。
- [x] 回归与报告：pnpm exec tsc --noEmit、pnpm build、pnpm test、新UX回放、现有模块/装配/墓室/Legacy布局受影响回放。对禁改目录/文件hash，与基线一致。查看实际截图，记录 A复现真Bug / B可发现性 / C修改 / D验证 / E手感待验收。更新本任务状态段及当日日志。无本轮推送授权，不提交推送。

## 验证命令

```powershell
pnpm exec tsc --noEmit
pnpm build
node tests/workshop-ux-ui.mjs --case keyboard
node tests/workshop-ux-ui.mjs --case library
node tests/workshop-ux-ui.mjs --case states
node tests/workshop-ux-ui.mjs --case theme
pnpm test
node tests/workshop-assembly-ui.mjs
node tests/workshop-module-ui.mjs
node tests/m11-layout-ui.mjs
```

UI 验证使用受控文件选择结果，真实主进程、存储、history、视口和拖放仍执行；不以模拟DOM代替Electron。UI新文件/核心未变更，Blender和Unity原交换证据不重新冒称本轮运行。

## 完成结果

四组真实 Electron 回放全部通过；两尺寸四 Workspace及三种HTML Dialog通过并已查看截图。183核心测试、类型/构建、模块/装配/墓室资源稳定和Legacy布局回放通过。69项禁改源码/契约与基线hash一致。便携包已更新并通过实际EXE新旧入口烟测，插件25文件及SHA256保持不变。A–E完整报告见[Workshop-UX](../../自制工具/map_editor/docs/Workshop-UX.md)。2026-10-05：用户明确授权提交并推送 GitHub。本轮 UX 验证基线为 7575cdf；提交基于当前 main f5fb4bb，发布目标为 GitHub main。
