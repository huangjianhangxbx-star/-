# Workshop-M2.0 验证与边界

本版是四工作区的正式实现：项目与资产、模块编辑、场景装配、冻结发布。项目/场景/私有源各自保存；公共库取用为独立可编辑副本。0.25米体素、Root与局部帧、PNG比例参考、实例多选/框选/批量操作/分组/轴拖动、GLB与水平PNG贴花已接入。旧图只显式迁移为副本，保留原文和迁移报告；旧Gameplay仍由Legacy或Unity authoring负责。

## 真实验证

- 183项Node核心测试、TypeScript与构建检查。覆盖文档边界、联合撤销、保存WAL/恢复/路径与hash、Legacy补偿、冻结闭包和实际失败。发布取消/超时受控runner与真实Blender检查分别记录。
- 实际Electron从新建项目开始，取用五个库副本，PNG/笔刷/Root编辑，十实例墓室，保存重开、发布A、再次笔刷编辑发布B；逐文件hash，A字节不变，公共库五源不变。四页与墓室五张1440×900截图。
- Blender5.1.2对组合及两个外部资产实际生成完整FBX/旁车/PNG；GLB/FBX重导入世界顶点468/74/74一致。源灰/RGB、MASK alpha0.5、双面及PNG契约保留。
- 团结2022.3.62t13实际接收原生单件、7实例A和10实例B；独立GLB导入预期与Unity世界顶点集合A468/B524一致，包含半格Root和四旋转。RGB/灰、MASK、双面与PNG参数检查，另有实际Unity渲染图。
- Reader拒绝schema/轴/配方/hash/重复JSON字段/缺旁车/实例错误/源与runtime不一致，以及重新计算hash后的小数旋转、未知分组字段、源资产闭包错误、小数长度、非网格Root、体素错相位和损坏PNG。外部GLB-only明确拒绝，不使用latest映射兜底。
- 同版GUID稳定；新版本/新receipt分目录；生成文件被手改、删除或存在未保存编辑时拒绝重收。包装新副本保留手调位置、组件、碰撞和视觉实例引用，原包装不变；未知引用/内部覆盖/scale、删除已手调实例及改Root冲突拒绝。
- 接收中缺Shader造成实际中途故障，此前有效输出/meta/包装不变，本次生成物清理。另一个引擎进程退出后恢复被中断的生成文件/meta并移除半成品。旧ReaderM12、Integration、Axes和分进程Recovery回归通过。
- 缺源私有体素复制保持种类；空模块发布拒绝并可返回所选源继续编辑，不产生版本文件。实际窗口关闭取消/保存后关闭、两种窗口尺寸四页布局、菜单角色与缩放恢复通过。
- 新默认工坊与显式Legacy入口、独立便携EXE正常保存/发布、完整正式插件白名单/元数据、构建指纹检查由最终package-smoke记录确认。

## 证据与复跑

项目内 `validation/workshop-task5` 至 `workshop-task9` 保存各阶段包、日志、JSON和截图。Task9重点：workflow-ui-result.json、workflow-project、unity-workflow-proof.json、unity-tomb.png、package-smoke-result.json与五页PNG。Task8的Unity证据包括reader-edge、geometry、wrapper、fault、recovery和final-results；不是以模拟进程替代引擎实测。

源码运行：`pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build`、`node tests/workshop-workflow-ui.mjs`。团结使用验证工程内WorkshopWorkflowProof.Run；正式插件由WorkshopPackageProof.Export导出，Proof与验证资产不入插件。`node scripts/package.mjs --target workshop` 后运行 `node tests/workshop-package-smoke.mjs`。

## 尚未覆盖

不含Gameplay编辑器、任意FBX/Blend的直接可编辑转换、实时自动更新Unity、URP/HDRP或任意材质节点图。来源未知/缺配套GLB的旧外部模型保留占位和原因。水平贴花与模块参考PNG是两种用途。隐藏组仍参与发布。

代码短回放不能替代用户操作手感、长时间大场景性能、透明复杂排序和最终美术验收。文件完整性采用hash和依赖闭包，工具不覆盖已有发布身份；用户手动删改发布目录会失去有效版本资格。没有代码签名，FBX配方需要用户已有Blender5.1.2；单纯GLB和原生体素接收无需启动Blender。
