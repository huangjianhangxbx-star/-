# 原创Spine角色接入检查表（xx试装经验）

本表供下一次资产交接使用，不实现通用导入器，不要求作者改当前原文件。资料来源是已保存AR07审计与本机运行库证据；AR06-G01没有访问 E:/1画画/星骸回廊/rozeul/Models。

| 检查项 | xx当前事实 / 交接时需提供 | 状态 |
|---|---|---|
| 原工程、导出、贴图 | .spine/.json或.skel、atlas与全部PNG；相互引用和SHA256。已存133文件清单见xx-asset-manifest.json | VERIFIED（历史核验，本轮复用） |
| 导出版本 | 当前工程4.3.26，旧skel3.8.99不是当前母版；记录导出工具版本和输出SHA | VERIFIED |
| runtime版本 | 本机4.3.13 Canvas解析；Blue/Yellow4.1、其他3.8隔离，禁止写全局同名namespace | AUTOMATED VERIFIED |
| 动画语义表 | 110名称列表；本轮只消费idle1_1/run/atk1～4/upper_hitted_all/death。其它仅预览 | IMPLEMENTED / 其余PENDING |
| 原事件与秒时点 | hit_start、hit_end、hit_to_idle原60FPS秒值，实际Basic消费者与有效窗对应，详见xx-animation-events.json | SOURCE VERIFIED / 语义部分适配 |
| 命中窗与判重 | 一个动作一个AttackEvent，跨窗口共用目标集合，不把多个窗口自动变成多次伤害 | AUTOMATED VERIFIED |
| AttackReady / MoveReady | 原收招事件后分别1/2帧，两个字段和消费者；原事件没有这两个门 | SAMPLE |
| 方向与镜像 | 单共享rig，169bones/88slots/default skin；水平镜像，无独立五向/背面；不套Blue遮罩 | VERIFIED / 背面PENDING |
| 轨道与部件 | 一个权威Track0；切pose清轨/setupPose，附件完整性与方向混合分开检查 | AUTOMATED VERIFIED / 初步USER LIMITED POSITIVE |
| 显示尺寸与脚底 | 512Canvas、显示2单位、足底450/512；视觉尺寸与世界碰撞体分离 | IMPLEMENTED；比例最终PENDING |
| 碰撞与镜头 | 接现有主碰撞/LOS/双人镜头，不按刀刃外形重造碰撞或镜头 | IMPLEMENTED / 技术回归 |
| 动作资格和取消 | 由主AR02/AR03接入，死亡/受击/移动门/暂停/失焦/切人/重建分别验证 | AUTOMATED VERIFIED |
| 伤害与资源 | 四段15/15/20/35等Blue几何标明来源；没有xx霜寒、弹夹、盾冲消费者 | SAMPLE / 其余PENDING |
| 音效与接触表现 | 需要动作→原事件→已授权音源→播放时点映射；xx尚无原音效绑定 | PENDING，不能制造“原音效已确认” |
| 主权威和身份 | 主HP/resolveHit、ActionContext/AttackEvent/HitOutcome；离手不获Manual权限 | AUTOMATED VERIFIED |
| 人工体验 | “蛮不错”仅初步正反馈；列具体试过/未试项目，另验完整战斗 | USER LIMITED POSITIVE / PENDING |
| 生命周期与发布 | reset/dispose、资源404显式报错、本机loopback白名单；源码可发，原素材本轮仅ignored | AUTOMATED VERIFIED / 项目约束 |

下次交接至少带：源与导出清单/SHA、编辑器与runtime minor、语义表、事件秒时点、资格/取消/资源/声音消费者及SOURCE/SAMPLE/USER APPROVED/VERIFIED/PENDING标记。拿到新资源不自动闭合原作动态消费者或OBS。无需重取已有相同版本证据。
