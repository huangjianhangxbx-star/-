# QST-01B｜B级定向验证

执行跨2026-10-11/12。起始游戏基准 f428490814dcb4da7ca29b55dcaf856f67f6eefd，目标源码清洁；工坊/旧记录等既有dirty保留。发布时 main/GitHub 已由另一任务推进至9bbabc6f61b242222e40d3b9f15d73e9ce106dbc：审计45文件，游戏源/test/本任务文档没有交叉；包含工坊与共享记录增量，保留后线性选择性发布，不回滚或强推。

## 实际验证

|方法|结果与边界|
|---|---|
|TDD RED|初始4核心失败，UI连接前Q1真实点击仍未接取；日志 core-red、browser-red|
|核心最终6文件|46/46：QST6、世界访问生命周期、经济边界、FARM、Y瓶。QST涵盖一次credit、重复/陈旧/错误请求、死亡动作/空间/可见拒绝保持整状态、余额溢出、独立旧resource分派与纯query|
|地图定向|2/2，另4历史用例显式跳过；seed复现/原入口出口篝火5米buffer及所有事件/20房中心entry连通性|
|自然Q1 1920|正式入口→前厅委托真实接取→WASD按只读BFS路线走到32,8→HUD点击调查→随身+10/永久账户不变/奖励键一次→按钮禁重领→实际二次确认新世界，状态重置。46.7秒，无pageerror|
|自然Q2 1280|近点Space暂停/F/G持有时真实按钮不得接取，取消Tab后成功；满血Y不扣，步行回原篝火真实使用，任务不变。12.6秒|
|自然Q3 1920|Tab背包遮罩下场景点击不得接取；切其他页真实键盘不触发任务，回页场景点击接取；普通空地LMB产生原普攻accepted trace，任务状态不变。8.7秒|
|自然兼容2故事|FARM耕种→种下→模拟生长→收获→再种；Y满血/暂停/V/F/G隔离。1920/1280六区原位几何校验通过。38.4/9.4秒|
|TypeScript/main build|--noEmit通过；Vite主入口构建通过，已有>500KB chunk警告保留|
|Action Lab烟测|HTTP200、5 canvas、pageerror=[]；仅启动检查，不声称Action Lab全回归|

自然故事只用键盘/鼠标操作，page.evaluate仅读取状态、路线、投影与几何；未注入位置、余额、任务状态、隐藏command或时钟。现有截图/JSON在validation/browser、compat-farm、compat-y。Q3失焦覆盖真实其他页输入及返焦，未人为合成失焦任务点击。暂停与模态是UI所有权门，不宣称核心有全局暂停字段。

合法离区/继续的active/completed保留及未完成不新增出口门，采用**核心状态夹具**（真实exit/leave/continue事务，放置身体并去敌满足原出区资格）；没有自然走完144×120全图或强行注入当作故事。自然Q1验证的是确认新世界重建。Y自然只测满血/隔离，治疗/消耗与补充由其核心小集负责；未重测全地图、长期存档、全设备性能与组合战斗边界。用户尚未试玩认可本任务。

## 历史失败与夹具调整

首轮旧小集49项含7失败：旧exploration-events两项依赖已退休body；standalone四项依赖已退休fiorre/旧退出结算。这6项在 git archive **f428490 原源快照**重跑仍失败（10项4通过6失败），不是本轮回归，未为了绿灯改旧玩法。快照使用本机原node_modules及只读同路径工具/public依赖；首次缺依赖跑不成功日志另保留，最终基准日志才作为失败证据。

第7项来自安全buffer测试把所有事件当篝火：增加quest后错误要求调查点周围5米无敌。仅将该断言限定campfire，并保留入口/出口与5米距离；连通性断言仍覆盖全部点，包括任务。不是放宽既有安全区或重抽敌人。新增身体/点位跨层拒绝测试先修夹具，让身体处8,8再单改9,8层级；同一格整体层变化不应伪称跨层。

## 保护、资料与发布

15项SHA保护一致：开发细则、地图、两角色黄金战斗、campfire、Y、farm、al-items、offhand、world-inventory/economy、backpack/activation及头像等；scene只改新任务标签，不改六区样式或正式素材。共享文档仅本轮段落增量，原未提交前缀保留，普通index非任务项不动；GitHub main选择性发布，不访问/推送Gitee。发布凭证在本机work/QST-01B/publish-receipt.json。

研究链接“游戏核心设计（归档）”仅能读取最近3turn的用户消息与内容占位符，助手正文不可得；未声称读取最新完整研究正文。执行依据为本轮完整附件与已核对本地有效规范/前任务交接。实际Skills：brainstorming、writing-plans、test-driven-development及其测试参考；没有启用不可用技能，因无关键疑问未触发grill-with-docs，无新UI美术无需额外生成Skill。

完成即停用户试玩Gate，未执行QST01C/SUR01/BLD01/VAL或纵深AL/FARM。
