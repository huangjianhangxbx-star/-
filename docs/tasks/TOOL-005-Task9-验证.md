# TOOL-005 Task9 全流程与便携交付

2026-10-04。九阶段实现完成，默认入口切为工坊，显式 --workspace=legacy 保留旧界面。Workshop-M2.0 使用独立目录，未运行覆盖 M1.2 的打包路线；本任务没有提交推送。

## 实际交付核验

183 项 Node 测试全部通过，TypeScript 与构建通过。真实 Electron 回放从新建项目/场景开始，取用五个公共库独立副本，编辑参考 PNG、笔刷与 Root，装配十实例墓室，保存重开，发布 A，真实笔刷修改后发布 B。逐文件 hash、私有身份、公共库五源保持与 A 包字节不变均检查。四工作区及墓室五张 1440×900 截图已查看。

这些 UI 产出的真实发布包在团结 2022.3.62t13 接收：A/B 各十实例、同包 GUID 保持、用户包装组件/碰撞/手调变换/视觉引用保留，新包装副本升级成功且原件字节保持。实际 Unity 墓室渲染已查看。Task8 的冻结闭包、几何/颜色/PNG、故障/跨进程恢复及旧接口回归继续有效。

实际独立 EXE 烟测覆盖默认工坊新建/编辑/保存/发布和显式 Legacy 正常绘制保存；包内源码/bundle/构建指纹逐项一致，不夹带 node_modules。正式 unitypackage 解包核对 25 个源码/Shader 文件、对应 asset.meta 与正式源字节，排除 Proof/Fixtures/Generated。窗口回放覆盖未保存关闭取消、保存后关闭、1440×900 与 1000×700 四页布局、菜单角色与缩放恢复。源入口 M1.2 原生模块回放通过。

最后补充两项边界：复制缺源的私有体素仍保持体素种类及未解决原因；空模块发布失败可返回所选模块继续编辑，不产生版本文件。均有失败前的红测试和修复后的通过证据。

## 输出与证据

- 便携目录：自制工具/map_editor/release/星骸地图工坊-Workshop-M2.0/，主程序 星骸地图工坊.exe。
- 插件：release/星骸地图团结插件-Workshop-M2.0.unitypackage，同时随便携目录提供。
- 示例：便携目录的 示例/工坊墓室（UI 实际项目，含两次冻结发布），保留旧格式/旧可玩塔防示例。
- 操作与边界：README.md、docs/Validation-Workshop.md、adapters/tuanjie/README-Workshop.md。
- validation/workshop-task9 下的 final-tests.log、workflow-ui-result.json、unity-workflow-proof.json、package-smoke-result.json、window-ui-result.json、publish-source-ui-result.json、legacy-native.log、protected-check.json 与 PNG 截图。

145 项保护基线中，除 Task3 已登记变更外新增 core/scene-glb.ts（共用静态组合导出）、scripts/glb_to_fbx.py（真实 Windows 长路径修复）及其 Python 编译缓存；均属于本任务执行或生成缓存。没有新增未解释的源资产改动。旧样本、原始资产和 M1.2 便携目录保持保护基线。

## 支持范围

本版没有 Gameplay 编辑器、URP/HDRP、任意材质节点图或 Unity 自动跟随最新源。外部 GLB-only 接收明确拒绝，需完整冻结 FBX 配方。长期大场景性能、用户手感与复杂透明排序尚需实际使用反馈；短回放不代替这些验收。无需新增产品决策。
