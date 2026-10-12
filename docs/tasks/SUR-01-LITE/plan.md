# SUR-01-LITE Implementation Plan

**Goal:** 正式世界南支廊单例暗区 → Tab团队便携灯唯一消耗 → 原雾区真实照亮 → 20模拟秒到期恢复限制。
**Architecture:** 小模块environment-sample.ts存固定区位及纯资格/接受事务；WorldSession.sampleLight只存revision/useSerial与最近有限使用史，真实位置/半径/remaining仍在s.lights，不另造灯钟。正式beginWorld才初始化，具名夹具/Legacy/Lab无sampleLight。visibility仅暗区目标缩短身体视野，旧light及普通区不变；墙和层仍查原空间。新Command显式传请求，背包按钮在其模态自身输入下消费，不加快捷键。原Scene的灯mesh/PointLight与雾纹理足够，无新美术。
**Tech Stack:** TypeScript / Three.js / Vitest / Playwright Edge。
**Spec:** approved-plan.md（用户本条明确批准实施，提案原草稿身份另存）。执行本机可用brainstorming/writing-plans/TDD，内联实施；不假装执行不可用的executing-plans。

## Global Constraints

main/GitHub=f8260aa5b2f2b11ed4960de78b06d9e81c7e526d。game源clean，旧t016测试与工坊/历史dirty保留。保护地图/两黄金战斗/quest/farm/ALAI/Y/campfire/offhand/原fog与人工区/开发细则。暗区SAMPLE x9..11/y16..20，基础视距1.5，固定地灯半径4/20秒，初始团队2；不改随机敌人或战斗范围。原口语设计的自动辨识仅沿现行可见性消费者，不改变手动自由挥击或敌人AI感知。

## Task 1 — 核心暗区及唯一消费

Files: 新core/environment-sample.ts、tests/sur01.test.ts；修改visibility/world-inventory/world-session/types/engine。
Interfaces: SampleLightRequest={worldId,visit,actorId,controlRevision,expectedRevision}; querySampleLightUse/acceptSampleLightUse、sampleDarkTarget/sampleEnvironmentView；新command useSampleLight。不复活item:light。
- [x] RED：实际入口state在暗区body10,16，目标10,20原5米可见须变不可见；真实command唯一扣2→1并照亮，step模拟超20熄灭；过期world/visit/rev、死亡/动作/区外/非法数量失败零写；同世界库存史保留，卸载灯不退款，新世界重建；普通区/墙层/迷雾记忆/具名隔离与AL不消费。
- [x] GREEN：模块实现条件/纯查询，灯用当前身体位置快照；查询全资格后一次性扣团队1、加light、递增revision/serial和有限history；引擎仅已有dt减remaining，existing unload清lights；无新全图扫描。
Run: node node_modules/vitest/vitest.mjs run tests/sur01.test.ts。

## Task 2 — 真正背包输入与显示

Files: backpack-panel.ts（只选团队lamp显示按钮）、exploration-hud.ts（原目标区短状态）；app只传点灯时UI所有权门。
- [x] RED自然故事：步行10,16，Tab选lamp，button应出现；同位置visible前false后true，库存2→1；重复/暂停/文本/陈旧不能再次消费。
- [x] GREEN：背包token+control+sample revision产生当次请求，模拟暂停的背包自身可点灯，但Space/别的模态/失焦拒绝。quantity/剩余只从核心读。数字绑定的灯明确提示Tab主动使用，不能变农具或AL自动消费者。默认允许既有交付/撤回，AL无灯消费者。

## Task 3 — B定向验证与交付

- [x] 核心SUR/visibility/world-session/world-inventory/QST/FARM小集；库存数组夹具事实调整保存原失败；types/main build/必要Lab启动。
- [x] 两个短键鼠故事：正常走南廊，暗→点灯→Space/Tab冻结→实际模拟20秒熄灭；旧QST路线及原FARM/Y/六区各代表，合法leave/continue仅核心夹具。只读观测、不注入。
- [x] 文档contract/validation/handoff、受影响共享记录增量；独立index选择性GitHub main；服务恢复后HTTP200并新版本链接。停用户试玩Gate，不做SUR02/BLD/VAL。

服务问题反馈环：启动前HTTP连接拒绝+5173无listener；Hidden Start-Process启动原Vite后HTTP200。纯进程恢复，无伪造业务修复或无关配置重建。

最终验证按B执行，45核心/5不同自然故事分段通过；路线失败、HMR中断与模拟/墙钟差异均保留，不声称一次全批绿。自然QST代表止于前厅，完整完成事务由核心覆盖。折叠标题补充经过独立L3 RED/GREEN。
