# 迭代预览与新增动画执行计划

用户本轮明确流程：自动采样映射 → 尽可能输出身体动作预览 → 修改映射/局部修正 → 刷新 → 满意后确认迁移 → Spine 内继续编辑。新增动画是默认；不要求全骨架匹配，不把衣服/头发/deform 等未处理内容作为预览和确认的前置门槛。沿用用户已选“工坊自动准备，在 Spine 确认动画导入”的保存边界。本轮直接执行已指定工作流。

## 1. 独立草稿计算（并行任务 draft_engine）

新文件 src/transfer/spine-draft.ts、tests/spine-draft.test.ts；严格检查器 spine-timelines.ts 保持可用于诊断。接口 createSpineDraft(source,target,action,mappings,corrections=[],policies=[],range?,skins?,targetDrawOrderKeys?,scope='body') → {animation,report,omitted,copied,disabledIk,scope}。

先运行失败测试：身体骨有键而衣服无映射时 animation.bones 仍有身体键；两个来源抢同一目标时冲突键不写入，但无冲突骨仍输出；FK 主导时只在新增动画中关闭相关目标 IK；空映射可预览空动画且 copied=0；修改映射重算的 JSON 跟随目标变化。保留原始文档，真正不支持的裁切与损坏输入仍报错。

运行 node --import tsx --test tests/spine-draft.test.ts 与 npm run typecheck 后使用真实角色 atk1 检查 runtime 可读性。

## 2. 界面迭代状态与输出（主任务）

修改 src/ui/spine-app.ts、spine.html、spine-report.ts；增加草稿状态测试与报告测试。默认“身体骨骼优先”，可切到“全部已映射通道”。重新载入两侧并完成自动分析后生成草稿；映射、修正、策略变化会防抖刷新，也能手动点刷新；自动刷新可关闭。显示旧预览的过期标识，刷新前禁用确认，异步旧结果不得覆盖新配置。时间轴仍控制两侧同一时间。

生成入口使用 createSpineDraft；把未映射/不兼容项作为略过报告，保留原因。UI 显示 copied/omitted，不把部分草稿标记成完整兼容。默认收起其余骨骼候选，现有身体映射可编辑、定位、跳过。确认前不创建磁盘文件；已有预览可确认，无需先选输出文件夹，确认时再选保存位置。

新增动画默认调用 appendDirectAnimation，每次预览以原目标快照重建同一个工作草稿，反复刷新不会增加多条动画；非空同名动画不被覆盖。对于用户预先创建的空动画，检查官方导入语义后决定是否明确支持选择该占位，否则仍自动创建新动画并说明最后在 Spine 的目的动画选择。

报告测试示例：草稿有 unmapped 时 formatSpineReportText(report,context) 包含“草稿”和“未迁移”，不显示“迁移已阻止”。新增预览状态测试验证过期草稿不能确认、最新结果可确认、下次刷新复用同一动画名。

## 3. 保存与原生校验

native_workflow_audit 只读检查官方动画导入/空动画碰撞行为；必要最小修改交由主任务。保留完整目标工程，不将临时单动画载体作为最终作品。产物导回后严格比较除指定新增动画外的原有数据；原生保存接口无法直接写入时仍提示用户在 Spine 确认动画导入。

## 4. 真流程、打包与交接

扩展 desktop/spine-flow-smoke.cjs 的草稿流程：无配置 rhiny/rozeul atk1 自动预览、编辑映射后自动刷新、同名复用、确认前不输出、确认准备原生项目。核对原工程哈希及旧动画不变，官方 runtime 读取候选并抽样主要骨的运动。运行 npm test / npm run typecheck / npm run build，打包 0.2.4，在最终 EXE 隐藏窗口复测。更新 README、交接和项目日志，核对 GitHub 基线后选择性提交推送，不同步 Gitee。

完成：草稿引擎、迭代 UI、空动画目的地、报告、无操作保护、最终EXE与官方原生回读均完成；结果及仍需人工导入/调动作的边界见 iterative-draft-handoff.md。
