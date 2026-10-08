# xx 源动画与事件审计

只读来源 E:/1画画/星骸回廊/rozeul/Models。旧 rozeul.skel 是3.8.99，不能代表更新后的美术工程。实际已安装 Spine Pro 4.3.26 的只读 info 确认当前 rozeul.spine 是4.3.26、Dopesheet 60 FPS；CLI json+pack 输出至 ignored work/AR-07-X01/assets/xx，未使用 clean/save，源文件指纹留存。

真实4.3.13 Canvas运行库解析当前导出通过。该库以Blob ES module局部变量加载，不写window.spine；3.8及4.1继续原隔离方式。minor一致的导出兼容约定见[官方运行库说明](https://github.com/EsotericSoftware/spine-runtimes/blob/4.3/spine-ts/README.md)，只读CLI与导出依据见[官方CLI](https://en.esotericsoftware.com/spine-command-line-interface)。匹配来源与SHA见xx-asset-manifest.json。

当前169骨骼、88 slots、default皮肤，110动画。单一root/共享身体rig，动画内可转侧面；没有五方向选择轨。水平朝向镜像；上下仍使用原rig，不宣称已提供独立背面。没有应用Blue部件遮罩。换pose先clearTracks/setupPose，仅一个权威Track0，时间直接采样；视觉2×512画布，脚底450/512，不改变世界碰撞体。

P0实拍观察：idle1_1站立完整；run有行走摆动；atk1/2有横向刀击，atk3延伸刀刃，atk4低姿态旋身；原hit_start附近刀刃已展开，hit_end附近进入回收。upper_hitted_all作为受击候选、death倒地候选。对应窗口解释是合理适配，未称作者语义确认；原文件保留。截图所写Z/Rknife4实际为骨骼，不是独立动画名。

## 采用母版与SAMPLE
四段近战优先Blue。伤害15/15/20/35、范围1.7/1.7/1.8/2.2、半角1/1/1/.48标XX SAMPLE FROM BLUE。没有照搬Blue的Dash/霜寒/盾冲；RMB/Shift/E禁用，并在UI说明。atk_branch、dodge、qte、heavy、xskill和其它源clip可在预览观看，但不新建能力消费者。

hit_start/hit_end只开关有效窗；每次动作一个AttackEvent，一个目标集合跨窗口判重。hit_to_idle仅记录收招。无独立AttackReady/MoveReady原事件，本轮计划许可集中SAMPLE：收招标记后1帧连接解锁、2帧移动解锁；二者有独立字段和日志，不改原事件。空挥不绑定敌人，伤害通过主权威/已知活跃遭遇/LOS提交。模拟时钟与动作画面统一；原事件时间用原60FPS秒值。

|槽位|源动画|hit_start|hit_end|hit_to_idle|AttackReady SAMPLE|MoveReady SAMPLE|
|---|---|---:|---:|---:|---:|---:|
|Basic1|atk1|0.0833333|0.2666667|0.3666667|0.3833334|0.4000000|
|Basic2|atk2|0.1000000|0.3666667|0.5000000|0.5166667|0.5333333|
|Basic3|atk3|0.2333333|0.4166667|0.6833333|0.6999999|0.7166666|
|Basic4|atk4|0.0666667|0.5666666|0.7666666|0.7833333|0.7999999|

## 全动画清单（事件原始顺序）

|源动画|时长秒|事件|本轮消费者/级别|
|---|---:|---|---|
|atk1|1.1000000|hit_start@0.0833333; hit_end@0.2666667; hit_to_idle@0.3666667|Basic / 原事件观察、语义适配|
|atk1_move|1.1000000|hit_start@0.0833333; hit_end@0.2666667; hit_to_idle@0.3666667|预览 / 未启用能力|
|atk2|1.2666667|hit_start@0.1000000; hit_end@0.3666667; hit_to_idle@0.5000000|Basic / 原事件观察、语义适配|
|atk2_move|1.2666667|hit_start@0.1000000; hit_end@0.3666667; hit_to_idle@0.5000000|预览 / 未启用能力|
|atk3|1.3000000|hit_start@0.2333333; hit_end@0.4166667; hit_to_idle@0.6833333|Basic / 原事件观察、语义适配|
|atk3_loop|0.3333333|—|预览 / 未启用能力|
|atk3_move|1.3000000|hit_start@0.2333333; hit_end@0.4166667; hit_to_idle@0.6833333|预览 / 未启用能力|
|atk4|1.4666667|hit_start@0.0666667; hit_end@0.5666666; hit_to_idle@0.7666666|Basic / 原事件观察、语义适配|
|atk4_move|1.4666667|hit_start@0.0666667; hit_end@0.5666666; hit_to_idle@0.7666666|预览 / 未启用能力|
|atk_branch|1.2333333|hit_start@0.2666667; hit_end@0.6666667; hit_to_idle@0.7666666|预览 / 未启用能力|
|atk_branch_move|1.2333333|hit_start@0.2666667; hit_end@0.6666667; hit_to_idle@0.7666666|预览 / 未启用能力|
|death|1.1166667|—|死亡 / 合理适配|
|dizzy_end|0.3333333|—|预览 / 未启用能力|
|dizzy_loop|1.1666666|—|预览 / 未启用能力|
|dizzy_start|0.2500000|—|预览 / 未启用能力|
|dodge_back|0.6666667|—|预览 / 未启用能力|
|dodge_counter|1.0333333|hit_start@0.1166667; hit_end@0.3666667; hit_to_idle@0.5166666|预览 / 未启用能力|
|dodge_counter_move|1.0333333|hit_start@0.1166667; hit_end@0.3666667; hit_to_idle@0.5166666|预览 / 未启用能力|
|dodge_front|0.6333333|—|预览 / 未启用能力|
|execution|2.9500000|m_start@1.0000000; hit_end@2.0000000; hit_to_idle@2.3333330|预览 / 未启用能力|
|execution_move|2.9500000|m_start@1.0000000; hit_end@2.0000000; hit_to_idle@2.3333330|预览 / 未启用能力|
|fly_fall|0.3333333|—|预览 / 未启用能力|
|fly_trans|0.3000000|—|预览 / 未启用能力|
|fly_turn|0.3333333|—|预览 / 未启用能力|
|fly_turn2|0.2992461|—|预览 / 未启用能力|
|fly_up|0.3333333|—|预览 / 未启用能力|
|ground|0.5333333|—|预览 / 未启用能力|
|ground_death|1.1833333|—|预览 / 未启用能力|
|ground_hitted|0.2500000|—|预览 / 未启用能力|
|heavy|1.3666667|hit_start@0.0666667; hit_end@0.3333333; hit_to_idle@0.5000000|预览 / 未启用能力|
|heavy_ex|1.3000000|hit_start@0.0666667; hit_end@0.6333333; hit_to_idle@0.7333333|预览 / 未启用能力|
|heavy_ex_move|1.3000000|hit_start@0.0666667; hit_end@0.6333333; hit_to_idle@0.7333333|预览 / 未启用能力|
|heavy_move|1.3666667|hit_start@0.0666667; hit_end@0.3333333; hit_to_idle@0.5000000|预览 / 未启用能力|
|idle1_1|4.0000000|—|预览 / 未启用能力|
|idle1_2|4.0000000|—|预览 / 未启用能力|
|idle2|4.5000000|—|预览 / 未启用能力|
|idle3|4.6666660|—|预览 / 未启用能力|
|jump_atk_all_move|1.3666667|—|预览 / 未启用能力|
|jump_atk_end|0.9000000|hit_end@0.0166667|预览 / 未启用能力|
|jump_atk_loop|0.1666667|—|预览 / 未启用能力|
|jump_atk_start|0.3000000|—|预览 / 未启用能力|
|jump_atk_start_move|0.3000000|—|预览 / 未启用能力|
|leg_hitted|0.1666667|s_start@0.0000000; m_start@0.0500000; s_end@0.0500000; l_start@0.1000000; m_end@0.1000000; l_end@0.1666667|预览 / 未启用能力|
|leg_hitted2idle|0.3333333|l_end@0.0000000; l_start@0.0000000; m_start@0.0666667; s_start@0.1666667; l_end@0.3333333; m_end@0.3333333; s_end@0.3333333|预览 / 未启用能力|
|leg_hitted_all|0.5000000|—|预览 / 未启用能力|
|qte1|2.0333331|hit_start@0.3333333; hit_end@1.1333333; hit_to_idle@1.4666667|预览 / 未启用能力|
|qte1_end|1.1666666|hit_end@0.2666667; hit_to_idle@0.6000000|预览 / 未启用能力|
|qte1_end_move|1.1666666|hit_end@0.2666667; hit_to_idle@0.6000000|预览 / 未启用能力|
|qte1_loop|0.1666667|hit_start@0.0000000|预览 / 未启用能力|
|qte1_move|2.0333331|hit_start@0.3333333; hit_end@1.1333333; hit_to_idle@1.4666667|预览 / 未启用能力|
|qte1_start|0.3333333|hit_start@0.3333333|预览 / 未启用能力|
|qte1_start_move|0.3333333|hit_start@0.3333333|预览 / 未启用能力|
|ready_end|1.0666667|—|预览 / 未启用能力|
|ready_loop|1.0000000|—|预览 / 未启用能力|
|ready_start|0.6666667|—|预览 / 未启用能力|
|run|0.8000000|—|预览 / 未启用能力|
|stand_up|0.4833333|hit_end@0.3500000|预览 / 未启用能力|
|start|2.6500001|—|预览 / 未启用能力|
|upper_hitted|0.1666667|s_start@0.0000000; m_start@0.0500000; s_end@0.0500000; l_start@0.1000000; m_end@0.1000000; l_end@0.1666667|预览 / 未启用能力|
|upper_hitted2idle|0.3333333|l_start@0.0000000; m_start@0.0666667; s_start@0.1666667; l_end@0.3333333; m_end@0.3333333; s_end@0.3333333|预览 / 未启用能力|
|upper_hitted_all|0.5000000|—|预览 / 未启用能力|
|win_start|4.1166668|—|预览 / 未启用能力|
|xskill|2.3666666|hit_start@1.0000000; hit_end@1.6000000; hit_to_idle@1.8333334|预览 / 未启用能力|
|xskill_move|2.3666666|hit_start@1.0000000; hit_end@1.6000000; hit_to_idle@1.8333334|预览 / 未启用能力|
|base/celebration|6.6666660|—|预览 / 未启用能力|
|base/drag|2.3333330|—|预览 / 未启用能力|
|base/drag_end|0.7833333|—|预览 / 未启用能力|
|base/drag_end4|0.6666667|—|预览 / 未启用能力|
|base/draw_loop|4.0000000|—|预览 / 未启用能力|
|base/draw_start|7.3166661|—|预览 / 未启用能力|
|base/touch|3.5999999|—|预览 / 未启用能力|
|base/walk|1.0000000|—|预览 / 未启用能力|
|city/fall_loop|0.1666667|—|预览 / 未启用能力|
|city/jump_all|0.9000000|—|预览 / 未启用能力|
|city/jump_end|0.7500000|—|预览 / 未启用能力|
|city/jump_loop|0.1666667|—|预览 / 未启用能力|
|city/jump_start|0.0666667|—|预览 / 未启用能力|
|city/jump_trans|0.3333333|—|预览 / 未启用能力|
|city/sit_all|2.6666670|—|预览 / 未启用能力|
|city/sit_loop|1.6666666|—|预览 / 未启用能力|
|common/give_end|0.5000000|—|预览 / 未启用能力|
|common/give_loop|1.6666666|—|预览 / 未启用能力|
|common/give_start|0.6666667|—|预览 / 未启用能力|
|common/no|2.0000000|—|预览 / 未启用能力|
|common/objection_end|0.3333333|—|预览 / 未启用能力|
|common/objection_loop|2.0000000|—|预览 / 未启用能力|
|common/objection_start|0.6666667|—|预览 / 未启用能力|
|common/ready2_all|3.6666670|—|预览 / 未启用能力|
|common/ready2_end|0.4333333|—|预览 / 未启用能力|
|common/ready2_loop|1.3333334|—|预览 / 未启用能力|
|common/ready2_start|1.9000000|—|预览 / 未启用能力|
|common/ready2_start2|1.9000000|—|预览 / 未启用能力|
|common/squat_check_end|0.4500000|—|预览 / 未启用能力|
|common/squat_check_loop|1.6666666|—|预览 / 未启用能力|
|common/squat_check_start|0.4166667|—|预览 / 未启用能力|
|common/squat_end|0.3333333|—|预览 / 未启用能力|
|common/squat_loop|2.0000000|—|预览 / 未启用能力|
|common/squat_start|0.3333333|—|预览 / 未启用能力|
|common/take_check|3.3333330|—|预览 / 未启用能力|
|common/take_end|0.6666667|—|预览 / 未启用能力|
|common/take_loop|2.0000000|—|预览 / 未启用能力|
|common/take_start|0.3333333|—|预览 / 未启用能力|
|common/talk1|3.0000000|—|预览 / 未启用能力|
|common/talk2|3.0000000|—|预览 / 未启用能力|
|common/think_end|0.5000000|—|预览 / 未启用能力|
|common/think_loop|2.0000000|—|预览 / 未启用能力|
|common/think_start|0.3333333|—|预览 / 未启用能力|
|common/walk|1.0000000|—|预览 / 未启用能力|
|common/walk_back|1.0000000|—|预览 / 未启用能力|
|common/yes|2.0000000|—|预览 / 未启用能力|

全部骨骼/slot/skin附件名称从新导出登记于xx-skeleton-inventory.json；不是已验证每个110动画全部时点。未使用的强度事件s/m/l不映射通用命中。未有音效事件标识；本轮不制造原音效绑定。原资源不提交GitHub，忽略文件仅本机可用。

其它xx独立技术样本：受击动作锁0.5模拟秒，短点击缓冲0.25真实秒，连段保持0.625真实秒，命中Hitstop0.03真实秒/0.15倍率。它们不是原事件或作者已确认参数；与伤害/范围同属本机试装SAMPLE。
