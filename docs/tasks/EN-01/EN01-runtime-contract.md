# EN-01 Runtime 合同（正式 v1.0 实施）

2026-10-09；基准 `877a3f44922a05208aaa4380a870853276073df6`。入口 `/?en01=1`，普通 `/` 不加载 V2。仅在现有主探索暗牢放置一只技术敌人；主角、地图、主 HP/防御、真实时钟和正常输入沿用现有系统。

## 权威链路

`decideEnemyTarget → requestEnemyAction → advanceEnemyAction → commitEnemyRelease → advanceEnemyEntities → engine.resolveHit`。

`EnemyV2Profile` 是显式 EN01 FIXTURE，不代表原作怪物消费者。Decision 只读取可见、LOS、距离和存活的双本体，最近者优先；最终方向、范围、CD、控制和身体 Ready 再独立检查。拒绝不分配动作或支付 CD。接受时缓存 caster、targetId、point、origin、facing；Z、后续目标移动不重写缓存。当前夹具原地出招，方向拒绝时每秒转向 3 弧度；未实现追击或完整怪物 AI。

Prepare/Lock/Attack/AttackReady/MoveReady/Finish 按同一个 `state.time` 绝对时点推进，cursor 确保每项一次。AttackReady 允许满足 CD 的下次动作；MoveReady 单独允许运动，不由 AttackReady 推导。当前夹具不消耗运动许可来追击。Finish 只结束身体动作。

身体 AttackEvent 只证明释放，不等于命中。扇区实体按真实空间接触；运输实体从缓存起点至缓存落点，真实墙可阻断，落地生成独立圆形危险区。实体有独立 entityId、存活时段及 per-target contacts；同一实体每人一次接触尝试（包括免疫），不同实体可再次命中。主 `resolveHit` 是唯一 HP/盾/无敌/受伤入口；面板和 SVG 不结算伤害。格挡、无敌、真实接触和墙阻挡分别记录。

## 身份、时钟和生命周期

V2 通过同世界 `CombatIdentityState` 权威分配负 ActionId/AttackEventId，避免碰撞旧玩家正 ID 或改变旧 recorder 的顺序。Trace 关闭仍分配 V2 身份。generation 隔离 Reset；entityId 在 generation 内递增。运输为身体的 child action，落地为运输的 child，root/caster 始终保留；子动作 acceptedAt 与 AttackEvent 使用预定出生时点，低帧采样不得使身份时间倒置。

Attack 时预提交未来运输（当前 delay .35）；身份及 spawn 诊断可预登记，但实体在 spawnAt 前不能接触。实际落地另记 land。已提交实体不依赖身体仍在播放。受伤/控制/死亡撤销尚未消费的身体事件；已提交实体按 profile 的 cancelPolicy/deathPolicy retain 或 clear。Finish 不撤销未来 spawn。owner 从世界删除、generation 更换会丢弃旧实体。主世界保留死亡敌人作为来源记录。

主 `step` 的 120 Hz 切片及 Hunter Hitstop 共用同一模拟时钟；暂停不消费模拟时序，慢速/倍速改变主时钟速度。既有 wall collision、玩家移动、音频时钟不另起一套。诊断 trace 上限 256，主 CombatTrace 上限保持 512；没有全局事件总线或任务级追加订阅。

## Legacy 隔离

| 旧入口 | V2 gate |
|---|---|
| Engagement/探索感知与站位更新 | `updateEngagement`/`cleanEngagements` 排除 V2 |
| 旧闪避 tick / invalid Intent 消费 | 主早期循环排除 V2 |
| reaction / Intent / choose / approach / probe / basic fallback | V2 身体分支先处理并 continue |
| 旧受击 activeAvoidance / brace / counter-step | `resolveHitLegacy` 的 V2 目标不进入 |
| 旧 posture 二次破势 | V2 目标 pressure=0；V2 释放 postureDamage=0，限夹具 |
| 身体死亡 | `interruptEnemyV2('death')`，不走旧 reaction |

未 opt-in 的 Legacy/玩家路径不采用以上 gate；没有删除旧代码。`engine.ts` 的 defenseResult 只观察既有结算结果，没有第二次调用防御判断或新扣费。

## SOURCE / SAMPLE

所有敌人参数均为 **EN01 FIXTURE/SAMPLE**：近战范围 1.8、视距 6、方向资格半角 .65 rad、扇区 100°、CD 2.5、伤害 power 5、危险寿命 .1、受伤锁定 .24；运输范围 5、CD 3.5、延迟 .35、飞行 .9、落地半径 .7；默认 retain。事件偏移为 0/0/.6/1/1.1/1.2 秒。主图净伤害还受原防御影响，不能把 power 5 写作固定扣 5 HP。

复用当前地图、双角色黄金包和既有敌人显示资源，仅诊断叠层展示攻击几何；没有导入新原作二进制。显示不声称原僵尸或骷髅弓动作/音效已迁移。原作动态消费者及 OBS actualResult 保持空白。

EN-04 架势未实现；本轮只记纠错：持续 Debuff/DOT 扣 HP 不算新攻击命中，不应自动重置架势自然恢复延迟。EN00 受限报告原错误行未改，后续必须按用户最新决定处理。黄金角色数值、皮肤、音效文件和动作合同保持不变。
