# TOOL-015 实施与交付

用户已授权执行附件 PLAN.md M0–M8。基线 GitHub/main 1d3b15e；保留TOOL-014布局/画布列表/顶层菜单和唯一主会话。后续N1–N4不自动实施。

## 实际模块

| 范围 | 实现 |
|---|---|
| M0 | 原创门洞/后墙、平板/L角、对称柱，三精度、负坐标/非零origin；测试目录与样例独立于用户资产 |
| M1 | PaintSurfaceDomain共面全局UV、完整占用/owner外露面判断；CanvasView逐像素可见性缓存；源与草稿隔离 |
| M2 | 色轮/色板、HEX/RGB/HSV、当前/上一/最近色、Alt吸色；直接工具栏、方圆笔头、16/8/4px复位、覆盖外轮廓 |
| M3 | 整数直线/折线/矩形/椭圆、描边/填充与Shift约束；1px自由画笔修整；原笔快照重建、取消零写入 |
| M4 | 单平面矩形/连通选区、加减/反选/清除；小面/共面/选区填充及RGB最大通道容差；选区擦除不删体素 |
| M5 | 共用SymmetrySpec，作者空间XYZ及组合、固定中心与显式半格吸附/选点；精确像素中心/法线映射、去重/范围裁剪、镜像可见性选项和跳过统计 |
| M6 | 普通候选后镜像，体素增/擦/染、三维/搭积木/创造；对象模式不合并新格，编辑模式阻止其他owner；旧像素完美先修整再镜像 |
| M7 | 最多4笔、32MiB总差量的顺序队列；确认源/在途/待发/活动草稿分开，发送前基于最新确认源重放差量；失败冻结、同ID同内容重试/显式放弃；保存/历史/返回串行 |
| M8 | 便携版/原创样例/三步说明/源码指纹与最终包复测，最终回执在本文补记 |

PaintSurfaceDomain/paint-raster/paint-selection/symmetry-space负责纯逻辑；surface-paint-tools负责输入手势，paint-command-queue负责客户端顺序，SymmetryControls按资产+对象+画布隔离本机偏好。父/子窗口共享经过校验的同一设置；不写资产字段，不移动Root。权限协议仍为paint/undo/redo/save，未放宽子窗IPC。

发现并修正旧缺陷：删除带faceTone的体素没有清掉对应键，EditorDocument.commit因此拒绝。现在删除时清理该格六面，笔前快照仍完整保留，三精度测试证明Undo恢复几何/手绘/暗面与其他物体。

## 验证状态（打包前）

487核心测试通过；类型/构建通过。真实Electron包含选色不dirty、跨洞直线不染后墙、镜像与选区填充、20笔=20次有序修订、折线Enter/形状Esc、125%窗口缩放、共享中心、主工坊对称增格与整次历史。原绘画六面三精度、失败保存/关闭取消、租约/重启故事通过。画布列表和菜单命中回归通过。

Blender 5.1.2：三精度×六面角像素纹样FBX+PNG回读通过；实际窗口折线/填色/建模后资产的GLB/FBX再导入，8个网格、450个UV循环、实际RGB(69,103,137)存在，源文件字节不变。证据tool015-actual-export-OIfr1v与paint-fbx-SfUgyC。

未执行：本轮团结接收器实机、物理显示器/DPI切换、全部旧入口、长时极限压力。125%为Electron实际页面缩放。图层/alpha、复用、自动边带、手感增强仍分别为N1–N4；任意非共面展开/跨不同画布写入未做。Gate P-A用户审美/手感待试玩。

默认沿可见表面；形状锁平面。隐藏镜像只允许精确的外露对应面。预览绘制完整覆盖集合的外边线，作者数据按完整有限掩码/预算计算，超限整次拒绝。折线上限128节点；待确认笔触上限4笔。B级定向验证，不声称完整SAI功能。

补充可靠性：未结束手势按保存/历史会保留草稿并提示先完成或Esc取消。原生关闭与父窗口关闭统一通知受控客户端，客户端取消活动草稿、排空已结束队列后才确认关闭；父窗口等待真实closed事件后释放会话。真实窗口四笔延迟队列+父关闭验证全部保留。删除暗面键只清六个对应键，不在每格删除时扫描整份暗面表。

## 最终便携程序回执

第一包M0–M8技术交付完成；Gate P-A仍为用户待试玩。功能/包内commit：c305a3bfbf32ba4e8272f6a281742b5fe80aed69。sourceFingerprint：818ec1c8917ce7d1b055d121ff16fc84e0a182f20d3e7fd5954953c0dd79b0a1，本地源码重新计算与包内值一致。构建时间UTC：2026-10-24T23:03:41.475Z。

运行路径：自制工具/map_editor/release/星骸地图工坊-Workshop-M2.0/星骸地图工坊.exe。重新启动旧窗口后使用。旧TOOL-014 cfbfb13完整目录保留在同级Workshop-M2.0-TOOL014-cfbfb13。练习项目在程序目录“示例/精确绘画与对称/project”，三步说明随包提供。

最终EXE证据（验证目录不提交用户资产）：
- tool015-exe-toolkit-final.log / surface-paint-ui-t7D0JB：真实色轮/色板/上一色、Alt取色、尺寸复位、跨洞线不染后墙、对称/选区填充、20笔有序修订、折线Enter、形状Esc、活动草稿保存拒绝且不消失、四笔排队父关闭全部保留、共享中心和建模镜像/历史。1500×940、1280×800为BrowserWindow实际内容尺寸；另有125%页面缩放。
- tool015-exe-window-final.log / surface-paint-ui-ngE4kr：三精度六面、擦除/历史、租约拒绝、保存失败/关闭取消、五次开关、进程重启。
- tool015-exe-continuity-final.log / surface-paint-ui-pP35yN：800ms确认延迟前/中/后的白色笔触RGBA均为255,255,255,255。
- tool015-exe-list-final.log / surface-paint-ui-LCdrOS：画布管理/合并/历史/重启/草稿与租约回归。
- tool015-exe-menus-final.log / viewport-workshop-fQA9fL：三尺寸与150%菜单真实命中、互斥/Esc/关闭不透点。
- tool015-exe-sample-final.log：原创练习项目从正式打开入口进入模型。
- tool015-actual-export-final.log / tool015-actual-export-0LV1hl：本次最终EXE作者源导出的真实GLB和FBX+PNG再导入；各8网格/450 UV loops，实际折线RGB69,103,137存在，原源字节未变。
- tool015-unit-final.log：487/487核心；tsc与build通过。额外paint-toolkit-export.test.cjs证明三精度六面角像素朝向通过真实Blender FBX+PNG读取。

[1500窗口](screenshots/toolkit-1500.png) · [1280窗口](screenshots/toolkit-1280.png) · [125%缩放](screenshots/toolkit-125percent.png)。色轮缩窗重绘有CSS位图保底以避免Chromium离屏表面重分配时空白；不会进入作者源或导出。大选区的覆盖外边线完整呈现。

本轮没有修改开发细则或人工区，其SHA256仍为FA8BA103B456D76BF371F3F504C442356A6B891EC6969E1E9E25B39AF035A94E。未把第三方参考截图或用户生产模型提交/随程序发行。未实施N1–N4；未执行本轮团结接收、物理DPI/显示器拔插及长时极限压力。用户审美/手感不由自动测试代填。
