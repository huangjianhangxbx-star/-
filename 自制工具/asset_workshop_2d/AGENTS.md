# 2DW 第一轮独立工程

继承 Origin/AGENTS.md 和 design/开发细则.md。当前用户已授权执行第一轮详细计划；只实现 2DW-00/01 及 Codex/ZIP 最小纵向样例，完成后停止等待审阅。

只写本目录与本任务必要工程记录。map_editor/、既有 EXE、原作研究、design/开发细则.md、design/用户维护/、游戏本体不可修改；用户在第一轮完成后明确授权当前成果提交并推送 GitHub main（2026-10-08）；Gitee不在授权范围。

新程序不得在运行时 import ../map_editor/ 或读取其 node_modules。依赖只从本目录锁文件安装。核心规范与提示词分离；固定测试图是自制夹具，目标素材不在任务 ZIP 中。

命令（Node 24+、pnpm 11）：pnpm install --frozen-lockfile；pnpm test；pnpm run typecheck；pnpm run build；pnpm run proof；pnpm start。验证证据留在 validation/，生成物由本目录 .gitignore 忽略。
