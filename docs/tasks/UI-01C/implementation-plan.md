# UI-01C PPT布局还原实施计划

**Goal:** 修复正式HUD的PPT比例及阿尔用户头像绑定，停在用户审美验收。
**Architecture:** HUD消费现有权威状态；在1920×1080设计画布上按六区尺寸、四角/底部锚点等比缩放。角色身份位置固定，Z仅切高亮和技能消费者。
**Tech Stack:** TypeScript DOM/CSS、已有RGBA几何PNG、Pillow连通背景蒙版、Playwright/Edge。
**Spec:** 本机work/UI-01C-20261010/input/UI-01C-严格还原与后续衔接-v0.1/01_UI-01C_PPT严格还原与阿尔头像修复_执行计划.md，v0.1。附件02只读不执行。

## 约束与基准

HEAD/远端github/main均36eef0b9453b0202c28150f0bf22bc753497c5a1；4490既有跟踪文件工作字节冻结，历史未提交/暂存保护。14个包清单SHA通过。没有HUD目标路径冲突。
用户三被动决定保持level1/2/3；level0无效只记录，成长不实现。无新体力、Y瓶、农业、Q/R、天气/日历消费者。黄金战斗/AI/世界核心不改。
Skill实际读取：brainstorming（已批准的范围明确修复，沿用计划批准不再重复询问）、frontend-design、writing-plans、TDD/writing-good-tests、xinghai-ui-geometry、Presentations（只读PPT）。执行计划子技能不在本机可用列表，按当前会话顺序执行，不伪称调用；不额外开子代理。

## 设计与任务

沿用黑#090b0d、细边#8ca9a3、生命#af6067、架势#c9b16b、文字#dbddd4。标题宋体、数值Consolas、正文微软雅黑。签名结构为左下大圆头像和右下不对称QER三角；不增加装饰或动画。

- [x] C0：原生PPT只读导出8页，画布约13.6/96.4/1135.6/638.8px；取整数14/97/1135/639。保留源哈希、AI初测和三槽覆盖说明。三档现状截图与DOM、RED新验收测试。
- [x] C1：改game/src/exploration-hud.ts正式集群，保持data-body/data-actor；geometry-hud.css用统一设计单位和身份布局，清除上下同款卡/竖动作表。
- [x] C2：按计划明确允许的连通白底蒙版处理原头像，保留眼睛/肤色；只为ranger身份绑定al-user.png，不更改Unit.asset/动画。
- [x] C3：复用既有portrait/bar/square/diamond，不再重生几何变体；上下武器、Y/自由槽、三被动、Tab十格、QER及V分别定位。无新键盘监听。
- [x] C4：运行ui01c.spec.ts，三档无重叠/真头像/禁用槽/角色切换/真实血条。1920六区偏差≤1.2%、大小≤8%、IoU≥.8；配合内部排列检查，防空容器伪匹配。
- [x] C5：真实键鼠普通探索+敌群+Z/LMB/RMB/Shift/E、G/F、篝火、合法离区继续/重建；ActionLab/xx烟测；全量核心、类型、双构建。失败日志保留。
- [x] C6：生成同尺寸PPT/实机并排、50%叠图/矩形对照、前后图和尺寸JSON；更新本任务/项目状态/当日记录及受影响对账/索引。替代index选择性GitHub/main提交推送，核对历史字节和远端，停在审美Gate。

测试先验证真实DOM、图片加载、权威状态，不用源码字串断言。期望矩形从独立源PPT测量得出；测试读取现有状态只为观察，不注入HP、位置或假成长。

技术任务完成；最终停在用户审美Gate，未把技术PASS当作用户认可。
