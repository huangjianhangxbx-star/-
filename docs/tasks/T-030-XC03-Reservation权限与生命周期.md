# XC03 Reservation 权限与生命周期

范围：Standalone battle 的双人原本体。Focus 本身不预留；合法 Aim 必须属于当前离控 CommandFocus。类型为 path / skill / mobility；记录 actorId 和模拟 startedAt，重复同类型开始保留时间。不同类型重新记录 Aim 时间，不重启 TacticalFocus。无独立 yielding/ready 生命周期字段。

## 唯一入口

`core/exploration-control.ts`：queryBeginCommandAim、beginCommandAim、cancelCommandAim、commandReserved、commandReservationReady、autonomousBodyStartAllowed。变更通过 engine 的 beginCommandAim / cancelCommandAim Command。查询只读；Tower/Legacy 拒绝入口，自治 gate 在其范围外为 true。

Begin 需要合法离控焦点；运行中的 legacy player move（ai.command=move 且 path/destination 存在）、recall、partyTask、rescueTarget、loadout 拒绝，无状态变更。新动作数据留待 XC05。

## 撤销与完成

- 仅撤销 companionCombat.moving、ai.moving、following 拥有的自由路径/终点，停止 AI 移动标志，重决策时间回到当前模拟时间；没有旧路径快照。普通 drawPos、moveProgress、moveFrom 不强制重置。
- 已承诺 crossing 对象与计时保持，只保留其落位终点，撤销之后的 AI 队列及 afterCross；已承诺 skillLanding 的实体返程保持，不再续 AI after 目标。
- 原 attackPending 按原命中验证结算一次。Reservation gate 位于创建新 pending 之前。
- 队友战斗 AI gate 位于危险响应及新目标/走位之前；跟随 gate 位于可能 clearMotion 的分支之前。不会发起新走位、规避、AI Evade/Blink、Flank/Peel/Regroup。
- tickSpecial gate 仅阻止新 Rain/Reap 身体动作。已有 run、后台 Dance/Snipe/Poison 状态、冷却/机动恢复继续；既有技能实际伤害及正常结束保留。
- Ready 为 Reservation 成立且没有 attackPending、foregroundSkill / run、evasion.action、forcedMotion、crossing、skillLanding、loadout、recall、partyTask、rescueTarget、stagger、正时长 stun 或 ready 始动时间。只查询，不推进动作，不存第二套状态。

## 取消、输入与失效

Cancel 只删除 Aim，保留 DirectActor、CommandFocus 和当前 TacticalFocus；不回填旧 AI 路径。AI 下次自主判断从当前位置规划。WASD/E/R/T/Shift 为例外的 Direct Escape Hatch：Cancel Aim → Promote → 同一次输入的原动作；失败仍接管，模态和暂停继续阻拦直接动作。Escape 在模态之外先只取消 Aim，下次才清 Focus。

换焦点、清焦点、提升、身份/队伍/阶段失效清 Aim；不向替代角色转移 Reservation。过期或不匹配焦点的 Aim 不拥有输入权威。Life、伤害、破势、强制位移、救援死亡等原系统继续工作，没有暂停或无敌。

Debug 显示 Focus、Aim、Reserved、yielding/ready、AutonomousStartBlocked。没有新的普通 UI、热键、LMB Confirm、预览或持续 MoveOrder；下一阶段 XC04 尚未实施。

<!-- T-035:start -->
## T-035 单一实控切换（2026-10-07）

用户批准以 controlledBodyId / DirectActor 为唯一实控身份。C 两位本体切换，1/2 绝对选择，头像及场内友方点击立即切人；有效持有 WASD 转交，新技能和机动只操作当前角色。当前角色选择 no-op，无效对象先拒绝。旧 Focus/Promote/CommandAim 与 CommandDefense 正常流程停用；离手交正常 AI，切回撤销普通 AI 路线。新 Aim 只属于 Direct，F 选路保留；切走作废未确认 Aim/token，但保留双方已确认订单和原子动作。成功身体动作只取消自身订单。主 HUD、技能和机动同绑 Direct；复制体查看只读，默认切人不自动慢速，其他模态规则保持。

此块替代历史 T029–T034 的双身份控制要求；资源、碰撞、订单、合法 Release/Hit 与真取消安全契约仍有效。专项入口：docs/tasks/T-035-单一实控输入与交接契约.md；执行与验证：docs/tasks/T-035-单一实控切换与控制简化.md、T-035-验证记录.md。用户试玩通过后直接回 EC10 战术轮盘；XC08/XC12/13 研究与演出不冒充完成，旧 XC10 Command UI 退出。发布仅 GitHub main，禁止 Gitee。
<!-- T-035:end -->
