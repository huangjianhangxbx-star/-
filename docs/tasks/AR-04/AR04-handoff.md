# AR04 交接

Hunter BasicV1 已接入主探索，保留 Shot01/Shot02/Shot01 二段逻辑，同表现原素材已获用户批准。其他职业、Tower/敌人、ActionLab保持原契约。停止在本轮可玩评审，不启动第二角色或EC11。

- [逻辑契约](AR04-hunter-basic-contract.md)
- [原素材探测与用户裁定](AR04-hunter-motion-probe.md)
- [表现映射](AR04-presentation-map.md)
- [验证与A/B实拍](AR04-validation.md)
- [任务记录](../AR-04-猎人BasicV1.md)

试玩使用主入口 http://127.0.0.1:5173/，进入双人探索后用左键普攻、WASD取消/移动、Shift机动、E技能、C切换，G轮盘慢速与顶部2×可比较时钟。action-lab.html仍是已冻结的AL样板，不展示AR04主战斗迁移。

定义唯一节点源：basic-definition.ts，SAMPLE .4可替换。Runtime缓存presentationId；view/basic-presentation.ts映射两个原片段；scene.ts按Runtime身份识别动作并按模拟时间采样，暂停与晚加载均同步。既有通用射击FX/音效保留，PRESENTATION PENDING显式记录。

冻结版本由本任务Git提交定位，基准e58abf8；manifest列必要文件与素材hash、消费者检查、保护与日志。技术用例通过不代替手感确认或原作事实。仅GitHub main发布，不同步Gitee。
