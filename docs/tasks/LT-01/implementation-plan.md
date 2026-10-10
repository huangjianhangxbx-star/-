# LT-01 v0.3 实施计划（含 ROST-01）

基准 cc04ac2a6a6825ef6af271e4dbf5bd1d119166a6。用户已明确批准附件设计与实施；CB-02 仅技术完成，手感 Gate 不代签。使用 brainstorming 核对跨系统设计、writing-plans 落步骤、TDD 验证。无需重复确认局部实现。

- [ ] R0/R1：先增加 roster/default/非法 ID/开发夹具失败测试，再将 createGame、exploration-party、入口 UI 和 preload 固定为 hunter/ranger。
- [ ] R2：移除旧角色类型、角色专属配置/回血/救援/音效/素材声明；专属生产资源先记录 SHA256 再删除。公共职业技能执行底座按真实装备/夹具依赖保留。
- [ ] R3：迁移 CB-02 与索引夹具，定向测试、TypeScript、主构建和实际入口；单独提交角色减法。
- [ ] L0/L1：新增 party-lifecycle，复用 Unit.life=respawning；hurt 致死入口、tick 复生入口、direct-control 自动交接统一调用。死亡取消未释放动作，保留合法独立实体；浏览器只清旧持键与捕获，不取消幸存者动作。
- [ ] L2/L3：10 模拟秒等待、有限合法同层候选和 .25 秒重试；双灭 .5 秒可观察阶段后一次原子出生点恢复。HP/架势/体力满，付款 ID、弹药/CD/耐久及同世界进度保留。
- [ ] L4：存活者可以交互、篝火、离区/继续；scene 根据正式队伍身份隐藏友方 bar/buff，死亡整体不可见；原位 HUD 显示等待。敌人显示和黄金战斗参数保持。
- [ ] L5：限定 C 风险矩阵覆盖单死/双死、暂停、非法复活点、付款水位、控制输入、合法实体、持续世界、防重与显示。必要 3–5 条实际浏览器操作，主及 Action Lab 构建；记录失败与未测。
- [ ] 交接：删除清单、生命周期契约、验证、共享工程记录、选择性 GitHub main 发布；停止用户试玩，不进入 EQ。

接口：partyDeath(s,u)、tickPartyLifecycle(s,dt)、restoreRevivedStamina(s,u)；GameState.partyLifecycle 只保存全灭截止与事务次数，inputEpoch 专供客户端自动交接，不复用支付或世界代次。落点依 canStop/segmentClear/surface、实体危险集合；双人位置全部计划成功后才修改。

远端 TLS 首次查询失败，发布前重试核对。工作区其他工具及 t016 测试修改保留；共享记录仅选择本任务新增段落。不得修改开发细则、人工维护区或原始角色材料。
