# 绘图图层与局部粘贴交付

- 功能提交：0adc9b5；合并并行更新后包版本：69a3638f423917865a8d1b16e90982023e73dccc。
- 源码与包指纹：8db2f715ffe91095ba7234da50bac67f7a16fc901ae23b9ed44b6b8c86f2af68。
- 构建UTC：2026-10-25T05:01:06.892Z。
- 可执行文件：自制工具/map_editor/release/星骸地图工坊-Workshop-M2.0/星骸地图工坊.exe。
- 上版备份：release/星骸地图工坊-Workshop-M2.0-TOOL015-perf-95d9c1a。

504项核心测试通过，类型/构建通过。实际Electron完整旧绘图工具故事通过。最终EXE的图层显隐、合并撤销、跨画布缩放旋转粘贴、Enter确认/Esc取消、撤销重做、窗口重开、进程重启回读通过；800ms确认延迟前/中/后RGBA完全一致。GLB与可见平面合成的导出字节一致，隐藏原稿保留。

最终EXE证据：validation/paint-layers-exe.log、paint-layers-exe-continuity.log；截图surface-paint-ui-O5VhRW/layers-paste.png。独立生成测试项目，未修改用户生产资产。

使用见[图层说明](../../../自制工具/map_editor/docs/PaintLayers.md)。沿表面延展按相邻体素面折转，复杂分叉以预览为准。贴片在当前窗口内跨目标保留，不是系统图片剪贴板；不新增半透明/混合模式。原有像素面预算包含隐藏层，每画布32层。用户手感尚待试玩，未执行此次物理DPI、长期极限和团结端接收测试。
