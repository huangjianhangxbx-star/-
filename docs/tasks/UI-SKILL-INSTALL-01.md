# UI-SKILL-INSTALL-01：几何 UI 技能安装与项目归档

2026-10-10。用户明确要求安装本机 Skill，并作为项目资源上传 GitHub，可单独建立技能文件夹。基准 GitHub/main 与本地 main 为 `0a475ba90710a185f09ee30867bda37a20154d8a`。

## 安装与范围

- 原包：`xinghai_ui_geometry_skill_v0.2.zip`；SHA256 为 `9514e8aa184566a0225de9dc581996591ca205b84477332709dde3be97ff080d`。
- 本机技能：`C:/Users/Administrator/.codex/skills/xinghai-ui-geometry/`。
- 项目资源：[skills/xinghai-ui-geometry](../../skills/xinghai-ui-geometry/SKILL.md)，包内 171 个文件按原始字节保留，170 个清单校验全部通过；另提供 [项目安装说明](../../skills/README.md)。用户另附 README 与包内版本一致。
- 隔离运行环境：`C:/Users/Administrator/.codex/skill-runtimes/xinghai-ui-geometry-v0.2/`，复用已有 Pillow/NumPy，pytest/OpenCV 安装在该环境中，未全局安装。
- 实际使用 `skill-installer`，读取目标 SKILL、README、依赖、入口脚本及测试。GitHub 安装脚本只支持仓库来源，本次本地 ZIP 使用经路径/清单校验的直接安装。

本次安装与资源归档不改游戏代码、当前 HUD、玩法、人工原稿或开发细则，不把随包 20 个示例视为用户已批准的美术成品。源码自带的“尚未安装/未修改仓库”是包生成时的历史说明，保留原文，当前事实由本记录区分。

## 本机验证

首轮无 OpenCV：10 项通过、2 项失败，失败为方形／菱形自动识别。虽然原包将 OpenCV 标为可选，这两个测试确实需要连通区域候选。补充 `opencv-python-headless` 到隔离环境后，12 项全部通过；没有修改脚本或降低断言。

一键 CLI 以随包几何样本作为安装冒烟输入，在独立工作目录实际生成 3 个方框变体、独立图层、预览单和通过的验证报告。该输入是生成样本，不是原始研究截图，不作为新增美术研究证据。

技能目录名及 YAML 的 name/description 正确，本机代码入口可运行。当前回合的可用技能列表尚未刷新，下一轮自动发现需由客户端加载；没有声称已在当前列表观察到新技能。

原样副本与校验信息、依赖版本、失败及通过日志、CLI 报告见 [验证目录](UI-SKILL-INSTALL-01/validation/install.json)。本轮仅做技能资源及必要工程记录的选择性提交，GitHub/main 正常推送，不同步 Gitee。
