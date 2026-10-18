# NPC-HOME-02 实施计划

Goal：把三项单站活动升级为稳定评分、承诺及多站步骤的三条无产出Goal。
Architecture：原home-resident成员关系、hold/路径身份和engine共享移动资格不变；home-goals纯评分+数据步骤，home-schedule薄适配（原型daytime默认/开发覆盖），home-routine执行器由原home-activity迁移，原模块仅兼容入口转发。坐标只取布局tag。F10状态只读，独立开发相位选择不存档、不强制Goal。
Spec：work/NPC-HOME-02/source/01、02、给Codex；基准a4f89cb与fetch后main一致，game/docs旧未跟踪目录保留。用户要求执行批准的计划，brainstorming按已有详细子系统批准继续；writing-plans/TDD已读。不伪称不可用superpowers子技能。

- [x] G0 阅读接手资料/基础细则，记录外链登录不可读与ZIP/远端基准、保护边界。
- [x] G1 RED验证旧单站定义不足；home-goals数据链+稳定评分，冷却/记忆/上下文/相位/不可用/承诺。仅查可用元数据和物理站位，不在评分阶段逐个寻路。
- [x] G2 RED验证两站以上及step中断；迁移同一执行器至home-routine，原API转发，等价点选择/有界失败、保留stepIndex，履行原路径身份保护。
- [x] G3 复用原租约/旅行/危险/成功组队；布局失效与日相位改变不抢当前承诺，危险长中断或失效可放弃。F10展示前三评分/step/最近六Goal转换，开发相位可切，原型来源明确。
- [x] G4 正式入口三条真实故事A备餐→餐桌、B书柜转座位途中F对话冻结并同step恢复、C后门水点/菜畦至巡视途中组队→外图原战斗；无强制Goal/改坐标伪造自然故事。负例明确夹具。
- [x] G5 独立只读监工四项各2.5，总≥9且无硬失败，最多3轮；相关小集+构建，记录规则/状态/日志/索引，选择性GitHub main，禁止Gitee。

约束：已验收布局不重画，仅补活动语义tag；单101/同一ranger，无第二移动器、产物/经验/好感/需求/睡眠/正式日历/离线/刷新存档/自动返家/解散。用户维护区/开发细则/原媒体不改。完成即停，不扩展NPC-HOME-03。
