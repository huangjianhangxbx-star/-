# AR05-F01 小蓝 Spine 可见性专项

基准 main@7a7774551e089cd91198874dd2cf165d14a21d81；用户已授权执行外部 AR05-F01 v0.1。仅修两端4.1展示遮罩，原模型只读，战斗黄金逻辑不动。原素材及诊断截图仅 ignored work/AR-05/F01。

## 实施计划

- [x] 核对开发细则、AGENTS、当前修改、专项与最近两轮对话；读取 diagnosing-bugs、TDD、writing-plans、motion-design。后者的UI运动建议不覆盖专项黄金不变约束。不存在可调用的 superpowers 子技能，按已授权计划直接实施。
- [x] 实际两端 Slot 遮罩红测试；只读核验16个根下分支、方向 Track 和 transform 约束。
- [x] 同时间 B无方向/过滤、C方向无过滤、D旧过滤、E仅确认根过滤，保存原生画面和 Slot 差分。
- [x] 先看红测试，再以共享纯展示辅助函数最小修两端；不修改黄/3.8/原骨架。
- [x] 回归四段五方向与镜像、特殊动作、两端一致、held/快速转向、暂停/慢速/切人/重建；黄金与旧相关逻辑回归及构建。
- [x] 工程记录独立追加，保护已有修改、原资源字节与核心模块；提交推送GitHub main，停在用户视觉复验。Gitee/AR05-G01/AR06不启动。

测试入口：`npx playwright test tests/ar05-f01.spec.ts`。删除所有非当前根的旧遮罩会让共享/受约束分支的attachment断言和渲染差分变红；期望来自动画apply后的真实attachment，而非强制每个Slot可见。

确证根因与可视矩阵见 AR05-F01-visual-evidence.md；验证与用户停止点见 AR05-F01-validation.md。
