# 背包扩大、圆角与重量 · 实施计划
目标：保留格子事务，扩大面板覆盖部分HUD，圆角物品格并真实计重。
- [x] 界面：1434×804基准，主窗12/20/440/770，安全窗456/20；网格仍五列，尺寸适配新宽，拖放用相同网格度量；详情移至565，外部容器保持右锚。
- [x] 重量：只读派生，整数克；定义数据配置，单件乘堆叠数量；团队/安全/后备/双人装备计入，箱子/掉落不计；未知重量显式显示待配置。参考容量30kg为SAMPLE，本轮采用提示模式（已询问、未收到回复后按可逆推荐默认，不声称用户已确认硬限制）。
- [x] TDD：拆分合堆、跨容器转移、消费、死亡、未知定义、超重显示。
- [x] 浏览器：放大几何、圆角、计重明细、拖放及不同尺寸；相关测试/构建，更新记录后仅GitHub。
参考：https://dev.epicgames.com/documentation/en-us/unreal-engine/lyra-inventory-and-equipment-in-unreal-engine ，https://overextended.dev/docs/ox_inventory/Functions/Server 。不复制其引擎/网络架构，当前会话本地权威保持。
