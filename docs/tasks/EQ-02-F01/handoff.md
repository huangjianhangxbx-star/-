# EQ-02-F01 独立技术验收

基准 main@6d6dfa2，2026-10-11；用户本轮授权 A→B 连续执行。四文件 SHA 校验通过。最新对话用户“两手独立”明确覆盖 EQ01 Hunter E 需盾的历史 SAMPLE，历史合同不改写。

hunterInput 只对 guard 查询左盾；Hunter E 原 Accept 28 体力、prepare/release/charge、原 CD 和次数不改。HUD 不因左炸弹/损盾禁用 E；装备说明纠偏。两条 EQ01 旧错误断言迁移，RMB 损盾资格、护盾真实磨损仍有断言。

4 个 F01 定向测试及 EQ01/EQ02/CB02 共 **46 通过**；TypeScript 与主构建通过。真实 Edge 键鼠 **1 剧本通过**：官方 carry、鼠标换炸弹、C II、E down prepare / up charge / Release、原体力付款一次、左 CD/耐久不支付，RMB 再实际投弹，E 不因副手灰显。截图与读回在 validation/。技术条件已独立通过，允许开启 SK01A。

失败记录保留：初夹具未 beginWorld 故没有 gear（red.log）；修夹具后真正 RED 为装备门（red2.log）。GREEN 首轮仍有未迁移旧断言，以及 .3 秒不足以跨退步+释放的测试等待；增加模拟小步观察完整原动作，未修改技能时点（core.log）。最终 core2.log / build.log / browser.log。

真实键鼠 E 触发已验；旧动画仍有护盾外观，两者不是同一事实。破盾通过核心行为验，未为浏览器注入耐久。未重跑全历史浏览器、目标 GPU、全地图。用户原稿/开发细则未改；待用户试玩而非声称重新认可手感。
