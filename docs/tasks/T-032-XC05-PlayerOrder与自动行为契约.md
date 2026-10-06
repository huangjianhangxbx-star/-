# T-032 / XC05：PlayerOrder 与自动行为契约

依据批准的 XC05 v0.1 和 main@e810870 的 XC04 基线。以下只适用于 Standalone 双人探索；Tower/Legacy 原移动与自动行为保留。

## 意图与执行

`explorationControl.moveOrders[actorId]` 是每个本体的持续移动意图。订单保存 id、actorId、最终 destination、source、issuedAt、state、暂停原因与重寻路时刻。`Unit.path`、`Unit.destination` 是可以被暂时替换或清空的执行路线，不能据此宣告意图完成。

显式 PathAim 确认创建或替换当前角色订单；不同角色的订单并存。确认不改变 DirectActor/CommandFocus。订单期间重新 F 暂停旧目标；RMB/F/Escape 取消 Aim 后从身体当前位置恢复，确认新点才替换。改变 Focus、清 Focus、纯身份切换不取消订单。

## 权限与临时动作

| 状态 | Tactical / Follow | 局部自动身体行动 |
| --- | --- | --- |
| Command Reservation | 禁止 | 禁止新起手 |
| MoveOrder | 禁止覆盖目标 | 允许合法局部自动行为 |
| 普通自由 AI | 原规则 | 原规则 |

保留 `autonomousBodyStartAllowed` 兼容别名；正式接入分别采用 `tacticalAutonomyAllowed` 和 `localAutoCombatAllowed`。空 path、commandGrace 到期仍由订单持有身体意图。Direct 来源重新 Aim 时也暂停订单的局部新起手。

Basic 只针对活动交战域中、当前已知且可命中的敌人，沿用原攻击间隔、风向、LOS、伤害与风up。准备实际起手时清临时普通路线；释放/取消后重新寻路，不等完整攻击 CD，也不追离开射程的敌人。未交战敌人不能触发这种中断。

合法自动 Rain / Reap、闪避、低层 Blink、ForcedMotion、WallPin、Stagger 和落位只暂停订单。后台 Snipe / Poison / Dance 与独立技能时钟保持既有规则。本轮没有增加新的 Hazard AI、追击或连段机制，也不改变 Reap 原起手资格。跨层保持原子执行路线，落位后再恢复判断。

## 恢复、完成与取消

恢复以当前位置、实际半径、现有 navigate/canStop 和交战 guard 规划路线。Command 每次重寻路继续避开未交战感知区；Direct 保留主动探索资格。目的地合法但暂时无路线时进入 blocked，约每 .25 模拟秒重试；地形目标非法、来源安全策略拒绝或角色失效时取消并记录原因。真正接近最终目标且没有跨层/技能落位时才完成，释放给原有 Follow/AI。

成功提交的 WASD 非空方向、技能/模式切换、手动 Evade/Blink、武器行动、收纳/回收/救援或冲刺卡取消对应订单；失败不取消。新的行动路线按其原机制保留。成功救援取消 Hunter 的旧意图，而不是把救援路线误清掉。H/B 按逐角色真正接受的结果取消；跨层/回镰拒绝及无落点的闲时集结保留订单。

## 复核边界

确认入口升级为持续订单，历史 T031“一次旧 move”记录由本契约覆盖。F、点击独占、模态、暂停及同键接管界面未扩展。运行时可在现有 `window.prototype.state` 查订单；未增加正式 HUD、Aim UI、轮盘、VFX/SFX 或 XC06 行为。

实现：[move-order.ts](../../game/src/core/move-order.ts)。证据：[验证记录](T-032-XC05-验证记录.md)。

<!-- T-035:start -->
## T-035 单一实控切换（2026-10-07）

用户批准以 controlledBodyId / DirectActor 为唯一实控身份。C 两位本体切换，1/2 绝对选择，头像及场内友方点击立即切人；有效持有 WASD 转交，新技能和机动只操作当前角色。当前角色选择 no-op，无效对象先拒绝。旧 Focus/Promote/CommandAim 与 CommandDefense 正常流程停用；离手交正常 AI，切回撤销普通 AI 路线。新 Aim 只属于 Direct，F 选路保留；切走作废未确认 Aim/token，但保留双方已确认订单和原子动作。成功身体动作只取消自身订单。主 HUD、技能和机动同绑 Direct；复制体查看只读，默认切人不自动慢速，其他模态规则保持。

此块替代历史 T029–T034 的双身份控制要求；资源、碰撞、订单、合法 Release/Hit 与真取消安全契约仍有效。专项入口：docs/tasks/T-035-单一实控输入与交接契约.md；执行与验证：docs/tasks/T-035-单一实控切换与控制简化.md、T-035-验证记录.md。用户试玩通过后直接回 EC10 战术轮盘；XC08/XC12/13 研究与演出不冒充完成，旧 XC10 Command UI 退出。发布仅 GitHub main，禁止 Gitee。
<!-- T-035:end -->
