# NPC-HOME-01 有限在家行为实施计划

> For agentic workers: 在当前会话逐项执行；实际环境没有superpowers:executing-plans/subagent-driven-development，不伪称调用。包内监工要求由独立只读reviewer执行，不并行改产品。

**Goal:** 同一个驻家ranger自然选书柜/厨房/墙外菜园，真实走到、朝向并停留，可打断和恢复，入队立即让权。
**Architecture:** HomeResident持有短期activity状态，与resident/party成员关系分离。独立home-activity模块选择配置目标并发布带所有权的共享移动路径；engine仅给该居民路径一个移动资格例外，绝不放开战斗/技能/切控资格。既有对话/菜单持有者显式获取并释放目标居民的暂停租约；旅行冻结并保留小状态，离开家不运行后台AI。
**Tech Stack:** TypeScript、Vitest、Playwright、现有Three.js/导航/模拟时钟。
**Spec:** work/HOME-02-FIX01/source/03_NPC-HOME-01_有限在家行为_待视觉确认后执行.md。用户2026-10-18“布局可接受 继续吧”接受A并明确授权B的默认建议；代码基准99223df，旧game/docs未跟踪内容保留。

## 范围与约束
3项read/kitchen-stand/garden-inspect，按既有活动tag找布局点，不复制坐标。停留8–15模拟秒、稳定顺序/种子权重、冷却与不立刻重复；stand-placeholder。选中/失效才寻路，不每帧查询所有活动可达性。阻塞有限重试/冷却，layoutRevision或对象失效丢弃旧目标；路径只清自有，旧回调不能清新跟随路径。对话/菜单、旅行、危险、死亡/硬直让权；组队失败原任务保留、成功同步取消。离图冻结、返家同一Unit/装备/伤势/位置。无新动画、产物/经验/需求/日程/自动返家/解散/离线/存档/重AI平台。用户维护区/开发细则/原媒体不改；仅选择性GitHub main，禁止Gitee。

## Task 1：自然任务与共享移动（TDD）
- [x] tests/home-activity.test.ts先验证正式世界模拟中原居民会真实移动到两个不同活动、包括从后门去菜园；观察失败。
- [x] 新core/home-activity.ts定义3行为/小状态/短日志/有界规划预算；home-resident.ts挂任务数据；engine.ts仅自有居民路径进入现有advanceMovement，不修改participates/party身份。
- [x] 到达后正确朝向，模拟停留/冷却，阻塞有限重试/换目标，选择原因与真实到达日志。每帧不对全家寻路。

## Task 2：所有权与中断生命周期（TDD）
- [x] 先测对话/取消/菜单租约、危险恢复、目标/布局失效、拒绝组队不改任务、成功组队旧回调不抢新路径、独行旅行冻结同实例。
- [x] DialogueGame及RoleInteractionPanel仅目标居民获取暂停租约，成败原子；joinHomeParty先验证成功再同步取消，MapTravel/unload前冻结，返家重验目标。
- [x] F10显示目标/状态/控制者/剩余停留/阻塞/最近中断，正常HUD不堆调试。没有阅读等动画时标stand-placeholder。

## Task 3：自然故事与独立监工
- [x] 正式标题进家不组队→自然至少两个目标→走后门菜园→途中交谈停住→结束后恢复→入队退出→前门外原伙伴战斗。记录真实步行/时间/同一Unit，不改坐标伪造自然故事。
- [x] 必要阻塞/布局/旅行/旧回调负例可明确标夹具；相关居民/组队/对话/布局/伙伴小集、类型与构建。不全量五层/技能库回归。
- [x] 独立监工四项各2.5，总≥9且无身份复制/瞬移/抢控/穿墙硬失败，最多3轮。
- [x] 更新现行规则/状态/日志/规则对账/索引与验收记录，复核GitHub基准后选择性提交推送main，验证5176试玩可用。
