# EN00｜旧系统替换与保留边界

本轮没有改动或删除代码。以下是后续分期替换合同，不是已有 V2 实现状态。基准 `main@3eea3eb` 的游戏提交内容与计划 `5d77f90` 一致。

## 旧设计退位，运行依赖仍在

| 范围 | 后续决定 | 当前实际 |
|---|---|---|
| 新探索正式敌人 | V2 Profile→Decision→Action→独立实体→主结算；不使用旧 Kit 隐形 fallback | 尚未实施，当前普通试玩仍旧敌人 |
| `enemy-abilities/enemy-combat/enemy-approach/attack-intent` | 旧 fixed total/lock、probe/burst、melee/ranged/heavy 的出招反应退出新探索基线 | EN00 只读定位；EN01 夹具隔离，EN02/03 分样板切换 |
| Tower/历史场 | 保留实际调用与旧回归，不扩成新模式目标 | 不删除、不重调、不用其通过宣称新敌我完成 |
| `pressure.ts` 及旧反应 | V2 接新适配器，避免两次反应/架势 | 现行为 LEGACY；EN04 实施最新零点/恢复/盾规则 |
| 地图/Unit/HP/encounter IDs | 复用可验证的空间和身份基础 | 不能默认旧 blockCapacity、高低差、追击距离全部符合新规则 |
| Action Lab | 冻结参照和技术证据，继续本机可试玩 | 不复制 LabWorld 为第二个主伤害世界；不把素材新证据当原动态闭合 |

切换必须覆盖 `engine.tick` 的旧反应、AttackIntent tick/resolve、候选、probe、basic fallback 和死后清理所有入口，仅替换选招函数不够。`enterExploration` 和 seed/profile 注册也要分开；未迁移 heavy 明确未就绪，不能给它偷偷分配旧 ground-slam。旧原型保留在显式 Legacy 对照，开发入口不能以统一“已迁移”标签混入旧敌人。

## 可复用，但必须过接口验收

- 主 `resolveHit` 是唯一 HP/防御结算点。新实体送明确 caster/action/root/parent/entity/target/time，不预减 HP，也不让 `withCombatAttack` 诊断上下文变成唯一身份存储。
- 主地图的扫掠、LOS、导航候选和遭遇身份可复用；必须验证近战墙阻挡、投射运输的落点规则、暗区目标信息、Z 切人及离手角色。不得以隐藏位置帮 AI 完美反应。
- 主 clock、generation、Reset/换场保留；取消身体与关闭世界分别处理。ID 从接受/出生时保存，不从当前 controlledActor 追溯。
- AR02 `recordCombatAction/recordAttackEvent` 当前 trace off 返回 undefined。下一阶段分配权威身份不依赖 tracing，诊断可以关闭；不重写黄金玩家身份合同，也不建全局 EventBus。
- Encounter 活跃判定需认识 V2 身体动作和仍在途实体；不因身体 finish 就结束战区，也不把永久死后危险当永久追击。

## 后续 Cleanup 门槛

完成 EN06 新敌我用户验收之后，另立 Cleanup：列静态引用、真实运行引用、Tower/历史影响与回滚证据，再决定删除文件或旧字段。EN00～EN03 不执行大范围 rename/delete，不移除旧测试制造全绿。新敌人的受控夹具先独立 opt-in，普通主页不能半迁移。

## 玩家冻结与最新方向

Hunter G01 黄金手感、阿尔 RMB 总体认可保留；具体未试项未知。xx 仍是可逆替身，不加第三身体。AR06-G01 v0.1 旧敌人对战日志是 G01-A 角色侧有限验证，最终敌我基础闭环留到 EN06。

最新三轮还确认自由探索而非节点地牢/塔防主玩法、高低差命中规则取消、双角色死亡/复活方向等。它们作为后续迁移约束记录，**本轮不实现整套自由探索/复活/武器成长/体力改革**，也不把这些新规则反写成当前代码已支持。关机要求已撤销，完成后保持电脑运行。
