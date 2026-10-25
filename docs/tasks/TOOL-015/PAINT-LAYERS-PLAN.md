# 绘图图层与局部粘贴实施计划

目标：独立绘画窗口支持每画布图层、局部跨表面粘贴；黄色轮廓默认关闭。
设计依据：2026-10-25 用户确认本会话上一条设计并要求执行。
架构：SurfacePaint 增加可选层栈，faces 是可见合成结果。旧资产首次编辑图层时无损转为底层；预览和导出仍读取 faces。所有作者修改通过已有权威会话和撤销队列提交。
技术：TypeScript、Three.js、Electron、Node test、Playwright。

- [x] 核心：core/paint-layers.ts；图层增删、重命名、锁定、显隐、顺序、复制、向下合并；验证原稿与合成一致，隐藏层计入预算；测试遮盖后擦除、隐藏与合并、旧数据迁移。
- [x] 接入：surface-paint.ts、workshop-canvases.ts、workshop-documents.ts、paint-command-queue.ts、paint-session-contract.ts；保存、历史、物体变换保留层原稿，队列保持原有单写入语义。
- [x] 界面：paint-workspace.ts/html/css、paint-layers-ui.ts；右侧紧凑图层列表及目标选择，锁定和隐藏层不能写入；工具源为当前层，预览源为可见合成。
- [x] 粘贴：core/paint-clipboard.ts 与 surface-paint-tools.ts；选区复制当前层/可见合成，透明空白不覆盖。目标点击定位，90度旋转与比例缩放，Enter确认、Esc取消。共面模式裁到当前表面；沿表面模式映射相邻外露面。跨画布保留物理尺寸。
- [x] 轮廓：工具栏复选框，localStorage保存，默认关闭黄色绘图轮廓；选区轮廓继续显示。
- [x] 验证：针对性核心测试、类型检查、全套单测、独立窗口真实点击、保存重开、撤销重做、跨画布隔离、粘贴取消、打包EXE验证；更新规则与工作记录，选择性提交并推送GitHub。

约束：保留现有布局与性能优化；不改用户资产；不自动推送Gitee；不改受保护设计原稿。
