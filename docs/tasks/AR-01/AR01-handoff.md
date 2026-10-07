# AR01：交接与停止点

2026-10-07；基准 main@dfe16b4a82adc627df75d69c44b319e7bd4cdc5b。只读评审完成；未改主游戏或 Lab 源码，未开始 AR02、EC11、EC14、第三角色/敌人或新 RQ。未编辑开发细则、用户维护区或父研究正文。

## 入口

- [现主链](AR01-current-main-flow.md)：实际输入、请求、timing、空间/伤害/反应和表现。
- [Lab语义/冻结来源](AR01-lab-semantic-flow.md)：原来源、批准 SAMPLE、技术验证与用户体验分层。
- [采用矩阵](AR01-adoption-matrix.md)：21项 ADOPT/ADAPT/KEEP-LAB-ONLY/REJECT/PENDING。
- [差异与风险](AR01-gap-analysis.md)：A已有、B扩展、C最小新增、D实验专用。
- [目标架构](AR01-target-combat-architecture.md)：单一现结算权威、能力边界和挂接位置。
- [迁移顺序](AR01-migration-sequence.md)：唯一下一任务 AR02 工作包与行为不变验收。

## 十项验收回答

| 问题 | 本轮结论 |
|---|---|
| 1 哪些语义采用 | 请求≠接受、出手≠命中、身体≠危险存续、角色资源所有权和完整来源链原则；具体接法仍建议 |
| 2 哪些只留Lab | SAMPLE数值、Canvas/debug/local loader、有限arena和另一份HP世界 |
| 3 保留哪些主代码 | T035/T036、basic请求、skill输入/三槽、blink/evasion、kit/intent、空间/resolveHit、现压力/表现 |
| 4 哪些必须扩 | Basic执行定义、分散action身份、SkillRun/Echo来源/取消、未来独立攻击实体 |
| 5 最少共享层 | 第一刀只 context + AttackEvent + 分项HitOutcome旁路；能力/实体层留后续需求 |
| 6 Hunter/Partner挂哪里 | 现profession/unit定义后接角色profile/controller/能力，不把Lab角色一对一映射 |
| 7 Direct/AI如何共用 | 原source/permission提出请求，共用接受与执行；切换只转移下一请求权 |
| 8 T036怎么隔离 | 只改离手候选/风险/目标/路线，不改动作锁、支付、伤害和已生成效果 |
| 9 第一刀是什么 | AR02身份/事件最小桥，行为不变；本轮未开始 |
| 10 用户仍需决定 | 正式角色拓扑/技能、资源与盾防、具名成长消费规则、投射物死亡政策、F01体验 |

## 证据与权限

已实际读取设计聊天最新2轮，未以全文扫描替代较新内容；全文范围仅用户给的 AR01 计划。完成基准、GitHub main、空索引及5402既有修改/未跟踪文件保护清单核对。使用真实 writing-plans/codebase-design；无实现改动，未使用 TDD；没有阻塞本次文档的关键选择，不启动无必要 grill。

现有验证：Vitest 24文件、420测试通过（2.52秒，exit0）。范围为 T033–T036、attack-intent、skill-slots、skills-integration、pressure-integration、impact、enemy-combat 和 tests/action-lab；完整命令与原输出见 validation-logs.txt。本轮未运行浏览器或性能测试。F01冻结中的43浏览器测试是前轮证据，不冒充本轮新增验收。

F01 cadence/枪声/投射反馈/换弹继续 **PENDING USER ACCEPTANCE**；原作 OBS/实际动态结果无证据保持空白。不是取消 F01 实现，也不是阻止其他架构评审。AL04已有独立角色回归不升级为正式角色/正式参数通过。

保护与发布：本轮仅任务文档及工程记录追加块；共享记录的既有用户内容保留，索引使用 HEAD+本轮块，禁止整份脏文件加入提交。最终核对见 AR01-verification.json。只提交推送 GitHub main，不同步 Gitee；提交标识由 Git 历史确定，冻结文件不自引用提交 hash。

停止点：AR01结果已可审阅。唯一建议下一任务为 AR02，需下一实施指令；不自动继续。
