# Hunter BasicV1 契约

基准 GitHub main@e58abf8b4c011d586068e5a102ecd7fb27fba43f。用户批准保持 Shot01 → Shot02 → Shot01 的二段逻辑，两段沿用视觉相同的原动画，长铳表现待补。

| 节点 | 值与权威 |
|---|---|
| Release / MoveReady | 两段 .4 秒，SAMPLE，无已确认攻击事件 |
| AttackReady | 原武器/重量/Snipe 计算 period，且不早于 Release |
| Finish | 原 attackTimer 恢复到零；覆盖前唯一终结 |
| buffer / continuation | .12 / .45 秒，原规则 |
| recoveryScale / 伤害 / 姿势倍率 | 1，原命中消费者 |
| 身份 | 接纳时一次创建，玩家/同伴/Order 同 Runtime |
| 取消 | Release 前沿用移动、direct、闪避、blink、技能、stagger；不退恢复 |

presentationId 仅是语义映射键。骨架名称不进入逻辑层。技能特效事件不发伤害；当前 canHit → releaseAttack → resolveHit 路径、距离、前方、LOS、扣血、姿势、灰血、耐久及成长逻辑不变。没有新弹药、RMB、held 连射或投射物。

其他职业与 Tower/敌人保持原定义/执行链。历史 AR02/AR03 冻结测试明确选择保留的 legacy 定义以继续验证原契约，不重录旧 fixture。猎人新行为另测；T033 Focus 原 .3 秒假设改为 .45 秒覆盖 SAMPLE Release，其伤害/不连射断言保留。

原作实际结果：空白。用户本轮新手感验收：待试玩。
