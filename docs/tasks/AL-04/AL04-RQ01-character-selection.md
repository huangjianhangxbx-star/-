# AL04-RQ01｜第二角色有限候选与锁定

研究支持独立执行者；2026-10-07；Build 24935935。只读原资源/现有父研究，仅写本RQ与 work/AL-04；未改游戏、父报告或原作，未启动原作OBS。按 AL04 v0.1 P0 比较最多三候选，未扩技能树。

## 选择建议与身份边界

建议 `characterId=小黄`，真实 Unit.prefab=`魔弹射手`、model=`小黄`。选定本地小黄.prefab的Unit组件 `loadData.id/model` 和 `heroData.id` 分别吻合原资源Hero/Unit行；主角label真实存在。原Unit.name为`？？？`；本轮不能声称“魔弹射手”是原作个人显示名。显示名保持null，申请P0例外，页面可按用户批准显示真实资源身份及“原显示名待核”。不把颜色昵称冒称名字。

有限比较：

| 候选ID | 已证数据拓扑 | 取舍 |
|---|---|---|
| 小黄 | 左键挥舞炮筒三段、右键枪找子弹、弹夹4/上限7、能量0、翻滚、上弹 | 锁此一名直接依赖；独立装弹与点选弹射提供不同语法 |
| 小红 | 父CR03B限定近战Combo安装+飞刀，Hero能量10 | 不扩新动作；整体更接近已有近战样板 |
| 小绿 | Hero能量100、召唤消费者元数据存在 | 不扩宠物/召唤依赖，避免本轮范围增长 |

## 原资源事实

小黄 Unit原HP40、moveSpeed6、modelRange.25；Hero BasicAtkSpeed .91、Combo维持.5、dashCount1/CD1/duration.19/distance2.4。数值是源配置，不代表动态最终效果。

Basic：Hero.bornLeft→Card小黄近战（显示挥舞炮筒）→Skill小黄近战（瞬发+主角_替换连招）→Combo小黄近战连招 `[小黄a1,小黄a2,小黄a3]`。三段rawatk15/20/30，clip a1/a2/a3。选定原Spine事件：

| clip | Dash | Hit | Break | End |
|---|---:|---:|---:|---:|
| a1 | .0119 | .0333 | .1333 | .2 |
| a2 | .0333 | .0667 | .1667 | .2667 |
| a3 | .1667 | .1667 | .3 | .4 |

三段Bullet为跟发射点+冲击波+spine方向，duration .15。prefeb空/range0不证明零几何；实际碰撞仍未知。共享连招安装/攻击事件生产沿父CR03B可复用；新小黄OnAttack明确转发Character.OnAttack。没有原作按键观察，Held推进/取消窗口需要实验采用并显式记录。

翻滚：Hero与Card锁定，没有盾；小黄DashEnter调用Character.DashEnter并暂停上弹动画。_dash无事件、视觉duration .3667；不能把它当.3667全无敌。实际无敌窗尚未闭合。

代表主动选 **火箭弹射**，仅原基础卡：color小黄/kind技能，rootSkill主动瞄准跟子弹、CD6/cost0/range6、clip rocketjump，关键词无敌/不许冲刺。原skill_rocketjump Hit.1/End.4667。root atk0→火箭跳子弹（抛物线砸地，duration.33/height3/function手雷）→命中时直接son火箭弹射爆炸（atk85/target自己）→火箭跳爆炸子弹（圆2、凭空出现、冲击波、duration.1）。不外推所有技能。

**直接消费者**：主动瞄准跟子弹.Shoot先base.Shoot再跟弹；async _跟子弹缓存Context.bullet，角色初始位置−bullet位置偏移，并随bullet写Unit.transform.position（维护NavMeshAgent）。因此是角色跟随弹道的位移，不是留角色原地的独立飞弹。End调用所跟bullet.Finish(false,false)、清引用，再base.End。原输入具体Hold→Release/智能施法默认设置未知；不得从类名强造蓄力阶段。可申请2D SAMPLE：Q按下接受并缓存指针落点→Hit发射→角色随.33弹道位移→落地派生爆炸→End清理。

RMB源卡显示射击32伤、3秒不射或弹尽自动上弹。枪找子弹.技能释放时：空列表拒绝并ReloadEnter；非空读装弹列表[get_子弹位置]选择实际Skill，AimAsset，Context最后一发标记，然后Cast。本方法本身不扣弹。本轮未闭合真实默认弹种与扣弹节点，不冒称r1是唯一执行Skill。config上弹时间=.8；ReloadEnter读它，ReloadUpdate按deltaTime*上弹速度减；base上弹速度/换弹不许动时间及完整ReloadEnd原子结算未闭合。若纳入RMB，需要单独SAMPLE，不把所有支付归通用AttackEvent。

## 所需最小实验缺口

准确显示名；碰撞半径/扇形与投影；Held段序、Attack/Move恢复与取消；翻滚无敌具体窗；RMB弹种/扣弹/补满节点和速度属性；主动输入方式、合法落点、精确无敌/取消与恢复；音画映射。建议Basic range1.8/halfAngle1/life.15，主动radius2/life.1，均是未批准建议；其余原数值见JSON，不能改标成SAMPLE失去来源，也不能把SAMPLE当OBS。

## 资产与取证

已提取原小黄Spine4.1.23及png/atlas/json至 `work/AL-04/assets/yellow`，默认skin。记录 `work/AL-04/yellow-extraction.json` 含bundle与文件SHA256、对象ID、原clip事件。bundle SHA256 `6c178ba6748ab25371e1bd052b617687c1570c0e565e9425988122ce14a8d634`。没有自制替代角色。原粒子/特效与准确audio映射尚未导出，优先继续所需原资源；不足时由用户批准最低实验反馈，不默认新增素材。

资源原文件SHA256 `5c44a84aadc79e06e588a2264f6afc72ffd94bdfcd464b7bd7ce86d5b39319aa`；Assembly SHA256 `51977661202d164037abaa502a701e64c9426e8b6351ea6200263033c3188d44`。有限新静态方法23（21业务/2编译器生成；准确清单见JSON）。原Assembly仅静态PEReader读取，未加载运行。

原OBS与user_acceptance仍null。所有证据为原配置、序列化绑定或静态消费者；不声称默认选择已实机可用或完整角色还原。父CR03B H2旧状态保持原样，本RQ独立补证不改父结论。
