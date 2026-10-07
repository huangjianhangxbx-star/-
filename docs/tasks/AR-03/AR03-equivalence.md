# AR03 零手感等价证据

生产修改前，在 main@5cb9e488 冻结 `game/tests/fixtures/ar03-old-basic.json`。18 场景 × 2 seed（742/19）× 61 状态点 = 2196：loop、buffer、expire、target、whiff、move、direct、blink、evade、postmove、switch、ai、order、weight、snipe、reap、正确 guard poison、dance。

每点比较完整旧 gameplay 序列化投影 SHA256，包括 RNG seed/nextId、HP/姿态/CD/资源、位置/path、旧 pending/chain/basicRelease、durability、stats、effects 与技能状态。仅去掉新增观察 metadata（combatIdentity/ActionContext 等和 basicAction）；没有删去旧游戏结果来使等价通过。AR02 已冻结的 1808 个状态也继续通过；ar02-fixture 只增加新 basicAction metadata 的排除。

AR02 trace 比较 action/request/start/attack/outcome 的实际 actor/source/target/ID/时间，并保留非 Basic 生命周期。仅排除 Basic finished/cancelled 与递增 sequence，因为本轮明确迁移了 Basic 生命周期时点/原因；新的 Runtime 测试另核对唯一 Start/Release/Finish/Cancel。不能宣称完整 raw trace 逐字节相同。

冻结包附 rawTraceHash 是历史 trace 的校验元数据，不作为等价判据；原先压缩 raw 历史行时采用 Python canonical JSON，第一初始状态的引用保存不具有逐帧 raw 证明力。主等价证据是当时立即计算的 gameplay 与规范化 identity hash。受保护的录制器只允许 runtime 源码尚不存在时生成，不能拿迁移后的结果覆盖旧证据。

额外验证：真实 buffer 消费关闭上一 Action；回收/退出清 Runtime；镜像篡改不触发早出手；目标离开形成 whiff；切人保留旧 requester；1/3/4 段测试定义共用执行器。T033 旧拓扑测试以前修改 BASIC_PROFILES.proof，现只 mock definition resolver 为三段只读定义，仍通过完整真实 chain/engine 检查第三段，不删除测试或降低断言。

两个权威消费者 `resolveHitLegacy` 和 `releaseAttack` 与基准文本一致。实验不等于原作动态消费者/OBS 闭合，原作实际结果没有新增证据，留空。
