# 星骸回廊｜INV-01B 阿尔自由道具栏拖放接入｜下一轮 Codex 执行计划 v0.1

> **文档性质：AI 建议的下一轮执行草案；需要用户确认执行后 Codex 才实施。**
> 
> 依据：2026-10-11 用户反馈“新版已上传，貌似无法把道具拖给阿尔的自由道具栏，适于期内的吗，下一步计划是什么”。
> 
> 核对基准：GitHub `huangjianhangxbx-star/-`，`main@c8cc48261a928d6b2ae7c03ab19bfde3a889eb19`。若开工时已有新提交，先核对差异，不覆盖并行任务。
> 
> 适用：根 `AGENTS.md`、`design/开发细则.md` v2.2、`docs/tasks/INV-01A/{contract,validation,handoff}.md`、`docs/tasks/ITEM-Y01/contract.md`、`docs/tasks/UI-01C/handoff.md`、`docs/tasks/SK-02/contract.md`（保护而非重做）、`docs/规则对账.md` 相关最新段落。

## 0. 结论：INV-01A 没有遗漏已批准的交付项

INV-01A 仅实现 `Tab` 背包和原位 **1～0 农用数字栏**，合同明示“同伴自由槽仍预留；无 AL-ITEM01”。因此玩家当前不能将背包物品拖到阿尔左下角的“自由道具”容器，是**预期范围之外**，不是玩家操作有误；不是游戏已经有接收器但坏了。

实际接线：

- `game/src/backpack-panel.ts` 的 `pointerup/move` 只匹配 `[data-hotbar-index]`，并签发 `assignHotbar`，没有阿尔自由槽分支。
- `game/src/exploration-hud.ts` 的 `#companion-cluster [data-reserve-kind="free-item"]` 仍由 `reservedSlot(...)` 输出，仅显示“自由道具”；`#quick-reserved` 才有可操作十格。
- `game/src/core/world-inventory.ts` 的 `WorldInventory` 只有 `stacks / hotbar / selectedSlot`，没有 `ranger` 自由道具引用。
- `game/src/core/world-session.ts` 已经为正式探索维护 `world.backpack`；现有 Y 回血瓶在 `world.healingBottle`，两者不能混同。

由此建议将原排期 `INV-01A → FARM-01 → AL-ITEM-01` **暂时调整为 `INV-01B → FARM-01 → AL-ITEM-01`**。只补齐玩家眼前发现的接口，不改变农业/战斗设计。

## 1. 本轮目标与权威边界

**一句话目标：**在普通双人探索的现有 Tab 背包中，物理拖动已拥有的实验物品到阿尔原有“自由道具”槽，松手后确实绑定、可见、能解除，并与当前世界库存状态一致。

### USER 事实、AI 推荐与明确延期

| 项目 | 性质 | 本轮处理 |
|---|---|---|
| 需要将背包道具拖给阿尔自由道具栏 | 本次用户提出的缺口；具体后续道具行为未明确 | 作为下一轮建议范围，等待用户授权实施 |
| 保持原 PPT 左下阿尔头像、自由槽位置及黑底细边风格 | 已批准项目约束 | 硬约束，不重新布局 |
| 当前世界公共库存；数字栏引用物品，不搬运/复制数量 | INV-01A 已实现事实 | 复用一份 `WorldSession.backpack` |
| 自由槽也存 `itemId` 引用而非消耗/转移物品 | AI 推荐的最小原型方案 | **SAMPLE**，可修改 |
| 暂时允许实验种子、实验农具绑入阿尔槽作拖放测试 | AI 推荐，仅测试 UI / 绑定 | **SAMPLE**：不代表未来这些东西是阿尔正式自由道具 |
| 阿尔 AI 自动使用、道具快捷键/施放、伤害或物品效果 | 尚未确认 | 本轮明确不实现；交 AL-ITEM-01 |
| V 武器升级、技能/被动成长、睡觉清等级 | 用户明确暂缓 | 完全避开，不顺便适配 |

### 数据所有权

- `WorldSession.backpack` 继续是**唯一**物品库存。建议增加 `companionFreeItem: {ownerId:'ranger'; itemId:string|null}`，或等价单一结构；不得创建第二份数量账本、`Unit.inventory` 或全局 DOM 存档。
- 绑定表示**装备引用**，不表示扣减库存。同一试验物品可同时存在于数字快捷栏和阿尔自由槽；数量仍按 `inventoryQuantity` 读取。
- 只有固定 `ranger/阿尔` 是此槽合法拥有者，猎人主角的 Y 瓶不属于此结构；阿尔的左手副装备（枪/炸弹）也不属于此结构。
- 若以后没有该物品库存，显示“不可用/缺货”，不能仍伪称可使用。清除引用可以是之后消费者的职责，本轮查询不应有隐藏写入。
- 与 `rightPreparation`、SK-02 当前 `activation`、`MainInstance` 及 CB-02 接受支付序号无关系；不建立新间接依赖。

## 2. 实施顺序（给 Codex）

### G0｜开工核对

1. 核对 `main` 新提交与本机未提交差异；读取本轮完整计划、适用根 `AGENTS.md`、开发细则及上述任务交接。`game/` 下不存在另一个适用 AGENTS 时使用根配置；若新添则核对。
2. 检查实际安装的 `writing-plans`、`frontend-design`、`test-driven-development` 等 Codex Skill 是否可发现，**选中后读取真实 `SKILL.md`**；不可用时按工程现有方法完成，不宣称调用成功、也不批量安装新 Skill。
3. 用户原稿、开发细则、头像及原有几何图片只读；未明确授权不修改。源代码只修改本轮实际受影响文件。

### G1｜核心 RED → GREEN

预计受影响 `game/src/core/world-inventory.ts`、`game/src/core/types.ts`、`game/src/core/engine.ts`，必要时 `game/src/core/world-session.ts`（仅建新世界初始字段）；创建 `game/tests/inv01b.test.ts`。

新增只读查询 + 真实原子命令（名称可按已有风格确定）：

- `queryAssignCompanionFreeItem(s, {worldId, visit, ownerId:'ranger', itemId})`
- `assignCompanionFreeItem(...)`
- `queryClearCompanionFreeItem(...)` / `clearCompanionFreeItem(...)`

守卫要求：正式世界 active + 合法访问代次、两人唯一身份、库存有效正数量、只允许合法 owner 与已有 item ID；拒绝不改变世界/钱包/冷热数据/战斗动作。`query` 纯读取，无自动修复或付款；若同物品重复绑定，幂等且不生成其它副本。

状态生命周期：正常 Z 切换、死亡/全灭复活、篝火、区域离开/继续保留绑定；显式确认新测试后重新创建空自由槽。页面刷新仍无存档；旧 `inventory/quickSlots` 及遗留 `item` 命令继续隔离。

**核心最小测试：**正确绑定与覆盖、同一物品重复引用十格、错 owner/错 ID/缺货/旧 world/visit 纯拒绝、解绑不扣库存、一次性新世界清空、同世界生命周期保持、Y/左副/SK-02 零影响。

### G2｜背包真实拖拽 + 阿尔槽显示

预计受影响 `game/src/backpack-panel.ts`、`game/src/exploration-hud.ts`、`game/src/geometry-hud.css`；如有需要最小调整 `game/src/exploration-app.ts` 的事件门。

1. 把现有 `#companion-cluster [data-reserve-kind="free-item"]` 改成**可接收拖放的实际控件**（可用 button，但原来位置/尺寸/外框不能变）；添加稳定的 `data-companion-free-item` 或等价标识、可读标签、绑定名称与当前世界数量。
2. 扩展 `BackpackPanel.move()` 和 `pointerup`：新增匹配阿尔自由槽的分支，走**核心纯查询和同代次提交**；鼠标拖拽经过目标时高亮合法/非法，松开才绑定。不得绕开已有 `Drag.pointerId/token` 与输入所有权验证。
3. 维持拖拽浮标/来源 DOM 身份，不因 HUD 刷新导致 `lostpointercapture`、`pointerup` 丢失；背包关闭后静态显示已绑定项。`#duo-status` 根是 `pointer-events:none`，要保证自由槽作为唯一真实交互子节点可命中，透明区域仍穿透到世界。
4. **键盘可访问性**：在背包已选中物品时，提供一个清晰的“绑定到阿尔自由栏”按钮（或等价已存在面板动作），键盘方向键/Enter可用；不能要求只能靠鼠标拖动。右键自由槽可以解除绑定，但不能把右键误发给战场 RMB；若背包未打开亦允许右键清除，遵守正常战斗/模态资格。
5. 反馈要真实：物品名称、拥有数、已绑定/未绑定、当前还没有自由道具使用功能。库存失效时显示不可用，绝不声称已经装备了可用战斗技能。
6. 保护 `#hero-cluster` Y 单瓶、阿尔用户头像、两个武器槽、三被动槽、QER 区、数字十格与既有 1920/1280 布局；不要为补接口新建浮动 HUD。

### G3｜B 级定向验收与交接

按开发细则 v2.2 **B｜模块验证**，避免全量老塔防/历史浏览器/无关工坊重复测试。

- 核心：新增 `inv01b.test.ts` + 受影响 `world-inventory.test.ts`、`healing-bottle.test.ts`/`world-session.test.ts` 中实际相关项目。
- TypeScript、主构建，以及共享类型受影响时的 Action Lab 构建烟测。
- 3～4 条**真实鼠标/键盘浏览器**：1920 从背包拖种子/农具到阿尔槽并完成绑定、覆盖/解绑；1280 目标捕获/高亮/视觉位置/键盘替代；拖动途中 Esc、点击外部、resize、失焦事件取消、不产生战场攻击；Z/同世界继续/新测试的身份和生命周期各取最短可验证路径。无法自然跑完整路由时，核心测试证明的行为与浏览器实测分开记。
- 旧数字十格 `1` 和 `0` 仍可拖放、选中、右键解除；Y、RMB、E、Q/R 不误触发、不产生库存消耗或资源支付。
- 真实失败记录与后续定向复测分开；用户拖拽手感/美术 Gate 与技术通过分开。

任务完成后维护 `docs/tasks/INV-01B/{contract,validation,handoff}.md` 及相关索引/对账/项目状态的**本任务增量**；选择性提交推送 GitHub `main` 仅在已批准实施且满足仓库授权条件时执行。**不得 Gitee、强推、混入工坊/T016并行文件**。结束停在用户试玩，不自动开始 FARM-01。

## 3. 明确排除

- **不开发道具的实际使用动作、阿尔 AI 自主施放、物品生产或攻击效果。** 左下“自由道具”先成为一个可编辑的物品引用，不等于完成自由道具玩法。
- 不发明正式自由道具库、道具经济、物品耐久、农具工具动画或阿尔技能改绑。
- 不混入 Y 回血瓶，不改阿尔 RMB 射击/炸弹，不创建第二个物品背包。
- 不实施 `FARM-01` 农地/播种/生长/收获或天气/13日历。
- 不实现 V 注入/武器升级重构、SK-03/04 变体、SV-01 睡眠关联适配。
- 不修改 `design/开发细则.md`、`design/用户维护/` 任何文件、用户原始素材/PPT。

## 4. 下一阶段路线（只规划，不包含本轮授权）

| 顺序 | 阶段 | 核心目标 | 与当前自由槽的关系 |
|---|---|---|---|
| **1** | **INV-01B** | 阿尔槽实际绑定、显示、解绑；沿用背包库存 | 眼前缺口，范围最小 |
| 2 | FARM-01 | 仅一小块合法土地，实验种子真实播种→成长→收获→库存变化，使用 1～0 | 不要求道具由阿尔自动使用 |
| 3 | AL-ITEM-01 | 明确阿尔的自由道具类别、使用对象、触发条件，并接入至少一个真实可玩道具 | 需要用户未来确认实际用途；不得从“能拖入”推断“能自动使用” |
| 延期 | SK-02-F01 / SK-03 / SK-04 / SV-01 相关适配 | 武器等级和技能变种及睡眠清级 | 用户表示想通并重新开启才处理 |

**执行提示语：**请只执行附件 INV-01B。先核对当前 main 和保护约束，使阿尔左下自由道具槽能够接收背包真实拖放、显示/解绑，并保持现有数字栏、Y 回血瓶、左右手装备及世界生命周期互不干扰。道具实际效果和 AI 自主使用先不做。按 v2.2 B 级定向验证，结束交给我试玩；后续 FARM-01 仅列计划、不自动实施。
