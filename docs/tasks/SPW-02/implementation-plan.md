# SPW-02 Spine 到 Spine 映射与动画迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有桌面工坊中完成一对真实角色、一个对应方向、两条动作共用映射的 Spine→Spine 迁移，并将结果导回目标原工程副本验证可编辑。

**Architecture:** 保留现有 GLB 投影与采样路径。新增独立的 Spine 来源、类型化对象映射、原生时间线迁移和 Spine 模式页面；候选动画对象只生成一次，目标预览与完整 JSON 输出共用它。角色映射、动作修正、每通道决定和资源身份分别建模。

**Tech Stack:** Electron 44.5.1、TypeScript 7.0.2、`@esotericsoftware/spine-webgl` 4.3.13、Spine 编辑器 4.3.26、Node 内置测试。

**Spec:** `E:\迅雷下载\SPW-02 星骸 Spine 动画工坊 Spine 到 Spine 映射与动画迁移执行计划 v1.0.md`；聊天“规划Spine动画工坊”中 2026-10-24/25 的 Spine→Spine 主线决定。

## Global Constraints

- 只在 `Origin/work/SPW-02/checkout` 的 `local/spw02` 工作树修改跟踪文件；用户原素材只读，证明素材放被 Git 忽略的 `work/SPW-02/`。
- 默认 Spine→Spine，保留原 GLB 入口和 v1 配置；目标原 `.spine` 始终通过工作副本导入，不能以重建 JSON 工程取代。
- 输入和输出均为 Spine 4.3；旧版来源只通过本机官方编辑器导出工作用 4.3 数据，绝不直接改版本字段。
- 迁移只改结构化动画引用；保留目标已有骨架、skin、附件、约束、旧动画和曲线；不静默丢弃关键通道。
- 编辑器操作集中在原生对照与最终导回；完成必要测试、类型检查、构建及便携包真实启动后选择性提交 GitHub main，不推 Gitee。

## File map and ownership

| File | Responsibility |
| --- | --- |
| `src/core/spine-contracts.ts` | v2 来源/目标身份、类型化映射、动作 job、报告及状态类型，不改 GLB v1 类型语义 |
| `src/source/spine-source.ts` | 读取 4.3 JSON 的动画、skin、方向、实际打键依赖与骨架指纹 |
| `src/transfer/spine-suggestions.ts` | 唯一同名候选及左右/类型/父链核对，不自动选歧义项 |
| `src/transfer/spine-timelines.ts` | 结构化改写、曲线/时间保留、必要校准与裁切、冲突及通道报告 |
| `src/output/spine43-direct.ts` | 将完整迁移动画以唯一新名追加到目标 JSON 副本 |
| `src/config/spine-config.ts` | v2 配置校验与 v1 类型分流；角色映射和动作 job 分开 |
| `src/preview/spine43-preview.ts` | 复用官方 runtime 对来源和目标候选的独立、可重复时点求值 |
| `src/ui/spine-app.ts`、`src/ui/spine.html` | Spine 默认流程、双预览、映射/修正/报告、状态失效 |
| `desktop/main.cjs`、`desktop/preload.cjs`、`desktop/package-store.cjs` | 完整 Spine 来源 IPC、输入保护、带报告的唯一目录输出 |
| `scripts/build.mjs`、`scripts/package-portable.mjs` | 同时构建/打包 Spine 默认页和原 GLB 页 |
| `docs/tasks/SPW-02/` | intake、implementation-plan、validation、handoff |

## Task 0: M0 真实素材和原生基线

**Files:** `docs/tasks/SPW-02/intake.md`；忽略目录 `work/SPW-02/asset-audit/`。

- [ ] **Step 1:** 对现有 4.3.26 工程导出真实来源与目标；记录原 `.spine`、JSON、atlas 和全部页面的 SHA-256、skin、方向、两条实际动作、时长与控制链。优先核对 rhiny→rozeul；若朝向或绑定不相容，回查 xl→rozeul。不得用同一角色复制冒充第二角色。
- [ ] **Step 2:** 在目标原工程副本用 Spine `Import Project → Animation` 导入来源动作，记录同名对象成功部分、缺失警告和姿态差异。若 4.3.26 CLI 仍无动画导入参数，GUI 集中完成此步与 Task 5。
- [ ] **Step 3:** 列出选中两条动画的所有实际通道，按关键运动、必要显示、装饰和不支持分类；选定一个可复现的来源/目标方向与手臂权威驱动入口。

## Task 1: v2 配置、来源读取与身份

**Files:** `src/core/spine-contracts.ts`、`src/source/spine-source.ts`、`src/config/spine-config.ts`、`tests/spine-source.test.ts`、`tests/spine-config.test.ts`。

**Interfaces:** `readSpineSource(jsonText, resources)` returns `{summary, document, animationDependencies}`；`validateSpineConfig(value)` returns a v2 typed configuration；`readWorkshopConfig(value)` selects v1 or v2 by `schemaVersion` and `sourceKind`.

- [ ] **Step 1: Write failing tests.** Use actual exported JSON in ignored integration tests where present and a small checked-in fixture for shape validation. Assert source animation names/durations, duplicate or malformed input rejection, stable skeleton fingerprint when only animation list changes, and v1 config loading unchanged.
- [ ] **Step 2: Run RED.** `node --import tsx --test tests/spine-source.test.ts tests/spine-config.test.ts` must fail for missing implementation or asserted behavior.
- [ ] **Step 3: Implement minimal reader/validator.** Fingerprint the ordered bone hierarchy, setup transforms, slots, constraints and skin attachment structure; keep whole-file hash separately. v2 config holds `sourceDirection`, `targetDirection`, typed `objectMappings`, `calibration`, `animationJobs`, and `channelPolicies`.
- [ ] **Step 4: Run GREEN.** Run the targeted tests plus `pnpm run typecheck`.

## Task 2: Typed mapping and compatibility report

**Files:** `src/transfer/spine-suggestions.ts`、`tests/spine-suggestions.test.ts`。

**Interfaces:** `suggestSpineMappings(source, target, animationName)` returns candidates without committing ambiguous matches；`analyzeSpineMapping(source, target, animation, mappings, policies)` returns per-channel status `direct | corrected | explicit-skip | unmapped | unsupported | conflict` and reason.

- [ ] **Step 1: Write failing tests.** Assert unique exact names are suggestions; case/prefix collisions remain pending; left/right, bone/slot/constraint types never auto-cross; duplicate target property is a conflict; actually keyed missing controls are reported even when unkeyed skeleton objects differ.
- [ ] **Step 2: Run RED.** `node --import tsx --test tests/spine-suggestions.test.ts`.
- [ ] **Step 3: Implement minimal mapping scan.** Check mapped parent/axis/setup/inherit/negative scale and IK/transform driver relationship. One chain has one authoritative driver; keying both covered FK and active IK without explicit policy is a conflict.
- [ ] **Step 4: Run GREEN.** Targeted tests and typecheck.

## Task 3: Native timeline migration and output

**Files:** `src/transfer/spine-timelines.ts`、`src/output/spine43-direct.ts`、`tests/spine-timelines.test.ts`、`tests/spine43-direct.test.ts`。

**Interfaces:** `migrateSpineAnimation(sourceDocument, targetDocument, sourceAnimationName, mappings, correction, policies)` returns `{animation, report}`；`appendDirectAnimation(targetDocument, animation, requestedName)` returns `{jsonText, name}` without mutating input.

- [ ] **Step 1: Write failing tests.** Assert mapped rotate/translate/scale/shear/IK/transform key arrays retain exact key times, winding and `curve` when no numeric change; mapped numeric corrections update Bézier Y controls; unknown/critical channels never disappear silently; slot attachment requires an existing target attachment; draw order requires compatible slot order; events require explicit target event; duplicate destination property fails. Assert two output names never overwrite existing animations or each other.
- [ ] **Step 2: Run RED.** `node --import tsx --test tests/spine-timelines.test.ts tests/spine43-direct.test.ts`.
- [ ] **Step 3: Implement minimal structural copier.** Traverse every top-level and nested 4.3 animation channel. Preserve complete keys for direct mappings, apply limited local corrections in the documented coordinate space, and emit one report entry per copied/skipped/blocked channel. Preserve target JSON outside `animations[newName]` by deep comparison.
- [ ] **Step 4: Add crop tests before code.** For nonzero start/end assert boundary pose, stepped attachment state, Bezier midpoint and rotation winding; implement only after RED. If a channel cannot be cropped exactly, block that job with a specific report rather than output an incorrect result.
- [ ] **Step 5: Run GREEN.** Targeted tests, runtime evaluation of source/target candidate at 0, midpoint, extreme and end, and typecheck.

## Task 4: Desktop Spine mode and state protection

**Files:** `src/ui/spine-app.ts`、`src/ui/spine.html`、`src/ui/index.html`、`src/preview/spine43-preview.ts`、`desktop/main.cjs`、`desktop/preload.cjs`、`desktop/package-store.cjs`、`scripts/build.mjs`、state/IPC tests and hidden Electron smoke.

**Interfaces:** `openSpineSource()` returns a resource ID with matching JSON/atlas/pages；both pages call the existing protected output IPC；Spine page generates one candidate JSON then previews and saves that exact text.

- [ ] **Step 1: Write failing UI/IPC state tests.** Loading a bad source, changing source/target/skin/direction/animation/mapping/range mid-generate, and selecting a new target immediately invalidate old output. Config save/output cannot overwrite any loaded `.spine`, JSON, atlas or page. Old v1 GLB route still opens.
- [ ] **Step 2: Run RED.** Targeted state tests and hidden Electron smoke must fail on the absent Spine route or guard.
- [ ] **Step 3: Implement minimal UI.** Make Spine mode the startup page, with a link to existing GLB page. Reuse shared stylesheet, dual preview and time controls; hide all 3D axes, camera yaw/pitch and in-place policy in Spine mode. Show typed mapping status, explicit skips, correction and output report; do not show “complete” when a key dependency is blocked.
- [ ] **Step 4: Run GREEN.** Targeted tests, old GLB smoke, `pnpm run typecheck`, `pnpm run build`, and new normal Spine flow smoke.

## Task 5: Two real actions and Spine editor roundtrip

**Files:** ignored `work/SPW-02/proofs/`；`docs/tasks/SPW-02/validation.md`。

- [ ] **Step 1:** Generate first full real action with mapped main body and actual arm drive. Confirm source pose is repeatable at the same seek time and the target candidate changes shoulder/elbow/wrist in the expected chain; audit every unmapped channel and its visual effect.
- [ ] **Step 2:** Save character mapping; close the packaged app, reopen, load the same mapping and a different second action; verify no whole-skeleton remapping and keep corrections scoped to their job. Output two unique complete JSON folders and migration reports.
- [ ] **Step 3:** Import both candidates through temporary projects into one copy of target original `.spine`; save and reopen. In an independent copy modify a visible key, save, reopen and CLI re-export. Compare candidate and editor roundtrip at representative times and deep-compare all target preexisting data.
- [ ] **Step 4:** Record explicit `通过 / 部分通过 / 阻塞 / 待用户视觉审阅` results. Do not substitute synthetic fixtures or a playable JSON for an unmet real-editor criterion.

## Task 6: Package, handoff and GitHub delivery

**Files:** `README.md`、`packaging.md`、`scripts/package-portable.mjs`、`docs/tasks/SPW-02/handoff.md`、`记录/项目状态.md`、`记录/2026-10-25.md`。

- [ ] **Step 1:** Update the Chinese workflow, real asset limits and GLB fallback. Package a new Windows portable folder on E:, ensure every built page and desktop helper is included, and launch the final EXE for the shortest real Spine flow.
- [ ] **Step 2:** Run affected tests, full tool tests, typecheck, build, packaged smoke and `git diff --check`; rehash original source/target files.
- [ ] **Step 3:** Selectively stage only SPW-02 tool/docs/status files. If remote `github/main` still matches the base (or a reviewed fast-forward integration succeeds), commit and push GitHub main without force; leave Gitee untouched. Record delivered paths and limits.
