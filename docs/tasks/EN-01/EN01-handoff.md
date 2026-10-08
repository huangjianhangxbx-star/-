# EN-01 交接与试玩

本轮停于 EN-01 技术闭环。EN02/03 的具名怪物迁移和 EN04 架势没有启动；此敌人是 SAMPLE，并非已经认可最终手感的原作怪物。

[打开单敌试玩](http://127.0.0.1:5173/?en01=1&v=EN01-v1)；[普通主探索](http://127.0.0.1:5173/)。选择“近战扇区”或“延迟运输”；WASD、Z、猎人右键格挡、阿尔右键射击、Shift、Space；G 为既有战术慢速，Alt 为既有倍速。敌人固定站位，离开范围便会挥空或拒绝出招。“重置”清空本轮并更换 generation；“返回普通试玩”离开夹具。

右侧诊断显示六事件、锁定目标/方向、敌 HP、实体数、模拟时点和拒绝/接触结果。阿尔切换前可能已被陪伴 AI 带离范围，需要正常走近，不必等待远处固定敌人追过来。敌人净伤害较低，用于观察命中和取消，并非平衡版本。

本机 Vite 服务在关机后停止。重新开机后，在 `E:\WORLDCREATOR\XingHaiHuiLang\Origin\game` 运行 `npm run dev`，再打开上面链接；如 Node 未在 PATH，本机可用 `E:\tools\nodejs\node-v22.14.0-win-x64\node.exe` 运行 `node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173`。页面查询参数用于刷新识别，不是云端部署。

版本定位：在 GitHub/main 的提交标题 `feat: implement EN01 isolated enemy action runtime` 查找本次冻结提交；最终 commit 及远端回读随交付消息和本地 `work/EN-01/publish-receipt.json` 给出。正式外来计划 v1.0、EN00 基准和本任务证据摘要见 [执行记录](EN01-execution.md)、[运行合同](EN01-runtime-contract.md)、[验证](EN01-validation.md)、`EN01-evidence.json`。原始截图和大型日志留本地 ignored work，不提交受限原作素材。

进入 EN02 前需另行批准：选择具名来源、接入真实动画/音效、映射 prepare/lock/attack/Ready/finish 与打断死亡、设计其独立 AI 并复用本身份和实体缝。不能用此 fixture 的 SAMPLE 数值直接宣称原作事件闭合。原作 actualResult 保持 null，已有玩家黄金认可不等于敌人认可。
