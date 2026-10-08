# AR05-F03 小蓝单身体专项修复

基准 main@f8fcba32f7135f01b00298893ba800d0a80422be；用户批准执行外部 F03 v0.1。范围仅小蓝 Spine4.1 主探索和 Action Lab 视觉；GitHub main 可提交推送，Gitee 禁止。大量既有工作树修改留存，开工指纹在 ignored work/AR-05/F03/intake.json。

采用 diagnosing-bugs、writing-plans、test-driven-development；范围与验收已由外部计划明确，没有新增设计决定，不需要重复访谈。基础细则按当前 AGENTS/design/开发细则 接手；本任务未引用独立 Spine 专项细则。不使用 Unity 项目记忆技能，不修改用户维护区或开发细则。

实施顺序：原生 Canvas 和真实探索复现 → 独立单头部 RED/完整性保护 → 单变量探针 → 两入口最小修复 → 原生矩阵/输入与黄金回归 → 工程记录与 GitHub 推送 → 用户视觉复验。

## 已确认根因

从已绘制的站立左向转向左上攻击，A4 .229–.379 秒可见 zuoshang 与 shang 两套头部。同一时刻一个 Hunter Unit；重叠已存在于单个原生 Canvas，不是 Three.js 增加角色造成。无此前已应用方向轨道的静态逐帧重建不能稳定复现。

4.1 AnimationState.setAnimation 产生 mixingFrom 链。当前视觉直接设置权威 trackTime，不调用 AnimationState.update；旧方向轨道因而未退出。原 vendor updateMixingFrom 要求 mixTime>0 才清链，update(0) 探针仍失败。清 Track0 仍失败；清 Track1 后相同帧只有一套头部。

最小修复：仅小蓝方向变化时 clearTrack(1)，随后 setAnimation 新方向。方向本来就是离散选择、默认 mixDuration=0，不引入额外时间推进。原遮罩保留受约束英文部件；骨架/atlas/PNG、Track0 时点、黄金战斗、输入、音效、Yellow 与 3.8 不变。

## 验证计划

- 真实 draw 调用：已绘制站立 → A1–A4，单套可见头部分支，Track1 无旧 mixingFrom。
- A1 左 .1333 部件保护：完整结果与粗暴全英文删除结果不同，完整结果只有一套头部。
- 13 姿态×5方向×2镜像×6关键时点，加入站立方向前置；真实 held/换向、两入口一致。
- F01/F02/AR05/T036 浏览器、全 Vitest、两个构建；不以相互像素一致替代单身体检查。
- 原素材和既有工作树指纹保护；最终停在用户“不重影、不缺部件”视觉验收，未启动 G01。
