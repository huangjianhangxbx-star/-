# T-032 / XC05 持续 MoveOrder Implementation Plan

基准 main@e81087073a8824b96823b80285a421098007d40c，与附件及最新两轮对话一致。game 无未提交差异，697 条既有修改、历史证据和保护文件已快照到 work/T032。用户批准实施、提交推送 GitHub main；不推 Gitee，不改 AGENTS、开发细则、人工原稿。

Goal：每个本体独立保存最终目的地，使临时战斗/物理动作不丢失移动命令。
Architecture：move-order.ts 持有签发、替换、暂停、恢复、重寻路、完成/取消；exploration-control 拆分战术与局部自动权限；engine 接入既有移动、Basic、技能和成功玩家动作。
Tech Stack：现有 TypeScript/Vitest/Playwright/Three.js，无新依赖。
Spec：[原始计划](T-032-XC05-原始计划.md)，完整字节副本。

已核对基础细则 v2.1、AGENTS、T029/T030/T031 任务/契约/验证、CurrentRules 及相关控制/移动/AI/技能/导航/交战代码。引用的 XC 清单未在仓库或下载目录找到；已有批准附件覆盖本轮范围，未发现实施冲突。不另造专项细则。
使用 brainstorming 核对已批准架构、writing-plans 落入用户指定任务目录、TDD 验证、domain-modeling 维护术语。执行子技能未提供，沿用本线程逐步执行；没有必须 grill 澄清的设计冲突。

## 步骤与接口

- [x] 接手、原始计划存档、未提交修改与保护快照。
- [x] Core RED：confirm 创建每角色订单，来源、替换、双订单、空 path ownership。
- [x] move-order.ts：moveOrder/hasMoveOrder/issueMoveOrder/cancelMoveOrder/completeMoveOrder/suspendMoveOrder/advanceMoveOrders/queryMoveOrderRoute；路径复用 navigate、canStop、radius、交战域 guard。
- [x] Aim suspend/resume：保留旧目标、取消从现位置恢复、新确认替换；原 legacy move 限制仅对未升级的 legacy 保留。
- [x] tacticalAutonomyAllowed / localAutoCombatAllowed：Reservation 禁两层，Order 禁战术/跟随但允许局部自动；Basic 在可命中活动敌人时暂停路线，不追怪，结束不等 CD。
- [x] 前台技能、闪避、强制位移、硬直存活；跨层原子完成；临时阻挡 .25 秒重试，真正非法取消并留原因，到达才完成。
- [x] 成功玩家意图取消，失败保留；focus/身份改变不取消；队伍命令逐角色接受后取消。
- [x] 浏览器 A–H、T027–T031 与 Tower 回归、全核心/类型/构建。
- [x] 工程契约/验证/状态/索引/对账，保护检查，限定暂存与 GitHub 发布复核。

不做 XC06、新 Basic 连段、Aim UI 扩展、正式 HUD、VFX/SFX 或轮盘。自动验收不替代用户手感验收。

实施与自动验收完成：998 个核心用例覆盖通过；8 组新浏览器及 69 项历史回归覆盖通过，类型/构建通过。T027 更新废除的普通点击输入，T030 排除 Hunter 干扰；记录保留修正前证据。发布只含任务范围与工程标记块，提交后用 work/T032/publish.json 复核远端、保护与原状态。人工手感待试玩，XC06 未实施。
