# INV-01A 实施计划

目标：在普通当前世界接入 Tab 背包及原位十格快捷栏，止于技术交付和用户操作/布局 Gate。
依据：reference/INV01A-plan-v0.1.md；用户本轮直接实施批准。附案基准 b9e0ac6；实际 main/GitHub 为2098d58，仅新增研究文档，无游戏冲突。

采用 brainstorming 核对已批准设计，writing-plans 拆实施步骤，TDD 先失败再实现，frontend-design 沿用原黑底细边。非新设计提案，不重复询问局部选择；内联实施，无不可用子技能。验证等级 B。

- [x] 核心：world-inventory.ts 定义稳定农用 SAMPLE 与世界库存、纯查询及提交；WorldSession 可选 backpack，普通世界一次初始化。types/engine 接独立命令。先验证初始化缺失 RED，再验证绑定、空槽/非法/旧访问、选择不扣数量及生命周期。
- [x] UI：backpack-panel.ts 仅持开关、选择和拖拽请求身份；核心持库存。复用 #quick-reserved 原 Tab 与十格位置。库存按钮稳定更新，种子青绿细边、农具暖金细边；正文 Microsoft YaHei、数字 Consolas；黑底 #090b0d、边 #8ca9a3、字 #dbddd4；标题 SimSun，唯一强调为绑定落点高亮。
- [x] 输入：真实 pointer capture 拖拽，目标查询、抬起才提交、外部松手/取消/失焦/代次变更清理；键盘选择→数字绑定、右键清空。Tab/Esc 开关，模态冻结、所有战斗输入隔离，数字物理 down 锁直到 up，不复活旧1–4或道具命令。
- [x] 验证：INV核心与回血瓶/World共享边界小集，tsc/主构建和独立ActionLab烟测；1920拖拽与1/0选择、1280键盘/取消/模态/布局、同世界/新世界用核心及短浏览器故事。不全历史/全地图重复。
- [x] 更新 contract/validation/handoff 及 AI 索引记录，保留 SAMPLE/未实测边界。选择性提交推送 GitHub main；既有 dirty 不混入，不Gitee。

保护：Y瓶/篝火/黄金战斗/敌压/装备/SK02实验/用户头像/人工原稿/开发细则不改；无种田实际消费、奖励、永久存档或升级适配。
