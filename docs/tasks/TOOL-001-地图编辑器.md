# TOOL-001 地图编辑器 M0/M1

2026-10-02，接手基准 main@29891d525bb04cf5baa1b3aeab7a5b5dbf00f8a7。用户要求执行地图编辑器总体路线与首期计划，并已采用 G1/G2/G3 推荐。

实施范围：独立 Windows Electron/TypeScript/Three.js 桌面工具，C# 团结插件，真实团结 E0 门槛后再完成 M1；M2 不自动执行。目录为 `自制工具/map_editor`，独立验证工程在其 `validation/TuanjieProject`。允许工程自身依赖，不安装升级引擎。最初暂不提交推送；用户随后授权本轮先上传 GitHub。

已决定：0.25米地形体素、顶面高度和独立厚度、负高度、三维保护；现有0.125米资产不重建；GLB预览、PNG水平贴花、外部Blender，事件用样例验证。

已查：根 AGENTS、开发细则2.1草稿、README、状态、索引与对账相关入口、附件、工作台API/Agent/验证资料。真实技能 brainstorming、grill-with-docs及grilling/domain-modeling、writing-plans、TDD。技能建议的其他执行子技能未找到，不声称已使用。

环境：团结 `E:/unity/Tuanjie Hub/2022.3.62t13/Editor/Tuanjie.exe`，ProductVersion `2022.3.62t13_632f6144c187`。独立空工程批处理创建日志退出0。旧工作台与art未提交修改保持。

计划：[Execution.md](../../自制工具/map_editor/docs/Execution.md)。最新状态见下方首版交付：E0已通过；首期人工GUI、手感和长期压力验收尚待进行。

## 首版交付（2026-10-02）

实现与自动验证：双视图桌面、地台/三维保护/剖切、色板/固定侧色、逻辑表面、模型/事件/贴花、稳定资产ID与受控改名、Blender副本修改回流、后台脏块网格、保存与恢复；真实团结持久烘焙、重复模块身份、无变化/更新、异常磁盘+内存回滚、跨进程恢复、独立Windows构建。

交付：自制工具/map_editor/release/星骸地图工坊/星骸地图工坊.exe；release/星骸地图团结插件.unitypackage；examples两份可编辑源图与资产库；validation/TuanjieProject独立验证工程；README及docs/MapFormat.md、AssetContract.md、Validation.md。

证据：22项核心/文件/队列测试、8组TS/C#黄金几何、真实Blender修改、桌面UI回放、FBX三轴/锚点、IntegrationProof、独立播放器及便携包检查通过。三档512/25600/184320体素已测；本机离屏GPU预览约60fps，较大编辑快照约226ms，多进程工作集约448–905MiB，不作大世界或长时间稳定保证。

尚未整体验收：团结菜单窗口的合成点击回放3次未触发，需要实际GUI确认；用户绘制手感、视觉与长时间内存压力未验收。E5不能笼统标作全部通过；这是可试用开发首版。详见工具Validation.md逐项A01–A28对账与失败日志。

本次未提交/推送，HEAD仍29891d525bb04cf5baa1b3aeab7a5b5dbf00f8a7；未同步Gitee。旧game、voxel_workbench、art、用户维护/开发细则均未写入，保留已有未提交工作。未安装/升级引擎。pnpm初次缓存曾落E盘根目录，已改工具内缓存，未擅自删除共享缓存。M2不执行。
