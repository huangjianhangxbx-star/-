# AR-01 Action Lab 主战斗吸收评审

**Goal:** 基于真实主战斗与AL01–AL04冻结成果，完成语义吸收矩阵、目标架构和唯一下一实施任务；本轮不改战斗实现。

**Architecture:** 保留T035实控权威与T036策略层；审计现有动作、技能、命中和派生通道，优先扩展既有执行路径。所有未来接口只作为迁移建议，不声称已实现。

**Tech Stack:** TypeScript、Three.js、Vitest、Playwright；本轮交付Markdown及文本证据。

**Spec:** `E:/迅雷下载/星骸回廊_AR01_ActionLab主战斗吸收评审与迁移蓝图_v0.1.md`。已实际读取设计对话最新2轮，非全文扫描。

## 接手与范围

本地与GitHub main均为dfe16b4a82adc627df75d69c44b319e7bd4cdc5b。暂存区为空，5402个既有修改/未跟踪文件已记录指纹；game/src没有未提交修改。开发细则v2.1、AGENTS、现行T035/T036专项契约已核对；历史双焦点控制不得重新激活。没有影响本轮只读评审的冲突。

实际使用writing-plans组织交付、codebase-design检查接口位置；本轮不实施行为，不调用TDD制造文档镜像测试。仅在关键缺口需要用户选择时使用真实grill-with-docs；现有计划已授权继续，不重复确认局部文档结构。技能建议的额外执行流程不能扩张本任务的只读边界。

F01复试玩未登记通过，cadence/枪声/投射反馈/换弹手感保持PENDING USER ACCEPTANCE。加特林运行时未实现，不影响语义评审；不在本轮补做。

## 执行计划

- [x] 核对计划、最新对话、分支/工作树、细则及专项控制契约。
- [x] R1：按实际调用链审计控制、Basic、Skill、Mobility、敌人、伤害、派生和表现。
- [x] R2：读取Lab冻结契约及运行时，将来源、实验验证、用户批准和待定分栏。
- [x] R3–R4：生成采用矩阵与四类差异，标明现有机制和最小新增层。
- [x] R5–R14：生成目标架构、挂接位置、迁移顺序和唯一下一任务AR02候选。
- [x] 运行必要现有验证：420项/24文件通过，现源与既有工作树保护见最终verification。
- [x] 更新本任务及工程记录，精确暂存文档增量；发布至GitHub main，不同步Gitee。

## 交付位置

`docs/tasks/AR-01/`：current-main-flow、lab-semantic-flow、adoption-matrix、gap-analysis、target-combat-architecture、migration-sequence、handoff。保护/验证记录随交接保存，不复制原素材或父研究全文。

状态：complete；只读评审交付完成。发布提交由本任务目录Git历史定位。停止点为AR01文档结果；AR02、EC11、角色重制、正式动作参数与原稿回填均未启动。

结论：保留现控制/输入/技能槽/AI/结算；扩展分散动作身份与执行定义，未来补独立空间攻击；不搬Lab数值或整体世界。attackCommit仅交战上下文、resolveHit true可HP0、猎人blink已异构、shot FX不是独立投射物，均以真实代码修正计划举例。唯一下一建议AR02身份/事件旁路桥，要求行为完全不变。[交接入口](AR-01/AR01-handoff.md)。
