# EN01｜EnemyActionRuntime 最小竖切实施计划（待审核）

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (if subagents are available) or superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

上句为 writing-plans 模板原要求；本机当前没有这两个子技能，不声称已调用。未来执行时重新核真实可用技能，使用现有 writing-plans/TDD 等完成实际流程；不得据模板自动安装或擅自分派。**本计划未执行；EN00 完成交用户审核之后，再确定 EN01 实施。**

**Goal:** 一个 opt-in 受控单敌夹具证明 V2 身体事件→独立攻击实体→主 HP/防御/身份结算，覆盖暂停、慢速、命中停顿、取消、死亡和 Reset。不是僵尸正式替换或远程完整迁移。

**Architecture:** 主 Unit 与模拟时间为权威。独立 EnemyDecision/EnemyActionInstance，使用 AR02 身份语义和现有 `resolveHit`；事件时序来自冻结 Profile，不依赖 Spine 更新频率或 optional trace。身体和已提交实体分开存储、按能力合同清理。无第二个 LabWorld、无旧 Kit 隐形 fallback。

**Tech Stack:** 现有 TypeScript、Vitest、Three.js/Spine 与 Vite；沿用现有测试工具，无新框架/全局 EventBus。

**Baseline:** 审核依据 `main@3eea3ebae1842322ddb3a54542e55603673caa54`，game 与 `5d77f90` 一致；执行前必须重查 HEAD/脏修改。前轮源码和用户黄金认可保持。[EN00 入口](EN-00-参考敌人体系对账与覆盖合同.md)、[动作契约](EN-00/EN00-action-feel-contract.md)、[旧边界](EN-00/EN00-legacy-boundary.md)。

## 范围和交付

只做架构与受控夹具。夹具 profile 明示 `EN01 FIXTURE/SAMPLE`，不是原作敌人；使用现有资源/简洁诊断显示，不能为技术夹具新生产整套美术。不改普通地图 seed、Hunter/Al/xx 动作、输入、黄金资源、盾/翻滚数值，不实现 EN04 架势及自由探索大改。Tower/Legacy 原链路保持。

拟新增最小模块：`game/src/core/enemy-action.ts`（Profile、资格、实例及纯时间线），`enemy-attack-entity.ts`（出生/接触/寿命/世代）；在 `types.ts` 增加局部 V2 数据字段、在 `engine.ts` 接 opt-in 分支和主结算。沿当前主世界空间 helper，不新造地图。名称是计划建议，执行核已有接口后可局部调整；若接口需要大范围重写玩家身份合同则暂停受影响部分。

拟测试：`game/tests/en01-enemy-action.test.ts`、`en01-enemy-entity.test.ts`、`en01-main-integration.test.ts`；文档 `docs/tasks/EN-01/EN01-runtime-contract.md`、`EN01-validation.md`、`EN01-handoff.md`。真实浏览器 opt-in 夹具入口与可见版本说明在本阶段末确定并提供；不能用旧主页伪装新内容。

## Task 1：接手与红测试

- [ ] 读基础细则、本任务引用专项、适用 AGENTS 和真实 TDD；确认本任务实施授权，核源码/未提交修改/Golden SHA/技能。仅任务指定 GitHub 分支，禁止 Gitee。
- [ ] 列 `engine.tick` 旧 reaction、Intent、candidate、probe、fallback 的分支点；确认 opt-in 不进入其中任一旧出招/反应函数。
- [ ] 写最小失败测试：最终资格失败不接受动作；接受后 trace off 仍有稳定 ID；挥空出生 AttackEvent 但不产生 HitOutcome；身体结束不自动删除独立实体。
- [ ] 使用现有 `package.json` 真实命令运行定向 Vitest，确认失败原因是缺能力而非 import/夹具错误，再实现。

## Task 2：身体时间线与身份

- [ ] Profile 含事件数组（prepare/lock/attack/attackReady/moveReady/finish）、相对主模拟时点、取消/死亡策略和 SOURCE/SAMPLE 标注。两个 Ready 独立，即使夹具时间相同也不合成一个总时长开关。
- [ ] FinalReady 只读取公开感知快照、存活/硬直/已有动作/CD/范围/方向；接受时缓存 caster、targetPoint、facing、root 和 generation。移动目标不追踪到命中时改向。
- [ ] 将权威 ID 分配与现有 trace recorder 分离；不依赖 recorder 的返回 undefined。避免多分配序号导致玩家 ID/RNG 漂移，trace on/off 的行为与随机流一致。诊断记录只是观察。
- [ ] 主逻辑推进消费跨过时点的事件恰好一次，同帧保持原事件顺序；finish/取消不可补发已过去事件。Spine 只播姿态和反馈，不直接扣血。
- [ ] 测 ready 门分别开关、同帧事件顺序、大步跨事件、不合格零副作用、取消前后和无法原作闭合字段的显式标注。

## Task 3：独立实体与主命中

- [ ] Spawn 请求保存 parentAction/root/AttackEvent/entity/generation/caster；出生为绝对主时点，未来出生已提交实体与尚未提交身体事件严格区别。
- [ ] 近战夹具进行真实空间/墙/方向接触；纯测试运输夹具证明 bodyfinish 后仍推进与落地生命周期，不做弓手正式图形/AI链。几何与墙策略按夹具合同明确。
- [ ] 接触只通过现有主 `resolveHit`，记录本实体/本目标去重及真实防御结果。正面盾、背面受击、无敌、挥空与 obstacle rejection 分开；不预填命中日志或注入 HP 得出通过。
- [ ] 根动作、子事件、transport 与 landing hazard ID 不混为一个ID；普通去重不按 root 一次清全部，不新增成长或统一扣费策略。
- [ ] 测两玩家同招分别合法接触、同实体同玩家一次、不同波次可再命中、trace off、Z切换施法者不变、权限/暗区/无目标边界。保持现玩家防御数字。

## Task 4：取消、死亡、时间和世代

- [ ] 身体取消只阻止未来身体事件；已提交实体 retain/clear 由夹具策略，死亡无新 Decision。未来 spawn 时点实体亦按“已提交”策略，不误删。
- [ ] Reset/换场清旧代实例、实体、表现与音频订阅；actorId 复用不跨代击中。销毁与释放重复调用幂等。
- [ ] pause、slow、Hitstop 使用当前主 clock；不启动另一条 Lab clock。冻结期间不越过事件、不回放旧音效；恢复后消费一次。
- [ ] 执行反例：发射前 cancel 无实体；发射后 death 保留指定实体；finish 不清实体；Reset 后迟生实体零命中；连续 reset 资源数稳定。

## Task 5：受控主夹具与回归

- [ ] opt-in 入口给一个真实 Unit/Profile，不随机生成新怪库；候选、拒绝、接受、event、实体、hit、cancel、finish 可读诊断，trace off 产品行为相同。
- [ ] 主世界真实障碍和普通键鼠验证，至少录主 clock/事件/HP权威证据，浏览器截图不代替有效命中日志。不得更改位置/HP来冒充自然场景结果。
- [ ] 定向新测试、现有 AR02 身份/主 HP、Hunter G01、Al AR06、Z/T036和受影响 Tower/Legacy 回归；再跑现行类型/构建必需命令。旧 EC10 四项基准失败独立列，不删除。
- [ ] 审查 diff：零旧 Kit fallback、零第二伤害中心、黄金合同无变化、源二进制 ignored、未改用户区/开发细则、普通游戏入口行为不变。
- [ ] 提供带版本的夹具链接、日志/结果/风险和 EN02 前置；更新工程记录，按有效授权提交推送任务增量。停止于 EN01，不能自动继续 EN02。

## 验收与暂停条件

通过：受控单敌主闭环可运行；trace on/off、主时钟、墙/防御/挥空、两 Ready、cancel/death/Reset 实体生命周期均有反例证据；现两角色/历史隔离无回归；所有 SOURCE/SAMPLE 与实际未闭合分列。

若必须改变主黄金角色身份/输入/手感、需要额外原作缺证才能确定语义、需要引入正式新敌人/架势参数或替换地图 seed，暂停相关部分并报告具体原因。局部类型/路径/测试组织可自主实现。没有这些冲突时不要为常规细节重复确认。

EN01 技术通过不等于原怪 AI 还原或双人最终战斗通过；EN02/03 才替换具名两敌，EN04～06 另行计划。此处无实施进度勾选，防止把计划当回报。
