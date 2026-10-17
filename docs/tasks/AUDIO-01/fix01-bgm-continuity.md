# AUDIO-01 FIX01：BGM 连续性与普通对话（v1.0）

基准 `4f7638b64fe5b1c88409448b098a23f32ceca90a`，2026-10-17。附件《BGM连续性与对话不中断》v1.0 已完整读取；同轮执行授权有效。工作树只有上一轮未跟踪标题截图，保留并排除提交；5176/5177 服务指向当前 checkout。外部 ChatGPT 链接跳转登录，不作为新增对话证据。

## 已批准修复设计

只改音乐选择、内容身份、持续播放、混音与资源生命周期。`ruleId/reason` 可更新，`playbackKey` 按素材/版本/段落/循环规格确定；相同内容保持 source/epoch/transport。普通对话只持有 `dialogue-focus`（music .45 SAMPLE），不自动抢曲。交战选曲读取已有 `state.context` 权威，不修改玩法。异步加载只填缓存，播放器在有效情境下重新解析，明确停止/销毁后不自动复活。F10 补有限连续性诊断，不改媒体。

## 执行步骤与文件

- [x] 在 `game/tests/game-audio-policy.test.ts` 纠正旧“普通对话选独立曲”断言；新增定向 `game/tests/game-audio-continuity.spec.ts` 复现同曲重启和真实对话断曲，先记录失败。
- [x] 在 `game/src/game-audio/` 分开内容身份与规则、维护 transport 和有界变更记录；复核异步加载、停止/世界/销毁和预约淡入。只增必要内容描述纯函数，不建立新调度框架。
- [x] 在 `exploration-app.ts` 使用既有队伍交战权威；普通对话快照和输入/世界时间不改。`monitor.ts` 补 rule/key/transport/起播/累计时间/循环/源状态。
- [x] 对 M01–M11 做 B 级定向验证；一条真实 home 曲→角色菜单/气泡停留8秒→结束→自然区域往返录音乐/主输出与时钟，原作与录音只留 ignored `work/AUDIO-01/FIX01/`。
- [x] 独立只读监工只评本次修复，最多3轮；不改旧7.4分报告。不虚构试听，完成后选择性提交推送 GitHub main，不推 Gitee，更新本记录与项目状态/当日日志。

## 验证与交付

生产构建/TypeScript通过，策略4项通过。先红后绿：旧逻辑下普通对话策略、同内容十次切换与真实对话source保持断言失败；本轮修改后通过。定向浏览器最终结果和独立评分在下方登记。没有人工试听，只报告播放状态与客观输出。

### B级定向矩阵

| 条目 | 验证与边界 |
|---|---|
| M01 稳定播放 | 正式home已加载后模拟AudioContext前进30秒，累计进度增30、source/transport不变；是时钟模拟，不冒认30秒真实输出。 |
| M02 同曲跨区 | 真实home十次规则切换；另以WASD自然跨界往返，rule变化但playbackKey/source/epoch/startCount不变。 |
| M03 对话继承 | 实际角色点击菜单→气泡→停留8秒→F推进/鼠标选项→正常结束；真实home不断曲。 |
| M04 对话退出 | 正常结束、两次Esc取消、模拟目标死亡使会话失效；均释放dialogue-focus，保留另一混音所有者及用户音量。 |
| M05 延迟升级 | 拦截短WAV加载，普通对话期间诊断曲继承，解码就绪只升级一次，20次tick不重复起播。 |
| M06 交战权威 | 无敌人测试夹具，真实鼠标空挥触发现有attackCommit、Z切主控、既有3秒calm恢复、再次空挥；不注入context/lastActivity。原8秒墙钟等待在整组运行时超时；诊断显示游戏时间仅0.61→3.11，lastActivity固定0.21，尚差0.1游戏秒才满足3秒calm（无敌人/追击）。放宽墙钟等待到20秒，不注入游戏时钟、不改生产玩法；移除敌人只是固定空挥夹具前提。 |
| M07 混音/监控 | volume/mute/solo/F10开关不重建同曲；用户音量和其他snapshot保留。 |
| M08 内容身份 | 同文件不同有效section/loop规格产生不同key与transport，允许换曲。 |
| M09 循环 | .25秒合成WAV有效循环，loopCount增加而transport不变；不等待真实home整曲结束，不推断原作loop点。 |
| M10 生命周期 | 延迟资源在换世界、stopAll、dispose后均不复活；换世界后已设新有效combat情境，旧home加载完成不覆盖它。 |
| M11 预约起播 | 已预约诊断三轨的强度连续变化不取消淡入；开播后3轨存活且gain非零。 |

### 真实输出证据（本地，不提交媒体）

- `work/AUDIO-01/FIX01/home-continuity.json`：100ms采样，包含audio时钟/游戏时间/位置、rule/key/transport/epoch、快照及音乐峰值。
- 同步录制 `home-music-only.webm` 与 `home-master.webm`，分别来自现有music总线与同一master输出；不会用音效掩盖音乐缺口。8秒对话期间source身份、home key与transport保持，结束后用户音量.33和其他snapshot .7保留，最终有效music约.231。
- `combat-authority.json`：上述无敌人夹具真实空挥/切主控/自然calm的选曲历史。短时战斗换曲仍可发生诊断→原曲升级，现有128MiB缓存可能重解码被淘汰曲；这属于内容可用性切换，不声称所有场景只起播一次。
- 所有原作候选仍为旧轮本机评估媒体，不新增来源/场景绑定/循环点证据；测试短WAV仅由测试路由生成，不放开正式素材白名单。

### 独立评审范围

只评价FIX01技术修复，四项权重：同曲连续3、对话继承3、合法换曲2、生命周期/诊断2。旧整体音频第三轮7.4分保持；人工音色/听感、完整历史跨场景/离线等旧缺口不在本轮自动补结论。独立报告另存fix01-critic.md。

### 最终验证

2026-10-17 最终整组 `npx playwright test game-audio-continuity.spec.ts game-audio.spec.ts`：22/22通过（12项FIX01、10项共享音频回归），约1.1分钟；M06含真实输入/游戏时钟脱战11.2秒墙钟完成。`npm test -- --run tests/game-audio-policy.test.ts`：4/4通过。`npm run build`包含TypeScript通过，只有既有大chunk提示。`git diff --check`无空白错误；GitHub main fetch与接手HEAD一致，无并行远端差异。5176试玩服务HTTP200。

交付仅本轮源代码、测试、现行规则与工程记录；未跟踪game/docs旧截图保留排除，所有原作/录音/诊断JSON仍ignored，不上传Gitee。独立技术复评见[本轮报告](fix01-critic.md)，人工听感未验。