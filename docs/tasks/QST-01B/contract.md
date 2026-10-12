# QST-01B｜有限探索任务契约

本轮用户明确要求执行附件，授权实现其有限样板；附件原文的“待批准/不授权写入”是提案身份，原样保留于 approved-plan.md。奖励、距离、任务名为 SAMPLE，不是正式永久平衡或原作还原。

- 正式新测试世界增加一项可选任务：失火储藏室调查。前厅 `(9,8)` 接取，储藏室西侧 `(32,8)` 调查。原地图同层 floor，实际正常键鼠路线可达；入口至调查点 BFS 28 米。两点避开篝火及两田，不重画地图，不生成保护区，不改敌人随机生成顺序。
- 世界地点唯一记录 `WorldPlace.quest = {status, revision}`；状态只走 notStarted → active → completed，0/1 与1/1从状态派生。旧 objective/cleared/mechanisms、出口资格保持各自意义。
- `QuestRequest`携 worldId/visit/placeId/pointId/expectedRevision/actorId/controlRevision。queryQuestInteraction 纯读；acceptQuestInteraction 再查当前访问和身体资格，拒绝死亡、非实控、动作锁、瞄准/指令、不同层、不可见、隔墙、超过1.2米、错误阶段及陈旧请求。UI另查暂停、模态、失焦与持有战斗指针，不能用DOM进度作为权威。
- 接取不付款；完成仅经 economy.credit 将 +10 生命力记入随身，同一个 worldRewardKey/economy.rewards 去重。先确认可入账并成功 credit，才登记奖励键/完成/递增revision；拒绝不改任务/经济。没有永久账户入账或暗中结算。resource/campfire/farm各走原消费者。
- 合法离开/继续保留当前世界的任务与奖励记录；未完成不新增出区门槛。确认新世界重新未接取，旧奖励不跨世界。刷新不提供长期存档。
- 复用探索目标折叠区的一行状态、现有点位按钮和场景 groundMark（仅准确标签）。仅可见点位显示，远处目标文字不额外开雾。已接取/完成按钮禁重复；核心仍独立拒绝重放。

实际任务落点可处于交战区域，符合存活可行动资格即可调查，并不要求全房清敌。它不是篝火安全点；未改变原篝火、入口、出口5米敌人排除。无NPC、任务链/第二任务、自动寻路/传送、全图图标、编辑器、新美术、长期存档或后续 SUR/BLD/VAL。
