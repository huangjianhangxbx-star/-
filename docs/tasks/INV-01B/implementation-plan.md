# INV-01B 实施计划

Goal：原位阿尔自由道具栏接入同一世界背包的引用绑定。
Architecture：WorldInventory新增固定ranger引用；纯查询校验world/visit/固定本体与库存，commit仅改引用。复用BackpackPanel指针捕获与所有权清理，HUD原节点原位置更新。
Tech Stack：现有TypeScript、Three.js、Vitest、Playwright；不加依赖。
Spec：[用户授权完整计划](reference/INV01B-plan-v0.1.md)。已有明确执行授权，采用inline执行；现环境无executing-plans子技能，不声称调用。属于已有流程的限定扩展，不另行请求局部设计批准。

- [x] 核心RED：新API/初始空引用；合法替换重复绑定、错误owner/身份/库存/world/visit纯拒绝、缺货可解绑、全生命周期保持与新世界重置。
- [x] 核心GREEN：world-inventory.ts新增CompanionFreeItemRequest及assign/clear纯门，types.ts/engine.ts路由；只调整INV01A初始shape断言。
- [x] UI RED：真实拖种子到原阿尔槽，当前缺接收器失败；先保存1920/1280六区原位geometry。
- [x] UI GREEN：exploration-hud.ts原free-item改button同几何，BackpackPanel扩展move/drop/clear及键盘按钮，geometry-hud.css局部显示/highlight。
- [x] B级：INV01B/INV01A/Y/World相关核心，3–4条真实键鼠含取消/尺寸/Z/新世界/旧数字栏；synthetic blur单独注明。tsc及主/ActionLab构建。
- [x] 记录：契约/验证/交接，现行索引增量；保留SAMPLE、不消费/不自动AI，不启动FARM01。保护SHA及既有dirty核查。
- [x] 选择性提交GitHub/main，不Gitee，不强推；最新版试玩链接/主观Gate待用户。
