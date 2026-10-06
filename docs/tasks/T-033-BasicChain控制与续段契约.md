# T-033 BasicChain 控制与续段契约

依据：XC06收口–XC07 v0.3，接手基准 main@70823a2。本轮替换 T032 的 Direct 自动普攻部分；离手本体、复制体、敌人、Tower/Legacy 及既有 Auto/Background 技能保留各自原权限。

## 普攻请求

DirectActor 的每一段都需要独立玩家输入；CommandFocus 和 MoveOrder 不授予自动 Basic。唯一页面入口是有效场景左键释放，模态、Aim、明确交互及本体聚焦优先；长按不重复，Standalone 拖拽不攻击。Command 中同一次有效攻击点击先接管焦点，再请求一段；动作失败不恢复旧身份。

BasicChain 是每个本体的阶段运行时；BasicStage 由 Profile 给定。当前共用两段候选配置，每段 windup .25 模拟秒，恢复沿用武器/负重/已启用技能倍率。支持逐角色 basicProfileId 和三段以上配置；不是全职业最终动画、数值或软锁定交付。

player-input / companion-ai / order-auto 明确标记请求来源，自动权限逐次读取当前身份，不由旧 Order.source 或前一段来源永久授权。每请求至多启动一段；合法下一时点固定，重复点击、改目标或重开 A1 不刷新恢复。续段有效期为下一合法时点后 .45 模拟秒；最多保存一条 .12 秒预输入，保存寿命 .17 秒包含消费容差。死目标、失去真实射程/LOS、过期均丢弃，不能改投另一个敌人。

每次请求按方向、真实射程、LOS 和生命状态选目标；挥空也提交真实前摇/恢复但没有假命中。Release 复核现有严格命中管线。空挥/Release 落空结束续段；后续显式输入从 A1 起。实际成功起手才取消自身 MoveOrder，缓冲和拒绝不取消。

身份变化、Aim、CommandFocus、暂停、失焦、成功高优先玩家动作、硬直及失效清未消费输入；不会回滚合法已提交攻击或已造成伤害。角色失效清 BasicChain，新节点沿 resetPersonal 清运行时。

## 指令期间有限防御

仅 Standalone explorationBattle、当前有效 Direct、另一有效本体 CommandFocus 时授权。Focus 慢动作到期不撤销授权；另一角色的 Path/Skill/Mobility Aim Reservation 只作用于 AimActor。正常 Direct 无 Focus 没有本次自动自保。

command-defense 是独立受限请求者，不能冒充玩家或完整 Companion AI。共享已有可见 Ability、反应时间、Threat、安全几何和真实机动执行。眩晕或尚不能行动的敌人不构成普通压迫。普通压迫只走 .7 格候选、路线至多 1.4 格；Ability 普通安全候选至多 1.5 格、完整路线至多 2.5 格。先走，走不及且 Threat 足够才 Blink/Evade；Basic 不花机动。没有合法路径/资源时允许承伤。

不可取消技能、跨层、落位、强制移动、换装、回收/救援、硬直等物理边界照旧；先找到并成功提交避险动作再取消可取消普攻前摇。机动真实扣费，不能同帧重复支出；不会发起新 Basic、追敌、flank/peel、手动技能或道具，也不跨未交战感知区。

防御普通路线用 ownedPath 身份标记所有者。MoveOrder 暂停时保留 id/destination/source，订单更新不覆盖防御路径；防御完成后从实际当前位置重规划。退出只撤自己的普通路线，不清后来的玩家路线，不中断已经开始的原子机动；已开始跨层仅保留当前边，丢弃后续旧避险路线。无订单时停在安全点，不回原危险点。

Aim 预览的世界点来自真实鼠标更新；相机因 Direct 避险移动不会重算该点。确认重新校验保存世界目标的路线/合法性，失败仍保留 Aim。

## 边界

完整 Skill/Mobility Aim UI、最终职业连段、自动软锁定/动画与 XC08 手感不在本轮。固定危险夹具只建立环境和危险；页面的切换、瞄准、确认和攻击仍走真实输入。

<!-- T-035:start -->
## T-035 单一实控切换（2026-10-07）

用户批准以 controlledBodyId / DirectActor 为唯一实控身份。C 两位本体切换，1/2 绝对选择，头像及场内友方点击立即切人；有效持有 WASD 转交，新技能和机动只操作当前角色。当前角色选择 no-op，无效对象先拒绝。旧 Focus/Promote/CommandAim 与 CommandDefense 正常流程停用；离手交正常 AI，切回撤销普通 AI 路线。新 Aim 只属于 Direct，F 选路保留；切走作废未确认 Aim/token，但保留双方已确认订单和原子动作。成功身体动作只取消自身订单。主 HUD、技能和机动同绑 Direct；复制体查看只读，默认切人不自动慢速，其他模态规则保持。

此块替代历史 T029–T034 的双身份控制要求；资源、碰撞、订单、合法 Release/Hit 与真取消安全契约仍有效。专项入口：docs/tasks/T-035-单一实控输入与交接契约.md；执行与验证：docs/tasks/T-035-单一实控切换与控制简化.md、T-035-验证记录.md。用户试玩通过后直接回 EC10 战术轮盘；XC08/XC12/13 研究与演出不冒充完成，旧 XC10 Command UI 退出。发布仅 GitHub main，禁止 Gitee。
<!-- T-035:end -->
