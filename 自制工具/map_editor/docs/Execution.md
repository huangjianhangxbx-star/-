# 地图编辑器 M0/M1 执行计划

日期：2026-10-02。基准 main@29891d525bb04cf5baa1b3aeab7a5b5dbf00f8a7。
规格：用户附件《星骸回廊_地图编辑器_总体路线与首期开发计划_v0.1_待确认.md》。用户已批准 G1/G2/G3 推荐及继续实施。

目标：独立 Windows 桌面绘图工具，地图源经真实团结烘焙成可持久化、重复放置的资源。
架构：Electron 文件边界、Three.js 双视图、纯 TypeScript 编辑/网格核心；C# 团结接入独立实现同一源契约。先完成 E0 再扩大桌面功能。

## 边界与决定
- 目录为自制工具/map_editor，验证工程为 validation/TuanjieProject；允许工具自身依赖，不安装升级引擎。
- 0.25 米体素，Z-up 源；顶面 h、厚度 t 的占用为 [h-t,h)，负坐标使用 floor；空与高度0分开。三维编辑保护不静默压平。
- 现有0.125米美术细节作为整体模型，不改既有资产。
- M0/M1，GLB 预览、PNG 水平贴花、Blender 源定位；事件先使用测试预制体。M2、游戏迁移、正式寻路、掉落存档不实施。
- 不提交、不推送；旧 game、voxel_workbench、art、开发细则、用户维护原文不改。
- 实际技能 writing-plans 的执行子技能在本机目录未找到；按已授权任务在本会话执行，不冒称调用缺失技能，不重复请求执行许可。

## 步骤与检查
- [x] 核对基准、现存修改、真实技能和 G1–G3。
- [x] 找到团结 2022.3.62t13，独立空工程批处理创建成功。
- [x] E0：fixtures/platform.json、bridge.json；adapters/tuanjie/Runtime/MapDocument.cs 与 Editor/MapBaker.cs。先以未实现生成器执行断言：单块6面、相邻10面、零高厚度1占负格；再实现与验证。建立两个事件实例的场景，保存/重开/修改/重新烘焙并构建运行。
- [x] E1：core/document.ts、mesher.ts、commands.ts；tests/core.test.ts。覆盖负高度、桥洞保护、分块两侧、颜色分界、连通填充、一次笔画撤销、非法数据、归一化两端输出。先失败后实现。
- [x] E2：desktop/main.cjs、preload.cjs、renderer.ts、index.html、style.css；正常 UI 新建绘制保存重开两份样本。输入与相机互斥，过时修订不发布。
- [x] E3：desktop/files.cjs、core/assets.ts；授权根内注册稳定ID、预览、重载、受控改名；PNG贴花、事件模型放置。测试越界/链接/重复ID/损坏文件保持旧数据。
- [x] E4：完整烘焙校验映射、实例、表面逻辑、贴花；更新保留引用与用户外层；失败注入不发布半成品。
- [ ] E5：Windows 双击包、正常UI完整回放、三档性能与对象释放测量；docs/Validation.md 区分自动检查、真实团结、人工验收和剩余项。

附件 A01–A28 为完整验收要求，不以其中一部分通过冒充首期完成。阶段结果记录本目录及 docs/tasks/TOOL-001-地图编辑器.md。

## 首版收尾

E0–E4 已形成可运行实现与自动化证据，详见 Validation.md。E5 已有便携包、真实团结构建、三档规模及两份正常桌面UI源样本。团结菜单窗口合成点击3次未触发，单独留作人工GUI验收项；不据此宣称28项全部验收完成。用户手感/视觉、长时间内存压力亦待复查。

修复了卸载对象判断、烘焙磁盘与内存回滚、FBX轴向校正；跨进程恢复验证通过。无提交推送，无M2扩展。实际代码文件以本工具README/AssetContract为准，步骤中预拟 commands.ts/core/assets.ts 已分别收敛到 document.ts/desktop/catalog.cjs。