# Three.js 战斗切片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. 本机未找到这两个辅助技能；采用已读取的 writing-plans 与 test-driven-development，独立模块并行实现、主代理集成验证，不声称加载了缺失技能。

**Goal:** 交付本地可运行的斜视角战斗切片，操作部署、移动、战斗、救援、撤离并保留节点损耗。
**Architecture:** 纯 TypeScript 模拟唯一状态；Three.js消费状态；DOM/CSS发出命令。统一types.ts合同隔离并行工作。
**Tech Stack:** Vite、TypeScript、Three.js、Vitest、Playwright、Spine 3.8兼容核验。
**Spec:** docs/DesignBaseline.md，用户已整体确认。

## Global Constraints
所有内容在项目目录内；工程game/、临时work/、文档docs/。无移动CD，交互0.1倍速；快捷拖动直接提交，完整点击需定向确认。失败不回档、不能战中退出；不修改原始资产。候选边界明示为临时规则。

## 文件与接口
core/types.ts定义Pos、Unit、GameState、Command；core/engine.ts输出createGame、command、step、pathTo、canHit、rangeTiles。view/scene.ts输出BattleScene(host)、update、pick、project、dispose。main.ts拥有输入状态机与主循环，ui.ts/style.css拥有HUD。view/spine.ts只负责真实视觉适配。

## Task 1：纯逻辑战斗 P0–P4
Files: game/src/core/types.ts、engine.ts、game/tests/engine.test.ts。
- [ ] 写部署、移动、路径、层级、自动攻击、阻挡和结算的红测试，再分别实现。
```ts
const s=createGame('standard');
expect(command(s,{type:'move',id:'hunter',to:{x:4,y:4}}).ok).toBe(true);
expect(command(s,{type:'move',id:'hunter',to:{x:5,y:4}}).ok).toBe(true);
```
- [ ] `npm test`先观察行为缺失失败，再实现与复跑。
- [ ] 生命周期明确区分在场、濒死、已救援、已离场、死亡、猎人重生；验证失败不回档、未超时结算获救。

## Task 2：场景 P1/P3
Files: game/src/view/scene.ts、game/tests/browser.spec.ts。
- [ ] 先建立真实浏览器场景可见性与点击落点测试并观察失败。
```ts
await page.goto('/');
await expect(page.locator('canvas')).toBeVisible();
await page.getByRole('button',{name:'进入战斗',exact:true}).click();
await expect(page.locator('#battle-status')).toContainText('战斗');
```
- [ ] 实现14×8地图、高台、石构、灯具、出生点、水晶、固定正交镜头与缩放。
- [ ] Q版纹理足底锚点、血条、方向、阴影；路径/范围读取核心查询，不重复判定。

## Task 3：输入和HUD P2–P5
Files: game/src/main.ts、ui.ts、style.css、browser.spec.ts。
- [ ] 浏览器红测试覆盖开始、选中、部署、方向确认、取消、快捷拖动与暂停，再实现。
- [ ] pending目的地仅在确认时提交；拖动松手保留默认朝向；HUD阻止点击穿透。
- [ ] 顶部状态、右下身份牌、技能键、三类手牌、背包、结果、节点页和折叠调试统计。
- [ ] 失焦不推进，暂停优先于慢速；三个桌面尺寸截图复核。

## Task 4：系统扩展 P5–P6
Files: core/engine.ts、engine.test.ts、ui.ts。
- [ ] 先测刷新保留临场/专属、非法目标不消耗、路障不封路，再补功能。
- [ ] 装备耐久、双武器切换、共享光照、精神压力与两战斗一休息节点。
- [ ] 候选边界与未完成项记录，不用空按钮充数。

## Task 5：真实Spine P7
Files: view/spine.ts、public必要素材副本、docs/SpineValidation.md。
- [ ] 独立核验3.8运行时、解析动画表和完整贴图。
- [ ] 测试加载、动画切换、足底比例；无事件帧采用逻辑时间点，不伪造事件驱动。
- [ ] 兼容失败不影响占位角色基础战斗；不升级原素材。

## Task 6：验收 P8
- [ ] npm test、npm run build、npm run test:browser。
- [ ] 1280×720、1440×900、1920×1080截图，浏览器错误、胜败与操作统计。
- [ ] 启动脚本、运行说明、交付清单（已实现/临时/待确认/未实现）、更新项目记忆。

## 自审
P0–P8均有任务归属，核心与表现接口集中在types.ts。数值可配置、规则不可静默覆盖。完成勾选取决于实际测试；未安装执行辅助技能不阻止用现有工具实现。提交仅在Git存在且已核对文件范围时进行。

## 实施结果（2026-09-27）
上述清单保留原计划追溯，实际完成情况以Delivery.md和自动化验证为准。核心战斗、输入HUD、卡牌装备光照、节点与真实Spine已实现；56项逻辑/交互、6项浏览器测试以及构建通过。镜头缩放、完整FX接入和磁盘存档未完成，不将P0–P8整体标成产品验收完成。
