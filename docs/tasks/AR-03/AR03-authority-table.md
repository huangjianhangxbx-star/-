# AR03 权威表

| 概念 | 唯一职责与权威 | 兼容字段/边界 |
|---|---|---|
| Request / buffer / 权限 / 目标选择 | basic-chain | 原 requestBasic / advanceBasicInputs 不变 |
| Definition / profile 映射 | basic-definition registry | 全部正式职业共享一份 legacy 数据；BASIC_PROFILES 是冻结的只读兼容视图 |
| Stage / continuation | basic-chain + nextBasicStage(definition) | 原 nextStageAllowedAt/.45 保留 |
| 已接受动作、前摇、Release | BasicActionRuntime | attackPending 只投影；迁移分支不递减它 |
| 恢复/攻击可用性 | 原 attackTimer 更新/暂停 + 原 chain buffer 消费资格 | Runtime 读取同一旧资格，不新增恢复计时；下一段实际接受关闭上一段 |
| MoveReady | Runtime 缓存 releaseAt 节点 | 现正式定义等于 Release；原移动取消/资格不变 |
| Finish/Cancel | Basic Runtime | AR02 旁路唯一 terminal，Direct 切换不清动作 |
| 表现/声音 | 原 basicRelease | 保持旧 nextId；无重复 Release |
| 空间复核、伤害、姿态、耐久、旧技能 modifier | engine / releaseAttack / resolveHit | 原函数主体字节语义文本相同，参见 verification |
| 身份与实际结果观察 | AR02 combat-identity | 独立 ID 与有界 trace；不成为伤害消费者 |
| Tower / enemy / 未迁移路径 | 旧 pending 分支 | 不创建 BasicActionRuntime |

兼容 pending 仍供 playerOwns、bodyActionReady、移动/轮盘/AI 等现有资格判断读。Runtime 前摇未释放时优先经过 advanceBasicAction 并 continue，旧分支不能再倒一次时钟。修改 mirror.remaining 的测试不能提前攻击。

attackTimer 并非新镜像计时器：保留的是原资格时钟。chain 的原 buffer 接受顺序也保留，不能为了使 trace 好看而改变输入响应。Runtime 消费这些既有资格信号并保证每个已接受动作的唯一 terminal。未来正式更换节点/拓扑须经过新的角色设计批准。
