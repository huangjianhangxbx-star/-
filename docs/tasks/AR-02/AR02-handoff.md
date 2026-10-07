# AR02 交接 / 冻结入口

本轮实现战斗身份与事件旁路。主游戏真实接受、出手、结算语义明确；原权威仍是现有Basic/SkillRun/SkillEcho/resolveHit。玩家手感、角色参数、输入及T035/T036保留。未启动AR03/EC11/角色化Basic/新资源或装备成长消费者。AL01–04/F01冻结资料继续有效，F01最终用户体验仍PENDING USER ACCEPTANCE，原作实际OBS结果无证据保持空白。

阅读顺序：[契约](AR02-contract.md) → [路径覆盖](AR02-path-coverage.md) → [技能覆盖](AR02-skill-coverage.md) → [验证](AR02-validation.md)。本轮提交由本目录Git历史定位；AR02-verification.json冻结源码/测试/证据哈希，不自引用发布commit。

只读证据API：`combatTraceSnapshot(s)`。从最近512条记录读取actor/request source/slot/skill、action/root/parent、attackEvent/wave/entity及分开的HP/posture结果；记录被截断后不能保证还有最早根记录。不存在Gameplay消费者或能改HP/推进时钟的新增Debug入口。来源和生命周期覆盖有限，legacy/unattributed边界不得改写成全部迁移完成。

行为比较：旧主干pre-bridge fixture + trace on/off完整状态投影，仅排除新观察元数据。初始poison夹具职业错误保留为历史输入；另从main@62a0dc8原始源码隔离运行正确guard夹具，未拿新源码覆盖旧基线。所有缺陷/重试详见验证，不把中断/失败批次写全绿。

工程保护：不改开发细则/用户维护区；已有工作树内容按接手指纹核对。旧测试自动写入的历史证据用完全匹配接手哈希的备份恢复，本轮生成证据另存。共享工程记录索引仅HEAD+AR02追加块。只提交推送GitHub main，不同步Gitee。

停止点：AR02收口，不自动执行下一阶段。未来消费者如需接入，应另立明确契约和批准范围，尤其不要合并普通伤害去重、成长首次门、扣费节点、施法者身份与取消清理。
