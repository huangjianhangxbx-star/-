# SK-01B 准备方案与世界运行契约

执行依据：用户本轮批准执行 SK-01B v0.1；接手本地与 GitHub main 均为 c315fc3b8bd04eb178d74cb43683398da3a1cd9f。适用根 AGENTS、开发细则 v2.2 §7.1.1，以及 SK01A/F01、EQ01/EQ02、CB02、LT01、NR01 相关契约。

`GameState.rightPreparation` 是两人下一次出征选择的唯一权威，只含 owner、稳定主武器定义、职业及 Q/E/R 技能 ID。猎人 `hunter-golden-main`，阿尔 `al-golden-main`；不保存世界实例 ID、CD、费用、当前动作或收益。未来三级变体/被动的预选归属此方案，本轮不添加无行为的候选。

准备页以 command → configurePreparedSkill 修改；queryPreparedSkillChange 只读。仅两名真实职业、本人的稳定主武器定义及现有同职业非原生候选可配置 Q/R，允许空槽。选择另一槽的技能时互换；同槽选择幂等。E 固定原生盾冲/火箭弹射。配置不推进时间、扣费、产生装备损耗或战斗动作。

出发经原 carry/beginWorld，复制方案到 MainInstance.skills；主武器/技能实例按新 world ID 建立，CD 从零开始，支付和动作继续由原消费者管理。模板与运行 slots 不共享对象。C I/II 共用配置，左手盾/射击器/炸弹不参与主技能资格。黄金动作与原生 E 数值未改。

同世界 continueWorld、LT01 死亡返场保留既有运行实例、CD 和支付序号。确认 restartWorld 后只保留局外库存、worldGeneration 与两人方案，下一世界重新建立运行数据；不携入旧世界消耗资源、派生动作或收益。原二次确认继续有效。

合法世界内脱战改配沿用 SK01A 安全门；成功后仅同步该 owner 的方案，保持按技能归属的 CD，拒绝不改任何选择或资源。这是本轮暂定易用性策略，尚非用户永久设计认可。接受动作的冻结快照/单次支付/主 resolveHit 不改。

两人各两项 Q/R 继续显式 SAMPLE。仅当前页面会话跨新测试世界保留，刷新不存档。未实施 SK02、V、level0→3、三级被动、睡眠、第二主武器或 AI 自动施法；停用户试玩。
