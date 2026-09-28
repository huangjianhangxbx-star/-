# 项目协作入口

所有项目源码、构建输出、临时文件、测试结果和人工工作记录保存在本目录下。不要覆盖原始参考资料。

本机项目根目录为 `E:\WORLDCREATOR\XingHaiHuiLang\Origin`。`github` 是开发中版本的默认推送远端，`gitee` 只在用户决定更新稳定版时推送。不要把日常开发提交自动推到 Gitee。

## 设计依据
- 用户最新明确决定优先；原始意图以 `计划/口语版设计.txt` 为主。
- `计划/从零搭建 Three.js 塔防战棋可验证原型计划.txt` 已于 2026-09-27 更新并完整读取（32519 字节、21 节）；作为技术路线和阶段验收参考。与口语版设计冲突处须单独记录，不静默覆盖。
- 角色映射和动画约束见 `角色/角色资产.txt`；视觉依据见 `美术风格/`。
- 涉及规则时先查 `docs/DesignBaseline.md` 的合并基线，边界见 `docs/OpenRules.md`，追溯决定见 `记录/项目状态.md`；术语见 `CONTEXT.md`。建议与已确认决定必须分开记录。资产接入查 `docs/AssetManifest.md`。

## 技能与连续性
- 设计澄清使用 brainstorming、grill-with-docs 与 domain-modeling。
- Web 游戏 UI 制作使用 frontend-design；涉及动画时使用 motion-design。
- 设计确认后采用 writing-plans；实现功能与修复时按 test-driven-development 执行。
- 不套用其他 Unity 项目的记忆技能；本项目有独立规则。
- 每次工作结束更新 `记录/项目状态.md` 和当日工作日志，记录完成项、验证证据、待解决问题和下一步。
- 本文件和项目文档是持久上下文，不代表应用已迁移原生会话存储，也不是全部聊天原文备份。


