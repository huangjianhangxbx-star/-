# AI-01 伙伴战术交接

基准CB-03 b3f6a4b。保留唯一G轮盘、Direct/MoveOrder/Companion单一执行；没有新listener、AI技能或自由道具。

| 模式/边界 | 核对与处理 |
|---|---|
| 自由 | 原finishPartyTactic清覆盖/拥有路径，恢复自主目标粘性；死目标不永久粘。无需重构 |
| 集合 | 原安全navigate、128预算、.25重规划、8秒实际路由预算；新双向native大障碍+移动主控步进证明绕路，无瞬移/穿墙；无路真实blocked+reason，free撤销 |
| 等待原动作 | 新测真正断点：原Basic的Hit后attackPending清除但MoveReady未到，及native射击special仍占用时，bodyPending误标active并花集合预算。补入原生Basic/两角色special和motion；保持原Companion owned消费者先前等待行为，准确pending-body并暂停预算 |
| 集火 | 原观察资格、短记忆、死亡/返回/控制变更撤销，Basic接受目标与AI/战术一致；旧目标不会复活。保留EN06-G01目标粘性参数 |
| 保守 | 仅effectiveTacticWeights临时overlay，仍有真实贡献，永久倾向不改 |
| Z/F/G | 原控制revision拒旧命令，F清rally/focus保留cautious，跨台当前原子边不强停，leave清临时战术；无H/B复活 |

## 验证

- RED 6新测中4失败：3为真实等待态漏判；1为测试移动主控7.2单位后不足观察时间，不调8秒预算/速度，减为仍会动的2.4单位目标后复测。
- 新6测 + 原T036、EN06-G01、companion、AR06、NR合计109通过。原冻结legacy mock夹具与新增真正native夹具区分。
- 4自然浏览器通过：Al RMB真正扣1弹→Z→G集合，HUD真实等待动作/预算0，动作结束后自然到达；F/G；四怪双向集火；自由AI实际Basic对象。没有state/位置注入。
- 原CB-03失焦/Esc/重复输入/GZ及ActionLab证据复用；Types、主构建通过。未改攻击黄金事件、目标粘性数值、永久AI倾向。

技术通过，用户主观行为验收仍待试玩。下一阶段QST-01A；不会自动授权后续AI-02。
