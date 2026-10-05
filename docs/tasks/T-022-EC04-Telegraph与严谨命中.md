# T-022 / EC04 Telegraph 与严谨命中

**Goal:** 独立暗牢敌人攻击具有 Tracking → Locked → Resolve，显示和判定共用 AttackArea。
**Architecture:** attack-area 负责严格圆/扇形/胶囊几何、Body Circle、LOS与绘制轮廓；attack-intent 管理模板和冻结生命周期；engine接入统一resolveHit，telegraph世界层消费核心数据。
**Tech:** TypeScript / Three.js / Vitest / Playwright。
**Spec:** [原始批准计划](T-022-EC04-原始计划.md)。

2026-10-05用户明确执行。最新对话只取最近2轮，EC03阶段性通过；本地main@8f7206036ffa199401b6a240789908e2c3450efc与计划相同，game无未提交内容。工坊/美术/共享记录保留。已读AGENTS、细则v2.1、EC长期清单相关阶段、T019–021任务/验证、CurrentRules及攻击/空间/敌人感知/视野/渲染代码。无额外独立专项细则，专项契约以EC04为准。

使用brainstorming核对已批准设计、writing-plans记录文件边界、test-driven-development先RED。用户已有具体执行授权，不重复设计审批；superpowers执行子技能不可用，直接分步实施。motion-design用于预警阶段可读性，domain-modeling用于术语。无关键疑问需grill-with-docs。

- [x] 几何RED：圆边界、扇形前侧/角边/半径/Body Circle、胶囊端帽/墙截断/epsilon。
- [x] 生命周期RED：创建、有限跟踪、锁定冻结、取消、同源唯一、周期。
- [x] core/attack-area.ts、core/attack-intent.ts、types/engine与standalone-summary接入；只独立暗牢敌人使用。
- [x] view/telegraph.ts与scene世界层缓存网格，薄轮廓/虚线Tracking、强填充/实线Locked，减少动态仍可读、可见源与可见地面过滤，pick/镜头不改。
- [x] 浏览器近战/远程横移、站区受击、正确时机闪避、heavy双人；全量核心/构建及EC01–03/全屏回归。
- [x] 参数/验证/规则/术语/索引/共享记录；保护快照与历史证据恢复；只推GitHub main。

模板锁定0.35/0.45/0.55s，结算0.55/0.75/0.90s；近战1.10U/100°，远程4U/半宽0.225U，heavy1.35U/125°。有限跟踪采用最大每秒π弧度，锁定前可转向，最后锁定以当时几何快照为准。最小恢复0.10s。伤害/架势沿用当前武器；不改EC01HP/移速。自动验证与用户手感验收分开。

交付实现完成。全量54文件611核心、类型/构建通过，相关浏览器32项通过，EC04阶段、走位、受击、双体与Shift证据见验证记录。基准及保护约束无变化；只提交任务文件与记录标记段，GitHub main，不同步Gitee。手感验收留待试玩。
