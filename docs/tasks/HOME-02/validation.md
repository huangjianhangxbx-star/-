# HOME-02 验证（2026-10-18）

B级定向验证，分次组合结果，不冒称一次全绿或人工长期试玩。工作目录game。

## 命令结果
- npm test -- tests/home-layout.test.ts tests/home-resident.test.ts tests/home-join.test.ts tests/map-companion.test.ts tests/map-travel.test.ts：5文件38项通过。新增碰撞/射线先观察失败再实现。
- npx playwright test tests/home02.spec.ts --workers=1：最初4项20.9秒通过；后新增键盘绕桌单项12.8秒通过，合计5项组合通过。起点由夹具定位，W/D移动和Z切人走真实输入。
- npx playwright test tests/home.spec.ts tests/map-companion.spec.ts --workers=1：4项56.1秒通过，正常独行往返/对话/组队、双向队友实际攻击；死亡项明确使用致死夹具。
- 南墙外地板修复后home02.spec.ts --grep 'source and lighting'：1项6.2秒通过。首次误在checkout根目录运行导致npx版本/目录错误，未执行测试；改在game后通过，无依赖清单修改。
- 后增101家具追兵/队友真实step与HP变化样本，map-companion.test.ts 5/5通过。该项是注入已交战敌人的定向夹具，不是自然从102引回完整故事。
- 构建此前通过，最终结果追加交付记录。

## A01–A17
|项|证据/结论|
|---|---|
|A01|G0/G1独立报告、原R2、实际参考核验及asset-work-order.json。|
|A02|18实际PNG全部引用，17家具实例+4地面项；原稿在本机work/HOME-02/raw。|
|A03|floor-seams.png含各3×3、横竖全部有序配对、8×8混排；分配为固定坐标函数，重入不重掷。|
|A04|浅底alpha-assets与深底实机，alpha>16包围盒逐项实测。|
|A05|G1实际角色/墙校准，256PPU、统一缩放和可见U记录。|
|A06|正常HUD全景、概念对照显示所有类别，非整图贴地。|
|A07|低桌仅阻身体、高柜阻射线，tile obstacle不变；空间诊断图。|
|A08|双角色键盘绕桌及movement-fixture.json；8点可达、y6通道。|
|A09|behind-table/in-front-table同机位定位截图检查足点排序，HUD全景保留。|
|A10|home.spec正常故事重跑、相关逻辑身份/库存保护。|
|A11|101定向追兵/队友step绕餐桌，无穿底座且真实敌HP下降；102双向自治浏览器故事重跑。|
|A12|activityAnchors两体均可达且查询前后状态相等，F10字段可读。|
|A13|家具不注册交互/容器/F命令，无生产代码；原F对话故事通过。|
|A14|roundtrips.json三次101↔102，101单根17件，102零可见家具根，末两次GPU计数相同。|
|A15|书柜加载失败、清单缺floor-c、旧请求延迟：旧root/单位/包保留，资源回落；恢复可重试，旧任务不覆盖新修订。|
|A16|Source/临时DungeonLight实看，无新增发白；home.spec BGM transport/start连续，没有人工试听。|
|A17|最终选择性diff/暂存审计，原稿/开发细则/用户区不改，game/docs排除，不分发原作库。|

## 限制
受光图是临时3灯/0.3环境强度，默认仍Source。活动点只有扩展接口，无生活行为。审美与真实硬件听感待用户。最终独立实装分数见final-review-R*.md，最多三轮，不能覆盖原分数。正常HUD全景/技术板和JSON存本任务evidence；其它原始证据在work/HOME-02及原回归任务work路径。

最终复核：TypeScript/Vite 230模块构建通过（现有chunk>500kB警告）。rest/store改侧面后home-layout+map-companion 8/8通过；更新F10/受光图对应浏览器1项6.3秒通过。实际站位见anchor-rest/store.png，南墙未遮人。

最终独立实装R1 9.1/10、视觉3.6/4通过，无已发现P0/P1或硬门阻断；原始报告final-review-R1.md保留。A17最终审计：选择性暂存仅本轮代码/18生成图/工程文档和证据；开发细则、用户维护区、AGENTS、原始PNG/PPT/解包目录均无暂存变更，原game/docs未跟踪内容排除。当前公开新增素材仅home02生成图；没有原作整库。陈设较R2疏朗、庭土直边、压缩代码维护性与未人工试听作为已知限制保留。
