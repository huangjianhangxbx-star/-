# AUDIO-01 实施基准与技术取舍

基准 `3b54460`；2026-10-17接手，工作树干净。计划附件 v1.0 提供范围，外部 ChatGPT 链接跳转登录，未作为内容证据。用户已授权连续实施，原作音频/采集留忽略目录；不推 Gitee。

## 方案比较
- **原生 Web Audio + 游戏薄层（采用）：**浏览器内直接取得唯一主输出、音频时钟、总线和可观察节点，适合当前 TS/Vite 原型；需自己实现调度、缓存、资源和声部管理。
- Howler/Tone：可简化部分加载、播放器或音乐时间线，但当前未核验它们对此项目的全源注册、F10现场监控和语义生命周期是否现成解决；引入后仍需游戏层。
- FMOD/Wwise：作为事件、混音和Profiler职责的设计参照；本轮无已安装浏览器SDK或许可事实，不能把中间件名字当成实际可用后端。

MDN [AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume) 证明恢复Promise行为，[AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode) 确认一次性源节点；Google [A tale of two clocks](https://web.dev/articles/audio-scheduling) 支持音频时钟预调度。FMOD/Epic/Blizzard引用见计划包02；它们是原则来源，不代表已实现同等商业工具。

## 实施界面
一会话一个 GameAudio 所有者与AudioContext；旧BattleAudio和三条角色/敌人适配器只做语义事件检测，均注入此所有者。行动成立点发事件，合成回退和本机原作样本通过同一总线。独立Lab继续保留为隔离页，F10子会话默认静音。事件、音乐、区域使用数据定义。短音请求带来源/作用域/有效期，缓存异步完成不得补播过期动作。音乐采用同一音频时钟的诊断原始分轨；未查到配套原作stem不得声称原作变奏。

F10外壳提供父正式会话的现场监控页签；旧独立调试页仍可进入，但不可充当父会话监控。用户音量与临时snapshot分开。记录真实输出与试听能力，评分对未听项保留未知。

## 工作步骤
1. 旧四路与本机7件素材、现有研究BGM核对，来源清单/保护检查。
2. 先用失败测试约束事件目录、总线snapshot、并发、作用域、音乐规则与过期丢弃；实现单Context后端与本机小样。
3. 四路迁移，加入真实UI/对话/标题/世界事件，音频时间与Gameplay只单向消费。
4. 条件音乐/段落/分轨/stinger、空间/区域与资源管理，接入F10父会话监控。
5. 定向浏览器/输出采样/独立评分；补工程记录与GitHub发布边界检查。
