# CR-SKILL-01 R0/R1 来源核验与原作规则对账草稿

2026-10-13（Asia/Shanghai）。本稿仅为本轮父任务可复用的研究记录，未写游戏、父研究、原作安装目录、存档、开发细则或人工原稿；未执行原作 DLL。原作证据仍为静态 CODE/DATA，OBS=0。用户批准执行 CR-SKILL-01 的事实和附件原先“待批准”标题分开，以下不把工程建议写成原作规则。

## R0：可继续限定静态研究，不能据此宣称全量可玩

本机 `D:/steam/steamapps/appmanifest_3214610.acf` 的 buildid 与 TargetBuildID 均为 **24935935**。本次重算 CRAR02 `evidence/protection-check.json` 所列 **42 个精确路径**的 SHA256，全部存在且匹配其 after_sha256；该数字包括指定源、四个被锁媒体 bundle、父研究主成果/索引与工具、AGENTS 和开发细则，不是整个安装目录或整个仓库。未遍历原游戏。

| 锁定源 | 本次 SHA256 | 与 CRAR02/intake/source-lock.json |
|---|---|---|
| Assembly-CSharp.dll | `51977661202d164037abaa502a701e64c9426e8b6351ea6200263033c3188d44` | 一致 |
| resources.assets | `5c44a84aadc79e06e588a2264f6afc72ffd94bdfcd464b7bd7ce86d5b39319aa` | 一致 |
| appmanifest_3214610.acf | `1e5e6c4f28f36a7be7244abb4ed7ae630406bf8103de830aabb43d13d5d2ee5b` | 一致 |

CRAR02 `evidence/final-validation.json` 历史结果：passed=true、54 新 CODE 方法＋74 复用、8 条专题案例、5017 nodes/5747 edges、OBS=0，scope 明确不含原作运行验证。本次还重算其 `evidence/evidence-index.json` 的 128 个 CODE 条目所指向的 **62 个不同已保存 IL JSON 文件**，全部与条目 sha256 相同；128 条的 token/type/name 和首尾 IL offset 也逐项与实际保存方法匹配，失败0。这里只报告当前文件完整性与指定方法复读，不声称重新解析原作全部方法或执行该历史校验程序。

相关原生身份：`24935935|resources.assets|71496|hero|小蓝`、`...|hero|小黄`；卡行稳定键使用 `...|magicCards|真实原ID`，SkillData 为 pathID71502、UnitData 为71504。原生 Unit.name=？？？；本轮不把绰号当已核本地化显示名。

只在根 AGENTS 的项目/记录边界内工作；搜索目标研究祖先未发现另一个适用嵌套 AGENTS。开发细则 v2.2 完整读取，游戏/研究源码与已提交基准的总审计由父任务负责。

## R1：八项四栏对账

| 原作已证事实（限定静态链） | 用户最新星骸决定 | 工程建议 | 未证内容 / 结论级别 |
|---|---|---|---|
| **1 清图/奖励。** 已证奖励物拾取→普通模式→二/三选一、按池过滤与加权候选→实际点击安装；主动与符文分别走二选一/三选一。研究入口从已存在奖励物开始。[A] | 放弃原作肉鸽随机获得；正常 UI 预选职业主动、被动及升级路径。 | 原作抽取器和星骸能力消费者分离；不要为了复用研究引入随机抽卡。 | **CODE+DATA 条件链已闭合至奖励物拾取/安装**；关卡完成怎样生成哪类奖励、所有关卡掉率、实际正常取得逐卡均 UNKNOWN，不能概括“每次清图必奖励技能”。 |
| **2 主动槽。** Hero 基础 bornLeft/bornRight/dash/reload 分别配置；主动列表是共用装备 Skip(2).Take(3)，实际索引2/3/4；Spell/Spell2/Spell3 分别路由这些索引。满槽普通奖励进强化；显式替换另分支。[B] | 同职业最多 Q/E/R 三个独立技能，各自 ID/CD/0～3 级。 | 不把全部 Skill 条目、基础右键或被动派生当 QER；输入字母与原生槽身份分开。 | **CODE+DATA 条件链闭合**；原设备按键当前 binding、全部技能菜单可达、六菱形具体用途未据此证实。 |
| **3 任意拿/无限叠加/不冲突。** 原正常可获取池按已持基础名、预留、color、mutex 对当前 groups 排除，前置不满足另置换；所选 R/M Buff stacksMax=1；内部通用符文列表999项不是 UI 无限。Buff 聚合/卡排重/层数是三层不同规则。[C] | 被动持有集合不设三/五硬槽，合法职业条目可先持有；具体效果仍按条件。 | 在独立星骸获取门放宽前置持有要求，保留 effect 条件；每个来源实例、叠层/优先级单列。 | **CODE+DATA 条件链闭合（反例成立）**：原作不是“任意、无限、不冲突”的普遍系统；不能将底层旁路获得 API 当正常菜单。全被动独立消费者待 R2。 |
| **4 主动三层二选一。** UI 实际绑定根ID＋1…6，正常可点判式 `(index-1)/2+1 == 当前家族等级`（整数除法）；选一增长家族计数，同阶段另一项失去资格；成长卡安装保留根主动。[D] | 每主动第1/2/3级各二选一，可出征前指定，V 逐技能升级。 | 严格查真实六行存在/ban/实际作用；缺行不合成虚假原ID；旁路请求也需独立资格门。 | **所选普通 UI 条件链闭合**；不是六分支同时拥有，不证明所有卡族都有完整六行或强制底层 API 全局互斥。 |
| **5 被动指定升级一次。** 已证凿冰→凿冰+、长枪突进→长枪突进+的正常强化：按真实 `id + '+'` 找定义，存在才是可强化；重新校验、原槽替换。[E] | 消耗一种指定实验道具；玩家指定已持被动；最多一次；已升级排除。 | 星骸 `upgraded:false→true` 与唯一扣费做单独权威；原作 `+` 强化与星骸道具操作分别标注。 | **原卡强化存在为 CODE+DATA 条件链**；“所有被动均一次、指定消耗物品、该物品取得与扣费节点”没有现成闭合证据，保持 UNKNOWN。不得冒称原作通用规则。 |
| **6 改动作/普攻/派生。** 蓝凿冰把原a3替为独立戳地及延时造冰柱，原四段表未增第五段；破阵猛冲1通过每波首次有效命中回霜寒；黄火箭弹射3在根攻击时加独立爆炸；精准装填一次改下一弹匣。不同事件粒度有不同消费者。[F] | 组合要能改变招式、连段、表现和真实结果，不能面板只加数字。 | 分离 AttackEmitted、HitConfirmed、FirstValidHitPerWave、ComboStep、ReloadCommitted；动作替换保留来源与撤销句柄。 | **所选链 CODE+DATA 条件闭合**；原作具体视觉/音效、同帧调度、全部改造排序/取消清理实机未知；不能用四个例子代表全两角色库。 |
| **7 角色专属与装备。** 原生 kind=通用符文仍可 color=小蓝；正常候选检查 color为空或等角色原ID。道具是另一 kind；大斧只有所选攻击触发/CD链，不证全部装备对四人都可用。[G] | 职业专属池独立；跨角色通用装备独立装备来源与行为 Proc。 | 权威绑定 professionId/ownerBodyId/equipmentInstanceId，不能因中文“通用”跨职业复制。 | **角色资格 CODE+DATA 条件链闭合**；空 color 只是获取条件一项，不能代替实际 owner/消费者安全与所有角色菜单验证。 |
| **8 无对应主动也持有。** 原取得门与触发门分离，但原正常取得可能有前置：霜爆侵袭 preconditions=[冰柱]，凿冰 group=[冰柱] 可满足；仅长枪突进且无其他来源不满足，候选被置换。另一类空前置可先取得但效果只在匹配事件生效。[H] | 合法职业被动可先持有，缺匹配主动时 dormant，后续装上自动匹配；未实现消费者须显示研究项。 | 保留 owned 与 enabled/eligibility 分离；dormant 仅用于已实现消费者当前条件不满足，UNKNOWN 不伪装 dormant。 | **具体前置反例与触发门为条件链闭合**；原作对所有被动均“无前置任意持有”不成立；全量个例交 R2，不暗中改变用户放宽目标。 |

## 精确证据导航（以 Cinderia 研究根为相对起点）

以下编号是本稿导航，不改父 evidence ID。原始方法 JSON 留本机研究目录，不复制源码进游戏。

### A：奖励取得但未闭合清图生成

- `24935935-CR03A/CR03A-evidence-index.json`：CR03A-A01 明确限制“研究从实际奖励物拾取入口开始；未证明每个关卡奖励生成概率，也未实际获得该卡”。
- `24935935-CR01/evidence/il-threecards-pick.json`：`0x06002BE4` OnPick.MoveNext，IL_0018–0035。
- `24935935-CR03/evidence/acquisition/il-normal-mode.json`：`0x06002BE6` 普通模式.MoveNext，IL_00C8–00CF。
- `24935935-CR01/evidence/il-threecards-flow.json`：`0x06002BEA` 魔卡流程.MoveNext，IL_0382–03BC。
- `24935935-CR03A/evidence/acquisition/il-active-reward.json`：`0x06002C05` 二选一魔卡.MyGetCard，IL_0000–000B。
- 符文路径另见 CR03-A03：三选一魔卡.GetCard `0x06002BCB`、谓词 `0x06002BDA/06002BDB`；不能按同名将二选一/三选一规则互推。

### B：三槽消费者

- `24935935-CR03A/evidence/acquisition/il-active-slot-window.json`：`0x06001DB2` 主动技能列表，IL_0000–0017。
- `.../il-active-slots-full.json`：`0x06001DB3` 主动技能已满，IL_0000–002A；`.../il-active-choice-ui.json` `0x060009E9` 满槽分支 IL_0013–0046。
- CR03A-A09：InputManager 的 OnSpell/2/3→`0x06001AC7` `_处理放魔卡输入`→`0x06001ADF` HandleSpell，当前槽取卡、空槽/按压边沿门。原三回调 token 和完整位置由该 evidence 项 location 保留。

### C/H：资格、前置与重复不是一个规则

- `24935935-CR03/evidence/acquisition/il-pool-filter.json`：`0x06001E21`，IL_0001–0016 已拾基础名排除；IL_0033–0065 color；IL_0067–0099 mutex。
- `.../il-pool-mutex.json`：`0x06001E22`，IL_0000–000F，mutex 不在已拾 groups。
- `.../il-pool-gates.json`：`0x06001DAB` 可获取池、`0x06001DAC` 判定前置；`.../il-prereq-nonempty-mode.json` `0x06001E24`；`.../il-prereq-replacement.json` `0x06001DE7`。
- CR03-A14 与 `24935935-CR01/evidence/il-buff.json`：`0x06003D6E` Buff.Add，层持续/上限；CR03-U08 补按 data.id 与来源/单开关键词的实例聚合，不能把卡排重替代此层。
- 原数据稳定键：`24935935|resources.assets|71496|magicCards|霜爆侵袭`、`...|凿冰`、`...|长枪突进`；T前置与R group 由 CR03-A15/A16、t-card/native候选行确认。

### D：每级二选一

- `24935935-CR03A/evidence/growth/il-growth-ui-bind.json`：`0x060009FA` IL_0049–00BB 实绑1…6；`0x060009FB` IL_002A–0055 根ID与index拼接再查真实卡。
- `.../il-growth-ui.json`：`0x060009FC` IL_005E–0084 已拾状态；IL_0089–00A8 阶段整数除法与touchable门。
- `.../il-growth-ui-commit.json`：`0x06000A2F` IL_0090–00A3 安装所选成长；IL_0175–0190计算同阶段另一项供表现熄灭。
- `.../il-growth-family.json`：`0x06001DDE` 家族等级；CR03A-G01/G02 的 FloatUtil.Max 实际 Math.Min 已由父研究核对，不按 helper 名字重写意义。

### E：符文＋强化存在，不等于已经证实指定道具规则

- `24935935-CR03/evidence/acquisition/il-upgrade-identities.json`：`0x06001D50` IL_003B–0068 kind含符文→找匹配强化；`0x06001D54` 只有找到强化定义才真。
- `.../il-upgrade-rune-predicate.json`：`0x06001D8B` IL_0000–0020 将当前ID拼 `+` 后相等匹配。
- `.../il-enhance-eligible-predicate.json`：`0x06000874` IL_0000–0010 有效卡与能强化。
- `.../il-enhance-click.json`：`0x06000895` 点击重新校验并同 Index 拾取；CR03-A05 主张限 R/M。不把并不存在的 `++` 自动补出来，不把所有kind归同一个“一次升级道具”。

### F/G：动作消费者、来源、清理与顺序

- 蓝破阵猛冲1：CRAR02 BLUE-A，`24935935-CR03A/evidence/growth/il-growth-firsthit.json` `0x060047A3/47A4/47A5` Start/匹配首次命中/MyDestroy；effect回格挡值消费者 `0x06003A75/03A77` 访问 Character.Inst 小蓝，不能跨角色照搬。
- 蓝凿冰：CRAR02 BLUE-B，`24935935-CR03/evidence/structure/il-swap-main.json` `0x06003FD0/3FD3/3FDE` 首层/末层/卸技能；`.../il-summon-affect.json` `0x060039D5` 召唤单位。替换竞争按 priority、同优先最后加入由父 CR03-U01 追溯；不是全被动次序无关。
- 黄火箭弹射3：CRAR02 YELLOW-A；`24935935-CR03B/evidence/trigger/il-axe-precheck.json` `0x060047EC/47ED/47EE` 攻击订阅/匹配施放/退订；`0x0600468E/4697` Trigger 子技能/上下文建立。关键词是根 `☆火箭弹射`，不因为派生也叫爆炸而重触发。
- 黄精准装填：CRAR02 YELLOW-B；`24935935-CRAR02/evidence/4.json` `0x060045BC/45BD/45BE` 一次弹匣Buff注册/回调/撤销；`evidence/7.json` `0x060027EF` IL_0000–00AD 各回调先调用再筛返回；`evidence/12.json` `0x060027FD` 排序候选。未选中不代表没有副作用，失败清理通用keyword消费者未闭合。
- 改连段类型：`evidence/6.json` `0x0600423F` 最后一层移除自建Skill和重置连招为已证机制，但它不是蓝凿冰新增第五段的证据。
- 职业资格见 C；通用大斧见父 CR03B 所选攻击事件/CD链。道具483只是候选目录，不是483种跨角色通用实测能力。

## 闸门与父任务应保留的缺口

R0 固定输入与已保存证据访问通过；R1 八项均有明确已证/未证划分，可继续 R2 的全量分类而无需重新问已经批准的星骸目标。**不是**对 R2、S1–S4 实施或可玩数的代验收。

原作清图奖励生成、全部正常菜单取用、被动指定物品一次强化、全回调同帧顺序、换弹失败完全清理、最终动态VFX/SFX及多角色安全仍有未知。真实原作 actual/视频时间码继续空白。新增资源/方法证据不自动闭合 OBS，也不能把研究条目未实现当 dormant。

本稿报告的 UI 阶段算法、pool过滤、符文+匹配对应已保存 IL 本次定向复读；其他范围通过已锁父证据导航复用。42/62 指纹检查是限定文件核验，不是全部游戏或全部历史成果冻结。
