# 表现映射

hunter-shot-01 → Galore/attack_01；hunter-shot-02 → Galore/attack_02。两动画对应采样相同，用户允许沿用；PRESENTATION PENDING：区分第二段与长铳特效。

Runtime 缓存 presentationId 和 acceptedAt，不知道骨架或音效。view/basic-presentation.ts 负责名称映射，SpineVisual 仅允许 Galore 攻击阶段使用已存在 clip。Scene 根据 Runtime 身份识别新动作，避免兼容 pending 镜像每帧重建导致反复重启动画。动画按 state.time - acceptedAt 采样，暂停保持，模拟倍速一致；移动/技能等优先表现仍保留。真实 Release 仍由 Runtime 执行，动画不会触发命中。

未证实枪口/特效消费者，因此保留当前通用 Release FX 与音效，不接技能特效、不制造新资源。短刃动作外观无法证明真实枪口同步；SAMPLE 明确代表逻辑节点，不能声称原作还原。
