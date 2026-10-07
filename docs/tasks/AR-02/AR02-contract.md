# AR02 旁路身份与事件契约

基准：GitHub main `62a0dc8df9f34c94616fdca2f9a3bb7c0bd41e9c`。依据用户批准的AR02计划与AR01迁移蓝图。纯工程缝合，无新增玩法规则；不回填人工原稿。实现范围为独立暗牢探索主游戏；Tower和非standalone历史测试场保持旧路径。

## 权威与数据

`combat-identity.ts`只记录，不能授权、支付、命中、调度、取消或触发成长。没有EventBus、订阅者、装备/成长消费者、Debug伤害/推进接口。所有原资格、输入、时钟、资源和结算继续权威。

- **Request**：被拒绝或进入Basic buffer仅写请求记录，未创建ActionContext。真实Basic `start`才创建；buffer实际消费创建一次。
- **ActionContext**：generation/actionId/rootActionId/parentActionId、actorId、requestSource/requestId、kind/stageIndex、slot/slotSkillId/executedAbilityId、acceptedAt及已有legacyCastId/entityId。没有请求ID的旧技能接口不发明ID。
- **AttackEvent**：一次真实攻击机会，允许挥空和HP0；不是伤害成功。含独立attackEventId、来源动作链、releasedAt及已有wave/entity映射。不会把attackEventId写入旧全局eventId去重集合。
- **HitOutcome**：旧resolveHit返回值原样记为resolveAccepted；分别记录HP前后/净损失、posture前后/原applyPosture.applied、life前后及旧eventId/castId。致死resetPressure可能令postureAfter回到上限，不能用净差代替applied。
- **Lifecycle**：仅记录已经发生的pending/run/time移除、释放、期限结束或旧Echo移除。节点触发已知时用legacy前缀标注；不推导统一取消规则，不按父动作结束清Echo。

requestSource：Basic明确player-input/companion-ai/order-auto；敌人真实Telegraph为enemy-ai；玩家技能为player-input；自动技能/准备为system。自动技能由现tick调用，没有不存在的AI请求ID。派生动作继承原来源，不改成当前DirectActor。

## 作用域和ID

每个GameState懒建独立combatIdentity；不使用模块级单例。action/attack/sequence计数器独立于旧s.nextId和RNG。元数据只附现attackPending/SkillState/SkillRun/SkillEcho/AttackIntent；无无限Context registry。每份trace最多512条，超限丢最旧；长期日志不能保证仍有根动作的最早记录，剩余事件保留根/父ID。

withCombatRequest/withCombatAttack只是同步观察作用域，用finally恢复外层；没有scheduler和延迟回调。多目标同一机会共用新attackEventId，旧resolveHit仍各自生成或消费旧eventId。雨箭每个实际发射slot独立wave；连续扫掠/留席/场迹按旧采样机会记录，不添加新命中频率。

新世界独立；同对象newExpedition/selectJourney/selectScenario/enter/enterExplorationNode成功时清trace并增加generation。旧generation元数据不能作为新攻击来源。reset不删除任何游戏对象/旧技能状态，也没有需要解除的订阅。

## 查询与隔离

combatTraceSnapshot返回小记录的深复制，调用者修改数组/嵌套context不会修改内部trace。configureCombatTrace仅为测试/开发开关，无玩家UI入口。disabled不生成身份/日志，不影响旧执行；resolveHit直接委托旧主体，不做前后快照。请求取消比对仅在已有观察状态启用时扫描少量技能状态。

原combatEvents仍在原位置写入。显式eventId重复拒绝、规避先消费eventId、RNG、姿态/Break/impact、灰血返还budget、费用/CD/耐久均未改。旧resolveHit主体精确比对只多两处标量结果捕获，见验证记录。未记录无法直接观察的shield/guard/reaction推断字段。

相关：[路径覆盖](AR02-path-coverage.md) · [技能覆盖](AR02-skill-coverage.md) · [验证](AR02-validation.md) · [交接](AR02-handoff.md)。
