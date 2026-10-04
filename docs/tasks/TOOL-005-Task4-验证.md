# TOOL-005 Task4：场景装配完成验证

2026-10-04，用户授权连续完成剩余装配工作。Task4A/B 的实例、联合 Root、GLB/PNG 导入能力与本轮 Task4C 合并，**Task4 装配退出条件通过**。发布相关联动验收继续由 Task6 实现。

## 已实现

- 装配工作区抽取到 `desktop/workspaces/assembly.ts`。树和视口支持单选、Ctrl 多选、Shift 框选；框选按可见对象几何包围盒中心判定。批量复制、删除、90°旋转、移动、分组归属各产生一个历史命令。混合选择包含贴花时禁止设置模型分组，避免部分成功。
- 多实例轴拖动同时预览，松手一次提交；Esc 取消预览。批量包含体素时按 0.25 米几何相位吸附；旋转依源 Root 修正位置，保留半格 Root。批量命令在全部校验完成后写入，非法输入不会留下部分变更。
- 公共库条目可真实拖进装配视口。可编辑体素模块建立新的本地资产、色板身份和源文件；GLB/PNG 沿受控导入路线复制。本地实例可独立编辑，公共源字节保持不变。
- 五种纯体素模块完成地面、高台、门洞壁、断崖和灯座的十实例墓室；库拖入柱子后共十一实例、六个本地源。源文件含非对称形状、负坐标和半格 Root，未调用旧地形支撑清理。
- 缺失已保存模型/图片时显示问题和占位，保存拒绝且场景原字节不变。模块删除局部原点体素仍保持局部帧、Root、PNG 参考与实例变换；另一场景的独立副本不变。
- 构建源指纹递归覆盖新增工作区和脚本，排除生成 bundle。build-info 仍登记 M1.2；此项准备工作不等于 Task9 新包交付。

## 验证证据

核心测试 **149/149**，本轮新增批量命令 3 项、递归指纹 1 项、删原点/A-B 场景隔离 1 项。类型检查、构建通过；先失败的批量命令、指纹和墓室界面反例保存在本轮目录。

| 实际回放 | 结果 |
|---|---|
| 墓室 | 五模块十实例实际界面摆放；框选十个、复制成二十个、一次撤销恢复十个；多选分组及撤销 |
| 公共库拖入 | 真实拖放后十一实例；本地新 ID、独立源，公共文件字节不变 |
| 共享资源 | 预热后 20 轮复制/删除/切页，WebGL 活跃分配始终 28 buffers、13 textures；删除副本不破坏原实例 |
| 保存重开 | 十一实例的 ID、位置、旋转和 Root 保持 |
| 二进制及缺失 | 实际 GLB/PNG 导入、贴花颜色像素、复制保存、删原件重开；删本地依赖提示两项缺失，拒绝保存且源 JSON 字节不变 |
| 轴拖动 | 真实 X 轴半格吸附、Esc 取消、一次撤销；新增两实例整体拖动和一次撤销 |
| 既有回归 | 联合 Root/保存冲突、模块全流程、Legacy 资产重载通过 |

本轮证据：`自制工具/map_editor/validation/workshop-task4c/` 内 all-tests.log、types.log、build.log、tomb-ui-result.json、tomb-ui.log、tomb.png、各 regression.log 与 protected-check.json。二进制/轴拖动结果在 Task4B 原证据目录更新，详见 binary-ui-result.json、drag-ui-result.json。Task4A 的四旋转/联合 Root 与 Task3 的模块/PNG 回放仍适用。

![真实十一实例墓室](../../自制工具/map_editor/validation/workshop-task4c/tomb.png)

可打开的示例：[project.xhproject.json](../../自制工具/map_editor/validation/workshop-task4c/tomb-project/project.xhproject.json)。启动 `pnpm exec electron . --workspace=workshop`，通过管理页“打开项目”选择它，再进入场景装配。

复跑：`pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build`；随后顺序运行 `node tests/workshop-tomb-ui.mjs`、`node tests/workshop-binary-ui.mjs`、`node tests/workshop-drag-ui.mjs`、`node tests/workshop-assembly-ui.mjs`、`node tests/workshop-module-ui.mjs`、`node tests/asset-reload.mjs`。测试使用独立 validation 项目，仅模拟原生文件选择结果。

## 边界与下一步

PNG 注册、复制、保存重开已通过；**PNG 内嵌冻结 GLB、发布 hash 和资格判断的最终闭环属于 Task6，尚未实现**。Task5 旧图迁移、Task7 FBX/Blend 完整依赖交换、Task8 新 Unity 接收和 Task9 新便携包/默认入口切换仍未完成。默认仍为 Legacy。

20 轮 GPU 分配回放证明受测操作释放稳定，不代表长期或大场景性能。实际轴拖拽主要覆盖 X 轴，Y/Z 操作手感尚待人工验证。联合 Root 历史参与模块不能单独关闭，需保留参与会话以维护同步撤销；切页和项目重开可用。水平贴花完全重合时的透明排序仍有既有限制。

原 145 文件保护集合：111 不变、34 已有计划内修改路径，无新增集合内修改路径；这是限定集合核对，不覆盖并行任务的整个仓库。未改人工工作簿、旧样本或 Unity 接收实现；未生成新包、提交或推送。
