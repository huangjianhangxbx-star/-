# 动作表现与位移候选合同
核心时点与位移见 AR05-hunter-v2-contract.md；属于黄金继承值，不为主动画迁移重新设计easing。基础四段为匀速短位移；Dodge、准备后退和盾冲为ease-out quad。地形和身体碰撞仍按主游戏分段扫掠，阻挡时不强行穿透。
原 _a1/_a2/_a3/_a4、skill_dashStrike、skill_架盾2、skill_盾冲前1/前3/盾冲！、_damaged/_die 由权威动作时间驱动，暂停/hitstop不独立跑动画。Spine4.1 namespace捕获后恢复3.8，同行者维持3.8。
本合同待AR05用户试玩确认后才作为正式美术冻结要求；当前未制作《星骸》自己的动画。
