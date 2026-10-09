# EN04—EN06 连续实施计划与接手检查

基准：main@8a5a396（GitHub一致），较附件204eb747仅增加独立2D工具提交，游戏代码无差异。用户批准附件v0.1执行及推荐参数；只推GitHub main。当前未提交工具/研究/旧验证改动独立保护，不改人工维护区、开发细则、原二进制。

架构：沿主World/Clock/HP，在 `enemy-posture.ts` 适配具名V2入口的接触、归零与恢复；原Legacy与EN01夹具保持旧架势。群体共用原注册、导航和实体生命周期，用身体扫掠避免重叠；无全局攻击排队。EN06补自然双人剧本、读招和同机资源测量。

批准输入：EN04-EN06附件§2.3；用户“参数使用推荐即可”。最新设计聊天读最近3轮，用户提到套间停顿短，助手回复仅内容引用无法取正文。该问题单列后续，不修改黄金；现 `basic-runtime.ts` 终段已有 .5模拟秒门。此前用户认可仅玩家黄金，未认可新增怪物或架势。

Skill：brainstorming用于批准设计范围核对（本轮为已批准连续架构实施，不重复审批）；writing-plans细化以下阶段；test-driven-development与writing-good-tests执行先失败再实现。未调用不存在的executing-plans；没有必要的参数歧义，不启动grill会话。专项依据：EN00架势提案/Legacy边界、EN01/02/03合同及黄金AR05-G01/AR06。附录状态表逐阶段填写。

## C1：EN04

- [x] 添加 `game/tests/en04-posture.test.ts`：真实resolveHit削1到0同次stagger；block半损/背面/无敌/重复控制/DOT/按实际动作恢复/TraceOFF/取消与第三箭。先运行失败。
- [x] 新建 `game/src/core/enemy-posture.ts`，修改types/engine与pressure灰血接缝；用主动作读来源，guard副手半速，Al shot主手。新模式由创建世界冻结，不做运行中切换。
- [x] 对应新接口 `applyEnemyPosture(s,u,amount,blocked)` / `tickEnemyPosture(s,u,dt)`，不扣HP、不分配Action/Attack ID。engine每有效接触仅调用一次；死亡优先，身体取消保持已提交独立危险。
- [x] 定向EN01～04、类型/主/Lab构建，自然单/双敌页面验证，冻结并提交。

## C2：EN05

- [x] `game/tests/en05-group.test.ts` 先验证3/4/5唯一实例、移动/Dash/击退不穿同类、同帧两弓6运输/归属、遇墙重算与域退出。
- [x] `enemy-playtest.ts` 添加three/four/five矩阵；`enemy-motion.ts` 身体扫掠与侧向合法候选；主地形不改。`enemy-decision.ts` 后撤合法身体空间/失效路径重算；保留独立并发AI。
- [x] 入口按钮与URL解析接同一世界Reset；实际模型实例资源逐个验证，六组自然键鼠，20次Reset；冻结提交。

## C3：EN06

- [x] `game/tests/en06-duo.test.ts` 与 `en06.spec.ts`：双角色持续在场、Z/G/MoveOrder、身份取消、动态风险、时钟及20次重置；不得以H召回替代双人验收。
- [x] 视图只展示已知敌风险与真实架势，三箭提示/危险/结束同步；普通Hurt与PostureBroken明确区分。资源加载失败保留显式报错。
- [x] 同机1/2/3/4/5，静态30秒与连续60秒，记录分辨率/DPR/WebGL、Three memory/Spine上下文/实体/Trace/错误；不编FPS/GPU验收目标。
- [x] 一次完整受影响逻辑回归＋分段浏览器与黄金/Legacy，备份恢复旧生成证据。逐项natural/fixture/static/historical、自动通过/用户待试分开。交付最新可用试玩链接、冻结合同和差异，提交推送，不关机。


C3 EN06技术收口：109文件1445通过/2既有跳过，类型/主/Lab构建通过；6个新场自然剧本+2当前角色兼容分段通过，旧选取浏览器13/14（伙伴旧spine字段失败保留）。1—5怪每组30/60墙秒SwiftShader测量通过、无请求失败；20Reset稳态计数与CPU短采样独立记录。玩家黄金不调，新增怪群/声音主观认可待用户，原动态OBS实际结果空白。768历史生成证据已按原字节恢复，发布仅GitHub main。文档及冻结包入口docs/tasks/EN-06/EN06-handoff.md。
