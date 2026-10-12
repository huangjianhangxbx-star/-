# EVT-01-LITE Implementation Plan

**Goal:** 正式世界临时奇闻入口→叙述/两个互斥选项→真实药+1或随身+10→结果页与继续；只一次结算。
**Architecture:** WorldPlace.sampleEvent唯一状态；sample-event.ts纯Trigger/Choice查询与接受事务。类型/引擎只有限命令转发，复用WorldInventory/credit，不改其实现。独立轻量SampleEventPanel负责token和模态输入，app显式冻结dt/effectiveTimeScale/tactical clock。HUD原world-event预留改小按钮，地图/场景不动。
**Tech Stack:** TypeScript/Three.js/Vitest/Playwright Edge。
**Spec:** approved-plan.md；用户本次“理解并执行”是本轮实施授权，附件其他SAMPLE及原草稿状态分开。已有brainstorming/writing-plans/TDD说明复用，frontend-design本轮完整读取。内联实施，无不可用执行技能或子代理。

## Global Constraints

本地/fetch GitHub/main=58009d8a37f299d4ad99804ac0ad53a2aee4eb64；game源clean，t016旧测试/工坊/历史dirty保留。只正式本机世界，Legacy/XX/具名不初始化。非交战、身体可行动、未暂停/模态/瞄准/物理held时才能触发；当前世界事件notStarted→offered→resolved，offered关闭/重开不给钱。A药团队+1不进后备；B随身+10不进永久。不复活旧卡事件或通用剧情框架。

## Task 1 — 单例事务RED/GREEN

Files: core/sample-event.ts、tests/evt01.test.ts；world-session/types/engine最小接缝。
Interfaces: EventRequest={worldId,visit,placeId,eventId,actorId,controlRevision,expectedRevision}; ChoiceRequest加choiceId salvage/listen；querySampleEventTrigger/triggerSampleEvent/querySampleEventChoice/acceptSampleEventChoice/sampleEventView。
- [x] RED真实入口：触发不奖励；两个新世界各自选A/B，结果互斥、旧请求/非法choice/数组重复栈/数量溢出纯拒绝；合法离区继续offered/resolved保持、新世界重建。只查有效idle本体，当前访问与身份。
- [x] GREEN：复用queryBackpack验证世界/身体，有限动作门；A先查唯一合法栈+安全增1（零栈可创建），B预查credit及稳定event rewardKey；提交成功再resolved/choice/revision，不写objective/mechanisms/quest/SUR。world正常begin初始化，fixture不可自动启用。
Run: node node_modules/vitest/vitest.mjs run tests/evt01.test.ts。

## Task 2 — 黑底细边叙述模态

Files: sample-event-panel.ts、exploration-app/hud、geometry-hud.css；tests/evt01.spec.ts。
Design: 固定标题“异常回响”，青灰#8ca9a3说话者“回响”，金灰#c9b16b外框，黑#090b0d内框，正文#dedace；楷体叙述配现有无衬线操作字体。下方偏中央720px框、两条竖排选项，结果页替换同框。这个探索铁匣/低语选择决定边缘配色，不加装饰图、动画或新主HUD。
- [x] RED单自然短故事：从原world区按钮打开、看到两选项；Esc未选择仅offered、重开；时间冻结，WASD/Z/F/G/QER/Tab/Space及场景鼠标不穿透；真实选A药+1与结果；最短二次确认新世界再选B随身+10。
- [x] GREEN：对话前release持有输入，打开时capture键鼠/焦点且close阻止按键续触发；eventPanel.open加入controlModal和所有显式模拟冻结处；速度不改写。原事件预留button只在有效世界显示，resolved显示已处理。

## Task 3 — 轻量B与交付

- [x] EVT/世界/库存/经济定向小集、类型/主build；仅一条自然故事，必要时在同条改1280小屏检查选项，不跑FARM/Y/QST/SUR/Lab旧长流程。
- [x] 对话截图目检；契约/验证/交接、相关共享记录增量，独立index选择性GitHub main，不Gitee/人工区/开发细则。停试玩Gate，不第二事件、TileMap、建造/成长。

最终：34核心+一条13.4秒真实键鼠故事/type/main build通过；两个结果都自然操作，1920/1280目检。Lifecycle只核心夹具，OS切窗未自然验。用户Gate待试玩。

发布前额外补查一个UI blur监听器夹具，现有全局repeat拒绝已经通过，生产代码不变；无头切页未产生真实blur的失败另存，不扩成OS/全设备验收。
