# AL-01 M2 阶段实施步骤

沿用唯一主计划 v0.1，不另立主任务。依据：已校验主计划§8–13/15–17、2026-10-07 M2接续指令，以及用户同日批准新缺项使用集中SAMPLE。

目标：保住M1已认可普攻，补闪避、方向格挡、四池资源、根准备/盾冲及每波首次命中成长，停M2试玩。
架构：LabWorld编排；Action带kind/instance/root/pose和同源事件轨；独立Motion持运动权、Defense持无敌/格挡资格、Resources持四池、HitEffects按施法者和根/波次消费命中。原始骨架不重导，原录音复用标SAMPLE绑定。
技术：既有TypeScript/Vite/Vitest/Playwright。writing-plans引用的executing-plans/subagent-driven-development不在已核技能库，按用户连续实施指令在本会话顺序执行，不宣称调用缺失技能。

## 步骤与接口
- [x] 接手a78c601、16输入哈希、5402既有脏文件指纹；M1源码复制只到ignored工作区，24测试通过。
- [x] AL01-T05/T06：先写世界正常请求测试，验证缺失能力失败。新增profiles/m2.ts（来源与SAMPLE配置）、runtime/resources.ts四池与runtime/abilities.ts动作/运动/防御接口；world.dodge()/shield(held)分别资格/支付/退出。motion与invulnerability独立，dash-strike不推进basic段。
- [x] AL01-T07/T08：先写prepareActive()/releaseActive()/cancelUpper()的挥空、节点前取消、节点后取消、命中成长测试。新增runtime/hit-effects.ts接收casterId/rootId/waveId/targetId/generation；首次命中归属施法者，重置清空。activecharge在根Attack节点支付，子动作有parent与root身份，按波次去重。
- [x] AL01-T11/T12/T14：边界/低帧/缩放/受击/死亡/暂停/失焦/重置测试。旧危险按实例退出；暂停冻结时钟并清输入/架盾/准备/无敌来源，不积压请求。死亡停止恢复与新动作。
- [x] AL01-T01/T13：entry键位Space闪避、R重置、Esc先取消准备再暂停，Q按住准备松开提交；HUD四池和安全重置构筑；spine读取action.pose、同一track.time，guard循环原pose。事件声音复用原三录音，反馈不结算伤害。
- [x] 正常浏览器键鼠链：普攻、闪避、架盾正反、Q空挥/命中、成长、双方死亡与重置；开发接口若需要仅固定初态/读日志。
- [x] AL01-T15/T16：定向→全量低并发→类型/两构建→AL01浏览器→主游戏回归；保护既有字节/受限分发，更新唯一任务现有六栏/审阅包，按适用GitHub main授权发布，不同步Gitee。

## 参数边界
已知：dash invulnerability配置.13；MP基础费用0；主动CD8/charge1；格挡消费霜寒1；特定盾冲每波首次命中回复2；霜寒基数3/.8恢复速度；后退1.7/.15，盾冲6/.2、基础atk75。所有未知最终值和消费者映射集中m2.ts，并标2026-10-07用户批准SAMPLE。取消与节点映射不称原作事实。不做完美格挡退款、备用霜寒闪避Buff、第二样本、M3、装备库或主游戏融合。
