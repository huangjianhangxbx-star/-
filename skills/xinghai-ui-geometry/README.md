# 星骸回廊｜参考图几何描边 UI Skill v0.2

**这是可以实际运行的离线代码与技能说明，不是 Photoshop 插件，也不是已注册到 ChatGPT/Codex 的在线技能。** 由当前聊天直接生成，未修改 GitHub、Photoshop 或本地游戏工程。

## 本版新增

- 参考图裁剪、像素颜色、基本形状分析；每个报告记来源 SHA256、明确的候选依据和待确认项。
- 根据分析生成 **3–5 个确定性变体**：不随机换色，不改变资产种类。
- 技能槽（方/菱）、圆头像框、矩形血条三类，输出 RGBA PNG、几何参数 JSON。
- 基底和轮廓分层 PNG；血条另外导出可在运行时裁剪的 `fill_full.png`。
- 自动验证、单任务预览单、四类 20 张参考驱动样本及并列对照图。

## 为什么仍称“半自动”

图像取样可自动执行，但单独的 Python 脚本无法理解任意复杂截图的艺术含义。复杂截图需要人或具备视觉能力的模型明确指出目标区域、种类与应保留的形状。未找到可信对象时，**不应虚构可用结果**。

## 安装运行

需要 Python 3.10+，Pillow 与 NumPy；可选 OpenCV 辅助检出局部连通区域。依赖见 `requirements.txt`。

在此目录下运行：

```bash
python -m pip install -r requirements.txt
python -m pytest tests -q
```

建议未来在项目专门虚拟环境中运行，不使用系统级强制安装；以上是使用说明，并不代表在用户电脑执行过安装命令。

## 你给参考图，一条命令得到五个版本

```bash
python scripts/run_pipeline.py --input "D:/refs/my-ui.png" --kind skill_slot --shape square --crop "10,10,180,180" --accent "#8C8580" --count 5 --out "D:/output/ui-skill-001"
```

若参考图是纯粹的单行血条，可试自动类型和颜色提取：

```bash
python scripts/run_pipeline.py --input "D:/refs/hp-bar.png" --out "D:/output/ui-hp-001"
```

支持的 `--kind`: `auto`, `skill_slot`, `portrait_frame`, `health_bar`。

`--shape` 可选 `auto`, `square`, `diamond`, `circle`, `rectangle`。AI/用户已经看清形状时最好明确填写。`--accent` 是用户选择的纯色，未指定则用候选像素色，**候选不一定正确**。

当输出目录已有内容时工具默认拒绝覆盖；请新建输出目录。参考图永不修改。

## 输出与游戏使用

- 单目录包含 `reference-analysis.json`, `review-sheet.png`, `validation.json` 和 `variants/`。
- 各 `variants/vNN/` 包含 `preview.png`, `base.png`, `frame.png`, `metadata.json`。
- 血条额外包含 `fill_full.png`, `fill_76pct.png`；后一名称为历史兼容，实际演示百分比存储在 `metadata.json`，不要从文件名推断实际比例。
- 运行时血条应该按比例**裁剪 fill_full.png** 而不是拉伸整张预览；portrait frame 透明中心可单独与角色肖像叠加。

## 随包测试数据与可复现边界

`samples/` 记录四类资产各 5 张变体；`reports/` 记录参考观察 JSON 和自动验证。样本来源于这次聊天已经提供的参考图，但**不包含用户上传的原始参考图副本**。已有分析 JSON 可用于重绘，但无法代替未来对新图的视觉观察。

`contacts/v0.2-all-20-variants.png` 为本次整合预览。

此阶段未运行本机 Photoshop CC 2018、未输出 PSD、未接入游戏 UI 实际布局，也尚未获得用户对 20 张样本的美术验收。详见 `docs/HANDOFF.md`。
