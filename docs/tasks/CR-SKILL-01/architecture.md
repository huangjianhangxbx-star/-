# CR-SKILL-01：S1 前代码迁移审计草稿

2026-10-13。只读生产代码审计，基准 HEAD `a35a2036015745b5b0f97eb8262febe920be0ef1`；本审计目标生产文件 `git diff --numstat` 为空。R0 来源核验由主执行者负责；R2 正在生成，因此本文所有新接口均为 **PROPOSAL**，不是 IMPLEMENTED，也不是原作 CODE 结论。仅创建此工作稿，不提交。

已读根 AGENTS、开发细则 v2.2 全文、README、相关 CurrentRules/OpenRules/规则对账/设计索引、完整本次总计划相关阶段。已读取并使用 `codebase-design` Skill，按 Interface/Seam/Adapter 的含义形成下面的最小接入方案。无游戏源代码写入。

## 1. 已核代码现状

| 实际代码 | 当前行为 | 对新计划的影响 |
|---|---|---|
| right-preparation.ts:5–33 | PreparedOwner 仅 hunter/ranger；MainDefinitionId 仅两种黄金；Q/R 可编辑、E 固定；准备被动固定三项 | 不能把 enum 放宽就声称职业系统完整。需要显式隔离职业定义及其构筑，不混入既有默认预设。 |
| right-skill-state.ts:4–8 | 六个固定 Ability ID；MainInstance 保存 slots 和按 Ability ID 的 CD；无级别/分支 | 每个装备技能有唯一升级权威；换槽不能重建 CD、等级或充能。槽仅是引用。 |
| right-hand-skills.ts:28–75 | 硬绑 Unit.id 与黄金 basicProfile；E 直接走 hunterInput/alInput，Q/R 固定扇形 SAMPLE | 新职业应走显式定义/消费者注册；原生 E 本体也有 slot=1 和固定 executedAbilityId，不能直接搬到 Q/R。 |
| weapon-activation.ts:15–44 | 只有两位黄金实例同时满足资格才启用；world.activation.activeLevel 两人共享，4/8/12 支付；只倍率加成 Q/R 样板 | 新职业不复用该共同等级。现行旧试验继续留在默认黄金路径。 |
| passive-definition.ts:4–11 | 三元素 tuple，且顺序/ID 必须等于 DEFAULT_PASSIVES | 新集合独立按 sourceInstanceId 管理；不能把固定 tuple 数量扩成 200 就称支持组合。 |
| equipment.ts:7–16 | 实际 right MainInstance 与 weapon 单一对象；owned 只保存副手；mainDefinitionFor 按 body.id | 保留主武器权威，增加明确实验 main definition 和可恢复切换，不制造 HUD 影子配置。 |
| basic-definition.ts:25 | resolver 只读 basicProfileId 和 I/II；返回黄金不可变定义 | 这是普攻变更最小 Seam：仅实验 main 走派生不可变定义。普通 main 原样返回现有定义。 |
| basic-chain.ts:35–43 | 使用真实 definition 选段，然后 startBasicAction；Hunter/Al 又以 nextStage 读序号 | 改连段长度后要在后续 Accept 前正规化 nextStage；不能把进行中的 action.stageSpec 替换。 |
| basic-runtime.ts:15–27 | Accept 冻结 stage、timing、weapon、context；nativeFamily 按 profile 硬判 | 可复用快照，但需要显式实验 family/consumer，不能拿 body.id 代替武器职业。 |
| hunter-combat.ts:50、89–91 | release 的 a4 presentation 强制映射 stage3，kind=basic，真实 hazard 命中后调用共享 resolveHit | 凿冰需要改第三段动作/召冰消费者，不能把 presentation 换名后仍默默走黄金 a4 特殊规则。 |
| al-combat.ts:27、42–50 | 右键 shot 在左副手域；rocket 写死 slot1；ammo 是数值4，reload 完成直接 ammo=4 | 新黄职业弹夹列表不能直接覆盖 Al 黄金左副手 shot/ammo。两域必须分开。 |
| engine.ts:111–120、690–697 | 共享 resolveHit 是 HP/架势权威；运行时在各 native advance 命中回调执行 | 新模块应把真实命中结果反馈到效果运行时，不另建伤害结算。 |
| combat-identity.ts:19–52 | recorder/currentCombatAttack 受 trace.enabled 开关；trace512条可丢弃 | trace 是观察而非触发权威。新增组合决不能读取 trace 或依赖 trace 开启。 |
| world-session.ts:32–93 | begin 建真实装备；leave 清接受动作/实体并增 generation；continue 保身体及装备对象 | 订阅从持有集合派生；visit 调度清、持有/升级留，continue 不再次 grant。 |
| activation-panel/right-skill-panel/exploration-app | V 双人共同模态；技能面板直接改配而非命令；明确列举多处暂停/输入互斥 | 新 UI 必须绑定新的 query/command，不在 render 副作用升级；新增模态必须加入所有真实冻结点。 |

## 2. 保留／替换／迁移／隔离矩阵

| 对象 | 本批策略 | 保护断言 |
|---|---|---|
| Hunter/Al 黄金 profile、常量、默认四段/三段、E、RMB、机动、音效 | 保留 | 默认 MainDefinition 无实验运行态；既有快照一致；不改引用原素材。 |
| MainInstance、左右手、HP、stamina、resolveHit、世界库存 | 保留并接小接口 | 仍由现有权威消费；不双扣体力、不让右手效果写左弹夹。 |
| 现有六个 right ability / Q/R SAMPLE | 隔离保留 | 默认路径继续原实现。实验目录独立身份，不复用同名 id 偷改参数。 |
| world.activation 与旧 V 4/8/12 | 隔离 | 实验 V 不访问该 level；旧 V 不访问新槽级别。 |
| PreparedPassives / 三格 HUD | 保留旧、实验新集合 | 新职业持有条数来自集合；HUD 数量不控制资格。 |
| 普攻定义 resolver | 最小迁移 Seam | 按 right.definitionId 分流；黄金返回原对象，实验返回组合编译快照。 |
| Action/Attack 身份 | 复用类型、修正实验 authority adapter | 运行 ID 在 trace disabled 仍有效；不从 trace 反向驱动。 |
| Y、阿尔道具AI、死亡恢复、QST/FARM/SUR/EVT | 保留 | 实验物品独立 ID；同世界不克隆团队库存；未引用不改源。 |

## 3. 建议的最小 Module 与 Interface

不要全库建总线/标签DSL。一个 `profession-runtime` Module 隐藏组合匹配、冲突顺序、来源账本与幂等；两种真实 Adapter：黄金 passthrough 和隔离实验组合。数据定义按职责分文件，不公开每个实现步骤。

```ts
type ProfessionDefinitionId = 'cr-blue-experimental' | 'cr-yellow-experimental';
type Evidence = { build: string; nativeKey: string; status: 'code-data'|'data-only'|'sample'|'unknown'; refs: string[] };
type PreparedProfession = { mainDefinitionId: string; slots: Record<Key, SkillId|null>; routes: Record<SkillId, [Choice|null,Choice|null,Choice|null]>; passiveIds: string[] };
type ProfessionRuntime = { ownerBodyId:string; mainInstanceId:string; definitionId:string; revision:number;
  slots:Record<Key,string|null>; skills:Record<string,{instanceId:string; skillId:string; level:0|1|2|3; committedBranches:Choice[]; cd:number}>;
  ownedPassives:Record<string,{definitionId:string; sourceInstanceId:string; upgraded:boolean; installedOrdinal:number}>;
  effects:Record<string,EffectState>; action?:AcceptedAction; revisionToken:number };
type PassiveView = { state:'active'|'dormant'|'unimplemented'|'excluded'; reason:string };
```

外部 Interface 建议只暴露 `query/commit(command)`、`resolveActionSnapshot(request)`、`onCombatFact(fact)`、`advance(dt)`、`clear(scope)` 及纯 view。命令包含 world/visit/body/mainInstance/controlRevision/configRevision/expectedLevel 或 passive revision；UI 不持有资源余额/等级副本。

- 技能级别/CD 保存在该 MainInstance 的技能实例，QER 槽引用其 instanceId；交换槽不重置，清空后再装也不清零。一个 skill 实例禁止同时装两槽以避免一技能双升级。要允许副本实例属于后续明确设计，不隐式创建。
- 装配与 Accept 分开。准备方案可预选三层，runtime 只有已成功提交的层生效；当前动作保存 `skillId + levels + branches + compiled effects + sourceIds + resource quote` 深不可变快照。
- 新蓝/黄职业是独立 right definition，显示原生角色证据身份；当前 body 仍 Hunter/Al，通过明确的实验选择进入。默认进入游戏没有实验被动。资料名不要变成正式个人显示名。
- 已认可 Hunter 当前四段已经包含过去凿冰/第四段式改造，不能用它冒充“原作基础第三段→凿冰”的 before。隔离蓝职业要建立明确的来源基础连段，只在实验 main resolver 使用。
- 戳地必须以实际动作替换第三段、实际 timing/hit geometry/子实体运行证明；不能只第3段多加伤或在4段后加第5段。未知冰柱碰撞/寿命若复用 AL02 授权 SAMPLE，必须标继承范围；不可写成源数据。
- 新黄职业改弹夹属于实验 main 专属资源，黄金 Al 的左手副射击器仍使用原副手 shot 资源。若要新 main 驱动 RMB，必须显式输入路由并保留/锁定左副手的安排，不能让同一次右键两域双出手。

## 4. 事实触发与去重：不合并六种账本

1. 普通伤害实体 hit-set：每个实体/波次对同一 target 的普通去重，仍落 `resolveHit`。
2. 每波首次有效命中：只在真实 resolver 返回合格命中后，按 `generation + mainInstanceId + actionId + waveId + effectInstanceId` 打标。先按 R2 的 HitValid 条件精确指定 predicate；不默认 `hpLost>0`，也不默认 blocked 的 accepted=true 必有效。挥空、闪避、重复目标不触发。
3. 攻击时：在 AttackEmitted，跟 HitConfirmed 分开；原根ID与派生实际ID不同。火箭起跳被动只匹配根，不能被派生爆炸反复触发。
4. 成长交易：`expectedLevel/revision` 防止 V 重复提交；只单个 skill 增级；不改另一 QER/另一身体。
5. 库存支付：团队背包独立原子一次消费 `sample-passive-insight`；失败不得改 source/runtime。`upgraded` 单向一次，候选列表剔除升级项但保留持有项。
6. 卸除/取消：来源订阅与待发调度按 sourceInstanceId 清理；旧已生成实体按各明文 policy 结束，不靠 source 查找失效后偷偷改变旧快照。死亡/卸区清 visit 实体；持有等级同世界保留。

不能用 trace 读回事实。最窄修正是实验 advance 回调取得共享 resolver 的 boolean/result，再同步调用实验 `onCombatFact`；保留原 resolveHit。不需先把全项目所有黄金/敌人事件改造成总线。需要 hp/posture前后值时在该真实回调就地采样，trace关闭验证结果须相同。实验 ActionContext 用 runtime allocator，与 recorder 状态分开；allocator 默认 kind=enemy/requestSource=enemy-ai，调用必须明确改成实际玩家/同伴身份。

## 5. 确定性组合与移除

编译 active effects = 当前持有来源中 consumer 已实现且条件匹配者，排序 `(phase,priority,sourceInstanceId)`；阶段固定 base→replace→append→hitbox/projectile modifiers。同目标替换只选唯一赢家并输出冲突诊断；其余仍合法持有，但不能冒称未匹配 dormant，应显示“当前被优先级覆盖”。

组合查询纯函数，不能消耗 buff/道具/CD。胜出方案实际提交后才消费一次性源。每个效果只记录自身增项，不修改全局 BasicDefinition。removeSource 重编译当前组合，不执行“恢复最早快照”覆盖其他持有被动。不能为了遍历 210 被动建立所有 O(n²) 组合，按事件类型/skillId索引，逐事件只评价订阅者。

## 6. S1 最小可测交付与 S2 入口

- S1-A：实验蓝基础第三段与凿冰替换实际命中/时点/子实体；无被动→有→去除恢复；两个同目标来源确定性赢家；在旧动作 Accept 之后升级/移除不追改旧动作；Z 和换 main 清 pending/held。
- S1-B：一条已证特定根技能被动可获取但未装根时 dormant；装上根生效，卸掉根再 dormant，不清持有升级；无法实现消费者的另列 unimplemented。能量回复作用该实验 owner 的霜寒，不写全局控制者或 MP/CD。
- 上述测试还要 trace off、同波多目标/多弹、挥空、无敌、death/unload、同世界继续和新世界重建。
- S2 在现有准备/装备区域显式选实验 main；正常 QER 三槽全部可配，但只允许 catalog `playable` 条目。V 针对当前 main的已装 skill，展示其独立0/3，使用已有该层真实双分支数据。开发支付门名称/成本单独 SAMPLE；没有资源时不自动赠送旧4/8/12。
- 模态字段至少记 world/visit/body/mainInstance/configRevision；Z/Tab/F/G/QER/LMB/RMB/blur/ESC取消与冻结统一接入；成功后读 runtime。升级旧请求无条件拒绝。

## 7. 不能跨越的闸门

1. **当前 R2 未结账**：不能把父 coverage 的小蓝210通用符文、小黄所有候选当已闭合消费者。R2 全量目录/ban/缺失六分支先完成；任一只有DATA的条目必须保留 imported_unresolved。
2. **S2 全三级不是自动可达**：父案例只确认破阵猛冲1等局部分支；有原字段不等于所有6消费者闭合。不能编相同加伤占满3×2。代表链可先实现，但其余层缺消费者时S2整体Gate不通过，需记录批次/停受影响层。
3. **原被动升级 UNKNOWN**：用户允许“每被动一次升级”是星骸设计，不是原作事实。无对应原作配置只能独立 SAMPLE 接口验证，不得给真实名称捏造升级描述。
4. **黄金身份/输入冲突**：若只能改默认 Hunter/Al常量、左副手语义才能表现来源，应暂停该效果，不能以整包迁移口号破保护。实验 main明确开启与路由能隔离则不需重复询问局部实现。
5. **全量运行效果范围**：37个未ban根及数百符文可能大量新派生/资产，不应当前一轮全部原创制作；按范型批次列 playable_verified/imported_unresolved/excluded_with_reason。只有已经批准且具证据的代表链/通用范型可继续。
6. **OBS=0**：本项目玩得通不证明原作动态菜单、材质/动画/音效一比一。原局部来源仍CODE/DATA；新实验动作参数单独SAMPLE，未知留空。

本草稿仅提供可实施方向，没有跑任何新代码/测试，不能用作 S1/S2 通过证据。
