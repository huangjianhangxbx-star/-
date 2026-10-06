# T-027 / EC09 Companion AI 2.0

基准 main@adc531249bc0d584ef0da4ed1b86b61f30db9acf，2026-10-06。用户已授权按 EC09 计划实施、提交并推送 GitHub main；禁止 Gitee、开发细则和人工原稿修改。原始计划见同目录 T-027-EC09-原始计划.md。

目标：Standalone explorationBattle 的所有离手原本体采用 Encounter Domain 内的独立战斗 AI；旧塔防/庭院保持 Anchor AI。优先玩家命令与生命周期、再以真实延迟处理危险，按职业选择距离/方向/保护站位。只复用真实 Evade/Blink 与已有自动/背景技能，不做手动技能 AI 或 EC10。

实施顺序：

- [x] 接手：细则、规则与 EC01–08、代码、未提交修改及基准核对，保存保护快照。
- [x] Domain/身份/活动组并集与不拉怪路径测试→实现。
- [x] 独立 AI2 状态、控制交接、范围/方向/保护站位与稳定性测试→实现。
- [x] 可见预警、反应延迟、多危险与真实机动资源测试→实现。
- [x] 真实浏览器七场景、群战稳定性与全量兼容验证。
- [x] 参数、验证、规则/术语/索引/状态日志回填，保护检查，限定提交/推送。

接手结论：GitHub main 与本地 HEAD 一致，game 源码测试干净；697 条既有外部未提交条目已快照，不纳入本任务。截图属于 Unity T6，仅作参考。Skill 使用 brainstorming（已批准方案核对）、writing-plans、TDD；术语回填采用 domain-modeling。无影响实施的关键冲突，不需要重复 grill。

状态：工程实施与验证完成；用户玩法验收待试玩。

## 交付

新增 encounter-domain.ts / companion-combat.ts，接入模式分流、交接、移动、真实机动、技能自治查询与 Debug。25 项 AI2 核心检查及旧三槽 identity fixture 保留原断言；新增 t027 八个浏览器场景，真实鼠标/C/charge 和原地图 Normal 20 秒，另检查威胁结束后恢复归队。Tower/旧庭院、地图布局、敌人基础数据和 Manual 技能策略未重做。

最终核心 61 文件/836 项通过；TypeScript/生产构建通过。浏览器整套 70/71，T018 原位置断言随后完整两项复查通过；本轮鼠标与归队加严检查再次通过。71 个不同用例都有通过证据，但不声称整套一次全绿。失败与归队时 Broken/stagger 的解释见 [验证记录](T-027-EC09-验证记录.md)。

[参数与边界](T-027-EC09-EncounterDomain与AI参数.md) · [验证记录](T-027-EC09-验证记录.md) · [截图/JSON/日志索引](../../记录/验证/T-027/README.md)。工程记录只回填 T-027 标记段。保护检查与限定提交按 work/T027 的新鲜基准执行；推送 GitHub main，不同步 Gitee。自然感、倾向、密集战斗可读性与长期性能仍待实际试玩，未启动 EC10。
