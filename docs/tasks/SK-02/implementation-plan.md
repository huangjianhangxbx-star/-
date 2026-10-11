# SK-02 世界同步激活实施计划

Goal：V模态真实一次支付，同步两人0→3，原位三被动产生轻量SAMPLE效果。
Architecture：rightPreparation保存三项稳定ID；当前WorldSession.activation唯一等级和事务水位（worldId+expectedLevel）；MainInstance复制被动选择，Q/R Accept冻结加成，原payVitality/resolveHit继续唯一消费。
Tech Stack：现有TS/Three.js/Vitest/Edge Playwright；无依赖或资产新增。
Spec：用户批准执行下载目录SK02 v0.1，main基准5883a757215f94d4692860c912632687cc9ca755。按brainstorming核对附件已批准架构，writing-plans编排、TDD执行；无真实可用executing-plans，不冒称使用，当前会话直接执行。

约束：固定猎人/阿尔，E/黄金动作/敌压/CB/LT/NR保持；样板费用4/8/12，共24；恢复×1.1/Q-R架势×1.1/Q-RHP×1.1；只原位HUD/CSS；不睡眠/多变体/AI施法/永久存档。B级相关验证，保留工坊/t016/共享记录旧dirty，只发布本任务GitHub main，无Gitee/细则/用户维护/原素材改写。最新研究3回合助手正文仅引用，完整附件为依据。

## G1 世界事务
Create passive-definition.ts、weapon-activation.ts；modify right-preparation/equipment/right-hand-skills/world-session/types/engine。接口queryWeaponActivationUpgrade(s,worldId,expectedLevel)、commitWeaponActivationUpgrade(...):CommandResult；pure effectivePassiveModifiers(s,u)，queryWeaponActivationOpen(s)安全门。
- [x] tests/sk02.test.ts先RED：纯拒绝/陈旧/满级/4-8-12一次支付，单死同期。
- [x] 世界初建activation={activeLevel:0}；完整校验双方owner/main/world/预选后payVitality一次，更新等级；不另建余额或角色等级。

## G2 实际被动消费者
- [x] RED：L0-3恢复20/22、Q/RHP20/22和架势25/27.5、trace关仍命中、旧Accept快照不变；原生E/Basic/副手隔离。
- [x] stamina恢复乘只读modifier，Q/R Accept合成spec及weapon；不在Release乘。
- [x] 复活/全灭/离区继续/篝火保等级与付款，restart保模板且新世界L0。

## G3 原位UI和输入
Create activation-panel.ts；modify exploration-app/exploration-hud/prepared-skill-view/geometry-hud.css。
- [x] tests/sk02.spec.ts先RED：V不足不扣、repeat/模态冻结，实际击杀赚4→升级两人槽亮，换人/形态/副手/真实Q-R效果，1280与1920读数。
- [x] V按钮和KeyV开窗；点击upgrade发缓存world+level命令，成功保持窗，Esc/Tab/Enter捕获，开关清held，安全拒绝不取消已Accept。
- [x] 原3被动槽从等级与实例ID派生，名称/生效状态/倍率可读；准备固定只读，无重新布局或新图。

## G4 B级验证与交接
- [x] 定向sk02/sk01b/sk01a/cb02/lt01/eq02/world-session，tsc及主/Lab构建；3-4浏览器故事，失败定向修正并留日志，不默认历史全量。
- [x] contract/validation/handoff及必要规则/索引/对账/日志/状态/术语追加，SAMPLE区别明确。
- [x] 独立Git索引选择性提交，保黄金/细则/头像及无关dirty，GitHub远端双验与新版HTTP；停用户Gate。

验证留真实失败，浏览器按失败部分定向复测，不把分段通过写为一次全绿。技术交付后停用户试玩Gate；发布回执独立本机保存。
