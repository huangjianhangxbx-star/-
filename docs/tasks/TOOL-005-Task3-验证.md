# TOOL-005 Task3 四工作区与独立模块会话

日期：2026-10-04。用户要求继续；本段真实工作区、管理、模块编辑接线完成。场景装配和冻结发布按计划显示阶段说明，工具尚未冒称这两项可用。

## 已实现

新增 `desktop/workshop.html/workshop.ts/workshop.css` 和 `WorkshopSession`。可实际创建/打开项目、创建场景、创建空草稿、编辑/复制模块、选区复制、改名、选择/重载公共库、取用独立副本及登记独立公共副本。源文件保存使用Task2三类文档lease及跨文件事务。重开管理页读取未打开模块的名称和体素数量；缺失或损坏源显示异常，不静默创建替代文件。

模块页复用原M1.2 renderer、EditorDocument、MapView、brush、色环和ReferenceView，通过受控moduleEditor绑定不同会话；没有再复制一套绘制算法。原地台/三维/六面、面积厚度、矩形、填色/重染/擦除、选区、保护列、剖切、表面Z、侧底面色、HEX/画笔色/槽重染、无光照与PNG辅助均保留。模块模式隐藏游戏属性/模型/事件摆放和旧native更新出口；旧入口继续提供原功能。Root可输入严格格坐标或从体素局部底角选点，显示源轴向标记；变更不移动局部cells，名称/Root和几何历史可正确撤销。

`WorkshopSession`保持各模块EditorDocument及历史、PNG、Root、dirty和保存回执。未提交笔画不会污染源快照；回执只确认提交revision，等待期间的新修改保持dirty。关闭未保存模块会拒绝；已关闭session不能接受旧回执。

`Catalog`识别 `.xhmodule.json` 源身份；`workshop-library.cjs`把新公共源与清单作为同一事务。登记时生成新asset/palette身份，取用时再次独立复制；native通过Task1桥接进入私有模块，公共原件不受编辑影响。GLB/FBX/Blend既有检视、定位和批量命名入口仍保留。

`main`按明确 `--workspace=workshop` / `--workspace=legacy` 选择入口，IPC只接受当前选定入口的准确URL/主frame。新回放使用统一launch helper，旧回放明确传Legacy参数。默认入口暂留旧版，Task9再切换。构建生成workshop.js；旧打包脚本补齐新增主进程依赖，但本段没有执行打包或覆盖M1.2便携目录。

资源由持续存在的模块编辑host持有：切页/切模块复用两视口与一个worker，通过sessionId/generation挡掉旧或外来网格回复；关闭某模块不会杀掉另一模块使用的worker。MapView.dispose、监听器、Observer、色环、Three几何/材质/纹理、动画/定时器和worker有卸载清理路径。采用保持host、切换绑定的实现，未照计划另复制module-interaction/workspaces组件文件；实际行为与生命周期通过回放验收。

## 实际验证

- 新增9个核心测试：会话6、worker身份1、公共库事务2。初始会话/身份测试5项失败、公共库2项失败；补充预览与元数据历史的失败反例后修复。
- **131/131核心测试通过**（原80+Task1/2的42+本段9），TypeScript及构建通过。
- 真实Electron模块回放：36格笔刷、选区复制及身份/色板独立、切页撤销重做、PNG有效范围/1.8m身高、PNG上方重染、A/B的Root/PNG隔离、项目保存重开、公共登记/取用原件不变、实际M1.2 Wall native取用、Root选点/撤销/取消、外部冲突保留字节并重试。管理页元数据检查曾失败（重开未打开模块名称丢失），修复后通过。
- 30次切页和10次关闭重开：实际worker1、Observer2不增长，监听器不增长；固定内容的两视口几何/纹理数量前后相同。测试只在回放注入原生Worker/Observer/EventTarget计数包装，不增加产品流程或测试专用UI。没有声称FPS/大场景性能通过。
- 第二套新入口回放：保护列两侧有效笔画保留、桥洞下方为空、整笔撤销、大笔画Esc取消、取消后保存仍为3个原体素、失焦取消均通过。保存开始时会立即显示进行中，防止沿用上一条“已保存”状态。
- Legacy实际回放：基础绘制/撤销、M1.2面积厚度笔刷、保护列/桥洞、大笔画取消、资产重载/损坏新导出保护通过；原批量改名和Native store核心测试在131全套内通过。
- 原145保护文件有111个字节不变；34个计划内变动为10个生产/构建源、2个生成JS、22个测试文件（主要明确Legacy入口）。原M1.2未提交成果作为基线增量修改，未恢复到HEAD；Unity、样本原件和用户工作簿未改。无提交或推送。

证据：[核心测试](../../自制工具/map_editor/validation/workshop-task3/all-tests.log) · [类型](../../自制工具/map_editor/validation/workshop-task3/types.log) · [构建](../../自制工具/map_editor/validation/workshop-task3/build.log) · [模块回放](../../自制工具/map_editor/validation/workshop-task3/electron-result.json) · [新入口桥洞/取消](../../自制工具/map_editor/validation/workshop-task3/protected-ui.json) · [旧资产重载](../../自制工具/map_editor/validation/workshop-task3/legacy-reload.log) · [保护变动](../../自制工具/map_editor/validation/workshop-task3/protected-changes.json)。

截图：[模块编辑](../../自制工具/map_editor/validation/workshop-task3/module.png) · [项目与资产](../../自制工具/map_editor/validation/workshop-task3/project.png)。均来自1500×940真实Electron界面。

开发入口：在 `自制工具/map_editor` 执行 `pnpm start -- --workspace=workshop`；旧入口可显式 `pnpm start -- --workspace=legacy`。现在没有新便携包、场景实例编辑、冻结发布或新Unity流程；下一任务为Task4场景装配与跨文档Root联合命令。
