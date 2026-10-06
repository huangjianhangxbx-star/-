# T-033 / XC06收口–XC07 v0.3

基准 main@70823a2。用户批准实施 v0.3，并允许提交推送 GitHub main；禁止 Gitee、保护区和人工原稿修改。最新两轮对话通过 read_thread 读取，内容与附件一致。基础细则 v2.1、AGENTS 与 T029–T032 控制/订单契约沿用；无子级 AGENTS。game 初始干净，既有修改及证据快照位于 work/T033。

采用已批准的架构设计，使用 brainstorming、writing-plans、test-driven-development；术语收口使用 domain-modeling。没有关键歧义，不触发 grill-with-docs。执行计划技能建议的子流程不可用时在本任务内按 TDD 执行，不虚构技能调用。

## 实施与验收

- [x] RED：真实 engine 的单次/续段/恢复/缓冲/挥空/控制身份测试；防御资格、走位、机动资源和订单保留测试。
- [x] basic-chain.ts：每角色 Profile + 单条请求；下一合法时间与过期时间独立于重复点击；共用 attackPending/Release。engine 新增 basic Command，自动入口按当前身份专门授权。
- [x] main.ts：唯一 pointerup 请求；Modal/Aim/交互优先，拖拽不攻击；同输入 Promote，旧 WASD 锁存，失焦/暂停清缓冲。
- [x] defense-query.ts + command-defense.ts：查询/提交分离，复用 AI 可见危险、反应、Threat/安全路径；CommandFocus 逐角色资格；真实机动、短路径所有权和 Order 防御暂停。
- [x] 生命周期：身份/Aim/失效/高优先玩家动作清未消费请求；防御退出只撤自己的路线，原子动作完成，订单从新位置继续。
- [x] 核心、真实浏览器 A–P/D01–D20 相关夹具、既有回归、tsc/build；证据注明固定夹具与人工手感边界。
- [x] 更新任务契约/验证、六个共享工程记录；保护检查、限定暂存并推 GitHub main。

实现和自动化验收完成，2026-10-07 收尾并按授权提交推送 GitHub main。参数是首轮候选；不做 XC08 完整软锁定、动画/正式 SkillAim UI，不改变 Auto 技能或 Tower 规则。

验证：69 核心文件/1037 测试，T033 新增39；T029–T033 67 个唯一页面用例有通过证据，新7项最终同次通过；类型/构建通过。详见 T-033-验证记录.md。保护区及旧差异通过快照校验；未做人工最终手感验收。

<!-- T-034:start -->
## 后续 XC09

本记录原结论保留。技能双模式与普攻展示收口见 [T034 任务](T-034-XC09-双模式技能指令与瞄准框架.md) 和 [验证记录](T-034-验证记录.md)。XC08 人工手感仍独立验收。
<!-- T-034:end -->
