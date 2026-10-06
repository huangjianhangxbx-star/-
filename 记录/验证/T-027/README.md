# EC09 工程证据

任务：[T-027 / Companion AI 2.0](../../../docs/tasks/T-027-EC09-CompanionAI2.md)。浏览器使用真实 Edge 软件 WebGL，前七项为隔离机制的局部夹具，第八项为生成地图普通遭遇。不是自然通关、目标设备性能或用户手感验收。

| 场景 | 截图 / 运行快照 |
| --- | --- |
| 超过旧 2U、不引出未活动组 | cross-room.png / cross-room.json |
| 阿尔实际侧背命中 | flank.png / flank.json |
| 普通行走躲避、保留 charge | walking.png / walking.json |
| 真实 Slow 下同行 Evade | ai-evade.png / ai-evade.json |
| 切阿尔后猎人应急 Blink | ai-blink.png / ai-blink.json |
| Ines 保护走位 | ines-peel.png / ines-peel.json |
| 鼠标移动 + C、完成后自主决策 | stability.png / stability.json |
| 原地图 Normal 20 秒 | normal-group.png / normal-group.json |
| 200 帧、活动组、位置反转、HP/事件 | normal-group-simulation.json |
| 威胁消失后控制恢复与归队 | normal-regroup-recovery.json |
| AI2 Debug 参数与域 | debug-domain.png / debug-domain.json |

red-domain-ai.log 保存依赖缺失 RED；red-auto-boundary.log 保存自动回镰错误攻击未活动组的真实行为 RED。core-final.log、typecheck.log、build.log、browser-regression.log 与 browser-final.log、browser-recovery.log 是工程检查与收尾复查；browser-first/second/mouse.log 保留诊断和逐步确认。protection.json 记录保护区哈希、原计划副本和外部修改保护。

stats 的 aiWalkingAvoids 是重新下达避险行走的决策次数，可能针对同一个 cast 多次重评估，不等于独立成功躲避的攻击数量。实时受击、资源与判定应结合 combatEvents、HP、charge 和各场景断言判断。
