# 2DW-TILE-02B 验证与限制

工坊0.5.0，显式protocol8/spec1.6.0/ZIP8；基础风格与旧协议保持。技术范围完成，人工美术和Unity保持待验。

## 实际证据

- 151/151受影响模块测试通过；类型检查和本工坊构建通过。命令：`node --test tests/tile-*.test.mjs tests/export-zip.test.mjs tests/clipboard-png.test.mjs tests/electron-isolation.test.mjs tests/environment-archive-2dw05b.test.mjs tests/ui-session.test.mjs`、`node node_modules/typescript/bin/tsc --noEmit`、`node scripts/build.mjs`。
- 定向 RED 包含不支持单图、无转换模块、错误UI检查，以及删除conversion权威字段仍被放行；GREEN覆盖实际PNG/批准/签名镜像/来源三件套与返工包。日志在ignored validation/2dw-tile02b/。
- 最终真实Electron11项通过，`desktop-eaTJa9/result.json`；截图为原生capturePage。文件/保存picker路径由测试注入，实际PNG读取、操作系统位图剪贴板、页面JS确认、HMAC审批、ZIP、转换、编译、应用关闭重开真实执行；没有把注入路径说成实际点击Windows文件对话框。
- 8个保护文件SHA不变，32个历史任务ZIP SHA不变且验包通过；原v6/v7规范/编译器、成熟石砖参考和风格规范未改。两族公开正式包+技术结果共4ZIP均独立校验。
- 实际AI两次调用、原稿SHA回读与47/188结果回验。详见[可行性](SINGLE-TO-CONNECTED-FEASIBILITY.md)，不将真实AI美术称通过。
- c64本机公开结果验包并重编译约1.31/1.35秒，正式任务验包18/20ms，结果ZIP229324/214409字节。这是一次本机测量，不是目标设备/GPU/最大规格性能基准。

## 计划验收矩阵

| 条件 | 结果与边界 |
| --- | --- |
| A01–A05、A08 | 文件/位图/唯一ID内容参考；无父single；原尺寸/目标格分离；4项诚实单图Gate；唯一批准SHA。定向模块与桌面证实 |
| A06–A07 | Alpha/尺寸记录，不自动抠背景或判断截图；经典转向与取消实测；人工确认图像实际含义 |
| B01–B06 | floor-flat与stone-front分开；拒绝/重修/规格失效；准确PNG正式包、pressure开关；签封身份校验通过 |
| B07–B08 | 32旧ZIP/8保护SHA保持；v8派生镜像重建、签名/字节篡改、批准检查绑定负例通过 |
| C01–C04 | ZIP自包含有序绘制/技术转换工序；程序生成编码而非要求用户手画；来源窗口/相位/SHA可查。AI工具读提取的文本而非自行解压 |
| C05–C07 | 两族47/188/九图、邻居与大地图、孔洞/转角；错尺寸、非法通道、重叠窗口、透明窗、伪转换凭据拒绝；共享框验真不证明无重复 |
| C08 | **待人工美术验收**；无用户准确最终PNG，不能冒充用户认可。实图有规则重复与局部取样损失 |
| C09 | floor模板无前侧面，视角检查为人工而非自动识别；真实试图未见自由斜透视；Unity复杂石墙Sorting待验 |
| D01–D04、D07 | 原生11项实测含导入/取消/重开/返工/旧入口，源图具体尺寸失败记录与SHA可见，同名ZIP写入保护由模块证实 |
| D05–D06 | 被批准的演练始终test-only；原生新文件/剪贴板只导入未批准。未编造用户手修分钟数 |
| D08–D10 | 选择性公开代码/原创夹具/记录；私有AI/密钥/研究原作均排除；人工/引擎边界写入交接 |

首轮桌面测试错误地跨进程序列化Clipboard Blobs，未能确认原剪贴板恢复；后续在Electron保留原对象并在关窗前恢复，不能据此恢复首轮前的用户内容。使用Ctrl+V前需重新复制PNG。原用户文件未修改。

## 复现与交付

`node scripts/tile02b-proof.mjs`生成新的原创证据目录，再把该目录verification.json路径传给`node scripts/desktop-tile02b-smoke.mjs <verification.json>`。桌面脚本会使用系统剪贴板，先自行保存所需内容。实际AI生成不属于脚本自动重跑，按记录与真实工具单独执行。

公开[样例和预览](../samples/2dw-tile02b/README.md)，[一页操作](SINGLE-REFERENCE-WORKFLOW.md)。本轮没有对全游戏/3D进行无关全量回归。运行依赖/锁文件未新增。
