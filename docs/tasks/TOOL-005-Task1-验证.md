# TOOL-005 Task1 文档契约、Root与独立副本

日期：2026-10-04。用户在正式计划交付后授权“执行吧”；本段实现完成，后续任务继续按计划推进。

新增4个核心模块：`workshop-documents.ts`定义并校验项目/模块/场景及引用；`coordinates.ts`统一源变换与轴向、几何格相位；`asset-copy.ts`提供深拷贝和独立色板身份；`workshop-adapter.ts`桥接旧native v1和EditorDocument。没有更改旧文档/原生源算法、桌面入口或Unity接收器。

模块允许空草稿，场景不要求同一cells地形支撑；新旧Root分流，旧半格Root与局部坐标保留。模型和PNG贴花登记分开，缺源可作为Issue显示，结构损坏则拒绝解析。独立副本更换assetId/paletteId、保留语义profile/colorId和来源记录。旧native额外未支持字段明确拒绝桥接而非静默丢弃，原Legacy读取器仍可处理。

## 实际验证

- 先编写23项行为测试，实际失败原因均为Task1尚无对应Interface；实现后全部通过。
- 边界补充发现并修正连续编辑修订数、撤销到原几何后的修订数、native未知字段及外部/PNG负载检查。最终新增29项测试。
- `pnpm test`：**109/109通过**（既有80项+本段29项）；`pnpm exec tsc --noEmit`通过。
- 两个实际M1.2原生样本往返后身份、Root、sourceOrigin与完整GLB字节一致，原文件字节不变。
- 前轮145个保护文件SHA256仍一致，本段仅新增源码/测试及证据，没有覆盖未提交M1.2成果。

证据：[汇总](../../自制工具/map_editor/validation/workshop-task1/result.json) · [首次失败](../../自制工具/map_editor/validation/workshop-task1/red.log) · [边界失败](../../自制工具/map_editor/validation/workshop-task1/red-boundaries.log) · [撤销失败](../../自制工具/map_editor/validation/workshop-task1/red-undo.log) · [最终全套](../../自制工具/map_editor/validation/workshop-task1/all-core-tests-final.log) · [类型检查](../../自制工具/map_editor/validation/workshop-task1/types-final.log)。Node22的实验性类型剥离提示沿用已有命令；不是用例失败。

新增测试与4个纯模块均通过实际Interface调用，没有mock引擎或UI。当前还未接真实四工作区、项目持久化或发布；本段没有运行桌面回放、构建包、Blender或Unity验收，无提交推送。

下一段：Task2项目持久化、多文件事务、冲突保护与跨进程恢复。
