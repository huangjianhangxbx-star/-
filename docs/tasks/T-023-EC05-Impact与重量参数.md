# EC05 Impact 与重量参数

适用独立暗牢；集中定义在 game/src/core/impact.ts。Impact 是 Break Reaction 后的位移负载，与 HP 伤害、PostureDamage 分离。

| 来源普攻 | Light 目标基准距离 U |
| --- | ---: |
| 猎人 | 0.40 |
| 阿尔 | 0.45 |
| 菲奥蕾 | 0.30 |
| 伊内丝 | 0.75 |
| melee | 0.45 |
| ranged | 0.30 |
| heavy | 0.90 |

| 目标重量 | 对象 | 距离倍率 |
| --- | --- | ---: |
| Light | melee、ranged | 1 |
| Medium | 猎人、阿尔、菲奥蕾 | 0.75 |
| Heavy | 伊内丝、heavy | 0.40 |
| Immovable | 复制体，优先于原角色重量 | 0 |

保留旧守卫的显式 Medium 映射，但其普攻不接入本期 Impact。重量不读取 HP、模型或武器负重。

只有真正 Break 的非派生普攻携带默认 Impact。阿尔启用 snipe 后的原始主箭覆盖为 1.60U、wallPin=true、1.40s；穿透/回响/分裂仍不携带位移。雨箭、毒、座印、结界等保留原架势结算与硬直。

ForcedMotion 速度 8U/s、扫掠采样最大 0.025U，按身体半径判定地形/路障/边界/层和所有在场 active body。不能借普通本体互穿，撞单位只停、不链推。跨层停止不生成 WallImpact；墙、障碍、路障、地图边界停止生成 WallImpact，不加 HP 伤害。

只有携带 wallPin 的 WallImpact 产生 Unit.wallPin 查询字段，stagger=max(当前,1.40)，不是累加。期间追加命中不重触发、不延长；最后 stagger 结束时清除钉墙并恢复 50% maxPosture，再延迟 1.50s 回势。

普通 Break 硬直 0.60s。归零当击只 Broken；下一次正架势有效命中才 Break。PostureResult.applied 为实际扣除量（Broken 后触发 Break 时为 0），becameBroken 与 breakReaction 分开。

Active Evade 优先于架势；护盾不阻止 Break。late Evade 被 Break 中断。crossing、skillLanding、回镰身体生命周期抑制 Impact，但保留硬直。死亡/倒地优先，不能残留位移或钉墙。

强制位移撤销旧普通路径、实时方向、跟随与 AI 任务，不修改经典锚点；控制交接也不因被推自动刷新锚点。结束后从当前位置重新验证任务。
