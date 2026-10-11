# EQ-02-F01 / SK-01A 连续实施计划

**目标：**右手技能资格与左手独立，先纠正猎人 E，再接三真实 QER 槽。
**基准：**main 6d6dfa2538e9decc3c030db432e84942acd0296b。目标源码无原有修改；t016 测试、地图工作台、项目状态中既有修改保留。
**依据：**用户本轮“读取理解并执行”覆盖整包 A/B；00 总说明、01 修复、02 SK01A 及截图四份 SHA256 全通过。较新对话明确两手独立，助手正文只返回引用。开发细则 v2.2 B 级；不是全历史回归。
**技能：**brainstorming 核对已经批准的架构与边界；writing-plans；TDD / writing-good-tests；配置 UI 使用 frontend-design，沿既有黑底纯色细边、原字型和 QER 菱形坐标。

## A：独立修复
- [x] 新增 eq02-f01.test.ts：炸弹/破盾 E 真 Accept、28 体力一次；RMB 盾资格仍拒绝；投弹前摇锁、C/Z 不串身份。
- [x] 先运行 RED；hunter-combat active 不查左盾，HUD/装备说明纠偏；迁移 eq01 过时断言，不改历史合同。
- [x] EQ01/EQ02/F01/CB02 定向检查、类型/构建；实际鼠标装炸弹 + E 完整 prepare→charge、RMB 与 C。
- [x] 独立技术通过记录后开启 B。

## B：SK01A
- [x] 核对现有 slot/state/accepted action 与伤害边界，形成右手实例配置、E 固定位、Q/R 可互换/卸下。拒绝无副作用，实例生命周期沿 equipment 保留。
- [x] 先写 RED：真实 Q/R 命中、单次付款/CD、所有权、空槽/障碍/动作拒绝、两人/两形态/副手无关、取消/死亡/同世界延续。
- [x] 最小模块 right-hand-skills，已有单一 resolveHit 为唯一伤害权威；E 仍调用原生输入、Q/R 新 Accepted 及缓存来源，4 样板明确 SAMPLE。
- [x] QER 真实物理输入、repeat/keyup/modal/G/F/Z/失焦；保留旧伙伴隔离。HUD 原框内可用状态与技能配置安全模态。
- [x] 2–4 核心小集、构建、3–5 真实键鼠剧本及 1920/1280 必要实屏；失败定向修复，不扩大历史套件。
- [x] 新任务合同/验证/交接，现行记录仅追加，两阶段选择性 GitHub main 提交推送；保留其他 dirty，不同步 Gitee。

Q/R 推荐表参数是本包批准用于可玩样板的 SAMPLE，非原作事实；E 原动作/28费用不变。E 任意改槽、成长/V/被动/AI 自动施法、完整职业库均不做。最终停止用户试玩。
