# 道具与商人第一批
用户范围：五档品质，各五件食物、贵重品、占位魔素瓶；地图商人仅出售；钱币为库存物品。新物品只投放临时箱，不改初始随身物品。

沿用 definition / instance / container / 原子库存事务；整数钱币与克数。出售先在草稿扣指定实例，再加入钱币，失败不提交。NPC复用Unit工厂和场景Actor，非战斗参与者。食物复用regen状态且按剩余时间结算。30kg只提示。

顺序：事务失败用例→目录/事务→NPC与箱子→UI与原创SVG→核心/浏览器验证→工程记录/GitHub。

参考：
- https://dev.epicgames.com/documentation/unreal-engine/lyra-inventory-and-equipment-in-unreal-engine （定义与实例分离）
- https://overextended.dev/docs/ox_inventory/Functions/Server （容量、增减物品接口）

所有新数值为本轮可调SAMPLE；没有原作还原声明。只出售有显式售价且未装备的物品，不购买，不接入旧抽象gold余额。
