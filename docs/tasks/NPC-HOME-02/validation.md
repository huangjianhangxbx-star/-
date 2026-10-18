# NPC-HOME-02 验证

2026-10-18。独立监工 [R1](review-R1.md) **9.6/10，通过，无发现硬失败或阻断**。

## 逻辑与构建

先验证旧单站定义与旧执行器不能满足双站步骤，再实现目标/步骤链。追加回归证明 24 次 hold/release 会挤掉旧诊断转换记录，改独立六条转换环后通过。

独立执行 11 文件 99 项通过：home-goals、home-routine、home-activity、home-resident、home-join、dialogue-game、role-interaction、map-travel、map-companion、companion-combat、home-layout-fix01。新增转换环回归后只复跑受影响 home-routine，6/6 通过；当前该集合为 100 项，没有重复声称一次最终全组运行。

npm run build：TypeScript 与 Vite 234 模块通过。保留原有 chunk 体积提示。旧 home-activity 浏览器脚本适配新目标名，但未单独重跑；本轮新故事覆盖行为验收，不声称全历史浏览器套件通过。

## 实际浏览器故事

从正常标题入口进入，正常键鼠/B近路/F交谈和组队；A/B/C 不注入角色坐标、目标或模拟时钟。PNG、JSON、录像留本机 work/NPC-HOME-02/evidence；小型摘要见 verification-results.json。

- A：54.3 秒通过。备餐 step 1 → 餐桌 step 3 → 完成 prepare-meal 后自然选择阅读。
- B：约 1.3 分钟通过。阅读的第二次移动 step 2 被菜单/对话冻结，世界继续；结束后同一步恢复到 rest/step 3，无重复书柜步骤。
- C：约 2.6 分钟通过。自然前两目标后经真实后门进入菜园，水点停留时组队取消生活控制；同一角色随玩家去 102，实际攻击使敌人 HP 下降，生活 clock 冻结、实例数 1。
- F10：3.3 秒通过。明确 prototype-phase 夹具；night 改变阅读评分优先级，当前备餐承诺保持。此项不算自然故事。

四分项均通过；末次 A/C/F10 同命令 3/3 通过，B 先前独立通过。A/C 早期因低帧率 SwiftShader 加录像导致墙钟等待不足超时；失败快照仍是合法 step 2 moving、path 3、retries 0。只放宽测试墙钟等待，没有修改游戏时速或强制坐标。

等价点占用、布局/路径阻塞、长危险中断和转换历史压力为明确单元夹具，不冒认自然事件。监工实看截图/JSON/代码/结果，但未完整播放录像或人工听音。未验证长期硬件性能或所有中断交错组合。

## 发布边界

仅本轮代码、测试与 AI 工程记录提交 GitHub main。work、旧未跟踪 game/docs、原始 ZIP/媒体不上传；用户维护区和开发细则不改；禁止 Gitee。