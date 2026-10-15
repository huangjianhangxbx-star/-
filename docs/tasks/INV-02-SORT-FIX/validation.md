# INV-02 整理失败与紧凑排序修复

2026-10-15，基线593fbdd。用户反馈“整理计算失败，库存保持”，并明确整理应紧凑、符合直觉。本轮限定修复后台整理可用性和同等空间评分下的左上摆放，不修改UI布局、装备规则或库存容量。

复现：接手5176服务已停止；恢复服务后正常连续整理通过。主动阻断Worker模块加载可稳定复现截图同文案。另一个混合形状用例：2×2护盾＋三个1×1道具，旧排序占用[0,1,2,3,4,8,9]，下排左侧留洞；期望[0,1,2,3,4,5,6]。两项均先RED后GREEN。不能仅凭截图证明用户每次失败都是网络原因，但对应错误路径已锁定并覆盖。

实现：主页面预载同一纯求解器；Worker加载/消息失败、构造异常或1秒无结果时终止后台，改用本地12ms搜索预算。后台默认优化预算250ms，先播种大件优先、分类/定义/ID稳定的左上first-fit布局，再播种现有合法布局；搜索限时仍返回合法结果，不谎报全局最优。每递归节点检查预算。既有最少占格、最大空矩形、碎片、同类邻接优先级保留；其后加入从上到下/从左到右的占用紧凑比较，最后才用ID打破平局。

取消、关包、访问失效及新任务会清理定时器、终止Worker和递增任务令牌；任何结果仍经原库存revision/访问/数量/实例/碰撞原子校验。玩家文案：已证最优为“最优整理完成”，有合法布局但未证明最优为“整理完成”。不在界面暴露算法异常堆栈。

验证：6个核心文件16测试通过，包含独立枚举对照、堆叠、形状陷阱、零预算保留现有布局、装备/死亡/物品事务；3个真实浏览器故事通过（正常连续三次紧凑整理、故意阻断Worker且实例/数量/武器状态不变、挂起Worker回退及取消不迟到提交）。TypeScript与189模块生产构建通过；原大chunk提示仍在。首次测试误从repo根启动导致junction同测被发现两次，后续正式小集固定在game目录执行，16不是重复计数。

复现命令：game目录运行 `node node_modules/vitest/vitest.mjs run tests/inventory-pack.test.ts tests/inventory-model.test.ts tests/inventory-equipment.test.ts tests/inventory-death.test.ts tests/inventory-world.test.ts tests/inventory-consumers.test.ts`；`node node_modules/@playwright/test/cli.js test --config playwright.scene2d.config.ts inventory-sort-fix.spec.ts`；`npm run build`。

本地5176已恢复。GitHub main选择性推送，不Gitee；完整发布回执在ignored work/INV-02-SORT-FIX/publish-receipt.json。没有声称用户已试玩认可。
