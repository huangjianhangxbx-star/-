> 发布权限更新（2026-10-14）：用户随后明确要求上传 GitHub，并同步仅含游戏原型本体的 Gitee 快照。下文“仅本地/未推送”描述的是审核阶段，不再限制这次已授权发布。

# CR-SKILL-01 本地定向审计

日期：2026-10-14；任务为用户批准的架构收口计划 v0.1，替代 S3 全库填充。仅本地实施，不发布、不合入 main。

## 基准、隔离与读取边界

- 本机 main 与只读 ls-remote GitHub main 均为 `97a2aa9ac44928901ae227ce91fb42ae57c4e454`。相对 d2d1c46 的两次后续提交是地图工具；技能代码、CR 任务文件无差异。
- 原工作区存在工坊/验证媒体/历史日志等并行修改及旧 `game/tests/t016-playtest-fix.test.ts` 差异。完整 status 保存在同目录 baseline-status.txt；未回退或夹带。
- 独立分支 `local/crskill-architecture-close`；checkout 位于本目录 checkout。未把原工作区 dirty 带入。node_modules 及七个已知本机媒体工作目录以 junction 引用，未复制/编辑研究或媒体内容。
- 本轮完整附件、AGENTS、适用细则章节和实际 Skill 已读取。最新 ChatGPT 线程读取只返回内容引用占位；网页回到登录页，无法声称读到新增回复正文。以用户提供的完整专项附件和当前代码作为有效实施依据。
- design/开发细则.md、AGENTS、人工 `书面游戏设计.xlsx` 未改；黄金动作、engine、世界经济、目录矩阵与原始研究未改。

## 保留判定表

| 路径/接缝 | 实际调用/证明 | 分类、建议与删除影响 |
|---|---|---|
| core/ability-sources.ts | trialSourceStates→evaluateSources；P2、24来源测试 | KEEP_RUNTIME；注册定义/持有/仲裁为实际权威，不能删 |
| core/ability-trial.ts | 初始化主武器 composition，basic-definition/hunter/al/engine 调用 | KEEP_RUNTIME；真实资源/快照/派生实体生命周期；移除会丢失已证消费者 |
| core/trial-effects.ts | hunter/al/right-hand-skills 消费已接受伤害/CD/位移；S3 modifiers 测试 | KEEP_RUNTIME；不是纯目录倍率占位 |
| core/trial-combo.ts | trialBasic 调用，实际快速前缀与第三段组合；combo 测试 | KEEP_RUNTIME；5/6段消费者，不删除 |
| core/trial-ice.ts | hunterInput→startTrialIce，advanceTrial→区域扫描；ice 测试 | KEEP_RUNTIME；真实区域/周期伤害与清理；SAMPLE表现不代表死代码 |
| core/trial-reload-effects.ts | acceptPrecision、advanceTrial、reloadStart/Complete/Cancel | KEEP_RUNTIME；释放延迟、装填完成及失败不同语义，不合成通用规则 |
| core/trial-rocket-reset.ts | trialHitEffects、advanceTrial；reset/lifecycle 测试 | KEEP_RUNTIME；直接击杀与目标标记死亡回充分别保留；旧 caster 名单资格已修 |
| core/trial-progression.ts | engine 命令、准备页、RightSkillPanel；P3 和三根测试 | KEEP_RUNTIME；主实例等级/来源+真实库存支付，不能删为“实验桥接” |
| core/right-hand-skills.ts / right-skill-state.ts | engine 实际按键命令与模拟推进，默认 Q/R/E 亦依赖 | KEEP_RUNTIME；probe 复用实际右手动作/CD，不创建第二账本 |
| core/right-preparation.ts | prepared-skill-view、initializeRightSkills、世界重建 | KEEP_RUNTIME；准备模板非运行实例副本 |
| core/equipment.ts / basic-definition.ts / basic-runtime.ts / combat-identity.ts | MainInstance/动作冻结/实际伤害身份；golden保护 | KEEP_RUNTIME；黄金和实验共用的单一接缝，本轮保留 |
| hunter-combat.ts / al-combat.ts / engine.ts | 原生动作、唯一 CD、周期伤害及支付；相关回归 | KEEP_RUNTIME；未重写，不删除旧黄金通路 |
| core/weapon-activation.ts | validBody 校验 golden definition、主实例ID；CR定义不满足 | KEEP_RUNTIME；SK02 world.activeLevel 与 CR 每技能 level 隔离，不是重复级别权威 |
| trial-loadout-view.ts / right-skill-panel.ts / prepared-skill-view.ts | exploration-app 创建并实际打开/配置；浏览器流程 | KEEP_RUNTIME；当前UI消费者；只校正文案与类型接缝 |
| game/src/trial-catalog.json（45,754字节） | trial-loadout-view 静态导入，未实现分支显示禁用 | KEEP_RUNTIME + KEEP_EVIDENCE；当前UI依赖。没有证明启动性能问题，不为缩小文件盲目删或异步改造 |
| S3-coverage-matrix.json（942,288字节）/catalog-index.json（302,966）/S3-source-gaps.md（60,237） | 681身份及来源/状态追踪；不被游戏运行时导入 | KEEP_EVIDENCE；不是运行时脏数据，未删改 |
| P1/P2/P3/S3合同、架构建议、CR测试 | 历史批准/保护/实际消费者来源；本轮复用 | KEEP_EVIDENCE；分期口径保留，新增当前结论，不覆盖历史 |
| work/参考研究 与 work/CR-SKILL-01* | ignored 原方法、指纹、资产；本轮只访问已知路径 | KEEP_EVIDENCE；未遍历或清盘，不以 ignored 判断可删 |
| rootEnabled、trialPreset=p1、addTrialSource | P1兼容初始化/旧测试/显式诊断 URL 仍调用 | POSSIBLE_DEAD（清理候选尚未证明）；当前不能删；保留实际兼容 |
| P1-only消费者注释、S3继续全库/火箭4交接口径 | 与本轮目标冲突 | STALE_DOC；已局部校正或添加新决定，保留历史 |

## 缺陷和改动理由

1. 原有封闭来源/根注册限制了验收：新增主实例可选只读 registry 接缝，生产默认常量不变；测试身份只在测试目录。未把 fixture 计为原作技能。
2. 新 registry 补证中复现：调用方改定义会倒改已 Accept 伤害。现在复制/冻结来源定义及递归 modifier，旧动作不追改。RED 1086≠117 → GREEN 117。
3. 新 registry 补证中复现：分支索引存在但消费者缺失时仍可能扣石并升级。查询现在同时核对真实注册定义、职业、主动分支来源及匹配根；缺失/unresolved纯拒绝。RED true≠false → GREEN。
4. 原回充接口仅核对主实例与 generation，未核对当前名单：移除 caster 后显式晚到标记仍能把CD置0。现在校验当前唯一名单对象和 context.actorId。RED 0≠5.94 → GREEN；Z切人仍返还原caster。

5. 新世界重建时，不存在于当前 registry 的测试根仍可能留在运行槽，造成悬空配置；现按当前职业 registry 校验并清空失效运行槽，正常已登记准备与等级重建规则不变。RED probe≠null → GREEN。

没有确认必须删除的 PROVEN_REDUNDANT 功能簇。本轮未删除整个文件、研究数据或测试；少量行替换为缺陷修复/接缝/文案。没有进行大规模清理。

## 保留风险

- registry 是内部只读依赖，不是完整通用插件安装/存档体系；第三 probe 使用既有独立 al-stab 消费者。多个新根复用同一 adapter 的独立资源拓扑尚未承诺或验证。
- 原冰路等保留已批准 SAMPLE 与来源缺口。原作 OBS 仍空白。
- catalog 为静态 UI 数据；构建仍有既有大 chunk 警告，未做性能基准，不据此认定数据脏。
- 原工作区人工区在 worktree 中不自动出现；本轮不复制人工原稿。
