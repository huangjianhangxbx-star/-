# EN04—EN06 连续交接

技术实现已按C1/C2/C3分段冻结。C1 `ede865653a4b1fea634a5219c3ea695b9ebce9f2`即时架势；C2 `99b4596a7c949c3806a5056cf3bf342a36194e44`具名群体与身体空间；C3为包含本页的提交。发布仅GitHub main；每阶段的完整commit和remote一致性在对应`work/EN-0N/publish-receipt.json`，最终C3收据由发布操作生成。

## 试玩入口

保持本机开发服务器5173。以下参数选本次具名主探索，不会进入旧EN01夹具：

- 双人混合：`http://127.0.0.1:5173/?enemies=v2&mode=mix`
- 三怪2+1：`http://127.0.0.1:5173/?enemies=v2&mode=three`
- 四怪2+2：`http://127.0.0.1:5173/?enemies=v2&mode=four`
- 五怪3+2压力：`http://127.0.0.1:5173/?enemies=v2&mode=five`

单僵尸`mode=zombie`、单弓`mode=ranged`；面板按钮也可切换并重置同一主世界。WASD移动、Z切猎人/阿尔；左键普攻，猎人右键方向盾、阿尔右键射击；Shift原闪避，E各自原主动；按住G选择集火/集合/谨慎/自由，Space暂停。正常试玩不要用H召回伙伴代替两本体。

交付消息带`v=短提交号`便于区分新链接，但v不是历史版本锁定；旧链接刷新也会读取当前本机代码。服务器停止/电脑重启后需重新启动，URL不能在其他电脑远程访问。

## 冻结物

代码契约[EN06-runtime-contract.md](EN06-runtime-contract.md)，剧本[EN06-scenarios.md](EN06-scenarios.md)，本轮结果[EN06-validation.md](EN06-validation.md)，有限测量[EN06-performance.md](EN06-performance.md)。原始日志/截图/读数在`work/EN-04/`、`work/EN-05/`和`work/EN-06/`；新证据和恢复后的历史证据分开。

本机收口包`work/EN-06/EN04-EN06-freeze.zip`只包含本轮合同、必要文本日志/自然轨迹/性能摘要和来源对应，排除素材/第三方二进制。包内manifest记录实际C3和各文件SHA256，不用未核原作结果填补研究空白。可以由用户交回研究侧，本任务不自动发消息。

## 待用户与后续

玩家猎人/阿尔黄金认可继续有效，新架势/僵尸/骷髅弓/群体和SAMPLE声音仍待实际试玩认可。五怪为压力场；软件WebGL测量不等于物理GPU验收。原作动态OBS实际结果空白，未新增类型/地图内容或全知AI。

已知历史浏览器字段：旧AR05伙伴`.spine.names.attack_01`已过时，本轮以当前Blue41/Yellow38自然四段兼容验证；两条T036旧`.evasion.charges`留后续，不包装通过。现有HUD在1440×900场景占比仍偏大，诊断已默认收起，正式UI整理留专项。

用户较新聊天提到整套普攻之间停顿短；此轮依据合同保护现有黄金和终段恢复门，未改玩家时间参数。该体验问题单列后续，不能以怪物换代顺带重调。
