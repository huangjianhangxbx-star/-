# AR05-G01 验收与证据

基准 GitHub main@fbf20a4160712ea6910827560983def0b4b1a050；2026-10-08。本轮无战斗源码改动。

- [x] 按基础/专项规则核对环境、工作树、F01/F02/F03、现有合同与 AL01 M2/M3。
- [x] writing-plans 组织收口；grill-with-docs / grilling / domain-modeling 区分视觉与整体主观验收，不新增总规范。
- [x] 当前 game/src 与基准一致；定向 vitest 四文件21项通过，2.05秒。
- [x] 用户回答“整体认可，可以收口（注明未试项）”；冻结已有四份合同。
- [x] 工程记录收口，仅按本轮授权发布 GitHub main，不同步 Gitee。

| 状态 | 结论 |
|---|---|
| USER APPROVED | G01 整体认可，F03 视觉另行认可；没有具体未试项名单，逐项人工覆盖未知 |
| LAB VERIFIED | AL01 M2/M3 黄金回放与用户认可保留 |
| MAIN IMPLEMENTED | 主猎人四段、闪避、方向盾、E盾冲及身份/音画事件接入，F01/F02/F03 修正保留 |
| SAMPLE | 已批准几何/资格/消费者/取消等实验值不重调，不声称原作动态还原 |
| PENDING | 原作 OBS、正式资产、AL04-F01 RMB、AR06 独立批准 |

## A—L 来源核对
| 项 | 边界 | 证据 |
|---|---|---|
| A | held A1—A4 与事件顺序 | ar05-golden.test.ts、ar05-combat.test.ts；M3黄金JSON |
| B/C | 续击与移动解锁/取消 | hunter-combat-profile.ts、ar05-boundaries.test.ts；既有ar05.spec.ts |
| D | 闪避次数/无敌/冲刺斩 | golden/combat/boundaries；AL01 M2 |
| E | 前后方向盾、接触去重/霜寒恢复 | combat/boundaries；已批准M2 SAMPLE |
| F | E准备/释放、支付/取消及根/子身份 | golden/boundaries；不同语义不合并成通用去重 |
| G | release/contact/hurt、Hitstop与暂停声音 | boundaries、audio合同、AL01 M3 WebAudio与既有AR05浏览器 |
| H | 单身体无丢件、方向 | F01/F03 原生1560组合及held；用户视觉认可，本轮不重跑重型矩阵 |
| I/J | Z、已接受动作、黑暗/障碍自由出手与LOS | F02合同/验证与既有浏览器，boundaries |
| K | 离手四段Basic，无自动盾/盾冲 | boundaries、T036既有权限 |
| L | .1/1/2、暂停/重建、4.1与3.8隔离 | golden/boundaries、F01/F03生命周期证据 |

既有F03证据：96文件1320通过/2跳过、两端构建、F01/F02/AR05/T036浏览器回归、原资源SHA保护通过。这里只复用版本匹配证据，不宣称本轮重跑。主世界HP/地形/遭遇压力不要求与Lab相同。没有发现阻碍收口的契约冲突。

[主探索](http://127.0.0.1:5173/) → 探索 → 同行者 → 携带进入；[Lab小蓝](http://127.0.0.1:5173/action-lab.html)。本轮主入口HTTP200。主Z切换、Shift闪避、RMB盾、E准备/松开；Lab原键位保持。
