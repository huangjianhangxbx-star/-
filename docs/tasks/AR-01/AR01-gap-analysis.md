# AR01：差异分类与风险

基准 dfe16b4。分类为真实能力差异，不据计划举例反推代码缺失。未来接法为 AI RECOMMENDED。

## A．已有，只需接线

- T035 DirectActor、切换 revision 和未确认 Aim 失效：保持 direct-control / exploration-control。
- SkillInputDefinition、AimSession、slot 身份、确认资格：保持 skill-intent / skill-slots。当前定义和类型扩展能力分开记。
- Companion AI / order-auto 请求来源、T036 收件人/策略：保持 basic-chain 和 party-tactics。
- 集中 resolveHit、空间/方向/姿态/位移/反应链，非新造伤害引擎。
- basicRelease 和表现读状态已有挥空/取消区别；新桥不能让这些再次重复发声。

## B．有概念，需要扩展

BasicChain 当前 default 两阶段，执行 timing 仍由 attackPending/attackTimer 控制；未来替换执行部，保留请求/缓存/订单接线。SkillRun 有 id、快照和时钟，普通技能另有计时器；统一上下文需覆盖两类而非另建输入。

Mobility 已有猎人瞬影和伙伴有限时闪避，不应按“从同一种闪避拆分”重做；后续能力接口包住当前碰撞/次数/无敌权威。资源和防御的具名规则已经存在，需要统一查询外观而不是抹平语义。

SkillEcho 已有延迟、source 快照、castId、hits 和特定 detached 政策；需要补 root/parent/取消作用域。enemy-combat 已有 kit/AI/intent/锁定/反应，新增实体只替换适合迁移的发射后路径，不重做索敌。

## C．缺少的最小共享层

1. **身份上下文与只读事件桥**：action/request/root/parent/source/slot/executed、AttackEvent 以及分项命中结果。AR02 只做这一层，保留旧执行。
2. **角色能力查询接口**：canPay/pay/gain、mobility、optional defense、basic definition；需后续已批准角色规则才能实施。不是 AR02 必备代码。
3. **独立攻击实体路径与显式取消域**：主游戏目前没有与 Lab 等价的飞行实体集合。未来新增最小主路径，复用空间碰撞和 resolveHit；现 FX 不再承担不存在的碰撞事实。

“EffectiveHit”命名要精确定义：接触已通过规避是一个事实，实际 HP 损失和姿态应用是另外的事实。建议事件包含 outcome，消费者显式选条件。不能把主 resolveHit 成功全部包装为 Lab damage>0，也不能改变原返血预算。

## D．Lab 专用，不迁移

Canvas 页面、有限世界坐标、固定种子场地、原素材 loader、Spine 单独呈现、SAMPLE 角色数值与键位，以及 LabWorld 的另一份 HP/碰撞权威。保留实验入口作回归参照，不清理或删除。

## 优先风险和处理

| 风险 | 实际现状 | 迁移保护 |
|---|---|---|
| 输入成功误记动作开始 | requestBasic ok 可只是缓存 | ActionAccepted 只在 start/真实技能启动记录 |
| 挥空意外扣费/触发旧统计 | basicRelease 产生但 releaseAttack 未必调用 | 事件旁路，不提前调用 releaseAttack |
| 多目标伤害消失 | explicit eventId 是全局一次消费 | context/attackId 与旧 eventId 分开，不更改去重 |
| 护盾接触误返成长资源 | true 可 HP0、姿态仍有效 | outcome 和消费者资格分开 |
| RNG/顺序变化 | nextId 混合效果/伤害/其他身份 | 新身份独立命名空间，禁止额外消耗 RNG/nextId |
| 中断抹掉已生成效果 | SkillEcho 按类型生命周期 | 先追溯现政策，不能全局 cancelAll |
| AI抢实控/重新双焦点 | T035、T036、MoveOrder已有边界 | 只接原 requester，不能复活 commandFocus |
| 技能覆盖不完整却声称完成 | 普通技能、特殊Run、模式派生、DoT路径不同 | 覆盖表明确 observed/legacy/unattributed |
| 把资料当原作验收 | SAMPLE、资源来源、OBS分层 | F01体验 PENDING，原作结果无证据空白 |

本轮无需要停下的目标/范围冲突；上面的参数、角色选择和未来语义细化均不阻塞只读蓝图。下一实施授权若要求改变规则，应暂停受影响部分并按 grill-with-docs 澄清，不能把本轮建议当批准。
