# EQ-02 双形态样板合同 · 2026-10-11

基准 GitHub/main f331ef2（EQ01）。用户批准的是双形态可玩样板；II 名称、数值和组合均为 SAMPLE，技术验证不代替手感验收。研究对话最近用户“似乎没问题”仅记 EQ01 初步反馈；助手正文只返回引用，未声称已读全文。

## 权威与输入

同一 MainInstance 增加 currentForm I/II，默认 I；武器对象、ID、owner、职业、重量及耐久共享。两人各自保存，Z 不改变形态；同世界离区继续和死亡返场不重建装备。新世界 I，仍无刷新持久存档。

C 单次 physical keydown 切当前实控活体右手；不调用 switchWeapon，不收费、不启动冷却、不操作左手。重复 keydown 不切，持 C 后 Z 的 repeat 不切新人。面板 I/II 控件走同一命令及只读查询，非主控栏明确禁用；键盘在模态、暂停、失焦、瞄准、G/拖动期间不切。

资格：正式固定双人、alive、有效未损坏本人右手、无 Basic/副手/主动/机动/受击/硬直/跨层/技能/瞄准等阻塞及整套普攻恢复。拒绝不排队、不消费、不取消动作。合法切换仅清未接受 Basic held/buffer，nextStage 从零开始；不会取消已经 Accept 的攻击，亦不跳过 terminal recovery。左右同时输入仍各走原消费者。

实际 Accept 缓存 frozen definition/stage/weapon、mainInstanceId、formId、presentationId、Hit/几何/姿态。Release、dash、实体及最终命中使用缓存；trace 只观察，不是运行权威。I 直接引用原 BASIC_DEFINITIONS，HUNTER_V2 与原黄金 stage 数值未改。

## 黄金 I 冻结与 II 差异

单位为秒，范围为世界米，半角为弧度。Finish 是现有原型逻辑终点，不能反称原作动态消费者闭合。候选原文件只读核对，事件清单见 reference/clip-events.json。

| 角色 I | Clip | Hit | AttackReady | MoveReady | Finish | 伤害 | 范围 / 半角 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hunter A1 | a1 | .0333 | .2 | .2333 | .7333 | 15 | 1.7 / 1 |
| Hunter A2 | a2 | 0 | .2 | .2333 | .7333 | 15 | 1.7 / 1 |
| Hunter A3 | a3 | .0333 | .2667 | .3 | .6333 | 20 | 1.8 / 1 |
| Hunter A4 | a4 | .1333 | .5 | .5 | .8333 | 35 | 2.2 / .48 |
| Al A1 | a1 | .0333 | .1333 | .2 | .8 | 15 | 1.8 / 1 |
| Al A2 | a2 | .0667 | .1667 | .2667 | .8 | 20 | 1.8 / 1 |
| Al A3 | a3 | .1667 | .3 | .4 | 1.2667 | 30 | 1.8 / 1 |

II：Hunter a3→a4，Al a2→a3，均两段。沿用对应 Hit/damage/dash/Finish/半角；Hunter 范围 2.05/2.45，Al 2/2；两人架势基值×1.35（当前15→20.25）；AttackReady/MoveReady 各+.18；terminal recovery .4（I .25）。不是大幅伤害放大，也无新动画或新武器外观。Al a3 沿用原 EN06-G01-R1 收尾表现压缩。II 组合、扩大范围、架势和衔接迟延全部 SAMPLE，待用户试玩调整。

CB02 每次实际 Accept 仍支付10体力，buffer不付费，重放request不再支付；C不支付。I buffer .25，Hunter continuation .625，Al .5。普通命中去重、支付水位、AttackEvent、terminal gate、LT返场和NR访问是不同边界。EQ01左盾/枪/炸弹及 E 参数、装弹、耐久、收费/CD均未重调。

## 实现与边界

main-form-spec.ts：只读规格与独立派生定义；main-form.ts：查询/唯一切换；equipment.ts：实例状态；basic-definition/runtime、hunter/al executor、engine：接受和命中快照；combat-identity：观测来源；equipment-panel/exploration-app/exploration-hud：真实控件、C及已有槽位。

未新增主武器、资产、职业、弹药/维修、SK01、成长或ENBAL；PPT 六区与阿尔原头像保留。用户原稿、开发细则和原动画只读。正式 II 外观、命名及长期平衡未批准。本轮停止在两人 I/II 用户手感 Gate。
