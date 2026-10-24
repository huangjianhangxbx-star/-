# TOOL-014 画布列表与菜单修正

来源：用户修正单与较新对话；固定基线717e234。

实现完整列表与视图层批选，使用原有合并规则与会话事务；合并后仍为独立物体。新增批删先验证全部目标，再一次提交；锁定/最后一张画布拒绝。跨画布只改变观察和目标，不引入历史。

原始失败：五画布列表实际0行；方块菜单首项中心命中背后select#model-interaction-mode。现均有真实Electron回归。菜单保持原DOM委派，用Popover顶层展示；没有叠加全局z-index或新增依赖。

验证：475/475核心，tsc、build；1/5/32画布含隐藏/锁定/空画布；Ctrl/Shift、复制粘贴、行内改名、排序、批删；合并重叠确认/取消、非重叠、Undo/Redo、保存重启；跨编辑作用域、草稿返回和贴图租约；菜单三尺寸1500×940/1280×800/1000×700，150% Electron缩放，首中尾中心与边缘真实点击、互斥/Esc/关闭点击不落笔。定向GLB节点变换后世界范围与源层保护通过。没有改导出器，未重跑Blender/团结全矩阵。

最终EXE已复测通过，功能版本 cfbfb13d175001df614cedb0d91a392d78226ce3，指纹 dbed1b6549ee8f36d600044669ba2579a024056f264f3f07a8f2bd1265e161bf，包内build-info逐项相符且源指纹匹配。运行路径：自制工具/map_editor/release/星骸地图工坊-Workshop-M2.0/星骸地图工坊.exe。旧47ba1c3目录已保留在同级Workshop-M2.0-TOOL014-47ba1c3。

最终EXE证据：
- canvas-exe-list.log / surface-paint-ui-ELkw97：五画布、管理/合并/历史/保存重启/草稿/租约。
- canvas-exe-one.log / surface-paint-ui-fc4UO2，canvas-exe-32.log / surface-paint-ui-bBLCAY：1与32行含空画布，两模式。
- canvas-exe-popovers.log / viewport-workshop-etn30t：三尺寸、实际150%缩放与命中。
- canvas-exe-oldmenu.log / viewport-workshop-KuRvjU：旧建模命令锚定及常驻对齐。
- canvas-exe-oldpaint.log / surface-paint-ui-sDdZKT：提交延迟800ms仍为白色笔触，正式确认后同色，无短暂底色回闪。

截图均来自最终EXE：
[完整五画布](screenshots/canvas-list-five.png) · [三选及目标](screenshots/canvas-list-three-selected.png) · [合并后](screenshots/canvas-list-merged.png) · [Undo恢复](screenshots/canvas-list-undo.png) · [窄窗菜单](screenshots/canvas-tool-menu-1000.png) · [150%缩放](screenshots/canvas-tool-menu-150percent.png)。

受保护开发细则SHA256仍为FA8BA103B456D76BF371F3F504C442356A6B891EC6969E1E9E25B39AF035A94E。用户资产只用测试副本；未修改原件、算法/导出器或P1–P3。未测范围：物理多显示器拔插、长期压力和全部UI组合；150%为真实Electron页面缩放，不声称切换Windows系统DPI。用户手感仍待试玩。
