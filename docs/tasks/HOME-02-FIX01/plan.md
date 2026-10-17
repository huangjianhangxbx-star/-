# HOME-02-FIX01 A：布局返工实施计划

> For agentic workers: 按下列任务逐项在当前会话执行。已批准计划包取代重复设计审批；独立监工仅审图/审查，不并行改产品代码。平台未提供superpowers:executing-plans/subagent-driven-development，不伪称调用。

Goal：按用户目标图恢复室内住宅、墙外菜园、真实西后门及靠墙家具组。
Architecture：101独立布局数据管理室内/庭土/步道、建筑墙、非建筑空区、家具与显示配置；保留现有地图/人物/库存所有权与共享导航。原墙白名单按家园独立选择，102不变。只实施A；B必须等用户确认实际画面并另行授权。
Tech Stack：TypeScript、Three.js、Vite、Vitest、Playwright、内置image_gen。
Spec：本机work/HOME-02-FIX01/source/01、02、04、05，原ZIP SHA核对12项通过。基准c8c25821bda97d2ca7e8b384789ed4068d01a630及fetch后github/main一致，旧game/docs未跟踪内容保留。

## 约束与批准
用户要求执行本包A，允许局部常规实施，无需再次审批；建筑边界、后门和出生/站位可调整，稳定身份保持。旧HOME-02 9.1不代表用户验收，用户否决旧布局。保护用户原稿/开发细则/原PNG/PPT/其它Unity工程；只按有效授权GitHub main，不同步Gitee，不强推。聊天URL返回登录页，未取得新正文。本包和当前工程记录为实施依据。

## Task 1：真实资产布局目标
Files：work/HOME-02-FIX01/preview与本任务layout-contract.json；补件仅public/assets/home02-fix01。
- [x] 实看用户原对照和HOME-01 R2；核对现有18图可见边界/256PPU与两体大小。
- [x] 原作墙只比现用金属、631003蓝石、631001木墙三候选；原PNG不修改，仅本机白名单。
- [x] 必要补件：纵向餐桌、东西椅、地毯、壁架、横竖栅栏、盆栽；若原庭土地面无法读出小路，仅补必要步道，记录原因。
- [x] 保存参考bbox、室内归一范围、世界组范围；用实际PNG/原墙和真实角色比例画可重建预览，独立G0视觉>=9且V01–V08成立后锁定目标。G0最多三轮，不以测试数加分。

## Task 2：布局数据与地图空间（TDD）
Modify：core/scene-layout.ts、home-layout.ts、map-definitions.ts、spatial.ts、home-resident.ts、map-travel.ts。
Test：home-layout.test.ts及新增home-layout-fix01.test.ts。
- [x] 先写并运行失败：后门同图连续路径、院外非可走空区、建筑墙不包含围栏/空区、两体可抵所有关键点；旅行仍到合法住宅前门落点。
- [x] 仅101布局拥有groundRegions、buildingWalls、室内外步行区、出生/到达/居民/门坐标。terrainFits拒绝非可走空区，但不把空区画成高墙。
- [x] initializeMapWorld/居民只用新布局位置初始化同一人物，不每帧校正；东门Portal身份保持，西门没有Portal。
- [x] 运行受影响导航/居民/旅行小集，修失败，不扩展生活AI。

## Task 3：显示与本机原墙资源
Modify：view/scene2d/view.ts、home-assets.ts、scene2d-assets.ts；新增有限home显示配置/ground regions消费者。
Test：home02-fix01.spec.ts与必要assets路由测试。
- [x] 先验证失效断言：家园默认配置生效、切102恢复、回家无重复，必需新图失败旧世界不损坏。
- [x] groundRegions提供纹理、重复周期/尺寸、绘制层；撤除硬编码室内土带。墙由buildingWalls决定，围栏独立道具。
- [x] 保存家园暖光、灯位置、合理相机跟随/限幅；仅进入101生效，Source诊断仍可用。
- [x] 新墙家族的47态原映射/逐片PPU/Pivot只留本机，提供有限别名，不发布原作媒体。

## Task 4：有限操作与最终独立验收
- [x] 标题开始→厨房/阅读→绕桌→WASD及B选路后门往返→居民F交谈→组队→双体通过→前门离家返家；采样visit/Unit/库存/BGM连续。
- [x] 定向追兵/伙伴家具战斗及敌HP，缺图失败、切102无灯/家具残留；夹具明确标记。
- [x] Source与保存默认画面、同室内尺度参考对照、HUD原图、后门录像及bbox测量。独立视觉R1最多至R3，>=9且V全过；T01–08另判全通过。
- [x] B级相关测试和构建，补记录/状态/规则对账/资产/设计导航，核对保护区与暂存再提交GitHub。未达视觉只交本地，不标完成。
- [x] A交付后等待用户视觉确认；不启动B。
