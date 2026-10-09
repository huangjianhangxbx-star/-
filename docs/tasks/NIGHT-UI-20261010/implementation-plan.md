# 夜间连续实施计划（2026-10-10）

采用 writing-plans；用户已批准分阶段范围并要求不中途询问普通细节，本会话顺序执行。executing-plans 不在真实可用技能目录，不宣称调用；使用本次授权的顺序检查点。技术栈 Three.js / TypeScript / Vitest / Playwright / Pillow。

目标：生成UI并接真实HUD、核对攻击合法性和伙伴战术、收口普通持续探索。输入为夜间包v0.1（12文件SHA256全部通过），最新用户三被动决定覆盖包中的五槽。

- [x] P1 UI-01A：只读PPT/PNG、真实Skill测试和四家族各3变体、选型/两档拼装；独立提交。
- [x] P2 UI-01B：先 browser RED 固定角色位置/3预留/真实资源/当前E/血条；精选资源复制 game/public/assets/ui/geometry，修改 exploration-hud.ts + scoped CSS，不改动作时点；GREEN、全core/双构建、自然多档UI/GFZ/失焦，独立提交。
- [x] P3 CB-03：读取 spatial/attack-area/角色实际消费者，先测试正反跨层/阻挡；只修失败权威，禁止高地特权与普遍强制LOS，必要夹具及NR延迟清理；验证与提交。
- [x] P4 AI-01：读取 party-tactics/companion-combat，测试集合绕障/主控移动/目标失效/让权；已有符合则不生产改动，断点最小修复；新HUD显示实际执行态；验证与提交。
- [x] P5 QST-01A：先真实入口与会话流测试RED；改 economy-ui/必要HUD/README，同页世界不结算不治疗、重置二次确认、开发资源折叠；自然出口/继续/篝火/各敌群 + 三档布局 + 最终全量；提交后停止用户Gate。

保护：原始资料、用户维护/开发细则、角色黄金与ActionLab时间线、历史未提交/ignored资产；单一写入者。每阶段 selective commit GitHub/main，远端核对，不Gitee/强推/关机。新成长、Y回血、日历事件、农业、NPC/任务/奖励及第二地图不实施。所有错误保存原始日志，修复后重测，不把技术通过写成人工认可。
