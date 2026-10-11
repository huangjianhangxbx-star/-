# AL-ITEM-01A 实施步骤

基准 4fa481511c061d6b2600dac79aeefc648ffffb2d，已批准计划见 approved-plan.md。架构：WorldInventory 唯一维护团队/阿尔库存；独立 al-items.ts 维护转交事务、纯候选与决策接受；现有 CompanionCombat 安全决策缝执行道具，regen 使用现有 healHealth。B 级模块验证。

- [x] RED：守恒/拒绝纯度/兼容/候选/唯一消费/生命周期。
- [x] GREEN：5槽空后备，团队药2；原自由槽团队拖入 give1 + priority，后备设优先不转数量。
- [x] 现有背包局部后备区及原位自由槽状态，安全拖放与请求revision。
- [x] 真实键鼠1920/1280、自然伤害治疗、Z抑制、继续/新世界；核心fixture单独标注。
- [x] 类型/构建/受影响小集，记录 SAMPLE、未试项与用户Gate，选择性GitHub main推送。

SAMPLE沿批准计划：5槽，每次转1；药4HP/s×5s，活体HP≤65%，3米同层视线，不主动走位，每.2模拟秒判断。不能取消已接受动作或抢避险；已有regen不重复服用。未来gift/model-drag只明确拒绝。保留FARM/Y/装备/成长与黄金战斗参数，不改用户区/细则，不Gitee。
