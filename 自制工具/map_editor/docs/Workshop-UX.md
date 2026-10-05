# Workshop-M2.0 本地桌面 UX 修正

2026-10-04，基于实际 GitHub main / 本地 HEAD `7575cdf44507aa3cde7cbd2e1dc3b5cd4dc3b26b`。本轮仅本地修正和验证，不提交推送。不改资产/场景/发布文档、交换配方、Unity Baker、Legacy格式或游戏玩法。

## A. 经实际复现确认的问题

场景已有可用撤销/重做按钮与 history，但 Ctrl+Z、Ctrl+Shift+Z、Ctrl+Y 未路由到场景；Ctrl+S也未保存新场景。工具/资产开关的 aria-pressed 与实际展开语义相反，且没有对应视觉；色环没有明确开关状态。Root选点进入模式后按钮没有状态。原默认整体浅色，模块绘制视口与Dialog有亮色区域。以上有真实 Electron 基线 JSON/截图与失败断言。

输入框 Ctrl+Z 没有复现误撤销场景，原有保护保留并加验。Workspace、绘制工具/模式、色板槽、实例选择与轴拖拽已经有部分 active 反馈，沿用并补齐语义与统一样式。

## B. 原功能已存在，但可发现性不足

公共库拖入独立副本与 clone机制已存在。原入口位于左栏底部；1440×900实测库容器 y≈987，未选库时没有空状态或选择按钮，只能返回项目页。原模块资产库和批量命名/独立检视仍保留。

## C. 实际修改

- 活动场景接收 Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y / Ctrl+S，模块接收自身 history（补齐 Ctrl+Y）；非编辑工作区不操纵隐藏编辑器。input/select/textarea/contenteditable 和 Dialog内留给正常编辑。
- 装配左侧为场景层级/Inspector，右侧为可放入资产；分“当前场景资产 / 公共库”。默认公共库页明确“尚未选择公共库”，同页选择、重载、搜索；拖入仍调用原 clone / Context.drop，源与色板身份独立，公共原件不变。
- 工具区、资产区、颜色区显示展开/关闭文字、pressed/expanded和暖铜高亮；工具/模式、色板槽、资产/实例、Workspace、轴拖拽及Root选点有明确视觉和状态。原选择反馈保留，折叠详情使用打开态边线。
- 深灰黑默认主题以 workshop-theme.css 语义变量管理；覆盖完整面板、输入、下拉、卡片、库、状态、Dialog、视口背景/网格与模块周边。暖铜为主要强调，冷青为辅助状态；源材质/色板/灯光不变。Legacy使用原颜色fallback。本轮没有主题切换，因此不引入偏好保存。
- 1000×700收窄装配侧栏；模块资产工具行换行且按钮文字不拆行。打包白名单包含主题文件。

## D. 自动验证及实际视觉

真实 Electron四组回放通过：场景撤销/两种重做/快捷保存，原生输入撤销可用，select/textarea/contenteditable不误动场景，模块与场景history隔离，项目页不撤销隐藏编辑器；未选库空状态，同页选库/重载/搜索与真实拖放，落盘不同assetId/paletteId且公共文件字节不变；开关与选中态；1440×900 / 1000×700四工作区、批量命名/改名/独立检视Dialog的实际颜色与截图。

183项核心测试、类型、构建通过；旧模块/装配与真实十一实例墓室/20轮资源稳定回放通过，Legacy布局拖动/持久化/折叠回放通过。旧布局测试首次因先前保存的宽度已达480px上限而失败，现使用受控216px起始值并恢复原偏好；墓室回放按新资产标签切换再选择/拖放。未将这些测试夹具问题报告为产品Bug。

69项禁改 core、正式 Unity 接收器、Blender转换脚本和文档契约与基线核对相同（文本换行规范化hash）。本轮没有重新运行Blender或Unity交换；其契约没有变化。

证据：`validation/workshop-ux/` 内 baseline.json、red-*、final-ui.log、*-result.json、core-tests.log、types.log、build.log、*-regression.log、legacy-layout.log、contracts-unchanged.json及截图。本地便携目录更新后另有 package-smoke.log。截图已实际查看，不仅检查CSS。

复跑：先 `pnpm build`，再 `node tests/workshop-ux-ui.mjs`；单组可加 `--case keyboard|library|states|theme`。

## E. 仍需用户手感验收

真实连续制作中的快捷键习惯、拖入位置、侧栏密度与滚动、不同显示器下对比度和长时间视觉舒适度仍需你使用反馈。短回放不能替代长期大场景性能。没有扩展建模功能。

本地便携包实际新旧入口烟测通过；打包源码指纹 `d7394752409d914ccff79b6d18fee3625b69d1cb9d7b041f8d1261415c9f3c44`，插件 SHA256 `5f3b8dc5f18fe7327716b4a6eed3e26882dbaeb9013e1f24aff97f998ab44383` 与原M2.0一致。2026-10-05：用户明确授权提交并推送 GitHub。本轮 UX 验证基线为 7575cdf；提交基于当前 main f5fb4bb，发布目标为 GitHub main。
