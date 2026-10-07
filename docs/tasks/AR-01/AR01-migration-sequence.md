# AR01：迁移顺序与唯一下一任务

只选择 **AR02：战斗身份与事件缝合** 作为下一实施任务；本轮停在蓝图，尚未开始 AR02。下列后续阶段为 AI RECOMMENDED，不是新增主计划或批量授权。

## 依赖顺序

| 顺序 | 范围 | 前置 / 停止点 |
|---|---|---|
| 下一步 AR02 | 身份上下文、AttackEvent、命中 outcome 的旁路桥 | 主游戏行为不变；交可追溯记录和等价回归 |
| 后续角色化执行 | Basic 定义/时间轴与独立 attack/move gate；接原输入/AI | 先批准具体角色动作规则，再替换一条执行路径 |
| 后续能力适配 | Mobility/可选 Defense/Resource，再接现主动技能 Action | 复用 blink/evasion/SkillState；无需按编号拆成多个大改 |
| 后续空间攻击 | Projectile / SkillEcho / Enemy intent 来源和取消域 | 共享空间/resolveHit，单一 HP 权威；飞行与区域分别迁移 |
| 整体验证后 | 第二正式角色与离手AI共用动作，再重审 EC11 | T035/T036回归、正式角色能力批准后才重新设计协作 |

不直接执行旧 EC11/EC14；不为编号强拆 AR03–AR08。角色拓扑、成长/装备消费者迁移顺序和正式移动/盾防是后续 PENDING 决策。

## AR02 可执行工作包（待下一授权）

**目标**：用最小生产身份/事件模块观察当前探索主战斗，能从玩家/AI请求追踪至实际接受、出手与目标结果；不改变任何当前参数、输入或结算。

1. 固定新接手 HEAD 和未提交状态，重读 T035/T036；建立基准回归与确定性轨迹。以本 AR01 文档为设计输入，而非复制 Lab。
2. 在 core 新增最小 context/只读事件类型及 GameState 隔离记录。新 action/event 身份独立于 s.nextId、combat eventId、castId；旁路不得消耗 RNG。定义 legacy/unattributed 标记，不伪造 root。
3. 接 basic-chain.start 实际开始；requestBasic 缓存成功只记录 buffered 请求。关联 pending/basicRelease，不改变阶段/target 检查或 releaseAttack 的统计/耐久节点。
4. 普通 engine skill、castSpecial/newRun 与已有 SkillEcho 各做明确适配，保留槽技能/实际执行身份及 castId；模式开关、治疗/状态动作不是攻击就不制造 AttackEvent。生成覆盖清单，不能以一处 newRun 改动声称全技能覆盖。
5. resolveHit 增旁路结果：原 false/reject 分支与 true 接触分开，实际 hpLost/postureApplied 分开；保留旧 CombatEvent、eventId 去重、pressure 预算、hurt 顺序及返回值。不重接成长、装备、资源支付。
6. 记录现取消/结束和 echo 延迟关系；切人不充当重置。只关联已有生命周期，不引入统一 cancelAll。普通 DoT、旧塔防、复制体和无法归属路径继续 legacy；如需支持必须另列受影响覆盖，不能扩大执行规则。
7. 回归、确定性等价、主游戏正常键鼠烟测；更新覆盖与限制，交付冻结记录，停下等待角色化执行任务。

**不得纳入**：新角色/敌人/技能/装备、正式参数、held连击、新投射物模拟、统一费用/退款、EC11、角色映射、表现重制、Lab素材迁入。敌人 intent 全链和全部旧塔防事件可先保留明确 legacy 状态，不要求第一刀扩成全引擎迁移。

## AR02 验收

- 同一 seed/输入/步长，新桥开关前后 HP、姿态、位置、技能 CD/计数、次数、耐久、返血预算、RNG 和现 nextId 的原轨迹相同；对比投影排除新只读元数据。只测最终 HP 不够。
- request rejected/buffered/started 身份区别；Basic 挥空有释放记录但不增加原耐久/统计/成长副作用；多目标不因旧 eventId 被误共享而丢命中。
- HP0 护盾接触、姿态应用、规避拒绝和重复 eventId 分别验证；返回 boolean 和原消费规则不变。
- 切人转交 WASD、未确认 Aim 失效、已确认技能/MoveOrder继续；离手策略、AI/订单 Basic 来源不变。保留 E/R/T 与纯手动 LMB。
- 已有 delayed echo 的 root/parent 可追溯且旧存续相同；重置/取消无跨世界订阅泄漏、记录有界，不改变派生回调。
- 运行现 T033–T036、attack-intent、skill-slots/integration、pressure/impact/enemy-combat；增加真正验证新桥与行为等价的测试，并运行正常键鼠浏览器控制回归和构建。
- 交覆盖清单：每路径 observed/legacy/unattributed；不把只读日志完整性当原作动态验收。任一行为差异未解释则不得完成。

AR02 中若发现为了表达事件必须改变伤害/费用/输入规则，暂停那一部分报告，不能以“缝合”名义悄悄改玩法。正式新角色与 F01 参数验收不属于 AR02。
