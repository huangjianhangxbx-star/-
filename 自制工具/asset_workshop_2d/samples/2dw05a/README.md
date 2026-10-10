# 2DW-05A 中间大砖局部重绘样本

这份任务包用关联对话中的两张参考图构成：图 2 是待改砖块和周边关系的内容依据；图 1 是用户手工修改后的中间砖画法依据。两张图复制为本目录的原始 PNG，制包脚本先核对其固定 SHA-256，再将原字节打入 ZIP。它们是输入参考，**不是工坊或外部 AI 生成的目标图**。

| 对话图与本地文件 | ZIP 内角色与路径 | 尺寸 | 字节 | 原始 PNG SHA-256 |
| --- | --- | --- | ---: | --- |
| 图 2 [`image2-original-detailed-brick.png`](image2-original-detailed-brick.png) | 内容：`references/content/image2-original.png` | 683×679 | 742,339 | `4d4d760cfdbc233a996d83e2f0e01cbe0f7afab42a01aef0a7b2d3440c3aca29` |
| 图 1 [`image1-hand-edited-middle-brick.png`](image1-hand-edited-middle-brick.png) | 风格：`references/style/image1-hand-edited.png` | 683×679 | 660,674 | `b04d514cc1dc5efe64dd034d1ecffe7ff21aed4f96fe78c02256b54c2264e1ed` |

[`2dw05a-middle-brick-redraw.zip`](2dw05a-middle-brick-redraw.zip) 的 SHA-256 为 `d8aa615fc41b9ea7a5f0a13f581f2b4ea5143b1134a11820f72b58ccc0fd8467`（1,416,830 字节）。现有 ZIP 经归档校验器解包，16 个条目通过 manifest 长度/SHA-256、ZIP CRC 和规格一致性检查；两张包内 PNG 与上表本地源文件逐字节一致。

## 包内任务

`spec/asset-spec.json` 指定任务 `2dw05a-middle-brick-redraw`：只重绘图 2 中间大砖，保留周围石砖、石缝与整体构图，以图 1 中间砖的黑块和简化块面为局部画法依据。未来目标为不透明 PNG `output/asset.png`，画布 683×679 px，Unity 100 PPU，对应 6.83×6.79 世界单位。这是该案例的画布规格，并非全项目 512×512 地块规则。

包内项目契约沿用“星骸回廊手绘块面风格”：暗部/亮部各最多 3 阶，用黑色结构和设计过的块面控制体积、碎纹理及渐变。本次偏移要求中间砖更概括、黑块更明确、层级和裂纹更少；不重绘整张图。项目契约与局部偏移分别写在 `spec/asset-spec.json`，并镜像至 `style/`。两张参考均标为 priority 90，但分属内容和风格角色；优先级不能消除实际视觉冲突。

实际 ZIP 是 `2dw-zip/3`，包括以下条目：

```text
README_开始阅读.md
manifest.json
spec/asset-spec.json
spec/style-profile.md
style/project-style-contract.json
style/project-style-contract.md
style/task-style-delta.md
references/content/image2-original.png
references/style/image1-hand-edited.png
workflow/recipe.json
workflow/analysis-plan.md
workflow/decision-policy.md
workflow/production-plan.md
plan/production-steps.md
prompts/codex.md
validation/checklist.md
```

`workflow/recipe.json` 对内容图和风格图各启用一项待执行分析；后续步骤要求综合事实与推断、处理冲突、制作、验证和交接。`reports/` 中的文件名只是未来预期输出。ZIP 没有已完成的视觉分析、重绘结果或 `output/asset.png`；是否能按图完成美术目标，仍须外部 AI 或人工实际看图、制作和验收。

样包由 [`scripts/make-2dw05a-brick-sample.mjs`](../../scripts/make-2dw05a-brick-sample.mjs) 从这两张固定哈希的 PNG 和当前编译器生成。复现时先在工坊目录运行 `pnpm run build`，再以 `node scripts/make-2dw05a-brick-sample.mjs --output-dir <新的绝对目录>` 导出到空目录；脚本会拒绝来源哈希变化，导出后再次执行 ZIP 合同校验。当前 ZIP 的可核对结果见[本轮验证记录](../../docs/VALIDATION-2DW05A.md)。
