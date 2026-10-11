# SK-01B B 级验证

采用开发细则 v2.2 §7.1.1 的 B 级定向验证。源码与契约自查、4 项核心新测试、受影响旧用例、类型/构建及 4 个真实键鼠故事；未启动全历史回归。测试完成于 2026-10-11。

## 核心与构建

- `validation/red.log`：4 项新测试先 RED，缺准备配置及保留行为。
- `validation/core-final.log`：7 文件、79 项通过（sk01b、sk01a、world-session、lt01、eq02、eq01、cb02）。中途小集与最终集合重叠，不累加数量。
- `validation/types-final.log`：tsc --noEmit 退出 0；成功无输出。
- `validation/build.log`：主 Vite 构建退出 0，保留既有大于 500KB chunk 提示；不据此声称 GPU/性能通过。

核心覆盖：独立互换/空槽与纯拒绝，错误职业/定义/原生 E/敌人/复制体拒绝，准备无支付及时间变化；初始化独立 slots、实例；显式新世界保留两人方案与账户、生成新实例/CD/支付序号；旧 world ID 拒绝；合法脱战同步、忙碌拒绝；真实 resolveHit 死亡与原合法复活/同世界继续保持运行实例、CD 与支付身份。

## 浏览器观察

真实 Edge + SwiftShader、实际鼠标/键盘/原生 select。公开 window.prototype 只读观察，未注入生命、位置、伤害、时间或命令。自然战斗路线通过只读空间观察计算，再以 WASD 实际移动和 Q/R 施法。

| 故事 | 最终证据 | 结果 |
|---|---|---|
| 两人准备互换/空槽→carry→实际 Q 支付/CD，空 R 拒绝；新测试取消/确认 | browser.log 的第 1 故事；preparation-1920 / selected-runtime / new-world | 通过，确认模态阻止 QE；新 world、CD0、支付0，保留空槽及两人选择；pageerror=[] |
| 原生 select 键盘焦点；1280 原装备与 HUD | keyboard-browser.log；preparation-1280 / hud-1280 | 通过，QE RCZ Esc 不触发战斗；左装备面板可开关，三个技能槽在视口内 |
| 世界内合法修改→下一出征，模态输入隔离 | browser.log 的第 3 故事；synced-preparation | 通过，仅猎人方案变更、阿尔不变，原生 E 未扣费 |
| 两人互换后的 Q/R 自然敌人命中 | natural-browser-final.log；hunter-hits / ranger-hits / natural-selected-hits | 通过，真实主实例/槽/执行者、HP/架势结果 |

最终 4 故事分段通过，不称单次全绿：初次三故事 2 通过/1 夹具失败，键盘故事修正后单独通过；自然故事最终单独通过。1920 和 1280 准备截图、1280 战斗 HUD 已视觉检查；1280 准备页可滚动，未改变六区锚点或阿尔用户头像。

自然命中实际记录：猎人 Q=hunter-sweep，18HP/30架势；R=hunter-break，20HP/25架势。阿尔 Q=al-spin，18HP/30架势；R=al-stab，20HP/0实际架势（该目标已处于架势0；没有伪造再扣20）。核心仍核对技能原始规格与费用，不把自然结果反推为新数值。

## 失败及边界

保留原始失败日志。核心死亡夹具一次大步在 hitstop 下未达到复活模拟时点，改为原 step 小步直到实际模拟时间，并移除已完成死亡作用的夹具敌人；未改产品复活。键盘夹具先 End 再 ArrowUp 选回默认，改为真实 ArrowDown/Enter。自然战斗第一版断言固定30架势不适用于方向/目标剩余架势，改为宽技能真实架势>0、两个技能均真实HP>0，并保存完整 outcome；不调整产品参数。

未测：长期/跨刷新存档、OS 失焦、所有地图/历史塔防、目标 GPU 性能、多设备音效与长时间稳定性；未将 headless 技术测试等同用户手感认可。Q/R SAMPLE、世界内同步策略待用户试玩，原生 E 带盾外观债务沿用前轮。
