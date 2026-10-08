# AR06-G01 双角色实战与用户边界

受测游戏基准5d77f90，2026-10-08执行、10-09交接。中断期间HEAD变为33688da（独立2DW-02）；全game/src SHA与开工一致，冻结合同未变。本轮没有产品代码改动。

## 真实输入与结算

只在普通主页选探索、阿尔、携带进入，WASD/鼠标/LMB/RMB/Shift/E/Z/Space操作。页面evaluate只读状态与路线、观察音源；未写HP/位置/障碍、未调用伤害入口、未增fixture敌群。到达现有第一遭遇使用键盘跟随只读路线；只有当前可见敌人方向才攻击。仍是自动键鼠实战证据，不是用户全流程试玩。

本机证据：work/AR-06-G01/natural-evidence.json、encounter-evidence.json、ordinary-dual.png、ordinary-encounter.png及natural-video/encounter-video/。录屏没有系统音轨。自然战斗日志包含玩家普攻、格挡、闪避、切人、离手普攻和阿尔玩家枪击；最终两名active本体hunter/ranger，其它旧角色为reserve。

| 项目 | 本轮结果 / 复用证据 | 人工状态 |
|---|---|---|
| Hunter held四段、tap、攻击后移动 | 普通入口真实输入；黄金/门/位移定向回归 | 既有G01 USER APPROVED，逐项覆盖名单未提供 |
| Hunter方向盾/霜寒 | 自然敌人melee-heavy-cleave被block，HP损失0；核心资格/支付/恢复测试 | 不重调；沿既有认可 |
| Shift闪避与冲刺斩 | 自然输入产生hunter-dodge命中；窗口和墙回归 | 沿既有认可 |
| E准备、释放、Z后生命周期 | 普通页真实释放与支付、F02原actor释放；独立门/取消测试 | 沿既有认可 |
| Al三段held/tap、移动门 | 普通页held三段和F02真实tap；AR06核心门测试 | IMPLEMENTED / AUTOMATED VERIFIED，逐项手感未提供 |
| Al翻滚/无敌/墙 | 真Shift；核心.13窗口与碰撞回归 | 同上 |
| Al四发/装弹/第五发 | 原生真实held，4→0→reload→第5次支付；原音源链路触发 | 本轮RMB USER APPROVED，逐项人工覆盖未知 |
| Al自然枪击 | WASD接近可见敌人，3次玩家子弹主HitOutcome，每发32伤，目标explore-3 | 技术实战证据；不扩成全部敌群人工通过 |
| Al E运输/落地/CD/墙 | 普通页真实E落地；主root/child与真实地形core回归 | 人工逐项未提供 |
| Z两本体、资源/HUD隔离 | 八次真实Z、两active，F02旧C/1/2/头像禁止，暂停清输入 | AUTOMATED VERIFIED |
| 离手只Basic | 自然hunter companion-ai四段命中；AR06/T036核心Al三段，不自动RMB/E | AUTOMATED VERIFIED，长期手感未提供 |
| F/G、黑暗空挥/LOS | F02真实键鼠，T036策略/权限核心；实际碰撞权威 | AUTOMATED VERIFIED；旧EC10四失败另列 |
| .1/1/2、暂停/失焦、单身体 | 本轮F01/F02/F03+核心，蓝黄4.1同屏；xx4.3与旧3.8隔离复用AR07 | AUTOMATED VERIFIED |

自然主权威观察示例：Hunter玩家普攻15/15/20；方向盾block；Al玩家小黄远程对explore-3三次32伤。伴随既有敌人攻击和离手Hunter Basic，来源身份分别登记，没有把离手命中算成Al射击。

## 采集局限与保留尝试

attempt1导航脚本W/S符号错误，未到遭遇；attempt2已到但精确拾取透明脚底未选中角色；attempt3已有Hunter实战，Al开火但没有证明玩家弹体接触。最终增加可见性检查、真实WASD接近和鼠标持续指向才取得三发Al接触。四次记录全部本机留存，不把前三次当作全部成功，不以采集问题修改战斗。

已批准SAMPLE/原素材消费者/OBS区分保留。旧地图和旧敌人只用作本轮角色回归载体；最新对话的全面怪物替换与架势融合超出G01，尚未实施，不称其已验收。阿尔RMB总体认可不自动关闭Al全包、所有敌群、墙边或长期性能未知覆盖。
