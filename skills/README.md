# 项目技能资源

这里保存可复用的技能包源码、说明和随包样本。运行环境及临时输出单独保存，不纳入技能资源。各包内的历史交接说明保留原文；本机安装验证另见项目任务记录。

## xinghai-ui-geometry v0.2

[技能说明](xinghai-ui-geometry/SKILL.md) · [运行说明](xinghai-ui-geometry/README.md) · [20 个随包样本](xinghai-ui-geometry/contacts/v0.2-all-20-variants.png) · [安装验证](../docs/tasks/UI-SKILL-INSTALL-01.md)

用途：根据选定的参考图区域，生成黑底、纯色细边、外部透明的几何 UI。支持方形／菱形技能槽、正圆头像框、横向矩形血条；输出 3–5 个确定性变体、独立 PNG 图层及分析报告。生成结果需要人工美术验收。

## 在另一台电脑安装

将 `xinghai-ui-geometry/` 完整复制到 `$CODEX_HOME/skills/`；没有配置 CODEX_HOME 时，默认是用户目录下的 `.codex/skills/`。目标同名目录存在时应先核对版本，不直接覆盖。下一轮对话加载技能列表后可调用 `xinghai-ui-geometry`。

使用 Python 3.10+ 的独立虚拟环境安装包内 `requirements.txt`。需要自动方形／菱形识别及全部随包测试时，还应安装 `opencv-python-headless`：v0.2 将它标为可选，但两个自动形状测试依赖它。验证命令为 `python -m pytest tests -q`，在技能包目录执行。

生成输出放入新的独立目录。示例：

```powershell
python scripts/run_pipeline.py --input "D:/refs/ui.png" --kind skill_slot --shape square --crop "10,10,180,180" --accent "#7C7777" --count 5 --out "D:/output/ui-001"
```

这次安装和资源归档不代表已经替换游戏 HUD，随包历史样本也不视为用户已批准的成品。
