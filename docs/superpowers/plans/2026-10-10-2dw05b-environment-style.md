# 2DW-05B 场景风格接入实施计划

**Goal:** 将获批 M0 总纲与通用/石材规则接入独立 2D 工坊，提供木材实验候选与三份可校验任务 ZIP。

**Architecture:** 现有 projectStyleContract 与 taskStyleDelta 保持；显式 environmentStyle 选择解析成规格内唯一场景快照。注册表只保存可信内置规则，镜像由快照编译；ZIP v4 严格核验新快照与派生文件，旧版本仍走原合同。

**Tech Stack:** TypeScript、Node 24、Electron、fflate、pngjs；沿现有独立锁文件，不依赖 3D 工坊。

**Spec:** [M0 候选与批准修订](../../tasks/2DW-05B-场景风格宪章待确认.md)、本地 2DW05B 执行计划及用户本轮批准消息。用户明确连续实施 M1–M8，采用本会话逐步执行，不再等待执行方式选择。writing-plans 提及的 executing-plans/subagent-driven-development 本机未提供，不冒称调用；当前工具与 TDD 流程完成同等逐步执行。

## 全局约束

- 总纲/通用/石材正式批准；木材 candidate，其他材质只保留身份。
- 明暗预算是主要块面的层级，不是颜色数量；弱整体材质色差允许但不必添加。
- V1 原字节持久保存，记录 SHA/来源/environment 适用范围；不复制其他商店原图。
- 规格硬约束优先，100 PPU 默认、单素材 200 PPU、Alpha、0–8 张图与另存防覆盖保持。
- 旧 1.0/1.1 规格与 ZIP /1–/3 不改解释和黄金包原字节。非场景不加入 environmentStyle。
- 不改 game、3D 工坊、design/开发细则.md、用户维护文件；选择性发布 GitHub main，不推 Gitee。
- B 级工坊模块验证：相关测试、类型/构建、1–2 条真实 Electron 工作流；不运行全游戏回归。

## M1–M3：数据合同、规则库与解析

文件：新增 core/environment-style.ts、core/environment-style-catalog.ts；修改 core/schema.ts、core/compose-preset.ts、core/task.ts；新增 tests/environment-style-2dw05b.test.ts。

接口：`EnvironmentStyleInput {schemaVersion:'2dw-environment-style/1',domain:'environment',materialFamily,repeatable,connected}`；`resolveEnvironmentStyle(input, contract, delta)` 返回 null 或内置规则解析快照，含 approvedRules、candidateRules、failureSignals、conflicts、referenceAnchors。规则保存 id/version/layer/scope/type/status/origin/checkMode/trigger 与必要 inheritedFrom。

- [x] 写失败测试，消费 composePreset；用显式 stone 任务断言 1.2.0、石材规则与主要块面预算，wood 无 stone 且 candidate 隔离。
```ts
const spec = composePreset(selection, { ...values, environmentStyle: {
  schemaVersion:'2dw-environment-style/1', domain:'environment', materialFamily:'wood', repeatable:false, connected:false,
}}, []);
assert.equal(spec.schemaVersion, '1.2.0');
assert.ok(!spec.environmentStyle.approvedRules.some(r => r.id.startsWith('ENV-STONE')));
```
- [x] Node 24 `--test tests/environment-style-2dw05b.test.ts` 观察缺少场景入口的真实失败并保存日志。
- [x] 实现严格选择验证、注册表、条件过滤与快照；未指定 input 不新增旧字段。ENV-COM-04 的暗部停刻与预算规则标记继承来源，渲染时避免重复旧正文。
- [x] 测试空/未知材质、未知版本、未知字段、未选择联通、预算冲突；保持原 getStyleConflicts 的窄范围声明。

## M4：桌面选择与继承概览

文件：desktop/draft-model.ts、desktop/app.ts、desktop/task-session.cjs，测试 tests/environment-draft-2dw05b.test.ts；沿 preload/main 现有受限桥接。

接口：DraftModel `setEnvironmentStyle(input|null)`；复制保留、普通新建清空选择，valuesForBridge 仅在场景选中时传环境字段。主进程 composePreset 接受此纯数据字段，不允许从 renderer 任意读取目录。

- [x] 先测试“改变材质使预览失效、复制独立、普通新建不携带石材”；Node 24 执行观察失败。
- [x] 加入领域/材质/重复联通选项与只读已批准概览、候选/失败信号折叠区；长期规则更新只保存为需审阅的 JSON 草稿，不静默修改内置批准版本。
- [x] 保留当前任务偏移、尺寸、PPU、参考选择与 PNG Ctrl+V；通过现有 PNG 文件选择加入 V1，不新增 Node 文件访问。

## M5：新 ZIP 与稳定编译

文件：core/environment-style.ts 派生镜像、core/workflow.ts、core/render-codex.ts、archive/export-zip.cjs；tests/environment-archive-2dw05b.test.mjs。

- [x] 先写真实导出/重读 v4、镜像/规则审批状态被修改后即使 manifest 重新哈希也拒绝、v3 不能携带场景快照的测试。
- [x] Node 24 执行并记录失败；实现 /4 + 1.2.0 绑定，严格新增镜像白名单与规范化快照比较。
- [x] 用稳定共享 `compileCodexAuthority(spec, workflow)` 构建前半段，去掉标题 slice/replace；旧 workflow 与 contract 输出文本保持原样，新的场景说明只在 v4 附加。
- [x] 新 style 文件为 charter/common/material/failure 的只读视图；spec 是唯一权威，记录候选、来源、适用原因与 V1 身份；不写未来 reports 或目标 PNG。

## M6–M7：样包与验证

文件：resources/style-references/approved-stone-v1.png 与 provenance.json、scripts/make-environment-samples.mjs、scripts/desktop-environment-smoke.mjs、samples/2dw05b/、docs/ENVIRONMENT-STYLE.md 与 VALIDATION-2DW05B.md。

- [x] 复制获准 V1 原字节并核对固定 SHA `41c21aa13228c01f15034d213e2e948d2f032fa4ebd0d8f6c87c17185332b559`；不改图。
- [x] 使用真实 exporter 生成 A 石地砖、B 石墙、C 木箱实验 ZIP，独立解包读 manifest 与 spec，列 approved/candidate/conditional/ref/specSHA/zipSHA；不写目标 PNG。
- [x] 全部工坊模块测试一次，typecheck/build；旧黄金 ZIP 前后哈希核对，不重新生成旧样包。
- [x] Electron 实际选择场景/材质、选择合法参考、查看继承/判错、修改 PPU、导出 ZIP、再独立核验；选择器可避免改变用户剪贴板。已有剪贴板定向自动测试保留。

## M8：收口与选择性发布

- [x] 更新批准/候选状态、迁移表、G01–G30、原型模块测试证据及人工美术待验项。
- [x] 检查定向差异、源码/引用、旧包哈希及保护文件；共享状态只保留本任务块进入暂存。
- [x] GitHub main 远端再次核对，选择性 add/commit/push；无 force，不推 Gitee。远端有并行新提交则核对路径并安全整合，不改其内容。

自审：M1–M8 均有实际路径与消费接口；无图片生成/拼接/Unity 扩展；版本迁移不影响旧任务；人工审美与程序验证分开。三项用户修订均由规则注册表、持久参考与文档直接体现。
