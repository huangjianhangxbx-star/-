# AL-ITEM-01A 契约与接手

用户本轮明确选定 ALITEM01A v0.1 并要求实施；批准原计划见 [approved-plan.md](approved-plan.md)。接手本地与 GitHub/main 均 4fa481511c061d6b2600dac79aeefc648ffffb2d；本轮相关源码没有已有差异，其他未提交工作保留。基础细则 v2.2 与 AGENTS 已核对；brainstorming 核对已批准方案，writing-plans 建立实施步骤，TDD 首轮六个功能用例 RED 后实施，清空意图的旧请求问题另有 RED/修复；frontend-design 延续原黑底细边、绿灰配色和字体。没有新增重大设计缺口，未启动 grill。未调用 Unity 工作流或生成新美术。

研究对话“游戏核心设计”读取最近三轮：下一步、继续、礼物/给予入口与直接拖模型的后续愿望。工具返回的助手正文是不可读取内容引用，未声称取得该正文；本轮有效实施依据是完整附件。未来愿望不扩大本轮。

## 已批准语义

团队 stacks 与阿尔 alReserve 属于同一 WorldInventory，但数量各自代表真实持有者。hotbar 仍仅引用团队剩余 stock。companionFreeItem 仅代表固定 ranger 的优先意图。团队→后备/后备→团队每次原子转1件，同类叠加；从团队放自由槽，原子 give1 + prefer；从后备放自由槽，只设置引用。清空不消耗，不收回；耗尽保留意图。旧引用没有 reserve 时显示未持有，不暗送物品。原 INV01B/FARM 自由槽 TEAM 同量描述在本轮被明确替代。

库存转交/设置优先必须带 worldId、visit、ownerId=ranger、source=team/reserve、itemId、amount=1、expectedRevision；过期、外来、无库存、重复行、非安全整数、满/溢出均原子拒绝。清空有效意图同样推进 revision，防旧优先请求回放。UI拖拽在pointerdown冻结 source/revision，取消/blur/resize/所有权变化不提交，坐标不作为核心语义权威。

ItemKind 边界 farm/usable/gift/material/handoff。当前三农用项仅手动农田 consumer；唯一 usable 为 sample-al-regen。后备可持有农用品，但阿尔不种田。gift/model/未注册 item 请求明确拒绝，不吞库存；没有新造礼物、对话或模型拖放。

## SAMPLE（实施参数，不是正式平衡或原作事实）

5后备槽，初始团队缓回药2，阿尔空。药4 HP/模拟秒×5秒，总量最多20、clip max/gray 由原 healHealth 权威；药最后一帧只结算剩余时长，其他旧regen行为保持原样。使用目标为存活唯一原猎人/阿尔，HP比≤.65、3米同层、有视线，无现存有效regen；阿尔实控时停用自动选择。瞬时使用不增加新动作或动画、不移动投递、不取消任何已接受普攻/RMB/E/闪避/受击/强制/技能等动作，高威胁先避险。queryAlItemCandidates 只读；现有 advanceCompanionCombat 调 advanceAlItemDecision，每.2模拟秒评估，通过 acceptAlItemUse 唯一扣后备并加regen。成功记录有限32条日志；唯一serial在库存中，trace关闭不改变去重。唯一药可用时 preferred 优先，否则允许后备药合法 fallback（含农用优先）。本轮无多种可用药，未声称验证多药优先排序。

Z/改意图/离区不重新支付；世界/Tab/Space冻结模拟时间，继续保留 reserve、使用serial及身上状态。LT01死亡清状态、无退款，已有复活规则不改。新世界才重建 stock/空后备；刷新不存档。Y瓶、副手装备、FARM、成长暂缓与黄金攻击参数不变。

## 工程缝

al-items.ts：转交事务、纯候选、唯一使用；world-inventory.ts：创建药/空后备、原自由槽兼容；companion-combat.ts：已有AI循环的一行接入；engine.ts：命令分派/新药过期小数dt；backpack-panel.ts/geometry-hud.css：仅局部两栏后备；exploration-hud.ts：原位显示实际持有与条件状态；types.ts：请求类型。角色身体上的“持续恢复”反馈沿用原 Scene 状态显示。没有独立新AI循环，没有改变地图/碰撞/战斗FSM。
