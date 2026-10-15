# INV-02 UI-FIX01 验证与交接

基线 `c457c95271dd2efd8b435c560db618a3c087eb0e`，工作区起始干净；本轮为已批准 v1.0 任务包的 UI 修复。11 个包内文件 SHA256 与清单相符，四页 PPT 与原生1434×804参考已读取。链接对话只返回引用占位/超时，未声称取得正文；本机完整执行计划及用户本轮明确要求作为实施依据。

## 实现

透明全屏事件根无底色、边框、阴影或遮罩；四个可见面板各自独立。左侧双人左右手两行、真实5×2团队格及局部滚动；旁边两个竖排安全保护位。无有效选择时详情整窗隐藏，无显式打开的有效容器时右窗整窗隐藏；关闭外部窗口保留自身背包。空白点击清除详情且不穿透战斗输入。所有面板在状态切换中位置不变。

统一按 min(W/1434,H/804) 缩放；左组靠左，外部窗靠右26原生像素。源图右窗被截出屏，按授权修正到x1043；源三安全槽改两保护位，栏高267→208。四手位代替原图十装备槽；团队容量仍真实十面积格。未复制原作图标、字体或HUD；物品采用项目既有字形占位，长名省略、完整名进详情/提示。SAMPLE与实例号折叠至记录，操作帮助折叠。未修改物品核心、装备/死亡事务、2D场景、碰撞、尺度或受光。

拖拽保持6px阈值、稳定实例节点、源格内抓取偏移；命中/预览使用实际DOM边框与缩放后的同一格距，取消固定56px依赖。拖影z10020高于窗口80。两档实机均完成多格抓取、安全包往返、换装卸装、当前箱子往返与Worker整理。

## B级定向验证

- 新浏览器检查先RED（旧根背景不透明/有边框），实施后2项完整实机故事PASS（27.9秒）；六张截图人工查看：原生自包、选中、容器、组合四态，1920×1080及2048×750组合态。
- 三档12面板边界最大误差0.014841px，低于1%轴阈值。实际DOM格距命中与保留多格偏移通过；宽屏不横向拉伸，留出场景间隙。
- 未来真实扩展行的测试夹具为8行，鼠标滚轮只滚动局部视口；生产默认仍5×2，无虚构格子。
- 模拟时间推进、灯寿命30→21.8996秒、实际倍率1、同武器ID与耐久60保持；浏览器pageerror=[]。
- 六个库存核心文件14测试PASS：model/equipment/world/death/pack/consumers。未为UI重跑全部历史长故事，也不把旧轮93项计成本轮执行。
- TypeScript noEmit及生产构建188模块PASS；Vite仍有大chunk提示，不是本轮新增分包任务。

复现（game目录，Node22.14）：`node node_modules/@playwright/test/cli.js test --config playwright.scene2d.config.ts inventory-ui-fix01.spec.ts`；`node node_modules/vitest/vitest.mjs run tests/inventory-model.test.ts tests/inventory-equipment.test.ts tests/inventory-world.test.ts tests/inventory-death.test.ts tests/inventory-pack.test.ts tests/inventory-consumers.test.ts`；`npm run build`。

## image-to-ui 实际使用

项目范围安装 XuToWei/Image-To-UI 固定提交3aa6527dcf09d8c28fe22936dc051d98b331d545，37文件及MIT许可证，见skill-lock.json；未安装UnityAgentBridge/Unity资产，未修改基础细则或用户维护区。git直连失败后以同提交codeload ZIP配合官方安装器验证/复制方法安装。静态检查14脚本的导入与调用，未发现上传调用；实际执行prepare、measure、check、own-state preview、finalize，Pillow12.3.0/NumPy2.3.5，无新增依赖。安全审查不等于对第三方全部代码的形式化保证。

严格结构45节点/45锚点/3派生格布局，0结构警告、0视觉警告；44路径审阅、12高风险均有当前焦点图证据，最终completion_report.complete=true。末轮2次check/结构修订2；早期独立草稿也曾检查，不把此计数当整个会话次数。重复格尺寸不一致曾被严格检查拒绝，改正后通过；审阅表路径须带反引号，补正后finalize通过。没有放宽警告或伪造绑定。

JSON是原生几何/条件组合分析模型，未声称完整原图还原、引擎导出或游戏状态实现。跨屏统一缩放、访问撤销、真实物品与事件由TS实现并实机验证；源图的商业美术/文字、无关HUD与背景明确排除。三个网格为固定用途槽位，并非数据记录列表。只有本轮显式路径调用，不声称本会话热注册成功；以后从此checkout打开的新任务可发现项目skill。

## 私有证据与限制

完整PPT、原截图、source-vs-runtime拼图、六张实机截图、技能完整分析图与绑定报告保留在 ignored `Origin/work/INV-02-UI-FIX01/`；不上传用户完整参考、原作图片或字体。`browser/index.html` 为实机总览，`analysis/completion_report.json` 为技能完成回执。公开仅代码、安装MIT技能和本摘要/纯几何契约。

技术几何与交互验证通过；物品图仍为字形占位，美术审美与最终试玩认可待用户，不声称PPT美术像素还原。刷新无持久存档、原SAMPLE占格/初值不变。GitHub main选择性推送，禁止Gitee；发布哈希见Git历史与本机publish-receipt.json。用户要求完成后Windows休眠；系统powercfg /a显示未启用，powercfg /hibernate on被Windows以需要提升管理员权限拒绝。本会话无法启用，未安排休眠，也未替代为关机或强制关闭应用。
