# Hunter V2 核心合同（G01整体认可并冻结）
只对 exploration 的真实 hunter 生效，显式 hunter-v2。Tower、复制体、其他职业保留 legacy。主 BasicRuntime/ActionContext/AttackEvent/HitOutcome 为唯一权威；不复制 LabWorld。小蓝原 Spine4.1/音频是临时本机参考，正式身份仍为猎人。

|阶段|Dash|Hit|AttackReady|MoveReady|Finish|伤害|直线位移/秒|
|---|---:|---:|---:|---:|---:|---:|---|
|A1|0|.0333|.2|.2333|.7333|15|.16/.1|
|A2|0|0|.2|.2333|.7333|15|.25/.1|
|A3|.0333|.0333|.2667|.3|.6333|20|.8/.18|
|A4|.1|.1333|.5|.5|.8333|35|1.25/.14|

edge缓存 .25 实秒，held 到 AttackReady 续段；Finish/Cancel 后 combo保留 .625 实秒。移动只等 MoveReady，绝不拿架势Break替代。A1–3普通取消清判定；A4已释放判定在普通取消后保留；死亡/reset全清。

Shift：2次、逐次2.5模拟秒恢复，2.6米/.14秒 ease-out quad、.13秒无敌；dashStrike Hit0、Break/End .2、clip .3333，伤害15。
RMB：startup .08、方向半角60°、移动倍率.35；霜寒3，成功有效接触扣1、去重不能重复扣；退出格挡且距扣费2模拟秒后 .8/s。背后/startup/无效接触不扣。
E：后退1.7米/.15秒准备，最长2秒；松开后原释放片段 .1667秒，Hit0扣一次充能、CD8、MP费用0；子盾冲独立身份继承root/parent，6米/.2秒 ease-out、伤害75、clip .6秒。付款前取消免费；付款后挥空仍支付。不得按命中退款。

出手hitstop .03实秒（A4 .045）倍率.15；有效受伤 .2实秒倍率.5。资源/动作在模拟时钟推进，edge/combo/hitstop使用实时。暂停不推进，清held/预输入/特殊动作，保留已接受Basic；blur同样处理。ShadowResident冻结资源和输入。

T014姿态/虚血仍由主消费者处理，格挡不自动免除原姿态伤害。主 HP/压力/地形/敌人不是Lab数值；用户须验证主环境是否影响已认可手感。

## G01 冻结（2026-10-08）

USER APPROVED：本轮用户回复“整体认可，可以收口（注明未试项）”；F03 新版“无问题”另记视觉通过。未提供具体未试项，不声称 A—L 均经用户逐项实测。LAB VERIFIED / MAIN IMPLEMENTED：复用 AL01 M2/M3、AR05/F01/F02/F03 版本匹配证据，本轮黄金定向4文件21项通过。SAMPLE：保留已批准实验消费者与参数，原作 OBS 未闭合。PENDING：逐项人工覆盖、正式资产、AL04-F01 RMB 与 AR06 独立计划。

冻结动作事件、取消、资源节点、位移曲线、Hitstop 与音频 cue；仅换美术/音色不改时序。5面骨骼不作为未来生产规格，未来可正/背或单面但保留360度战斗判定。当前候选合同已按整体认可转为冻结，历史待验文字由本节替代。详见 AR05-G01-acceptance.md。
