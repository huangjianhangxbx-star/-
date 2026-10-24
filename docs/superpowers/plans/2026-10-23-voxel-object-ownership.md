# 体素物体归属与画布合并实施计划

> 使用 writing-plans；按测试驱动步骤执行。用户已批准设计和实施；数据层与视窗层可使用并行子代理。

**Goal:** 物体身份独立于画布；自由绘制每格独立，内部编辑归属当前物体，同画布合并物体，兼容网格合并画布。
**Architecture:** ModelObject 增加显式 cellKeys 归属。同画布多个对象共享格坐标；CanvasSession 使用 editObjectId 隔离编辑源并在同步时保留非目标对象。物体选择、包围框与变换按成员格工作。
**Tech Stack:** TypeScript、Three.js、Electron、node:test、Playwright。
**Spec:** 本次用户确认规则及 docs/CurrentRules.md。

## 数据层
- [x] 先编写独立体素、加入活动编辑物体、同画布合并、跨画布拒绝、合并画布保持身份/位置/颜色/撤销测试，确认旧实现失败。
- [x] 修改 core/model-objects.ts、core/workshop-canvases.ts、core/workshop-documents.ts；复制/删除/移动/旋转/分离均按成员格执行，不能操作整张画布。
- [x] 合并画布检查同精度、整数格偏移，后合入覆盖重叠目标格并修剪旧成员归属；拒绝时不改模型。

## 视窗与控制器
- [x] desktop/canvas-view.ts、canvas-object-query.ts 按对象成员格生成点选、框选、边框、预览；避免每体素创建完整网格。
- [x] desktop/renderer.ts 按模式设置 CanvasSession 编辑范围；可见非目标对象但不能改写，绘制新增格同步归属。
- [x] desktop/model-object-tools.ts、workshop.ts 添加紧凑画布合并入口；只有同画布可 Ctrl+J。
- [x] 真实鼠标验证 A/B 独立、加入合并体、Tab新增归属、跨画布拒绝与合并后可合并。

## 验证和交付
- [x] 类型检查、核心测试、相关Electron回归；更新规则/术语/日志。
- [x] 选择性提交，构建Workshop包，实际程序验证并推送GitHub main。

2026-10-24 收尾：归属/范围/画布合并/历史及性能局部回归通过，随TOOL-010 A1一并交付；最终技术验证见 docs/tasks/TOOL-010-像素完美.md。
