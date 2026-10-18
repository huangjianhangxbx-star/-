# NPC-HOME-01 B 实装 R1 独立监工

日期：2026-10-18。审查基准：99223df 之后本轮 B 的未提交实现。只读审查产品，评审者仅新增本报告；没有借用 A 的视觉验收分数。用户“布局可接受，继续吧”作为 A 已接受、B 默认建议已授权的范围依据。

**结论：R1 通过，9.4 / 10。未发现身份复制、瞬移、控制抢占或路径穿墙的硬失败，不要求进入 R2。** 结论限于当前单住宅、单驻家居民、三种站走占位任务及所列定向证据。

| 维度 | 得分（各 2.5） | 独立判断 |
| --- | ---: | --- |
| 行为符合度 | 2.4 | read → kitchen-stand → garden-inspect 按真实活动点选择、寻路、朝向及模拟时间停留；自然故事中前两项完成、菜园真实到达，单元验证三项完成。无产物或经验。 |
| 操作／打断直觉 | 2.3 | 菜园途中 F 菜单及交谈立即暂停居民；交谈期间模拟时钟继续、目标与停留冻结，结束恢复原目标。F10 为只读快照且标 stand-placeholder；字段较多，查看目标需滚动，仍有可读性改进空间。 |
| 角色与控制权保护 | 2.5 | 沿用同一 Unit、装备及背包；仅共享移动获得资格例外，participates、战斗、切控成员规则未放开。失败组队不清任务，成功同步取消，旧释放函数不能删除新伙伴路径。离图保存同实例且冻结。 |
| 可扩展性 | 2.2 | 三项定义共用小状态机，活动 tag 承接布局、路径身份限制清理权；寻路有预算及三次重试，无每帧全家寻路。当前 mapInstance 选择处仍写死 :101，部分生命周期函数较密集，扩展第二住宅前应收敛为 home 权威并改善可读性。当前单住宅范围可接受。 |

## 实际检查及验证

已读 AGENTS.md、本任务 plan.md、B 原方案，完整检查 home-activity.ts、home-resident.ts，以及 engine.ts、world-session.ts、map-travel.ts、DialogueGame、RoleInteractionPanel、F10 的本轮接入；检查 home-activity.test.ts、home-activity.spec.ts 与原居民测试调整。没有修改产品源码或测试。

独立执行以下验证，均通过：

- `npm test -- tests/home-activity.test.ts tests/home-resident.test.ts tests/home-join.test.ts tests/home-layout.test.ts tests/home-layout-fix01.test.ts tests/dialogue-game.test.ts tests/role-interaction.test.ts tests/map-companion.test.ts tests/companion-combat.test.ts`：9 文件、77 测试通过。
- `npm run build`：TypeScript 检查及 Vite 构建通过，231 modules。构建有既有体积提示，不影响本轮功能通过。

实际使用 view_image 查看 start-natural.png、walking-to-garden.png、moving-dialogue-stopped.png、arrived-outside-garden.png、F10-activity.png、party-field-combat.png：书柜初始区域、后门入口、对话原地暂停、墙外菜园操作边、只读诊断及野外原伙伴战斗的画面互相一致。静帧本身不能单独证明连续运动；连续性由正式入口测试脚本、位置/同实例断言、单元逐步模拟及自然故事 JSON 联合支持。未完整播放 natural-story.webm，未人工听音；没有把录像完整观看或音频体验计入结论。

## 自然故事与夹具边界

本评审没有重新运行浏览器故事，审的是实施者已执行并保存的浏览器脚本、JSON 和上述实看截图。自然故事脚本通过正常标题按钮进入家园，使用寻路结果为玩家选择点击路点，再发送正常鼠标／键盘输入；未给居民指定任务，未改角色坐标、时速或强制到达。读取 window.prototype 与导航模块用于观察／挑选玩家路点，因此属于自动化正常入口故事，不冒充纯人工试玩。

natural-story.json 中：read 在任务时钟 0.196 到达、10.196 完成；厨房 12.684 到达、24.684 完成；菜园 24.688 选中，在位置约 (5.558, 6.442) 被菜单打断；恢复后约 25.859 到达 (4, 7.775)。期间总规划次数 4，含恢复后重规划。beforeJoin.original=true；成功组队后 phase=cancelled，外图 place=102、sameResident=true，并有 actualBasicTargetId 的原伙伴攻击。脚本另断言交谈期间坐标及剩余停留不变，而世界模拟时钟增长。

定向负例明确是单元夹具，不算自然故事：测试直接放置交谈发起人以建立交互距离、直接切危险上下文、移动家具底座制造阻塞、修改布局 revision／删除 ownerObject、注入外部路径、构造过期请求／TravelTicket，以及资源准备异常。它们验证边界而非伪造居民自然走路。旅行夹具保留同 Unit、受伤血量和武器对象，离图不走时钟／不改位置，返家不初始化／不传回待机角落。

## 关键保护核对

- 清路径仅在 `u.path === activity.ownedPath` 成立时执行；hold 释放只删自己的 token，不发路线。取消、布局失效及旧释放无法清除新的外部路线。
- 菜单及对话只有目标匹配驻家居民才获得 hold；正常居民任务不设置 generic busy。对话／菜单关闭释放，下一模拟步检查成员、地图和布局后恢复。拒绝组队先返回，成功后才同步 cancel 并发布 party。
- MapTravel 的 prepare 先暂停，失败 finally 解除 travel busy；提交前 unload 再暂停。居民储存至原 place，返家拼回原对象；活动离图早返回，不初始化或跑后台 AI。
- 路径由既有 navigate／advanceMovement 消费，保留半径和 segmentClear 检查；居民路径受阻先清自有移动，再由活动状态安排等待及有限重试。三次失败转冷却／换目标，寻路每次 1600 预算；每帧只检查当前目标，不逐一求全家所有路径。
- 死亡／硬直／危险／外部移动让权；模拟 dt 为零时不推进。未新增生活需求、存档、后台日程、战斗参与资格或第二角色。

没有发现需阻止本轮交付的硬问题。F10 摘要优先级与 home id 去硬编码作为后续扩展整理点，不构成本轮继续返工的理由。
