# LT-01 v0.3 双人生命契约

正式 standalone 探索固定 hunter（猎人）与 ranger（阿尔）。ROST-01 提交 1963c6c；旧角色 ID 合法拒绝，角色专属生产文件删除清单另见 roster-removal-manifest.md。原始角色源文件、人工截图、PPT、用户头像、开发细则不改。

| 状态/事务 | 权威行为 |
| --- | --- |
| active → 致死 | 原 resolveHit/hurt 判定 HP 归零，partyDeath 只接受 active 真本体。立即 respawning/HP0，停自身路径、输入、动作、AI、碰撞和受击资格；没有 downed/救援/尸体阶段。 |
| 单死 | ensureControlledBody 接原存活者；死亡 owner 更新 inputEpoch，浏览器在本帧清 WASD/指针/E/瞄准/G/捕获，旧 held 不传新 owner。幸存者已接受的主动动作不取消、不再收费。 |
| 等待/返场 | 10 **模拟秒 SAMPLE** 后，在当前存活本体附近有限候选内找合法同层位置。检查 terrain/canStop、segmentClear、实体/计划位置不重叠，以及已提交敌方 hazard 和未来投射物落点；阻塞每 .25 模拟秒 SAMPLE 重试。 |
| 恢复 | 仍是同一 Unit/武器实例；满 HP/架势/当前体力，清虚血、硬直、举盾耗尽与致死临时状态。restoreRevivedStamina 保留 nextAcceptedId/lastAcceptedId，禁止重新 initializeStamina(true)。 |
| 双死 | 双方先从场景退出；.5 模拟秒 **SAMPLE** 可观察等待后，先完整规划 entry 附近两处合法互不重叠位置，再一次提交恢复。无空间时双方继续隐藏，事务次数不增加。 |
| 全灭连续性 | 不 beginWorld/restart，不改变 world.id/world.generation，不重生已杀怪，不清收益/事件/已用篝火，不返还付费或重建装备。只清失效战斗临时实体/敌方旧动作，保留实体序号水位。 |
| 单人存活离区 | 当前存活者可交互、篝火、出口与同世界继续；离区/暂停冻结模拟钟。继续不提前复活，篝火仅恢复活体且仍有自己的首次门。 |

特殊资源遵循最小不刷资源：弹药、CD、装备/耐久/成长不在死亡或返场补满；离场时沿原原生时钟停止推进，活体后重新按原时钟推进。不增加复活无敌。这些均为原型策略，待用户试玩。原先 Hunter/Al 自身死亡会清其派生攻击实体，本轮沿用这一死亡策略；敌人的 retain-policy 已提交实体不因玩家单死被清。全灭才清旧战场攻击。不会将“单死保留敌方箭”误写成“所有玩家派生物跨死亡保留”。

显示：正式本体非 active 时 Actor.group/bar/buff 在首次渲染帧都隐藏；活体 bar/buff 每帧最终隐藏。场景内身体/脚下选择/飘字/敌方预警仍保留，敌方血条/架势/BUFF 按原绘制。PPT 左上/左下 HUD 坐标和阿尔 al-user.png 不改，读取真实 HP/架势/体力/等待状态。Legacy/具名开发夹具原死亡流程隔离，不冒充正式入口。
