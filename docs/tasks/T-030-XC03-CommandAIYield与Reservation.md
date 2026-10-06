# T-030 / XC03 Command AI Yield / Reservation

基准 main@aa1415df5082d273bd039f5e801a39dd55bb7707，与计划一致。接手游戏树干净；697 条既有修改、历史证据与保护区已新鲜快照至 work/T030。最新 ChatGPT 两轮和附件一致，原始计划按字节存档。基础细则 v2.1、AGENTS、CurrentRules、T027 AI2、T028 战斗节奏与 T029 控制契约及相关代码已核对。

用户批准执行并提交推送 GitHub main；不推 Gitee，不修改开发细则、AGENTS 或用户维护区。采用 brainstorming 核对已批准架构、writing-plans 记录实施、TDD 验证动作边界；domain-modeling 用于控制术语。不需要 grill-with-docs 澄清；执行子技能未提供，使用本线程执行。

## 实施步骤

- [x] 核对基准、规则、当前代码、未提交修改与保护区；原始计划存档。
- [x] 核心测试先 RED：官方 Begin/Cancel 命令、Reservation、AI路径、跟随、Basic、危险区、技能时钟与生命周期。
- [x] exploration-control 集中 query/begin/cancel/reserved/ready/autonomousStartAllowed；只存 kind/actorId/startedAt。
- [x] 队友 AI、跟随、Basic 创建、自动 Rain/Reap 启动消费统一 gate；保留已承诺动作和物理结算。
- [x] WASD/E/R/T/Shift 从 Aim 同键取消、接管再行动；模态和暂停仍优先。Escape 只取消 Aim，下一次才清焦点。Debug 只读状态，无新操作入口。
- [x] 官方 Begin Aim 接口及真实按键/时间的浏览器验证；旧控制和战斗回归。
- [x] 全核心、类型、生产构建；记录验收、保护与限定暂存，提交推送 GitHub main。

不实现 Aim UI、LMB Confirm、MoveOrder、PathPreview、新指令技能或机动面板；Tower/旧庭院/复制体行为不扩展。自动验证不替代未来绑定后的人工操作体验。

状态：实现和自动验证完成；948 核心、类型/构建、49 个不同浏览器用例覆盖通过。按授权完成保护检查和限定发布；人工瞄准体验留待 XC04。
