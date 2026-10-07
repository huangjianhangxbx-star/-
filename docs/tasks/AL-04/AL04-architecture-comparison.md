# AL04 分层比较

| 边界 | 小蓝 | 魔弹射手 | 实际归属 |
|---|---|---|---|
| 输入 | 四段basic、RMB盾、Space攻击闪避、Q准备/释放盾冲 | 三段basic、RMB弹夹射击、Space无攻击翻滚、Q即时点选跳跃 | Input Intent由PlayerController解释，registry仅构造/Reset选择 |
| 资源 | LabResources：霜寒、闪避、主动充能、MP | 自己的弹夹、装弹、rollCD、rocketCD | 角色独立；resourceRows是HUD投影，不要求全角色同字段 |
| Defense | guardContact方向/费用；独立来源无敌 | 没有guardContact；roll和rocket各自来源无敌 | 无敌来源容器共享，Block仅小蓝能力 |
| 动作轨 | AL01/M2既有时点/恢复/取消 | 原a1–a3/r1/rocketjump事件，Q1实验执行语法 | IsdaraController / CannoneerController；世界不按playerKind逐处判断 |
| Actor | blue兼容身份 | yellow实例、characterId小黄；原显示名null | 统一player与Actor；旧blue访问器仅兼容旧测试 |
| 攻击 | Basic/盾冲/派生 | Basic/炮弹/跳跃root与爆炸child | 共享AttackEvent身份、发布总线；付款不写入通用AttackEvent规则 |
| 命中 | 扇形/有限派生 | 扇形、直线首目标、落地区域逐目标 | 共享hazard/collide/EffectiveHit；单弹限定目标与每波命中去重分开 |
| Projectile | 骷髅弓落点运输来自敌人 | 直线炮弹和角色跟随抛物线 | 原ProjectileRuntime复用；角色callback解释contact/landing，不新建第二套伤害系统 |
| 生命周期 | 已释放AL03敌弹死亡保留 | Q取消/死亡清运输与待生爆炸；炮弹按获准策略 | generation/身份共享，ownerDeath与取消不是全局统一政策 |
| 页面 | 原资源行、可选旧构筑 | 自己三行资源/真实原骨架、禁旧构筑 | entry.ts只选择/渲染/输入/声音；不改HP，不负责damage |

保留的有限技术边界：world仍提供旧shield/dodge/prepareActive名称的兼容入口；新Controller内部使用secondary/mobility/active。AL02冰柱/大斧和energy的可选扩展仍在world中，依profile.builds和旧resources能力接入。本轮不借第二角色任务改造完整装备/技能框架。世界的伤害、碰撞、事件与敌人AI没有复制进新角色模块。

小蓝数值沿原profiles/reference、sample、m2、al02；仅动作代码移入IsdaraController。新角色原Unit基础HP40/速度6不等于原最终结算属性；事件原始时点的运行采纳为批准SAMPLE。真实输入、接受、AttackEvent、空间伤害与EffectiveHit分层，新射击付款位于Hit，主动费用原0，装弹完成单独结算。

新的永久配置术语仅限AL04：PlayerKind为本实验有限选择键；characterId为原角色定义ID；actorId为本次世界实例身份；PlayerProfile是静态描述；PlayerController持有角色运行状态。未修改主游戏术语、用户维护区或开发细则。
