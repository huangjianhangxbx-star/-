# TOOL-005 Task4A：体素模块实例装配与联合Root

2026-10-04，继续用户已授权的工坊重构。Task4推进到可运行的体素装配子阶段，**完整Task4仍未结项**。

## 已实现

- 新SceneSession管理实例添加、复制、删除、位置、90度旋转、分组可见和独立撤销/重做。纯场景允许悬空模块，不调用旧地图支撑清理；体素位置按Root相位严格校验0.25米网格，错误输入拒绝而非静默移动。
- 装配页具有真实Three视口、实例树与拾取、模块放入、数字位置、旋转/复制/删除、分组显示、编辑模块入口、保存和重开。几何按资产缓存共享，删实例不释放仍被使用的几何；缺失负载以粉色线框显示。
- 注册场景有实例时，Root修改由管理器统一提交：`Tnew = Told + R(newRoot - oldRoot)`。提案不修改源；提交前比对源/场景快照。模块与场景任一侧撤销/重做都检查两个历史头；参与方有后续编辑时阻止半份撤销。较早的无实例Root命令遇到后来新增实例也阻止单边恢复。
- 场景脏状态参与关闭/切项目检查。保存前同步捕获项目、所有场景及已打开模块，等待lease/IPC期间的新编辑不会混入提交快照；回执只确认提交修订。保存Root两方沿用Task2同一文件事务。

## 验证

新增8项核心测试，累计 **139/139通过**；类型和构建通过。先记录缺失实现失败，再实现；额外的“先改Root、后放实例、再模块撤销”和“捕获保存后继续联合编辑”失败反例分别修复。涵盖四旋转、负坐标、legacy半格Root、非对称角点、浮空几何、快照隔离、陈旧提案、后续笔刷/场景命令阻断与联合恢复。

真实Electron回放使用磁盘项目和公开UI：十实例→独立实例ID副本→数字变换/旋转→删除撤销→十一实例Root补偿→人为修改场景文件触发保存冲突，模块Root未写入且外部字节保留→恢复原字节重试→联合撤销保存→分组显示保存重开。无pageerror。上一轮模块全流程及Legacy资产重载回放通过。

证据目录：`自制工具/map_editor/validation/workshop-task4/`。`all-tests.log / types.log / build.log / electron-result.json / ui.log / module-regression.log / legacy-asset-reload.log`；失败反例见`red-scene.log / red-ui.log / red-late-instance.log / red-save-capture.log`。

![真实装配页](../../自制工具/map_editor/validation/workshop-task4/assembly.png)

## 边界与下一步

Task4尚待：外部GLB/完整依赖组与PNG贴花的主进程受控读取/复制/保存；框选、多选、轴拖拽预览与Esc取消、分组归属编辑；公共库拖入独立副本；共享几何释放的专门资源回放；完整模块化墓室制作。GLB内嵌图片和发布hash链在Task6闭环，当前不能宣称验证通过。

装配UI目前放在workshop.ts，待后续交互扩展时抽取到workspaces/assembly.ts。打开项目会加载模块源会话；长期大场景性能尚未测。含联合历史的模块会话暂不能关闭，以保留参与者；可切页，重开项目后恢复正常。数字输入严格拒绝不对齐，轴拖拽尚未实现相位吸附。

原145保护文件与初始基线相比111不变、34为此前计划内增量；本段没有新增该集合中的变更路径，详见protected-check.json。游戏、Unity和旧样本未改，用户工作簿未读取或写入。新增源/生成workshop.js在上述初始集合之外，不把该核对冒称覆盖所有文件。默认入口仍Legacy；无新便携包、提交或推送。

复跑（工具目录）：`pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build`、`node tests/workshop-assembly-ui.mjs`、`node tests/workshop-module-ui.mjs`、`node tests/asset-reload.mjs`。启动工坊：`pnpm exec electron . --workspace=workshop`。
