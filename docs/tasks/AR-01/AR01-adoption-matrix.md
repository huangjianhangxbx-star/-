# AR01：语义采用矩阵

决策标签描述本次蓝图的选择，不表示代码已迁移。证据状态分栏：USER APPROVED＝本次用户边界或既有明确批准；LAB VERIFIED＝Lab 技术证据；MAIN IMPLEMENTED＝基准真实代码；AI RECOMMENDED＝建议接法；PENDING＝仍需后续决定/验收。

| 领域 | Lab 输入 | MAIN IMPLEMENTED | 决策 | USER APPROVED / LAB VERIFIED | AI RECOMMENDED / PENDING |
|---|---|---|---|---|---|
| Input Intent | 请求与接受分离 | requestBasic 可缓存，Skill 确认校验 | ADOPT | 计划批准语义分离；Lab 请求/事件回归 | 接受事件挂实际启动；不改 LMB 纯手动 |
| Direct control | Controller 接受输入 | T035 controlledBodyId 唯一权威 | ADOPT | 用户明确保留 T035 | 沿用现实现，不移植 Lab 切换重置 |
| Action instance | action/root/parent/request | pending、SkillRun、castId 分散 | ADAPT | Lab 身份贯穿链成立 | 新增最小 context，旧生命周期先保留 |
| Basic topology | 角色不同段数/事件 | default 两阶段与职业查询 | ADAPT | 用户允许提炼模式，不指定角色映射 | 后续角色定义扩展；正式拓扑 PENDING |
| Attack/Move lock | 独立权限事件 | pending/foreground/locomotion 多处 gate | ADAPT | 分离原则批准；Lab 已验证 | 先记录原资格，后续再替换执行锁 |
| AttackEvent | 真实攻击机会与装备门 | attackCommit 是交战上下文；释放多分支 | ADAPT | 出手≠命中原则批准 | 新事件桥，不替换 attackCommit 副作用 |
| EffectiveHit | 空间合格、正伤害消费者 | resolveHit + combatEvents，HP0可成功 | ADAPT | Lab 技术验证；不可据此改主规则 | 记录接触/HP/姿态分别，明确具名消费条件 |
| Resource ownership | 角色可选资源 | 次数、槽计数、耐久、预算分别归属 | ADOPT | 角色所有权原则批准 | 后续 canPay/pay/gain 适配既有模型；不加通用 frost/ammo |
| Mobility | 角色专属闪避/翻滚 | 猎人 blink 与伙伴 evasion 已异构 | ADAPT | Lab 异构验证，现主代码也已分开 | 能力查询包装两现路径；AR02 不动 |
| Block | 可选方向盾防 | brace/ward/shield/无敌；block是容量 | PENDING | Lab 可选能力成立 | 哪些星骸角色有主动盾防待定；不能通用强加 |
| Projectile | 实体独立移动/运输 | shot FX 与 intent 区域结算，无共享实体表 | ADAPT | 身体/危险存续分离批准；AL03验证 | 后续主引擎新增最小实体路径，沿现空间/resolveHit |
| Derived Effect | 大斧/冰柱/爆炸 | SkillEcho/poison/镰扫/狙击已存在 | ADAPT | 装备出手门、成长命中门分别验证 | 扩展来源与取消域，不第二套派生结算器 |
| Skill input | instant/holdRelease 等 | skill-intent/AimSession/独立三槽 | ADOPT | 用户明确保留现键位和输入 | 扩展接受后的 action；不搬 Q/RMB |
| Player profile | 小蓝/小黄 Controller | profession/unit/skill/weapon 配置 | ADAPT | Lab 独立角色验证 | profile 描述能力；角色映射/正式参数 PENDING |
| Enemy action | choose/accept/spawn/hit | enemy-combat、kit、intent、反应 | ADAPT | AL03独立存续验证 | 保留候选/资格/Telegraph，后续连接实体 |
| Presentation | follows runtime | scene/audio/basicRelease/effects | ADAPT | 不以动画驱动伤害原则批准 | 逐步读只读事件；不增加同步伤害回调 |
| AI use | 可共用能力接口 | 离手AI/订单 source 已接 requestBasic；共用 blink/evade | ADOPT | T035/T036 明确保留 | AI 只请求能力；EC11 标签仅预留、不实施 |
| Lab 调试/资源 loader | Canvas、局部素材读取、固定场地 | 独立 action-lab 入口 | KEEP-LAB-ONLY | 本轮禁止复制整个 Lab | 不进入 core，不发布原资产 |
| Lab SAMPLE 参数 | 霜寒/弹夹/半径/时点 | 主游戏自有现规则 | KEEP-LAB-ONLY | SAMPLE 批准仅各 Lab 范围 | 不能以自动验证升级为生产默认 |
| 整体替换与角色一对一映射 | 有限 LabWorld/角色身份 | 已有 GameState 和 HP 权威 | REJECT | 用户明确禁止整体复制、固定映射 | 不建立平行伤害/AI/输入系统 |
| F01 最终射击体验 | 自动测试已有，用户未复验 | 不属于主射击参数 | PENDING | 尚无最终用户通过记录 | cadence/声音/反馈/换弹待试玩；不阻塞其他架构 |

代码依据见 [主调用链](AR01-current-main-flow.md)，Lab 来源见 [语义切片](AR01-lab-semantic-flow.md)。本表 ADOPT 优先表示批准保留/吸收原则；新接口和角色动作尚未 MAIN IMPLEMENTED。本轮不存在正式参数迁移。
