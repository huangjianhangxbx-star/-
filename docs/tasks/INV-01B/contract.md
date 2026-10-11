# INV-01B 阿尔自由道具栏契约

用户本轮明确执行INV01B v0.1。基准main/GitHub c8cc48261a928d6b2ae7c03ab19bfde3a889eb19一致，目标源码干净；既有项目状态及工坊dirty保持。最新研究聊天实际读取3回合：用户提出不能拖给阿尔；助手正文仅内容引用占位，具体授权范围以完整下载计划为准，不声称取得缺失正文。

USER_CONFIRM：原PPT六区、阿尔头像及自由槽位置/外框保持，Y与副手独立；只补当前背包到固定阿尔的绑定接口。SAMPLE：实验种子/农具均可绑定、同一物品可以同时绑定十格与阿尔，仍无种田/自由道具使用消费者；不是未来阿尔正式道具类别或永久平衡。

WorldSession.backpack新增companionFreeItem={ownerId:'ranger',itemId:null}；它仅保存稳定ID引用，数量唯一读stacks/inventoryQuantity。没有Unit库存/第二数量/DOM存档。queryAssignCompanionFreeItem和queryClearCompanionFreeItem纯读取；提交核准正式活跃世界、worldId/visit、唯一hunter/ranger本体及固定owner、存活实控/无瞄准指令；绑定还要求注册物品且唯一正安全整数库存。重复绑定幂等，失败全状态不变，解绑不消费。阿尔死亡/返场不丢槽所有权，存活猎人仍可整理。缺货保留引用、显示不可用，不自动修复；缺货可解绑。

同世界Z/死亡全灭返场/篝火/离区继续保持同一背包与引用；确认新测试重置为空，刷新不存档。Y瓶、左右手装备、SK02共同等级/付款、旧inventory/quickSlots、战斗Accept/Hit/Cancel和奖励保持独立。未增加依赖/装备消费者，旧item隔离门继续有效。

Tab背包允许真实拖到阿尔原槽，经过时纯查询高亮，松手才提交。来源DOM和pointerId/token/控制所有权沿用；Esc、外部松手、resize、blur、世界/控制变化清理，不转战场攻击。键盘选择物品→方向键焦点到“绑定到阿尔自由栏”→Enter；也可点击按钮。原位槽显示物品/同源数量/已绑定或缺货；右键解绑且不泄漏RMB，关闭背包后正常模态门仍适用。其他伙伴保留原预留槽，不获得阿尔接收器。

没有自由道具自动AI/施放/快捷键/伤害/消耗，没有FARM01、天气日历、长期存档或升级重构；升级继续暂缓。技术B级与用户主观可用性/审美Gate分开，停止本轮交试玩。原稿/细则/素材不改，仅按有效授权选择性发布GitHub/main，不Gitee。
