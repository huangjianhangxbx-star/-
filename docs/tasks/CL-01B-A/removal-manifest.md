# 删除、保留和延期依赖

| 路径/消费者 | 删前引用与职责 | 本轮处理 | 替代与验证 |
|---|---|---|---|
| `game/src/ui.ts` | main 的非正式分支构建旧 HUD；ExplorationHUD 引用 UIState 类型；包含卡牌、影体、旧侧栏/节点控件 | 物理删除旧 HUD | 纯类型移入 hud-state.ts，当前 ExplorationHUD 用于正式及必要开发场；实际 bundle 模块审计、自然双人输入 |
| `hand-drawer.ts` | 仅 main 的 Tab/手牌框消费者 | 物理删除 | 无正式职责；Tab 保留空所有权，旧键及开发路由验证 |
| `card-motion.ts` | 仅旧 HUD CardMotion，main 售牌/使用动画 | 物理删除 | 无正式职责；卡牌生产及构建审计验证 |
| `build-ui.ts` | 仅 main 旧构筑/配置点击消费者 | 物理删除 | 不删未来技能/装备核心目录；类型/全量共享测试验证 |
| main 的旧卡、召影、召回、部署、侧栏、拖售、背包、快捷装备、数字选择、旧节点配置事件 | 旧 DOM 可生成操作和慢速/瞄准状态；普通入口已有条件隐藏但静态依赖仍在 | 移除这些客户端状态、分支、监听和每帧消费者 | main 保留轻量路由；唯一 exploration-app 保留黄金动作、G/F/Z、经济/帮助/NR 模态；无第二份旧 main |
| `economy-ui.ts` 旧影庭/Tower模板 | 同文件混合正式携入/同行者及历史影庭页 | 移除历史模板，保留正式原模板和校验 | 当前资源不足拒绝、合法携入/兑换/世界继续；不换正式位置和布局 |
| `world-feedback.ts` 旧卡线、救援/撤离提示 | main 每帧处理隐藏卡牌和退役救援按钮 | 删除旧消费者，保留选路 SVG | F 真预览/确认、旧 DOM 不存在；深层死亡状态不改 |
| `core/cards.ts:eventCard` | exploration.enter、engine 击杀与 Tower.enter 共同调用 | 只关闭正式 sessionMode 的事件生产，保留隔离历史夹具 | 普通入场/12 次真实核心击杀/离区继续/新世界卡与 pending/cardEvents 均空，收入保留48；历史测试仍有原卡 |
| `?legacy=1` 与 `?scenario=exploration` | 完整旧塔防与旧复制体/节点交战页面 | 退休说明与明确返回链接，不加载游戏客户端 | 页面无 Canvas/prototype，正式跳转、EN01/xx/AL 仍可用；不恢复旧塔防完整可玩 |

未删除原骨架、贴图、音效、人物画像或研究资料。客户端静态和 DOM 依赖、核心 typed Command 依赖、动态开发/素材加载依赖分别核对；不把资源未引用等同于原素材应删除。

## CL-01B-B 与后继前置条件

| 保留链 | 当前真实消费者/原因 | 承接 |
|---|---|---|
| engine/cards/clones/waves、node/expedition/settle 的数据与命令 | engine typed Command、历史核心用例、共享基础实体工厂/经济/world 清理；删 UI 不证明整链独立 | B 批及 QST 接管生命周期后 |
| downed/rescued/respawning 与放弃离区交易 | queryExplorationExit、黄金角色死亡、当前世界合法放弃，不能本轮另造复活 | LT-01 |
| weapons/weaponIndex、职业和换装 | 几何/伤害/耐久、未来 EQ 消费、共享黄金/几何测试 | EQ-01/02 |
| E/R/T 旧技能库/slot/成长 | 当前支援同行者、离手自治、战斗与未来资源配置；只删旧配置面板 | SK-01～04 / INV |
| 部分历史基础 CSS 和通用 Interaction/skill-ui | Interaction仍用于直接输入状态/模态，skill-ui的skillStatus/skillButton仍被rework-boundaries.test.ts与skill-slots.test.ts检验；实际bundle已无skill-ui，但不能假称其测试依赖已解除。本轮只剥离证实专属CSS，不声称所有历史样式已清空 | B 批依赖审计 |
| 大量旧 Tower 浏览器剧本 | 测试完整旧产品流程，当前产品已退休；不是本轮全浏览器兼容承诺 | 冻结历史证据，必要共享几何/core 用例继续执行 |

最终实际文件/行数、bundle 模块与体积、残留引用事实见 validation 目录。本表记录授权处理方向，技术结果以验证报告为准。


A5资源修复：`view/reference-enemy-spine41.ts`原家族GPU池在最后租约归零后销毁并重载；本轮真实第二次新世界出现纹理请求挂起。最小重载RED与复测见test-migration.md。页内改为两个家族各一个共享GPU owner，骨架/输出与租约继续释放；idle owner保留、有上界，不改变动作或战斗数据。
