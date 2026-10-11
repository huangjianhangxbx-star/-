# EQ-01 · B级模块验证

基准：fc178114617c32004460a45184f3f1baf7961f7f / GitHub main。适用根AGENTS、开发细则v2.2 §5/6/7.1.1；范围涉及EQ、CB、LT、AR06、ENBAL、输入与PPT HUD。按已批准详细计划执行，无重大目标/范围歧义需要grill；使用brainstorming、writing-plans、TDD、frontend-design。未使用Unity记忆或重复安装Skill。

## 最终结果
- 最终5文件 **82核心用例**：EQ16、相关CB/LT/AR06/ENBAL。见 validation/core-final.txt。覆盖独立实例/权威、只读拒绝、旧guard/shot/E门、原Release/弹药、busy拒绝、最后一盾损坏、Accept取消/不退款/未Release不磨损、trace关闭也真实命中、挡墙、多敌单事件25架势/45基础HP、奖励只一次/无友伤、Z/死亡/复活/同世界离区继续、付款序号保留、精确Release后飞行钟。
- 主构建及Action Lab共享类型构建通过；TypeScript --noEmit包含在两构建，见 build-final.txt、lab-build-final.txt。Vite大chunk警告是现有构建提示，未当作性能验收。
- **4个真实Edge键鼠场景分段通过**，未修改浏览器战斗状态：Hunter原盾/E→真实面板→炸弹持键跨5秒CD仍1次→E拒绝→换盾恢复；Al Z→原四发/装弹→炸弹不付枪弹→Z冻结CD；1280两列/头像/右上左下/捕获F/Esc；真实地形挡墙落点RMB拒绝无接受序号/CD/耐久损失。前三套同时包括1920画面及面板冻结。对应最终 hunter-gate、followup(Al通过)、final-hunter(1280通过)、natural-wall 日志。
- 已实际查看1280最终panel截图，战术提示不再遮挡底部；面板在视口内。截图和只读facts在 validation/browser/。

## 真实失败及修复
初始RED缺模块；末边界RED发现职业仍读旧selector及飞行早一模拟帧，修为右手权威和true Release clock，保留 right-clock-red.txt。最后一盾损坏未清旧guard已修并记录 broken-shield-red.txt。
浏览器首轮fixture错用Charge/reload日志名，按已存在active-payment/reload-complete语义修正（未改黄金动作）。软件WebGL18秒墙钟仅推进约4秒模拟钟，保留长按跨6模拟秒原断言、等待上限45秒；不以墙钟代替冷却。随后真实E拒绝被keyup覆盖提示，修为仅接受成功才缓存待释放E。面板曾被旧战术提示覆盖，限定panel z-index修复。相关失败原日志保留，不声称一轮全绿。

## 未执行/验收界限
本轮未在真实浏览器自然战斗中复现多敌AoE/单死复活/离区继续的完整路径；这些仅核心定向通过。未做目标GPU/长时性能、移动端、多用户、跨刷新存档或正式美术验收。用户黄金手感历史认可不等于本轮炸弹/装备条件认可。当前B级技术交接，停用户试玩Gate。

保护：开发细则、AGENTS、用户维护区、原黄金profile/段定义、敌压profile、Al用户头像未改；大量既有工坊/map/t016及共享记录dirty保留。发布只本任务增量，GitHub main，不接触Gitee。发布SHA最终回复给出，避免文档自引用。
