# T-031 / XC04 显式 PathAim

基准 main@7afba6091e56658c980c0da64c5eecbe8adef916，game 干净。697 条既有修改与历史证据已快照至 work/T031。用户批准完整 XC04 计划及 GitHub main 发布；不推 Gitee，不修改人工原稿、开发细则或 AGENTS。

接手读取最新两轮对话、附件、AGENTS、基础细则及 T029/T030 控制与验证契约、CurrentRules、输入/移动/导航/可见性/交战域。未找到引用的 XC 清单 v0.2；附件和最新对话一致，无影响当前实施的范围冲突。

采用 brainstorming 核对已批准设计、writing-plans 记录步骤、TDD 验证权限与确认，frontend-design 沿用 HUD，domain-modeling 维护 AimSource 术语。无须 grill 澄清。

## 实施步骤

- [x] 接手、保护快照、原始计划字节存档。
- [x] 核心 RED：共享 AimSource、纯预览、确认重校验、Ready 与交战域。
- [x] exploration-control 泛化 Begin/Cancel；独立 path-aim 查询与展示缓存；engine 确认复用 move。
- [x] main F/按钮/LMB/RMB/同键逃逸及模态抢占；ui 最小按钮与提示；旧 Standalone 被动选路移除，Tower 保留。
- [x] 浏览器实际输入、核心回归、类型与生产构建。
- [x] 记录结果、保护检查、限定暂存、提交推送并复核。

不建设 XC05 MoveOrder、技能/机动 Aim UI 或模型/渲染变更。预览缓存只在展示层派生，不写 GameState；确认始终重新查询。

实施与自动验收完成：964 核心、类型/构建、63 个不同浏览器用例覆盖通过。保护结果与限定发布复核见验证记录。无持续 MoveOrder；用户手感待试玩。
