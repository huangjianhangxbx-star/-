# AR03 交接

角色化共享 Definition 与单实例 BasicActionRuntime 已接入 Standalone 己方，所有正式职业仍用 legacy 两段。当前试玩仍用主入口；Action Lab 独立页面保持冻结，不迁素材或实验技能。

- [契约](AR03-basic-contract.md)
- [权威表](AR03-authority-table.md)
- [零手感等价](AR03-equivalence.md)
- [验证](AR03-validation.md)
- [任务记录](../AR-03-角色化BasicRuntime.md)

源入口为 game/src/core/basic-definition.ts、basic-runtime.ts、basic-chain.ts 和 engine.ts 的 advanceBasicAction / releasePendingAttack。取消接入 personal/evasion/skill/loadout/AI/party/节点路径，未建立 Player/AI/Order 三套动作控制器。

发布授权只适用于 GitHub main；不推 Gitee。当前冻结版本从本任务文档的 Git 提交定位，基准是 5cb9e488。验收 manifest 包含必要文件 hash、消费者比对和日志，浏览器只读 trace 见 browser-trace.json。

本轮停止 AR03，不自动启动 EC11、AR04 或未来正式角色招式。建议由用户先决定哪个角色的段数/节点/动作资格，再替换批准的映射；新资源/取消窗口/表现不是这轮自动批准内容。原作实际结果留空，不能从这些技术测试倒推原作还原或消费者 OBS 闭合。
