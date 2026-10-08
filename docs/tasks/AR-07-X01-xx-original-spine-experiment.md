# AR-07-X01：xx 原创Spine试装

状态：技术可玩版完成；用户视觉和手感待验。计划v0.1；main基准ae4613c16436433be964209c5fbb128a388c639f核对一致。真实开工工作树551项既有文件指纹保存在work/AR-07-X01/intake.json；保留未提交工作，不操作Gitee。

本轮brainstorming按已批准外部计划检查边界；writing-plans组织以下步骤；TDD先失败后实现，motion-design用于源事件/权威时间一致；frontend-design只做动作检查页。已读根AGENTS、开发细则v2.1全篇、相关CurrentRules/索引/对账/状态、AR05-G01/F03和AR06合同。无独立Spine专项细则被本计划引用。无需Unity记忆技能。没有关键范围冲突，不重复询问局部实现。

## 计划与边界
- [x] HEAD/未提交内容/保护范围接手，审计源工程与旧导出的版本差异。
- [x] 只读CLI重新导出，110动画/原事件全清单，4.3模块运行库隔离，真实预览帧。
- [x] 独立XX_PROFILE/xx-combat/XXVisual，窗口/判重/独立解锁，原角色代码参数不改。
- [x] 先预览再主探索显式可逆替身选择；内部hunter ID，展示xx；仍最多两本体。
- [x] 主HP/命中身份/AI/移动与中断，真实键鼠/两人Z、pause/blur/变速、清理与原角色回归。
- [x] 保护检查/工程记录、GitHub main任务增量发布，停止用户复验点。

非目标：正式第三角色、长期存档、Hunter G01或Al时序修改、增加新技能或全部源动作消费者；不修改源.spine、开发细则或人工区，不公开上传原二进制，不同步Gitee。

实施入口：game/src/core/xx-profile.ts、xx-combat.ts；game/src/view/xx-spine.ts；xx-preview.html。窄接入basic请求/清输入/受击/主HP回调/direct移动锁/主HUD/本地资产白名单。xx替入猎人，阿尔或原其他伙伴保持原选择。缺少格挡/主动适配明确禁用，源dodge暂不映射新增位移能力。素材与SAMPLE见[审计](AR-07-X01/xx-animation-audit.md)。

试玩：/xx-preview.html单角色原动作检查；正常入口选独立探索，勾xx（实验角色）替换猎人，选择同行者出发。/?xx=1可预先勾选；刷新普通/恢复原角色入口即关闭会话实验。WASD、鼠标指向、LMB按住/点击、Z切换；其余战斗能力未适配。

最终验证、旧EC10基准失败分栏、本机视频与恢复操作见 [验证交接](AR-07-X01/xx-validation-handoff.md)。测试通过不等于用户认可；AR06 RMB待用户验收状态维持。保护检查完成；提交推送按当前main增量进行，最终commit与远端回读在本机publish-receipt.json及本次回复。开工后并行2DW推进至c10b392，已确认不影响本任务game基准。
