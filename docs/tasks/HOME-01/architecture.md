# HOME-01 身份与所有权

2026-10-18，基准 a755361。本轮是世界会话内的居民/出征成员薄层，不是新存档或日程系统。

## 权威边界
- `world.homeResident` 仅持身份、模式、住宅/驻留点与修订号，不持第二个 Unit。`explorationCompanionId` 保留角色配置兼容含义，出征资格统一查询 `isPartyBody`。
- 同图本体属于 `state.units`；离家后交给原有 `WorldPlace.residents`，回来取回原对象。场景卸载不删除居民或另造替身。初次 StandAtAnchor 设置站位；无每帧钉位置和离线模拟。
- `joinHomeParty` 校验世界、访问代、目标、控制身份、输入代及成员修订号。现有模态查询通过 WeakMap 注入核心校验，不创建第二个菜单状态机；旅行与对话生命周期也显式阻断。成功只改变成员资格及输入令牌代，不重建人物/库存，不治愈、不切控、不发装备。
- 库存继续唯一 `InventoryModel`。`reserve` 明确归 ranger，装备容器已有 owner。驻家个人物品不计携带、不掉落、不参与远程消费/交易付款；同家可访问。团队包中的物品按当前容器而非历史主人处理。安全栏始终两个独立条目位。
- 出征死亡/切控/敌人目标/队友AI/视野复用成员查询。回血瓶仅作用当前出征本体。武器激活在独行时校验当前成员，仍使用既有世界激活状态。

## 研究边界与未来接口
已核对 [Epic StateTree](https://dev.epicgames.com/documentation/en-us/unreal-engine/state-tree-in-unreal-engine) 的状态/转换定位及 [Smart Objects](https://dev.epicgames.com/documentation/en-us/unreal-engine/smart-objects-in-unreal-engine---overview) 的活动槽位、占用和释放模式。本轮只借鉴“状态与活动点分离”，不引入 Unreal API、行为树/GOAP 或完整占用系统。
[Rune Factory 4 官方介绍](https://marvelous-usa.com/games/rune-factory-4-special/) 可证明生活与同行探索的产品方向，不能证明其源码采用本项目架构。

未来活动点保留稳定 ID、地图、标签、站位/朝向、可达性和容量；家具换图不改点 ID。烹饪、阅读、灌溉、活动占用及取消均未实现，另轮明确授权后再扩展。当前只有 `home.florecia.idle`。

## 美术状态
真实 imagegen 概念 R1 经用户要求改为带少量魔素科技的 R2，独立概念门 8.7/10。两态合成避让既有操作提示和技能 HUD。原稿与合成分离；真实运行仍使用原有 101 地面/墙体，家具、科技设施和菜地不是本轮实装成果。
原件与参考联系表留在忽略目录 `work/HOME-01/concept`，未提交原作参考 PNG、全库或用户原稿。
