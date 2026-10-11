# SK-01B 出征构筑与跨世界预设实施计划

Goal：准备页可分别配置猎人/阿尔 Q/R，E 固定；新测试世界沿用预选而重新生成运行实例。
Architecture：GameState.rightPreparation 只存稳定 owner/主武器定义/职业/技能 ID；MainInstance.skills 保持原战斗权威。开始世界复制选择，continue/复活不重新初始化；合法脱战配置同步预选。
Tech Stack：现有 TypeScript / Three.js / Vitest / Edge Playwright，无新增依赖。
Spec：用户指定的 SK-01B v0.1（下载目录）；执行批准为本轮“理解并执行”。采用 writing-plans 编排，在本会话直接执行；未安装的 executing-plans/subagent-driven-development 不冒称使用。

基准：本地与 GitHub main 均 c315fc3b8bd04eb178d74cb43683398da3a1cd9f；适用根 AGENTS、开发细则2.2、SK01A/F01、EQ01/EQ02、CB02/LT01/NR01契约。未提交 t016、工坊、历史日志与项目状态前缀保留。近期研究3轮用户消息已读，助手仅返回引用，正文未取得；本轮完整附件作为实施依据。

## 范围与验证
两位真实职业、每位现有两项 Q/R SAMPLE；E固定；无假武器候选、升级/三级被动、睡眠、长期存档、AI新技能。本轮 B 级定向核心、类型构建、4个真实键鼠故事；保留黄金参数、PPT HUD及用户原头像。仅任务文件和必要工程记录选择性提交 GitHub main，不联系 Gitee、原稿或开发细则不改。

## Task 1：预选权威和生命周期
Create game/src/core/right-preparation.ts，修改 types/engine/right-hand-skills/equipment。接口 queryPreparedSkillChange、configurePreparedSkill；command配置入口。准备只记录选择，无 CD 或支付；右主 definitionId 稳定，实例ID由 world 生成。
- [x] RED game/tests/sk01b.test.ts：准备配置/合法拒绝、restart保预选并清运行、world继续与死亡、脱战同步。
- [x] Run Vitest sk01b 确认 RED。
- [x] 最小实现：`fresh.rightPreparation=structuredClone(s.rightPreparation)`；仅 beginWorld 初建 `skills.slots={...prepared.slots}`；runtime合法改配才同步同owner模板。
- [x] GREEN 与 SK01A/EQ/CB/LT/World 相关回归。

## Task 2：准备界面与真实输入
修改 economy-ui、exploration-app、geometry-hud.css、right-skill-panel 文案；新 prepared-skill-view 小组件，只从权威读写。内联两张角色整备表，Q/R实际选项与空槽，E只读；事件委托与稳定DOM不破焦点。颜色复用黑#090b0d/文本#dbddd4/猎人灰青#9dcad1/阿尔暗金#d7b86f；标题SimSun、正文现有字体、槽键Consolas；不新造图片，不改六区。
- [x] RED 浏览器准备页实际按钮及键盘配置、进入真实Q/R结果、确认新世界保预选、模态阻止战斗输入。
- [x] 实现 callback→command，render只读；失败显示原因，成功显示下一出征方案。
- [x] Edge 1920与1280，类型/构建通过；发现真实产品损坏才扩测。

## Task 3：交接与选择性发布
- [x] contract/validation/handoff 记录实际通过、失败与未测；更新受影响索引、对账、状态/日志及术语。
- [x] 原稿/细则/黄金/头像保护，HEAD+本任务追加记录进入独立Git索引；未提交前缀原样保留。
- [ ] 核对远端，提交推送GitHub main，验证最终版试玩HTTP；停用户Gate，不启动SK02。发布完成以本机回执与交付消息为准。
