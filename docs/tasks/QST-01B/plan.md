# QST-01B Implementation Plan

**Goal:** 一个正常键鼠可接取、调查、唯一奖励的世界内可选任务。

**Architecture:** WorldPlace.quest 保存 notStarted/active/completed 与revision，正式世界建立时初始化。新 quest 事件显式分派到纯查询/接受事务，不写旧 objective/mechanisms；奖励复用worldRewardKey/economy.credit/rewards。HUD只复用探索目标details，场景沿用旧标记仅补准确文字。UI暂停/模态/失焦/瞄准/战术门与核心actor/visit/revision门分别验证。

**Tech Stack:** TypeScript / Three.js / Vitest / Playwright Edge。

**Spec:** approved-plan.md；当前用户明确执行范围优先于附件草稿标签。writing-plans/TDD 在当前会话执行；未使用不可用的 executing-plans 或新子代理。

## 基准与保护

main/GitHub=f428490814dcb4da7ca29b55dcaf856f67f6eefd，目标游戏源码clean。工坊、旧记录等dirty保留。两点暂选accept=(9,8)、investigate=(32,8)，同层现有可达floor，BFS28米；不插入敌人生成的safe列表，避免改既有seed结果。最终用真实路线验收。奖励10随身生命力SAMPLE，不入永久账户。

## 实施与验证

- [x] RED：新 tests/qst01b.test.ts 经引擎事件验证接取/完成、旧objective不变；重复/伪造/无效actor/可见路径/奖励失败保持原状态；离开/继续与新世界。
- [x] GREEN：core/quest.ts 创建 QuestRequest/worldQuestView/queryQuestInteraction/acceptQuestInteraction；exploration-types/types/standalone/world-session/exploration/engine做最小登记与转发。app建立请求并校验输入所有权；hud显示派生状态，scene旧标记文字适配。
- [x] B：node vitest run tests/qst01b.test.ts tests/world-session.test.ts tests/exploration-events.test.ts tests/standalone-exploration.test.ts tests/economy.test.ts tests/farm01.test.ts tests/healing-bottle.test.ts；tsc --noEmit、主build。少量真实接取/路线/完成/重复与输入拒绝、1280原位；合法exit生命周期核心配合，FARM/Y代表复用定向短故事。
- [x] 交接：contract/validation/handoff、相关共享记录增量；独立索引保护其他dirty，选择性GitHub main、不Gitee，停用户Gate；SUR/BLD/VAL不启动。

事务顺序：纯验证 → 检查奖励键/余额可入账 → credit成功 → 登记reward键 → completed/revision；无付款成功不写completed。请求校验worldId/visit/placeId/pointId/revision/actor/controlRevision，不保留旧访问消费者。

最终：48核心/地图定向项、5键鼠故事/type/main build/ActionLab启动通过；历史6失败基准区分、范围冻结。发布父提交安全吸收工坊9bbabc6，不改其文件。见validation.md。
