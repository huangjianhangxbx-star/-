# 星骸回廊｜FARM-01 最小种田闭环执行计划 v0.1

> **性质：**供用户审阅/转交 Codex 的执行计划草案，尚未授权实施，尚未写入仓库。
>
> **代码基准：**GitHub `huangjianhangxbx-star/-`，`main@efea60ea4bb57beaf3a553601285daa7bede5a60`（2026-10-11）。Codex 实施前重新核对远端、本地未提交差异及适用 `AGENTS.md`。
>
> **现行规范：**`design/开发细则.md` v2.2，根 `AGENTS.md`；按相关任务与 §5 补读、§6 核实真实可用 Skill；本轮验证建议 B 级。`game/` 下未发现额外 `AGENTS.md`。

## 0. 设计依据、确定项与实验项

### 已有事实与必须保护的内容

- INV-01A/INV-01B 已在正式探索接入 `WorldSession.backpack`：Tab 整理、下方 1～0 数字栏绑定/选择、阿尔原自由槽绑定/解绑。三处同源数量，当前只存在 `sample-seed` ×5、`sample-tool` ×1；数字栏选择没有使用效果。
- 阿尔自由槽只保存物品 **ID 引用**，不是独立库存；阿尔 AI 尚不能自动使用。Y 回血瓶、RMB 左手炸弹、右手 QER 与当前实验 V 升级是不同系统，不能合并。
- 正式探索只有猎人 (`hunter`) 和阿尔 (`ranger`)；保留 CB-02 支付、LT-01 死亡复活、NR-01 持续世界、UI-01C 原 PPT 六区、阿尔用户头像及已有黄金动作。
- **武器升级设计继续暂缓**：SK-02 现有 V 弹窗、费用与固定被动原型保持，不能做长按 V 注入、三级变种、睡眠清等级，也不为本任务做复杂成长适配。
- 当前已登记设计和口语版设计没有足够详细的正式种田操作、作物种类、生长周期、土壤和产量规范。用户以《地心归途》为农业参考方向，但不能擅自将外部玩法细节当成项目已批准规则。

### 本轮建议的 SAMPLE（批准执行计划时仅批准为可逆原型）

| 对象 | 暂定实现 | 状态 |
| --- | --- | --- |
| 试验田 | 正式暗牢入口安全范围内 **2 块**合法、不阻挡通道的试验田 | AI 建议 / SAMPLE |
| 实验农具 | 选中后 LMB 点击空田**开垦**；作物成熟后点击**收获**；不损耗 | AI 建议 / SAMPLE |
| 实验种子 | 选中后 LMB 点击已开垦空田**播种**，真实消耗 1 颗 | AI 建议 / SAMPLE |
| 生长 | 播种 **6 模拟秒**后成熟，具备清晰阶段表现；暂停/离区不推进 | AI 建议 / SAMPLE |
| 收成 | 每次 +1 `sample-crop` 实验作物、+1 `sample-seed` 返还种子；原工具不消耗 | AI 建议 / SAMPLE |
| 交互 | WASD 靠近、1～0 选择工具/种子，LMB 指向田地操作；已有战斗键位不变 | AI 建议 / SAMPLE |

本轮**不做**自由创建大片农田、浇水/水泵/灌溉、天气与天数、料理、作物加成、市场交易、肥料、自动化机械、阿尔自动耕种、野外拾取、世界地图扩建或刷新存档。所有 SAMPLE 数值、规则及视觉待用户试玩后可调整。

## 1. 必须交付的可玩闭环

1. 打开正式普通探索，在入口附近看见两块**无阻挡、可站到边上、可辨认**的试验田；使用初始实验库存即可开始，不需要作弊注入。
2. Tab 背包中将 `sample-tool` 绑到数字 1，`sample-seed` 绑到数字 2；背包的拖放、阿尔槽、数字键选择/解绑仍正常。
3. 关背包，按 **1** 选农具，走近后 LMB 点击一块原始试验田，田地从「原始」变为「已开垦」；没有真实砍怪/普攻副作用。
4. 按 **2** 选种子点击这块田地，田地进入「生长中」，唯一背包种子数量 **5→4**，数字栏和阿尔自由槽引用相同数量。
5. 经过 6 **模拟秒**，世界标记从幼苗变为成熟；打开 Tab/暂停/离开当前区域期间不偷推进生长，显示预计还差多少模拟秒即可。
6. 按 **1** 农具点击成熟田地，一次性**收获**：仓库 `sample-crop` +1、种子 **4→5**；田回到「已开垦」，可以再次播种。
7. 第二块田独立：一块在长、一块可收；快速重复点击、双击、旧代次请求不会双扣种子或重复给予收成。
8. Z 换角色仍可由存活的当前实控角色亲手操作；阿尔离手 AI 不主动使用自由槽。Y、战斗 RMB、Q/E/R、C、F/G 不变。
9. 死亡/团灭与合法篝火不会清田；合法离区→继续当前世界田与背包状态延续；确认「新的测试世界」才重置为初始两块原始地、实验种子5、农具1、收成0，SK-01B 技能预选保持其现有规则。

**选址硬门：**必须根据现有暗牢地图 `tiles` 与入口实际安全区域寻找两处足够空间的合法地面，排除墙、悬空层、出生点、出口/篝火事件点和必要通道。找不到两处则报告位置阻塞与候选，不得强行改导入的 37 GLB/Unity Scene、删除障碍或把作物放在墙内凑数。

## 2. 架构与接口：不要第二套道具系统

### 2.1 已核对的真实代码

- `game/src/core/world-inventory.ts`：`FARM_ITEMS`、`WorldInventory.stacks`、`hotbar`、`selectedSlot`、`inventoryQuantity`、阿尔 `companionFreeItem`；农地消费者读同一库存权威。
- `game/src/core/world-session.ts`：`beginWorld` 只新建一次 World、`leaveWorldArea` / `continueWorld` 保留物品；新增田地建议附于 `WorldPlace` 或该地点的世界状态，不分散到角色、DOM 或展示缓存。
- `game/src/core/standalone-exploration.ts`：真实暗牢 `dark-dungeon-map.json` 的地图几何、入口、篝火、安全遭遇；不能以演示地图假位置替代正式入口。
- `game/src/core/exploration.ts`：`interactExploration` 只处理篝火/资源/目标；不能拿一次性 `memory.mechanisms` 承担可重复农田。
- `game/src/core/spatial.ts`：`surface`、`terrainFits`、`segmentClear`、`distance` 及合法角色位置；农田必须按实际地表层与障碍处理。
- `game/src/exploration-app.ts`：`pickTile` 和正式 LMB 既有普攻路径；须在世界点击接收处优先识别田地，避免对田地开垦同时发 LMB Basic。
- `game/src/view/scene.ts`：现有世界坐标、场景渲染、pick 与迷雾/遮挡；用最小独立几何展示农田，不写入原 GLB。
- `game/src/exploration-hud.ts`、`game/src/backpack-panel.ts`：固定十格、阿尔自由槽、Y/V 与原六区；农田不能再创建一套库存/快捷栏。

### 2.2 推荐数据结构

- `WorldPlace.farmPlots`（或等效唯一 WorldPlace 权威）：两个稳定 plot ID、固定位置/楼层、`state: raw | tilled | planted`、`plantedAt`、`matureAt`、`revision`、`harvestCount`。
- 「成熟」由 `state==='planted' && s.time>=matureAt` **纯推导**；禁止创建另一个会漂移的剩余时间账本。已有模拟时钟在暂停/离区冻结。
- `WorldInventory.stacks` 增加 `sample-crop` 注册 ID，只有**一个**数量来源；作物本轮只支持显示、绑定、不支持出售/回血/烹饪。
- 建议 API：`queryFarmAction(s, request)` **纯查询**、`commitFarmAction(s, request)` **原子提交**，`farmView(s)` 只读世界展示；Codex 可按现有架构改名但需解释不引入第二权威。
- request 至少带 `worldId`、`visit`、`plotId`、`expectedRevision`、所选的 `slot/itemId`。交互最终 Accept 前重新校验 owner、当前物理操作和道具库存；旧代次、过期 plot revision、重复 pointer 请求纯拒绝。

### 2.3 原子转换

| 当前状态 | 选择的道具 | 成功结果 | 花费/收入 |
| --- | --- | --- | --- |
| `raw` | `sample-tool` | `tilled` | 无 |
| `tilled` | `sample-seed` | `planted` 并记录成熟时刻 | 种子 -1 |
| `planted` 未成熟 | 任何 | 只提示剩余时长 | **无改动** |
| `planted` 已成熟 | `sample-tool` | `tilled` | 作物 +1，种子 +1 |
| 任何状态 | 错工具/空槽/没库存/不合法身份 | 明确失败 | **无改动** |

收获+作物与返还种子必须作为**一个完整的安全整数事务**先预检再提交；一项溢出/重复栈损坏则整体拒绝，不能「田地变空了但库存没加上」。种植亦必须原子扣 1 种子并更新 plot revision，不因为 trace 开关关闭造成重复或丢单。

### 2.4 农田行动资格

- 正式 `sessionMode='exploration'`、`kind='standalone'`、当前合法 `WorldSession/WorldPlace`、`phase='battle'` 且 `visit.active`；**排除** Legacy、XX、具名敌人开发入口、ActionLab。
- 唯一合法存活本体猎人/阿尔且是**当前实控**，未被控制/强制位移/跨层/重伤；`explorationIdle` 脱战；当前未有已接受的 Basic、右手技能、RMB、闪避、选路或模态动作。错误状态失败不取消既有动作。
- 选中已绑定且库存有效的工具/种子，当前 plot 与人物**同楼层、约 1.4 世界单位内、没有墙或阻挡**；真实可见、实际游戏地表合法，不能隔墙隔层点击。
- 玩家点击的是田地即便资格失败，也要**明确显示失败原因、截断世界 LMB 普攻**；否则玩家无法知道没种下的是距离问题还是抢输入。其余地面/敌人 LMB 原业务保持。
- Tab 背包打开、G轮盘、F路径瞄准、其它模态、暂停、文本输入、OS失焦不发出农业动作；物品拖出背包释放在战场不能直接算播种。

## 3. 视觉/交互样板：最少资产、可清晰读态

- 只在2块合法地表叠一个**黑底细边/土色底面**几何标记，已开垦用大色面，播种用简单几何芽，成熟用明显更大叶片或浅色块，鼠标悬停时突出当前合法操作。参考现有 UI/Three.js 几何，不新增或替换 Spine 原动画、原有地图 GLB。
- 标记显示真实 `plotId` 和状态（如「农具开垦」「种子播种」「成熟：农具收获」）；成长计时仅称 **SAMPLE 模拟秒**，不把它解释成未来永久天气/天数机制。
- 遵循地表层高度与 fog/遮挡，不关整个地牢深度检测以免隔墙透视。农田 marker 不成为敌人索敌/角色占位、不会挡走路。
- 1920×1080 和 1280×720 检查 PPT 六区、猎人/阿尔原位置、Y、V、QER、Tab、1～0、阿尔自由栏 **均未变动布局与尺寸**。
- 本轮无需 `image_gen` 生产正式资产；若未来用户指定参考图，再另列素材制作任务。

## 4. 给 Codex 的执行清单（按本次明确授权才实施）

### G0｜基准/位置只读核对
1. 核实 GitHub 最新 `main`、本地 dirty 与适用根 AGENTS、`design/开发细则.md` v2.2。按 §5 只补读 INV-01A/01B、NR-01、LT-01、ITEM-Y01、UI-01C 相关合同及实际调用代码，不全扫原稿/源码。
2. 当前 Chat 没核验到可用的 Codex `writing-plans` / `test-driven-development` / `frontend-design` Skill。Codex 在**其实际运行端**若选用，应先核对真实安装路径并读取对应 `SKILL.md`；未可用时照正常研发流程执行，不冒称已使用。
3. 在 `standaloneDefinition` 实际安全地面和入口附近定位2个 marker；先记录合法性证据，无法确定则停 **选址**，不改原图或放宽碰撞。

### G1｜先 RED 后 GREEN：农田权威
1. 新增 `game/tests/farm01.test.ts`：两个独立 plot 初态、开垦→扣种播种→模拟成熟→收获、再次播种、数字栏与阿尔槽同源、纯查询与安全整数。
2. 首次运行确保未实现行为真正 RED；再增非法阶段/旧 world/visit/revision、无货/重复stack、错 owner、越界/隔层、连续双击、死亡/离区继续、新世界的定向边界。
3. 最小实现 `game/src/core/farming.ts`（或架构等价窄模块），WorldPlace/WorldInventory/Command 路由接入；农地和收成只引用唯一权威。**不要绕到退役的 `item` / `equipQuick` 旧逻辑**。
4. GREEN 后跑受影响库存与 World/生命周期小集，保留 RED 证据。

### G2｜真实键鼠/场景使用
1. 新增农田 plot hover/pick/世界内交互路径，测试 LMB 优先权：田地点击不得同时给 Basic/技能/游戏瞄准发操作。
2. 使用现有 `selectedSlot` 读取当前 `sample-tool` / `sample-seed`，按阶段显示操作、远距与障碍的真实拒绝提示；与 HUD 的数字选择/Tab/阿尔引用同步。
3. 在 Three.js 中创建可读、低成本的地面标记；保持原 3D 场景/地图/人物资产不变。
4. 人工检查两档视口、点击感和出生点通行。田地不是不透明巨型 UI，不挡玩家走路。

### G3｜B级最小验证（不默认全历史回归）
1. 定向核心：`farm01`＋`world-inventory`/INV-01B、`world-session`/NR-01、LT-01 和必要 Y 物品隔离；`npx tsc --noEmit`、`npm run build`，实际共享类型修改时 `npm run build:action-lab` 烟测。
2. Edge / Playwright **3～4条真实鼠标/键盘故事**：
   - **S1（1920）** Tab绑工具至1/种子至2→WASD靠近→农具开垦→播种扣1→真实模拟时间到成熟→农具收获进背包，再播种。不得注入 game state 或调用内部 command 冒充玩家。
   - **S2（1280）** 未成熟、太远、隔墙/错误层、错误工具、空槽、模态等失败；不伤害敌人、不发 LMB Basic，不扣Y/体力/装备耐久、无 UI 漂移。
   - **S3** 两田独立+重复物理操作去重；阿尔自由槽绑定同种子时与数字栏库存一致；Z切人后保持，正常 LMB 对敌仍能普攻。
   - **S4** 合法区域离开/继续与新世界重建；耗时太长的危险死亡可用**核心夹具**覆盖，不虚报浏览器自然完成。
3. B级预算先按约10–25分钟；软件 WebGL 较慢可以据实际必要测试延长。留真实失败日志，区别产品 bug 和测试等待脚本错误，按影响范围定向补测，不为了全绿改业务断言。
4. 用户 Gate：农田够不够直观？数字栏到田地的操作顺不顺？6秒是否合适？是否需要在地图上自由耕种？这些都等待用户决策，不把 SAMPLE 自动定稿。

### G4｜交接、保护和发布
- 只在用户确认执行后写源码/测试和必要 `docs/tasks/FARM-01/` 契约、验证、交接；经授权维护的 `design/游戏设计索引.md`、`docs/CurrentRules.md`、`docs/规则对账.md`、`记录/项目状态.md` 与当日日志，要明确 USER_CONFIRM / SAMPLE / IMPLEMENTED。
- **禁止改** `design/开发细则.md` 和 `design/用户维护/` 的所有 Excel；不全量转换人工原稿、不动原 Unity Scene/GLB、原 Spines、PPT 文件、阿尔头像或别的工具工坊。
- 若本轮已经获得实施与有效发布授权，完成验证/审查安全远端后仅选择性提交推送 GitHub `main`，不强推、不混入其他并行 dirty、不碰 Gitee；否则停在本地回报。
- 结束停用户试玩 Gate，**不自动启动 FARM-02、AL-ITEM-01、天气/昼夜、烹饪、工业流水线或升级重构**。

## 5. 后续建议路线（仅排队）

| 优先 | 候选任务 | 本轮权限 |
| --- | --- | --- |
| 1 | **FARM-01 最小田地闭环** | 下一轮建议，经用户批准后执行 |
| 2 | AL-ITEM-01 阿尔自由道具真实消费者和 AI 时机 | 待专属道具确认，不实施 |
| 3 | FARM-02 可自由布田、浇灌、更多作物与场景表现 | 待农业规则明晰，不实施 |
| 4 | WORLD-TIME 日夜/天气/世界事件 | 待后续设计，不实施 |
| 暂停 | SK-02-F01 / SK-03 / SK-04 / SV-01 的升级关联 | **继续冻结** |

**最终备注：**试验田、阶段、时间、产物都只是本计划新提出的可逆 SAMPLE。当前仅生成聊天附件执行计划，没有修改 GitHub，也没有启动 Codex。
