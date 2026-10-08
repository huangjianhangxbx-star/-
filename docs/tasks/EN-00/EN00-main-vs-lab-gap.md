# EN00｜主探索与 Lab 的差距

2026-10-09，主代码基准3eea3eb，与5d77f90 game字节无提交差异。本轮没有更改以下执行路径。

## 已核真实调用点

| 当前文件/入口 | 实际行为 | 下一阶段处置 |
|---|---|---|
| `standalone-exploration.ts::standaloneDefinition` | 房间种子生成 melee/ranged/heavy；enemyKitForRole；Dustin/Verlaine_bot；heavy-rear-core | 保留地图/种子/房间身份，新增显式 profile映射，未迁移heavy不隐形回退 |
| `exploration.ts::enterExploration` | make单位/HP/武器、home/patrol、encounterRoom/id，initializeEnemyCombat | 初始化V2运行时另开入口；底层身份/敌人实体可复用，名字和资产不能证明迁移 |
| `exploration.ts::updateExplorationEnemy` | detect5、追踪18、丢失4.5（chaser）；最近目标/provoked/归位；旧block容量接敌 | 可复用LOS/路径执行，但这些感知、接敌容量参数是旧设计；V2不得称为原作AI。按最新自由探索方向重审，不自动迁移永久追逐或塔防容量 |
| `engine.ts` tick约706–788 | reaction→tickIntent→结算；chooseEnemyCombat→probe/burst→导航→startIntent basic | V2必须单独分支全生命周期，不能只替换 choose函数又落到旧basic/反应 |
| `enemy-combat.ts` | melee counter-step、ranged backstep-evade、heavy front-brace；固定delay/offset/CD | 探索设计淘汰；保留显式历史路径直到独立Cleanup |
| `enemy-abilities.ts` | heavy-cleave / power-shot / ground-slam；total/lock与damage倍率 | 不作为新根或子技能来源 |
| `attack-intent.ts` | 追向到lock→固定area→resolveAt一次结算 | 不承载原事件/独立在途链，不可直接换名EnemyActionRuntime |
| `engine.ts::resolveHit` | Hunter/Al防御→旧HP/架势/方向/受击/死亡→AR02 HitOutcome | 唯一结算入口保留；V2反应/架势需避免旧reactToEnemyHit再消费一次 |
| `encounter-domain.ts` | 活动判定含attackIntent和enemyCombat.reaction；领域供离手攻击/路径 | 接入V2动作/危险来源，不用旧字段冒充兼容；不允许离手AI获得隐藏目标 |

## Lab 并不能直接复制成第二世界

`world.ts::enemyReady`先检查生存/动作/硬直/CD/距离，再查朝向；accept缓存方向，远程另缓存目标。每帧最大1/120步，用模拟时间推进native事件、运动、碰撞。僵尸Hit生成寿命.1、跟施法者的扇区；骷髅弓Hit提交3个独立运输，第三个spawnedAt延.1；到点再出生爆炸，各目标按实体一次。

Lab 使用自己 Actor/HP/HitEffects、矩形arena和一个挡块，所有敌人只面对Lab.player。主游戏需要两个本体的真实感知/锁敌、连续地图/墙、主HP、visibility、Encounter、Z与offhand自治。**可复用纯几何/事件排序/生命期思路，不能把LabWorld.advance接入主引擎再维护第二份HP或clock。**

Lab `.tick`控制策略不等于原AI全部恢复；例如僵尸CD未好不移动，远程CD中调舒适距离是裁剪样板。本轮照实记录这些差异，不重调已认可角色。

## 身份接口的额外风险

AR02 `recordCombatAction/recordAttackEvent` 在 `combatIdentity.enabled=false` 时返回undefined，是观察器，**不是可直接依赖的权威scheduler**。若V2用这些返回值决定是否施放，关trace会停止怪物；若关闭时自行另造ID，会破坏统一语义。

EN-01提案：以同一GameState/generation和ActionContext/AttackEvent结构分配权威ID，trace仅可选记录；先用TDD证明trace on/off的动作、HP、RNG、资源结果一致，保留既有AR02观察接口与512条上限。不要为了日志引入EventBus或全局singleton。该变更尚未实施。

## 空间与投射物边界

保留 `spatial.ts::segmentClear/clearShot/terrainFits/radius`、`combat-step.ts::combatStep` 和主世界导航的几何职责。真实墙仍阻挡弹道（最新用户决定）；不能沿用Lab“夹在arena/投到测试块边”的落点作为正式NavMesh策略，也不能套直线capsule的高台伤害特例来代替抛物线。障碍接触/落点合法性须EN-03独立合同和测试。最新取消高台攻击门的决定尚未实施，本轮仅记录依赖。

## 数据与验证停点

当前只注册旧Kit；新profile、EnemyDecision/Runtime/Reaction/Presentation尚未MAIN IMPLEMENTED。Hunter/Al/xx已迁移角色端，与新怪物全体验是两件事。G01当前技术日志可作为G01-A角色回归，不成为EN-06通过证据。旧EC10四浏览器失败保留分类，不借新架构删断言。
