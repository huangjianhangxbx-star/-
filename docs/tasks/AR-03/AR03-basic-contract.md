# AR03 Basic 动作契约

基准 GitHub main `5cb9e488c30a472a729e01b4bcf0334271eb639b`。仅迁 Standalone 己方 party Basic；敌人和 Tower 仍走旧 pending。

所有正式职业 hunter/healer/cantor/guard/ranger/shieldguard/scythe 通过稳定映射共享只读 `legacy-main-basic`：两段循环，各段 releaseAt=.25、moveReadyAt=.25，attackReadyAt=原 period，finishAt=attack-ready；buffer=.12、continuation=.45。period 保留 weapon.attackPeriod / weight.attack × recoveryScale × snipe multiplier。未知 profile 回退 legacy；未安装任何新角色招式。

basic-chain 继续处理权限、目标、request ID、buffer/过期、continuation 和 stage；真实接受时调用 Runtime start，一次创建 AR02 ActionContext，再按原节点执行 attackCommit。拒绝与排队不产生 Action。player-input / companion-ai / order-auto 共用同一 Runtime。

实例缓存 definitionId/stage、accepted target/facing/source/request、节点和取消名单；不保存完整 Unit 或 GameState。Release 使用原 remaining-=dt 的浮点边界，不用 epsilon 提前出手。兼容 attackPending 由 Runtime 投影，每次刷新不能触发独立 Release。basicRelease 保持原 nextId 分配与表现身份。空间复核、whiff、releaseAttack、resolveHit 的原权威不变。

MoveReady 与 AttackReady 分开：出手后可移动，恢复期间仍不能提前下一次攻击。恢复保留现有 attackTimer 的递减和暂停路径，无第二恢复倒计时。旧链的 nextStageAllowedAt 继续是 buffer 消费资格；它在本帧旧计时扣减前接受下一段时，Runtime 先为上一段记录唯一 Finish，再建立新 Action，避免覆盖漏记。不额外等待一帧。

前摇移动/Direct/闪避/瞬影/技能/失衡由 cancelBasicAction 收口；已缓存的取消名单生效。取消不退还旧 attackTimer，不改变旧 buffer 清理。Direct 切换不取消已接受动作。出手后普通移动保留恢复；死亡、退出、回收失去参与资格等强制收尾清理实例。节点/新副本重置不携带旧实例。

唯一 start、Release 和 terminal lifecycle；空挥有真实攻击机会和表现，没有合成 HitOutcome。旧 AR02 在 release 记 Basic finished；AR03 延后到身体恢复结束（或下一段已获资格接受），强制退出用 cancelled。这个观察生命周期差异是批准契约，游戏结果不变。

拓扑由 definition.stages.length 与 nextBasicStage 决定；测试验证 1/3/4 段用同一个执行器，但不发布这些实验定义。当前正式节点关系仅为 period/attack-ready，不声称已完成未来角色的所有取消设计或新资源消费者。
