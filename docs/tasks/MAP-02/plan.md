# MAP-02 Implementation Plan

**Goal:** 修复真实敌方血条，实施区域用途、可见离散转场、有界跨门追兵与五层独立挑战。
**Architecture:** 继续以WorldSession/Unit/库存为唯一权威。静态用途与连接独立；动态run分配唯一placeId，查询统一解析实例。追兵在源区仅沿已核验路径推进，单次所有权转移，不模拟全世界。
**Tech Stack:** 现有TypeScript/Three.js/DOM、Vitest、Playwright。
**Spec:** 用户2026-10-17交付MAP-02 v1.0包01–04/给Codex；基准d05e6bb。授权直接执行，局部推荐参数按获准样板处理，不另行重复审批。

## Global Constraints

- 不修改开发细则、用户维护区、原媒体/PPT或其他任务；原有game/docs截图保留排除。
- 不重建世界/战斗/物品/音频，不新增奖励、Boss、永久死亡、后台世界或地图渲染工程。
- 家16×12、中立24×16；五层数量[2,3,4,5,6]按run seed一次洗牌，均为SAMPLE。
- 每层真实死亡后只开门；第五层回本次中立入口外侧。普通门敌人策略与层间禁止策略显式登记。
- B级验证，首轮最终验证预算10–25分钟；有真实问题则定向修复并记录耗时。三条自然键鼠主线，不改HP冒充通关。
- 最多3轮独立只读监工，固定3/3/2/2，硬失败优先；最后选择性推GitHub main，不推Gitee，媒体/可逆索引/录屏仅本机ignored。

## Tasks

- [x] P0 `enemy-health.ts`/DOM consumer：真实HP、活敌视野、锚点、节点复用清理。先失败测试，再实机攻击证据；不新增友方头顶条。
- [x] P1–P2 `map-definitions.ts`/`map-travel.ts`/`map-presentation.ts`：用途与门策略、统一实例查询，普通返家取消清场；ticket驱动150ms淡出/淡入、真实准备阶段和有效首帧。诊断延迟默认0，仅F10可控。失败保持源身份。
- [x] P3 `enemy-map-transfer.ts`：卸载前捕获有效追击及导航路径，游戏时间推进、阻塞等待、取消理由；同敌HP/收益来源不变，前后台单一所有者。提前准备显示，不锁玩家地图。
- [x] P4 `map-runs.ts`：每run五层唯一实例/seed/完整roster，重试不重掷，末层返锚与completed；新run不污染旧掉落，GPU资源有界释放。
- [x] 验证小集/类型构建与A追入、B真实五层、C转场/失败/连续接缝；真实证据留work/MAP-02。根据实际变化改旧MAP夹具，不删除仍有效断言。
- [x] 独立评审与必要返工；更新CurrentRules/对账/术语/项目状态/当日日志，选择性提交推送并核验远端。

首帧回归实际先红后修：资源完成后提交前做目标离屏渲染、上下文/模型检查；提交后只揭幕，不以表现错误谎称源地点已恢复。prepareUnit每ID共享Promise，取消和晚compile有所有权复核；原生骨骼先draw填充canvas。发现Scene.update旧分支与新准备并行造成3个初始孤立角色网格，DOM/scene回归先红3≠0后统一mapMode创建路径，legacy保留。未访问层按每敌冻结点保存初始冷却。最终43逻辑及构建通过，最终资源两项/A/C分段通过，最终自然B 8.7分钟通过，额外正常输入首层血条同屏图1.1分钟通过；早前失败与夹具修复保留于validation。

## 接手与技能

当前分支scene2d-validation，实际HEAD与包基准一致；仅旧game/docs未跟踪截图。通用规范2.2与适用AGENTS核对，后续按任务读取。ChatGPT链接要求登录，未取得新聊天正文。采用brainstorming、writing-plans、TDD；血条定位采用diagnosing-bugs；领域术语采用domain-modeling；最小反馈采用frontend-design与motion-design。无真实关键歧义，暂不启动grill问答。所有实施在本对话内进行，独立agent仅按包03做只读监工。

## 实施选择与检查点

血条按实体ID复用66×8px黑底细框，生命色#b95663、框#c2bca7；位置由实际脚底上移约1.1U投影，不取4U画布顶。系统字体沿现有Microsoft YaHei，信息不遮挡点击。转场复用暗蓝#080e17与暖白#ddd6bc，不做新插画；150ms淡出/淡入，未准备好显示目的地，减少动态偏好省略动画。连续片段不调用此层。

初始相关测试因消费者/实例模块缺失变红；诊断失败负例先实际失败（错误地到达102）再实现后通过。37项相关逻辑与类型/构建已通过初版。A实机37.7秒通过：真实受伤条宽下降、留活敌返家、原ID追入、屋内真实击杀、收益一次、源区无副本。首版A脚本在异步转场中按B导致等待失败，修正等待本次旅行结束，未改移动/生命/伤害规则；一次命令cwd误用导致补丁未执行，随后正确执行和复测。该段不冒称产品缺陷。B/C进行中。

参考只用官方资料，2026-10-17重新访问核验：
- [Flare Attribute Reference](https://github.com/flareteam/flare-engine/wiki/Attribute-Reference)：触发区、跨图与清场条件分离；不当作已有跨图追兵实现。
- [Godot Background loading](https://docs.godotengine.org/en/stable/tutorials/io/background_loading.html)：请求与就绪取用分开；本项目使用Three自身资源准备，不导入Godot。
- [Tiled Worlds](https://doc.mapeditor.org/en/stable/manual/worlds/)：片段原点与世界空间组织；不冒认编辑器自动提供运行时流送。
- [Three CSS2DRenderer](https://threejs.org/docs/pages/CSS2DRenderer.html)：HTML与空间标签的参考；实际沿用已有project回调，不新增渲染器依赖。
