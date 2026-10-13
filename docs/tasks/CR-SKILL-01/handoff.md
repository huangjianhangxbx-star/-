# CR-SKILL-01 当前交接

2026-10-13：研究提交 d305584 之后，用户批准「先交四条代表链，剩余清单分批」。P1已接入可玩运行时，详见 [试玩与实现契约](P1-runtime.md)。默认探索仍使用黄金职业；新入口 `?abilityTrial=1`，V配置，Z切人。猎人左键凿冰/E猛冲，阿尔Q精准装填/RMB迫击炮/E起跳爆炸。

R0/R1/R2完整枚举不变；只四个代表卡节点标记 playable_verified，未知不改为休眠。完整三级分支、全量消费者与原作OBS未完成。用户手感待本次试玩。

后续先读P1-runtime.md、coverage.json、私有shared/inventory-validation.json，复用已核路径/token/offset，不重复全盘取证。代码集中 ability-trial.ts，加原native适配；不要把实验弹夹并入左手Al.ammo，不从trace触发效果，不改黄金Profile常量。

本批21项核心/黄金接口测试、类型/主构建、自然键鼠故事已通过。浏览器记录在work/CR-SKILL-01/browser-p1；原媒体未新增提交，旧测试与工坊改动保持。

仅GitHub/main按本轮有效授权选择性发布，不联系Gitee，不触及开发细则或用户维护原稿。


## P2 接续（2026-10-13）

来源求值、base/+竞争撤销与凌凌如风实际冷却范型已实现。P2独立验证/提交后直接接P3。准确范围、测试与既有2条经济基线失败见 [P2契约](P2-runtime.md)。全目录/原作OBS未完成。
