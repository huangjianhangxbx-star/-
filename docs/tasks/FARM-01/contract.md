# FARM-01 最小种田契约

## 权限、来源和范围
用户明确授权执行下载计划并推送 GitHub/main。本轮实施两块固定试验田，不启动 FARM02、阿尔道具 AI、经济、自由耕种、天气或持久存档。研究 chat 最新用户内容可读；助手正文为引用占位，因此不声称读到缺失正文。授权计划原文保存在 reference/approved-plan.md。

基线：附件 efea60e；实际本地/远端 5b98df3，仅新增资产工坊，游戏源码一致。实际使用已读 brainstorming、writing-plans、TDD、frontend-design 流程；当前边界清楚，没有需要 grill 决策的重大冲突。未调用 Unity 技能或不存在的 executing-plans。

## USER_CONFIRM 与 SAMPLE
USER_CONFIRM：两块入口安全田；当前存活实控猎人或阿尔亲手操作；数字栏唯一选择；Z 与自由栏引用共享库存；死亡/篝火/同世界继续保留，确认新世界重置。
SAMPLE：初始种子5/农具1；距离1.4；6模拟秒成熟；播种扣1种子，成熟收获+1实验收成/+1种子；农具无消耗磨损。作物只显示、绑定，不具有回血/烹饪/出售效果。升级设计继续暂缓；SK02 实验代码不变。

## 单一权威与接受条件
WorldPlace.farmPlots 保存 raw/tilled/planted、稳定 farm-1/farm-2、位置层、revision、harvestCount、plantedAt/matureAt。成熟仅由 s.time 与 matureAt 比较推导；无第二成长计时器。farmView 与 queryFarmAction 纯查询，无修复/初始化副作用。

request 绑定 worldId、visit、plotId、expectedRevision、actorId、selected slot/itemId；提交前重新检查当前地点引用、本体唯一性/存活/实控、explorationIdle、动作与库存、同层可见/距离/墙。普通战斗、旧角色、XX、具名敌人构造器无农业能力。农田失败点击消耗本次LMB路由，不发Basic/技能确认，不取消已有动作。Tab/暂停/文本输入/失焦/瞄准/轮盘由前端物理入口拦截；Core 另核对动作所有权，不声称Core知晓DOM焦点。

开垦：工具→tilled；播种：种子-1与planted/revision同时提交；收获：先预检种子与作物的唯一非负安全整数栈和加法上限，再一起入账/田回tilled/harvestCount+1。任何损坏/溢出整体拒绝，无部分收入、无自修复。重复旧revision无效，不依赖战斗trace开关。hotbar与阿尔自由槽仅存itemId引用，数量仍来自同一stacks。

## 地面、展示与生命周期
位置 farm-1(6,6,layer0)、farm-2(4,8,layer0)。只读导入tiles确认两处九格内部空间、距离入口/事件2米，入口房间本身安全，多个seed验选址；见 placement.json。不修改导航、37 GLB或UnityScene，不添加碰撞/AI占位，出生到出口必经路线不受影响。

Three.js可复用土色底/细边/几何芽/成熟果、world标签和失败提示；使用实际地面高度、真实可见与深度测试，不穿墙显示，不新增人物资源、全局灯光或覆盖PPT六区。两档HUD尺寸与INV01B冻结记录一致。

同世界离开/继续只切visit，田和库存保持；world phase、Tab和暂停时模拟钟冻结。死亡/全灭/合法篝火不重建田；确认新世界重建两raw田和seed5/tool1/crop0，右手技能预选遵循原生命周期。刷新不存档。

## 尚待用户 Gate
田地可读性、数字栏操作顺畅度、6秒成熟值与未来是否自由开垦仍待用户试玩决定；技术通过不等于已认可。真实OS失焦与全地图自然离区/危险死亡未实测，核心与浏览器方法分列。
