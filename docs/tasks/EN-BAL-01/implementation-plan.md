# EN-BAL-01 高压试验实施计划

基准：GitHub/main 和本地 HEAD 均为 d8ab69a3fc08d1e5751f6ce0c2b62bff5673b9f2。用户本轮要求按附件执行；附件 00/03 明定本轮先 P1，P2 CB-02 需明确连续授权。本轮不启动 CB-02。

## 依据与设计

已读包内四 Markdown，4/4 SHA256 通过；较新研究对话确实提出两下破势、单接触三分之一 HP。助手最新回复仅返回 attachment reference，不声称读取其不可见正文。仓库根 AGENTS、开发细则 v2.1 §2/5/6/7、README、CurrentRules、相关索引/对账/状态已核对。4545 个接手 tracked 工作文件指纹冻结，game/src 无 dirty；无并行源码冲突。

本任务为已有 V2 接触链的限定行为扩展，采用已交付且用户要求执行的具体设计，不重新索取局部设计批准。使用 brainstorming 核对边界、writing-plans 记录实施、test-driven-development 先 RED 后 GREEN；无新的关键决策时不调用 grill-with-docs。采用单一 target-aware 纯估算函数，只在明确 high-pressure-v1 + 正式 session + standalone + 原 V2 敌人对在场本体生效。反解合法 flat armor 后仍仅调用既有 resolveHit 一次；Ward、方向、盾、无敌、主架势继续正常结算。危险观察针对同一目标查询相同估算，不引入不可见信息。

## 步骤与文件

- [x] E0 接手与包校验：work/EN-BAL-01-20261010/intake.py 保存包、清单、dirty 与共享原字节；旧动作/地图/素材、UI CSS 原封保护。全量基线、原始浏览器伤害样本单独留档。
- [x] E1/E2 先写 game/tests/enbal01.test.ts：原生 release→entity→主 step 的猎人/阿尔伤害、短间隔双击、自然恢复、盾方向/闪避、装甲、去重、三箭与代次、隔离/trace。观看旧代码 RED，再新增 game/src/core/enemy-pressure.ts，接 game/src/core/types.ts 与 engine.ts 唯一接触点。
- [x] E3 观察和 UI：enemy-observation.ts/companion-combat.ts 使用相同 target-aware 估算；enemy-pressure.ts/exploration-app.ts 正式入口 high 默认、baseline 与开发 explicit opt-in；exploration-hud.ts 原世界状态/帮助标注。combat-identity.ts 仅附加 hit-outcome 标量元数据。无 CSS/黄金参数修改。
- [x] E4 GREEN：定向 + 全量 core、tsc、主与 Action Lab 构建。记录每箭结果、双弓叠加；不偷偷添加群预算、不更改测试 HP 撑通关。
- [x] E5 真键鼠：game/tests/enbal01.spec.ts 普通路线真实 WASD 进入交战、HP 比例/破势、盾、Z/滚闪/G 与 mixed；两档 screenshots/只读指标；baseline 与高压各留样本，普通持续世界 baseline 长流程保护。
- [x] E6 任务 handoff/参数与风险、CurrentRules 的试验限定、状态/当日/对账/索引追加；alternate-index 白名单提交 GitHub/main 并核验，停在高压体感 Gate。

## 验收与限制

正常有效单接触 maxHp×(1/3±.02)，原始架势 .60×实际 maxPosture；blocked .5 架势、HP0，未接触/无敌0。每实体每目标仅一次、每弓仍3运输/原事件不变。数值为 SAMPLE 可回退，三箭都命中可近乎全血丧失，允许旧 LT01 濒死暴露但不改死亡规则。技术 Gate 与用户体感分开。CB02/LT/背包/成长/新怪/UI重排/地图/原始素材/用户维护和开发细则不在范围。

## 最终基准核对
接手d8ab69a；本轮期间同仓素材工具任务推进HEAD/GitHub至f23afa4，无game文件交叉。38路径逐一核对与该提交一致，共享两记录的既有字节及追加保留；选择性提交在f23afa4上发布。技术验收完成，E6发布以回执为准；用户体感Gate不冒充通过。
