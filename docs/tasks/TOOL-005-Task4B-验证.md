# TOOL-005 Task4B：外部GLB、PNG贴花与轴拖拽

2026-10-04，继续用户授权的Task4。**完整Task4仍未结项。**

## 实现

- 原生文件选择导入自包含静态GLB/PNG，或从已选公共库取用；每次生成新的本地资产ID。渲染器不能自报路径写入/expectedHash。场景登记、模块源和二进制负载走同一Task2事务。读取按项目token、sceneId及资产登记定位；登记与暂存负载不符、未知登记、失效token/非法路径均拒绝。
- 本地GLB/PNG保存到external/textures目录，删除原件仍可重开。源字节独立捕获，成功提交后释放暂存；缺失已保存负载时读取/保存报错。PNG新增CRC、IDAT解压完整性和64MiB解压上限，沿用尺寸/负载限制。旧模块参考接口未改。
- 真实外部GLB和水平贴花显示；贴花尺寸、位置、旋转、复制、删除与历史。模型/纹理缓存有释放路径和异步所有者检查；加载/无法显示有提示。异步加载刷新保留未提交输入。发现旧1×1测试参考常量压缩数据损坏，新贴花回放改用有效2×2PNG，并验证真实视口颜色像素。
- Three轴拖拽期间只改变预览，松开提交单个命令，Esc/失焦/切页/保存取消，提交检查场景revision。体素吸附按旋转Root相位；外部模型接受有限非网格坐标。半格Root不会被直接取整，拖拽时禁用轨道相机。

## 验证

新增5项核心测试（3二进制、1贴花历史、1吸附），累计 **144/144**；类型/构建通过。失败先于实现：red-binary、red-decals、red-drag、red-ui、red-drag-ui；损坏PNG拒绝的失败反例见red-png-corruption。

真实Electron：GLB非网格位置/复制；PNG尺寸2×3米/复制；保存两种文件字节不变；删除原件后重开四元素。视口实际绘制超过1000个贴花颜色像素。公共GLB/PNG分别取用为新的本地ID，公共文件字节不变。真实鼠标X轴拖拽：Esc保存保持`[0.125,0.125,0.125]`，松开后`[0.375,0.125,0.125]`，一次撤销恢复。无pageerror。十一实例Root/冲突、模块全流程和Legacy资产重载回放通过。

证据目录`自制工具/map_editor/validation/workshop-task4b/`：all-tests.log、types.log、build.log、binary-ui-result.json、drag-ui-result.json、ui.log、drag-ui.log、assembly-regression.log、module-regression.log、legacy-asset-reload.log。

![真实模型与水平贴花](../../自制工具/map_editor/validation/workshop-task4b/binary-assembly.png)

## 待办与边界

完整Task4尚待框选/多选、分组归属、库拖入、专门资源计数回放、完整模块化墓室制作及装配UI抽取。现导入只支持自包含GLB/PNG，入口单文件32MiB；FBX/Blend完整依赖组归Task7，PNG嵌入冻结GLB及hash归Task6，新Unity接收归Task8。不得视为这些链路已通过。

真实拖拽覆盖X轴/Esc，Y/Z手感、失焦和长期资源压力未单独验收。暂存负载保存前驻留主进程；大场景性能待测。模型树显示类型与ID；完全重合贴花可能有透明排序问题。

原145保护文件111不变/34此前计划内路径，无新增该集合中的变更路径，见protected-check.json。游戏/Unity/旧样本/人工工作簿未改。默认Legacy，无新包、提交或推送。

复跑：`pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build`；顺序执行`node tests/workshop-binary-ui.mjs`、`node tests/workshop-drag-ui.mjs`、`node tests/workshop-assembly-ui.mjs`、`node tests/workshop-module-ui.mjs`、`node tests/asset-reload.mjs`。
