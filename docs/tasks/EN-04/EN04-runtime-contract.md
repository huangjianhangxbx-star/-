# EN04 架势接触与控制合同

`resolveHit`仍唯一HP权威，具名V2入口创建冻结 `postureRuntime`，Reference只用于独立程序对照，无运行中UI切换。普通入口/Tower/旧庭院/EN01夹具保持原二次命中规则。新层没有自己的输入、World、Clock、伤害或Action ID中心。

有效接触→已有防御/HP→仍存活者架势结算→零点当次PostureBroken与身体取消→原消费者受击音画。死亡优先；HP0的盾挡可削架势。真实墙/范围资格在攻击实体端，invulnerable/Miss不进入架势。每实体contacts与普通damage eventId去重不合并，独立波次可以各触及同一目标。

第一次正数到0同次控制；持续期间HP仍真实扣，记录额外接触、不续期不叠时长。结束恢复半最大值。新有效攻击重置1.5模拟秒等待，控制时间也计入等待；DOT的原扣血消费者不调用新攻击架势入口。普通走路满速；Basic主手、盾冲准备/释放、Al射击/火箭、闪避暂停；Hunter盾副手半速。按当前实际runtime.kind映射，不以RMB推测；无法确认的旧技能活动为unknown/暂停，在源函数明确暴露。

PostureBroken不同于原AttackReady/Break事件，也不同于普通incoming>defensiveHardness Hurt。普通反应保持旧硬度门；零点优先一次取消，不再触发旧二击或额外强制击退。僵尸pre-Hit身体取消不释放；弓手已提交运输（包括未来第三）按retain，不随身体取消/死亡删掉。世代Reset清控制/诊断，主实体世界按既有generation清理。

Trace记录接触前后、原值、减免、实际损失、caster/root/parent/action/attack/entity；不分配新的ID。TraceOFF HP/架势/控制/seed/nextID一致。敌方架势条与受控提示只随已显示单位呈现；风险提示按实时可见位置，开发诊断可收起。

Hunter/Al黄金定义、费用、动画时点、四段/三段与基础输入全部保持原文件SHA。新层仅具名V2世界，新增受控是本轮已批准行为而非原作还原。
