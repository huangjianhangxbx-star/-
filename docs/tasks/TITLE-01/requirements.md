# TITLE-01 需求与实施计划

基准：5a1e70a，scene2d-validation，工作区干净。依据：用户 TITLE-01 v0.1 计划包；ChatGPT 链接要求登录，未作为已读依据。

|明确要求|实现选择（AI建议，在授权范围内）|待确认边界|
|---|---|---|
|原创蓝色标题、美术先行、两态概念与独立评审|深蓝星骸回廊背景、中文中央标题；概念至少8分后实现|无|
|点击屏幕进入菜单，开始游戏可用|左键/Enter/Space；Esc返回；零资源携入当前原型|无|
|读取和画廊暂未开放|原生 disabled 按钮|不实现存档|
|旧开始页保留为F10调试入口|独立调试视图复用旧页；返回恢复正式入口，避免污染正式世界|不迁移玩法|
|实现评审9分，最多3轮|真实截图、独立监工评分、定向浏览器链路|评分不冒充用户验收|

使用 brainstorming 梳理既有已批准方案，writing-plans 记录接线与验收，frontend-design 做视觉，imagegen 制作原创背景，test-driven-development 验证入口行为。不改开发细则和用户维护区，不同步Gitee。

## 实施步骤
- [x] 美术概念 A/B 和评审达到8分。
- [x] game/src/title-screen.ts 与 title-screen.css：专属标题状态、菜单和键盘；不引用战斗状态。
- [x] main.ts：正常路径先显示标题，按需加载原型；F10可进旧调试页。
- [x] exploration-app.ts：导出正式开始及暂停/恢复窄接口，复用现有命令。
- [x] tests/title-screen.spec.ts：默认待机、点击/键盘菜单、禁用项、开始真实世界、F10及返回；隔离旧调试功能验证。
- [x] 概念通过后实现；运行 TypeScript、入口浏览器测试、构建；实现独立评审最多3轮。
- [x] 更新任务报告、CurrentRules、项目状态、当日日志；核实远端后选择性提交推送 GitHub main。
