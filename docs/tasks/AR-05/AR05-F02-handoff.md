# AR05-F02 交接与停止点

实现范围：Standalone 双人仅专用 Z 往返（本轮暂定测试键）。C、1/2、场内友方及头像均不切 DirectActor；原 Tower 数字/头像/部署保持。头像保留现有只读状态展示，不为它新增另一操控身份。

普通 LMB Basic、Hunter RMB 与 E 准备方向脱离 fog/tile pick，黑暗、墙面、空地、友方方向可请求动作。真实 Hit、LOS、敌友判定与未知信息仍由主战斗裁决；F 选路、SkillAim、卡牌/道具、交互、G、模态保留原优先级。

切换只在 controlBody 接受后清旧场景指针及未消费 held/buffer；WASD 交接，已接受动作保留。E/RMB 放开仍属于原动作接受者。小蓝黄金时间、属性、声音、Spine 遮罩、Action Lab 与伙伴包均未改。

试玩：[主探索](http://127.0.0.1:5173/) → 探索 → 同行者 → 携带进入。建议复验 Z 往返、按住移动切人、对黑暗/墙/友方普攻、RMB 与 E 黑暗转向，以及之前 F01 上半身修复。Z 是否作为最终键位仍留后续用户决定。

自动验证见 [验证记录](AR05-F02-validation.md)，实验日志位于 work/AR-05/F02/；自动通过不等于用户手感验收。停止在 F02 用户试玩，不自动启动 AR05-G01、阿尔迁移或美术制作。

本轮按有效授权仅提交推送 GitHub main；不操作 Gitee。提交名为 fix(AR05-F02): isolate control toggle and project free combat aim；冻结实现以该次 GitHub main 提交为准。接手 5439 既有路径与 8 份原资源保护通过，共享记录按 HEAD＋本轮追加段隔离暂存。验证详见 validation；发布 SHA 在实际 Git 历史和本机 work/AR-05/F02/publish.json 回读。
