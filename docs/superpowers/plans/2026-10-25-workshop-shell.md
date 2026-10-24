# TOOL-014 实施计划（2026-10-25）

批准依据：用户转交完整ZIP要求理解较新内容并执行；执行U0–U7，P1–P3排除。实际基线014b97d，已快进保留Spine增量，原EXE6e85894。任务包文本逐项SHA核验，参考图仅validation本地。

1. 会话边界：测试 `PaintLeaseAuthority` 的错租约、过期revision、重复commandId、对象外像素与历史；实现 `desktop/paint-session-contract.ts`，只接受受限paint/history/save命令，不接受资产替换。`CanvasSession`提供运行期单写租约，commit/undo/redo/metadata均拒绝未持有写入权。
2. Electron：`paint-window.cjs`注册精确主/子Frame URL，只允许本地资源、最小preload、有限消息和一笔在途。主窗口回执关联requestId，超时/崩溃/重载撤销租约；主菜单按焦点和文本路由。加入构建/便携资源。
3. 绘画客户端：`paint-workspace.ts/html/css`复用MapView/CanvasView/SurfacePaintTools，快照仅用于本地预览；笔画提交至主renderer权威，统一Undo/Redo及现有保存，父窗口几何全路径保护。目标不明时从可写物体列表选择，已打开聚焦。
4. 外壳：`workshop-shell.ts/css`移动真实控件到左层级、右属性、工具列、文档更多；默认单视口/资产抽屉收起，损坏偏好回退。保留v1/Legacy原路径，应用深灰金色。动态画布/对象面板保持单DOM；参数按工具显示，常用入口≤2层。
5. 工具预览：Appearance/Rock可挂载，迁至停靠属性区；统一pending状态、应用/放弃/返回确认，布局/显示/失焦保留结束交互后的参数草稿。保存/切目标先解析草稿，普通笔画不要求额外Apply。
6. 验证：新租约单元测试先红后绿；实际Electron建模/上色/绘画/关闭重开、窄窗/150%DPI、安全sender拒绝和去重、五次开关资源、相同源导出不变与代表FBX回读；更新FEATURE_MAP逐项实际入口/覆盖程度，四张真实截图。
7. 选择性提交、构建与旧包回退；最终EXE再次建模→上色→绘画→保存重开，记录SHA/指纹与限制，核对保护原稿和远端后推GitHub main。旧美术Gate保持，P1–P3未实施。
