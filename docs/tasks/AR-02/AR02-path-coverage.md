# AR02 路径覆盖

| 路径 | 状态 | 接点与边界 |
|---|---|---|
| 玩家Basic请求 | observed | requestBasic旧资格完整保留，失败/缓冲不创建动作；真实start记请求ID、actor/source/stage |
| Companion AI / MoveOrder Basic | observed | 真实调用方传入companion-ai/order-auto；旧AI仍决定请求时间与目标 |
| Basic命中/挥空 | observed | pending.remaining到期的旧释放时点旁路AttackEvent；挥空不调用releaseAttack、不扣耐久/增旧命中统计 |
| Basic多段 | observed | 原两段/衔接窗口不改，每次start独立action；不存在新连段执行器 |
| 玩家技能/确认Aim | observed | 旧command验证成功入口，新记录slot与能力；Aim只影响原确认请求，不成为Action |
| SkillRun / Echo | observed | 旧启动/派生/发射节点；根父关系冻结，来源结束后继续旧Echo存续策略 |
| 普通敌人/技能Telegraph | observed | startIntent成功enemy-ai；tickIntent真实释放一机会/多目标；旧无效节点取消记录legacy-intent-invalid |
| resolveHit | observed / legacy / unattributed | 有真实出手作用域才observed；直接旧调用但有attacker为legacy；无attacker为unattributed，不造Action |
| Basic主动移动/换装等清pending | observed | command仅对实际移除记录；失败命令、单纯切人不全取消 |
| stagger / stun / lethal技能移除 | observed | 旧逻辑本来清掉的run/time记录；rain/sanctuary等旧保留路径不统一撤销 |
| 普通技能正常期限、reap返回、rain期限 | observed | 原完成节点旁路，不改结算/回收 |
| Echo未来触发、过期/失去旧资格 | observed | tickEchoes原remaining判定；legacy-echo-removed不声称知道统一取消原因 |
| Echo被其他旧filter替换/数量上限、跨层/跨节点外部清理 | legacy | 不重构所有散落的清理理由；generation节点重置明确，局部丢弃并非统一取消系统 |
| 状态DoT、路障HP、环境伤害 | legacy / unattributed | 旧hurt等绕过resolveHit的路径不伪造HitOutcome，未新建攻击执行器 |
| Tower / 历史非standalone场景、旧clone pending fallback | legacy | AR02未迁移其完整身份；旧行为/combatEvents仍权威 |
| Healing / Toggle / Auto准备 | not-an-attack | 有真实ActionContext，但不能因启动创建AttackEvent |

标签按接点而非整系统宣称。部分life/reset消失只有旧路径或generation边界，未凭日志补统一取消原因。来源对应当前主游戏实现，不是原作OBS动态消费者证据。原作实际结果仍空白。
