# T-026 / EC08 敌人 CombatKit 参数

来源为用户批准的 [原始计划](T-026-EC08-原始计划.md)。仅 Standalone 普通 melee/ranged/heavy 固定绑定 melee-v1/ranged-v1/heavy-v1，不接玩家 SkillId、SkillProfile 或三槽，不改 EC01 HP、移速、基础伤害、基础攻击周期和遭遇人数。

| Kit | Active / 权威 Area | 起手 / Lock / CD（秒） | HP / Posture / Break Impact |
| --- | --- | --- | --- |
| melee-v1 | 裂阵重斩：Sector 1.35U，140°；选择距离 ≤1.25U | .85 / .50 / 5 | ×1.35 / ×1.60 / .65U |
| ranged-v1 | 蓄力穿射：Capsule 6U，半宽 .16U；选择距离 2.2–6U、有 LOS | 1.05 / .65 / 6 | ×1.60 / ×1.40 / 无 |
| heavy-v1 | 震地重击：源点 Circle 1.75U，附近任一合法 Party Body | 1.15 / .75 / 7 | ×1.40 / ×2 / 1.15U |

所有 Active 共用 AttackIntent → Tracking → Locked → Resolve、AttackArea 和 resolveHit。能力开始即消费 CD，Break 取消不退款、无 Resolve；Broken 本身保留已提交能力。Impact 按 EC05 重量缩放，两种能力都不启用 WallPin；阿尔原始强化箭等旧 WallPin 授权不变。远程沿用 LOS/墙裁剪与原远程层级语义，近战/重装选择限制同层。

| Reaction | 触发 | Pending / Active / CD（秒） | 动作 / 命中语义 |
| --- | --- | --- | --- |
| Counter Step | 己方真实、直接、非派生命中产生 HP 或架势结果 | .15 / .18 / 4 | 侧移 .55U；选择更可通行一侧，相同条件稳定排序；无 iframe |
| Backstep Evade | 可见、有 LOS、同层 Party Body 距离 ≤1.60U | .15 / .18 / 5 | 后撤 .90U；Active 前 .08 秒共用 Avoidance 早退 |
| Front Brace | 真实 Front direct hit | .15 / .65 / 6 | Front 额外 HP/Posture ×.70，Side/Back 不变；Broken 立即取消 |

重装基础 Front HP .65/Posture .70，Brace 叠乘后为 .455/.49；Back 仍 1.25/1.35 且 rear-core。Brace 在受击前读取，归零当击按既有护架结算后取消；不改变目标朝向，不制造自动 flank。

Reaction 开始消费 CD。Pending 可见静态方向箭头或正面弧；未到 Active 没有闪避/护架效果。Reaction 不抢已有 Intent、ForcedMotion 或 stagger。动态阻挡或无法移动时结束动作，已消费 CD 保留，失败后撤不给无敌窗口。死亡、Break、回归和非法状态取消动作。

EnemyCombat 仅选择局部动作；探索感知、追击、patrol、8U leash、return 仍由旧 AI 管理。按稳定地图敌人 identity + seed 散列得到首次能力 0–1.2 秒偏移，首次接敌才启动；初次可攻击时序同样错开以避免统一 Basic 周期重新同步，后续 Basic 的数据/周期不变。不用 Math.random，不做随机 Kit。

CombatStep 每 .025U 连续采样身体圆、地形、层级和调用方占位策略。敌人 Step/Backstep 不穿任何 active body、墙、边界或 8U leash；玩家 Evade 保留原本己方互穿规则与独立充能资源。Attack/Reaction 不读取 keydown、mouse 或控制权切换。

能力用权威 Area 的第二条内描边（97%几何缩放，仅视觉）及短名区别 Basic；没有第二套伤害形状。Reaction Tell 静态可读，reduced-motion 保留；没有常驻敌人 CD 数字，仅 Debug 提供 kit/ready/action。隐藏敌人不显示新 Tell，不改变 world picking。

实现入口：enemy-abilities.ts（固定数据）、enemy-combat.ts（时钟与选择）、combat-step.ts（采样）；AttackIntent/engine/evasion 为共享战斗通道。Tower 和旧庭院不启用 Kit。没有加入新敌人类型、AI2、指令轮盘、怪物知识、卡牌转型或 EC09。
