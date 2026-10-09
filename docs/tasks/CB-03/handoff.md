# CB-03 攻击权威交接

## 消费者归属

| 路径 | 发起 / Release | 几何/碰撞/阻挡 | 终结 |
|---|---|---|---|
| 猎人LMB | basic-chain/basic-runtime + 原Hit | hunter-combat 原声明range/角度/身体容差 + clearShot | hz.hit、寿命/取消、resolveHit |
| 猎人RMB | hunterInput方向格挡 | hunterDefense原窗口/角度/霜寒；不发攻击弹 | 原资源接触/取消 |
| 猎人E/闪避 | hunterInput原事件/子动作 | 原局部扇形；translate合法地形移动 | 原扣费/Hitstop/取消 |
| 阿尔LMB | basic-runtime/原三段Hit | 原range/halfAngle + clearShot | 单entity hit/Finish |
| 阿尔RMB | 原r1 Hit扣一弹/spawn | 原30速度/5.6范围/半径；已缓存发射→瞄准目标的高度线；swept平面接触+完整路径障碍 | 子弹单接触、墙/寿命、原装弹 |
| 阿尔E | 原Hit/运输落地派生 | 原角色translate/落地circle+clearShot；不是通用弹道替换 | 原动作/子动作身份/取消 |
| 新僵尸 | enemy-action原Hit | enemyEntityArea扇形 + areaHits，实体跟随源 | 独立contacts，原deathPolicy clear |
| 骷髅弓 | enemy-action/原1+2派生 | enemy-ranged缓存三目标，运输沿固定launch→destination高度线；落地circle独立 | 原.1延迟/三contacts/retain及generation清理 |
| 离手Basic | companion-combat唯一目标 + basic-chain | 对应角色消费者；不是第二伤害中心 | 既有目标粘性/命中身份 |
| legacy模板 | engine geometry/templateGeometry→inWeaponRange | 声明射程，远程可跨层需物理LOS、近战同层；canHit拒绝crossing | 冻结历史夹具，未开放旧入口 |

方向背击/弱点仍由directionality独立解释，没有删除。没有高地必中或射程额外加成；近战、扇形、落地AOE仍使用各自既有权威，没有统统改成子弹LOS。

## 真实断点与最小修复

新增真实阿尔输入/step高→低测试RED：每个短运输段重新以当前格面eyeHeight重算，造成下降台沿假阻挡。spatial保持clearShot旧语义并抽出相同exact-grid ray检查；clearProjectilePath只为已发射弹道保留launch至缓存瞄准终点的高度插值。阿尔生成时缓存trajectory，射程仍由5.6寿命控制；骷髅弓使用原from/to，投影及运输都消费同一弹道。墙体、边角、地图外仍阻挡；不追踪目标后续移动。继续使用原平面身体碰撞，不宣称新增完整3D弹体系统。

原core时点、威力、费用、.1第三条运输、黄金恢复/装弹/霜寒未改。现有普通暗牢同层；高低差为明确合成场，不改普通地图来拍假自然证据。

## 验证

- 16个新增高→低/低→高/同层、射程、墙、边角、扇形、模板过渡/原骷髅三条运输测试；与原生敌人、黄金角色及NR合计114通过/10文件。原始RED保留；其中areaHits参数/敌朝向测试搭建错误另记，未当产品缺陷。
- 自然浏览器12项最终分别通过：11项整组 + 修正移动拾取与提交时采样后的集火单项。旧AR06/EN06直接引用已退休入口/旧HUD，首次失败未改产品；新night-*副本只适配现行入口/HUD和稳定实际拾取、在接受时记录目标，保留原文件。
- 集火接受时实际Basic目标/战术目标/AI决策目标一致；敌死亡后清目标不被误报回退。实际失焦/G/F/Z、ActionLab、双角色普攻终段、装弹与火箭均通过。
- TypeScript和主构建通过，阶段P2 ActionLab双构建及自然右键证据仍适用；最终P5再全量。

P4继续伙伴战术，用户黄金手感未重新标为人工通过。
