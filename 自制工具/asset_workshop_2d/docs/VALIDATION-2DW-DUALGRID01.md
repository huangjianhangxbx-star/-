# 2DW-DUALGRID-01 验证（2026-10-13）

工程技术交付；32项新增测试 +136项相关旧模块 =168通过。Typecheck/build通过，原生Electron九组通过。没有运行游戏/3D或无关全量测试。

本机证据：工坊 validation/dualgrid01/modules.log、compat-final.json、desktop-HUBpwb/result.json、latest-proof.json。桌面native picker路径由测试注入；真实鼠标、文件读写、剪贴板、确认弹窗、编译、重启和签名验证执行。原剪贴板已恢复。所有批准为signed synthetic/test-only，不是用户美术批准。

| ID | 状态 | 证据 / 边界 |
|---|---|---|
| A01 | 通过 | 固定Jess/skner版本与MIT，独立实现；tech-decision |
| A02 | 通过 | 16角bit字面枚举；dualgrid-core |
| A03 | 通过 | 0/15无轮廓，四直边；dualgrid-compile |
| A04 | 通过 | 孤角/内角方向穷举；dualgrid-compile |
| A05 | 通过 | 6/9分离策略；dualgrid-compile |
| A06 | 通过 | 单格四更新/鼠标擦拖；core与desktop-HUBpwb |
| A07 | 通过 | 边界哨兵/半格偏移；core/input |
| A08 | 通过 | Unity翻Y与实际c/PPU字面测试；mapping/core |
| A09 | 通过 | 新模块独立编译，无旧47PNG输入；compile |
| B01 | 通过 | 单图test-only工程进线；desktop-HUBpwb |
| B02 | 通过 | 批准原件/SHA身份；package/pipeline |
| B03 | 通过 | ZIP9连续A/B任务合同；samples/dualgrid01 |
| B04 | 通过 | 错尺寸/透明失败保存原件；compile/pipeline/native |
| B05 | 通过 | 显式窗口面积/坐标/前后SHA；pipeline |
| B06 | 通过 | 原创技术母图跨Render格像素回读；compile与full16 |
| B07 | 通过 | 兼容栅格边穷举/篡改硬负例；compile |
| B08 | 通过 | 墨线声明/源周期色差阈值警告；seam-check |
| B09 | 通过 | SHA重复率与可点坐标；diagnostics/8与16地图 |
| B10 | 通过 | art始终pending-human，不自动批准；全部结果 |
| C01 | 通过 | mask-00..15真实PNG；technical-result.zip |
| C02 | 通过 | atlas像素回读/重建验真；compile/output |
| C03 | 通过 | 原生鼠标逻辑格四显示格局部重绘；native |
| C04 | 通过 | 3/8/16、单格、岛、孔、棋盘编译PNG；proof |
| C05 | 通过 | 显示格trace四邻、mask、相位、SHA；native |
| C06 | 通过 | 错误80px原件进入返工ZIP；native |
| C07 | 通过 | 复用原workflow.productionGuard；package/pipeline |
| C08 | 通过 | ZIP9及结果重编译验真/篡改负例；package/output |
| C09 | 通过 | 离线、取消、实际剪贴板、重启与失败恢复；native |
| C10 | 静态通过 / 实机未测 | 16切片/外部映射静态通过；Unity运行未测 |
| D01 | 通过 | 36旧ZIP SHA不变，各自task/result验证通过；compat-final |
| D02 | 通过 | 原生旧ZIP8/47/188出口与普通入口；native |
| D03 | 通过 | 原风格契约未改SHA，相关tile-form定向回归；modules |
| D04 | 区分通过 / 真实试产阻塞 | 原创技术夹具明确testOnly；真实用户AI试产阻塞 |
| D05 | 通过 | 11保护SHA相同；未写3D/原作/开发细则/用户维护；发布白名单 |
| D06 | 待发布核验 | 选择性GitHub main发布；commit/push回执交接 |
| D07 | 通过 | 一页中文操作与离线技术样例；DUALGRID-ARTIST-GUIDE |

## 待人工与未测

M8真实用户手稿没有当前生产批准身份，未擅自将聊天截图、早期demo或公共参考变成批准图；本轮未调用AI生成，真实AI画风继承未测。计划允许技术交付并保留此项，不能勾选美术通过。工坊已可由用户导入准确原图后走完整流程。

素材边界目前是程序Lp轮廓与声明暗线，不保证保留艺术自由轮廓。源周期边界指标不能判定所有内部裂缝的语义连续；高重复率为机械SHA计数。canonical16在K4仅覆盖6.25%，推荐16世界相位覆盖全部母图；有限周期仍会重复。人工验收黑缝、转角自然度、整体成熟质感与大地图重复。Unity未实机，草地新批准、高墙高度/遮挡、GPU性能、大量多图压力不在本轮已验范围。

## 修复证据

新增栅格共享边Red暴露内侧采样的墨线差异，改为边界坐标0/1取几何覆盖，未平均原始RGB；穷举Green。新增atlas/兼容边负例Red→Green。保存picker等待期间保持串行，审批撤销阻止发布。UI诊断随地图/图源变化失效，避免旧“通过”残留。桌面脚本两处修正：滚动后鼠标定位改为元素相对坐标；旧47测试素材从相同四块改成真实不同原创变体，未弱化旧生产约束。沙箱账户无法启动Electron，授权后在独立profile执行，没有改系统ACL或关闭产品sandbox。
