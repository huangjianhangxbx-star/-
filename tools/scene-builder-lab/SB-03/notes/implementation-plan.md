# SB-03 阶梯石拱桥 Implementation Plan

> **For agentic workers:** 使用并行子任务完成构件、纯规则与后台验收，由主任务整合和复核。当前环境没有 superpowers:subagent-driven-development / executing-plans，使用现有 collaboration 工具执行同样的分工与检查；不安装额外技能。

**Goal:** 在现有团结研究工程交付能连续拖画、整体修改、保存重开和独立烘焙的原创素材驱动“楼梯＋单孔石拱桥”。

**Architecture:** B 作者拥有独立输入和派生网格。纯 C# 规则先求可行走线路、台阶和真实桥洞，再安排工坊源构件及明确授权的墙芯填充。Unity 编辑器负责输入事务、来源反查、合并显示、碰撞与持久化；A 地貌和人工物件不进入 B 的写入范围。

**Tech Stack:** Tuanjie 1.10.4 / Unity 2022.3.62t16、C#、URP 14.2、Blender 5.1.2、项目 voxel_workbench 共享 API、.NET 离线规则测试。

**Spec:** [SB-03 证据和设计](../../tasks/SB-03.md)。用户于 2026-11-03 回复“有计划了吗。继续吧”，按此前推荐的直线单拱桥切片继续执行。

## Global Constraints

- 第一轮只承诺直线双引道单拱桥；L 平台、连续曲桥、多孔桥、池塘属于后续切片。
- 新功能放入 `work/scene-builder-lab/SB-03`，完成后增量接入已有 `work/procedural-world-editor/LE-01/project/Assets/SB03`；不新建永久 Unity 工程。
- 不启动游戏或接管桌面；后台验证只使用一个可回收的临时工程。不操作正式 ANKALUTE。
- 真实原创 FBX/原生源直接参与拼装；不采用 Tiny Glade 原作网格，不转成 A 形色参考场，不对整件非均匀缩放。
- 细节格 0.125m、结构步长 0.25m。首套可走宽度以 0.5m 递增，踏步标准进深 0.5m、步高最多 0.25m。
- 桥洞贯穿整个桥宽，网格与碰撞都避让；约束失败保留上一已提交结果。
- A 和 Manual 物件独立，B 不自动挖地；地面承托首轮采用明确的平面标高，复杂地形支承不冒称已支持。
- 一次编辑一次 Undo，Esc 取消，右/中键导航不回退已提交结果；保存重开和独立烘焙必须验证。
- 当前任务完成并核对远端后按 AGENTS 仅推送本轮文件到 GitHub main；不触碰 Gitee、不强推。

## 文件与接口

新增 `candidate/Assets/SB03/Runtime/Core/BridgeSpec.cs`、`BridgeSolver.cs`：无 Unity 依赖的输入、结构求解和来源摆放清单。

```csharp
BridgePlan plan = BridgeSolver.Solve(new BridgeSpec {
    Length = 14, Width = 2.5f, DeckHeight = 2,
    StartHeight = 0, EndHeight = 0,
    ArchWidth = 4, ArchHeight = 1.25f, Opening = true, Rails = true
});
```

`BridgePlan` 提供 Valid/Message、Spec、Parts、Solids、DeckStart/DeckEnd、OpeningMinX/OpeningMaxX/OpeningCrown。`BridgePart` 的 Id/SourceId/Role 与 X/Y/Z/Yaw 定义固定比例原构件摆放。`BridgeSolid` 的六个边界定义配方授权墙芯体积。坐标为 X 沿桥长、Y 向上、Z 横桥，源底部居中。

新增 `Runtime/SB03BridgeAuthor.cs`：序列化作者与版本；`Editor/SB03BridgeGeometry.cs`：真实源导入、网格合并与来源表；`Editor/SB03BridgeSession.cs`：候选/提交/撤销/恢复；`Editor/SB03BridgeWindow.cs`：中文参数、拖画和节点操作；`Editor/SB03BridgeFiles.cs`：保存、重开、独立烘焙与样例。

`kit/` 保存 9 件原创构件的 recipe、profile 快照、blend、FBX、色板、预览和 contracts.json。Unity 内只放消费所需 FBX/色板/契约；完整源随交付包保留。

`qa/Core/` 运行规则测试；`qa/Editor/` 运行真实 Engine 验收、渲染、保存与独立重开；`reports/` 保存原始报告；`review/index.html` 展示素材板、同编号使用位置和可复现入口。

## Task 1：结构规则及失败保护

**Files:** Core/*.cs，qa/Core/*.cs / Core.csproj，reports/core-red.log、core-green.log。

**Interfaces:** 消费 BridgeSpec；输出 BridgePlan。构件源 ID 固定为 sb03.tread、deck、coping、rail、post、arch-stone、arch-foot、keystone、abutment-cap。

- [x] 写并运行失败测试：默认输入应有台阶、桥面、栏杆、拱圈及洞；改变高度要改变踏步数；不合法净空拒绝；相同输入有相同稳定 ID。

```csharp
var p = BridgeSolver.Solve(new BridgeSpec());
Check(p.Valid && p.Parts.Exists(x => x.SourceId == "sb03.tread"));
Check(!p.Solids.Exists(x => x.MinX < 7 && x.MaxX > 7 && x.MinY < 1));
Check(!BridgeSolver.Solve(new BridgeSpec { DeckHeight = .5f, ArchHeight = 2 }).Valid);
```

- [x] 实现两端台阶、平台、支承、阶梯拱剖面与稳定摆放；每个可见部分对应源构件或明确墙芯角色，保留至少 0.5m 拱顶结构。
- [x] 对真实构件包围范围检查不得侵入保护洞；NaN、长度/高度冲突、非法宽度、超预算明确拒绝。
- [x] 运行绿灯及参数变体测试，保留测试输出。

## Task 2：工坊原创素材与契约

**Files:** kit/contracts.json、kit/source/*、kit/exports/*、kit/previews/*，qa/kit/*。

**Interfaces:** 契约记录 id、编号、逻辑尺寸、底部枢轴、允许旋转、源版本/哈希、实际导出路径与实测包围盒。构件长轴 X，模型不得在 Unity 内隐式拉伸。

- [x] 查询实际 capabilities/profile；在新的后台 Blender 文件创建专用 0.125m 规范，不改旧源。
- [x] 用共享 API 制作固定接口构件；保存 .blend、FBX/色板和中性预览。
- [x] 实际重开源并检查尺寸、闭合几何、导出文件和坐标；输出验证报告。
- [x] 将真实导出与规则源 ID 对齐；展示编号和用途，缺件不以灰方块代替。

## Task 3：Unity 整体编辑闭环

**Files:** Runtime/SB03BridgeAuthor.cs，Editor/SB03BridgeGeometry.cs、SB03BridgeSession.cs、SB03BridgeWindow.cs、SB03BridgeFiles.cs；qa/Editor/SB03EditorTests.cs。

**Interfaces:** Session.Preview(BridgeSpec)、Apply()、Cancel()；只对选定 SB03BridgeAuthor 写入。Geometry.Build 使用真实源的 MeshFilter/UV/贴图，按材质合并，创建实际 MeshCollider，来源表与派生网格一同更新。

- [x] 先验收失败场景：候选取消后作者与网格不变，提交后一次 Undo/Redo 恢复，非法候选不损坏旧桥；建立真实引擎测试。
- [x] 实现作者、来源清单、墙芯表面合并、候选预览和原子提交；变更期间不得自动落盘每个构件。
- [x] 实现“在场景拖画一座桥”，拖动确定起终点与方向；参数滑条改变尺寸，场景端点可编辑；Alt/右/中键交还导航，Esc 撤销候选。
- [x] 实现 JSON 作者存取、原生场景保存、独立烘焙；烘焙副本移除 B 作者仍可显示并拥有通畅碰撞。
- [x] 用合成 SceneView 事件检验输入流程；明确它不替代人工手感或视口 FPS。

## Task 4：后台证据、接入、交付

**Files:** qa/run-editor.ps1、qa/Editor/SB03Evidence.cs、reports/*、samples/*、review/index.html、README.md、docs/tasks/SB-03.md、记录/项目状态.md、记录/2026-11-03.md。

- [x] 复制现有项目的 Assets/Packages/ProjectSettings 至唯一临时 QA；不用 Hub、不复制 WorkScenes/Recovery、不关闭其它工程。
- [x] 真实 URP 渲染：原始素材板、默认桥、改长/改宽/改高、洞口侧视、构件来源高亮；物理射线验证桥下通道及桥面。
- [x] 保存并在第二 Engine 进程重开；核对作者、源哈希、Mesh 与碰撞。固定 14m 和较长桥计时，报告构件/合并网格/三角数与解算/上传/撤销成本。
- [x] 独立复核设计、实现、测试覆盖；修复实际问题后增量复制仅 SB03 到原研究工程，核对 A/用户文件指纹不变。
- [x] 生成完整 source-only ZIP 与 SHA256、中文操作说明和审阅页；临时 QA 可恢复回收，不留永久工程。
- [x] 更新当前任务记录和确认边界；对 GitHub main 最新树做选择性提交，不混入本机其它改动，验证推送结果。

## 自查

旧证据复用、不再 broad 实机研究、真构件来源、受保护洞、整桥联动、事务与导航、保存/重开、A 隔离、后台验证、清理和推送均有对应任务。直线以外的路线明确列为下一切片，不把未测功能列为通过。
