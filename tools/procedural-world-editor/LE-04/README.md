# LE-04 基础地貌 v2

本轮实现已确认的 A 方向：在 Unity／团结的 Scene 视图中连续塑形、固定锚点精修、绘色，并用外部模型的形状与普通颜色生成连续地貌。无需进入 Play。

[实际效果、参考源和逐步对照](review/index.html) · [Unity 最终截图](samples/screenshots/08-final.png) · [完整作者文件](samples/LE04_Workflow.basicterrain.json)

## 从这里开始

下载本目录后，使用 **团结 1.10.4／2022.3.62t16** 打开 `candidate` 工程目录。该目录包含完整的 Assets、Packages、ProjectSettings 和固定的渲染配置；等待首次导入后，在菜单 **星骸 → 地编 → 开始** 选择 **打开基础地貌 v2 可操作样例**，或使用 **打开基础地貌 v2 样例** 菜单。样例复制到自己的 WorkScenes，原始示例保留。

此发布副本的 C# 合并 SHA256 为 `E1591A664DF4B46160A9C859F1B82E3E9E4E23A77609CBCD39BECCC1739C6570`。源代码与原生资产保持验收版本原字节；目录内 `.gitattributes` 禁止自动换行转换，以保留这些指纹。使用说明的入口已按仓库目录整理。

1. **从空白开始**：选择“新建基础地貌 v2”，在“局部形体”中选“延展”，然后在 Scene 中按住左键拖画。已有地形上可以改用抬升、下压、柔和隆起／压低、侧面加粗／瘦身或移除。
2. **精修某一处**：切到“锚点精修”，点击实际顶面或侧面，分别调整 X／Z 正负方向范围及上下高度带，观察贴面范围后“应用候选”。锚点保持不动；“取消”恢复原来的网格。
3. **上色**：在“绘色”页选色，连续拖涂，或用锚点扩大范围后一次填色。可限制顶面／侧面，Shift 点击实际表面取色。已有手涂颜色优先于参考色。
4. **形色参考**：导入下列 `.voxel.json`，或采样符合格度的闭合静态模型。调整 XYZ 伸展、朝向和融合宽度后连续拖画；可选增加、削减或只参考颜色。尺寸变化会重新采样占据，不是缩放一排原模型。
5. **撤销与保存**：连续模式松手提交一笔；锚点模式点击应用。Esc 取消当前候选。松手后使用右键／中键／Alt 导航会保留操作。保存作者文件、Scene 或带色 FBX 前，需完成当前候选。

示例保留最后一次参考削减的设置；初次尝试时可先切回“局部形体 → 柔和隆起”。

## 实际参考源

| 来源 | 内容 | 文件 |
|---|---|---|
| 岭脊 | 272 个源占据格，三段宽窄与深浅配色 | [预览](references/ridge/preview.png)、[体素源](references/ridge/source.voxel.json)、[原生模型](references/ridge/source.blend) |
| 缺角台地 | 448 个源占据格，保留缺角与不同颜色区域 | [预览](references/notched-terrace/preview.png)、[体素源](references/notched-terrace/source.voxel.json)、[原生模型](references/notched-terrace/source.blend) |

两份来源均由既有工坊共享 API 实际制作、导出和检查。场景右侧的独立原模型保持自己的 root、位置和网格；它不计作 B 专用搭建工具。

参考源只采样一次；拖画输出的是同一份有效地貌的增减体积。显示网格合并共面外壳，远处块复用。编辑真源保留为稀疏竖向区间及颜色记录，既没有每格一个 GameObject，也不需要每笔从最终网格反向猜回体素。

## 验证与性能

实际引擎为团结 1.10.4／2022.3.62t16。锚点、连续拖画、颜色、精确取消、分别撤销、完整文件／Scene 另进程重开和独立 FBX 检查均有记录。验证基于合成 SceneView 事件与后台控制器；真实鼠标手感和 GPU 帧率仍需使用反馈。

固定 24m、28,968 叶格的 A-only 场景，预热 5 次后测 20 次：

| 指标 | 0.25m | 0.125m，跨负坐标块边界 |
|---|---:|---:|
| 松手至提交 P95 | 71.26ms | 73.62ms |
| 最终主线程更新 P95，含 Mesh／Collider／提交 | 4.32ms | 5.29ms |
| 热预览 P95 | 68.72ms | 74.43ms |
| 撤销恢复 P95 | 91.03ms | 96.04ms |
| 取消最大值 | 0.132ms | 0.138ms |
| 一笔期间整个 Editor 的分配上界 | 24.66MiB | 24.97MiB |

冷启动准备约 1.10 秒，单列记录。分配来自经 2MiB 实际分配验证的字节计数器，包含主线程、worker 及 Editor 开销；不是堆大小差值。旧版同夹具主线程“改形＋局部编译＋上传”P95 为 142.42ms；新路径将解算移到后台。旧版四夹具完整网格指纹保持不变；新合并路径逐原子面保形／保色／保命中，局部重建与完整重建指纹一致。

## 范围与复现

本轮不实现 B 方向的屋顶、楼梯、桥梁或真实雪岩设计规则。参考中的白色只是普通颜色；不会自动理解材料分层、雪帽或建筑用途。A 与未来 B 可以独立网格同场景搭配。旧混合模型场景保持旧入口，不自动拆解为新参考体积。

支持 0.25／0.125／0.0625m 目标格度；根对象允许平移，保存时要求无旋转、缩放为 1。参考采样上限 65,536 格，累计覆盖列上限 65,536，区间／绘色记录有 262,144 级预算；超限明确拒绝。削掉已有实体的唯一支撑会被拒绝。本轮不是通用洞穴、桥体或任意斜面雕刻器。

`candidate` 是含固定包版本与渲染配置的最小复现工程。安装 .NET 9 后，可从本目录执行 `dotnet run --project qa/Core/Core.csproj -c Release -- surface`，并将末尾分组改为 `local`、`paint`、`paint-audit`、`reference`、`real-reference`、`validation` 或 `perf` 复跑对应测试。引擎入口是 `qa/run-editor.ps1`；异步性能／展示脚本会自行退出。临时 QA 工程不包含在版本库内。

证据位于 `reports/`：`editor-integration.json`、`editor-lifecycle.json`、`editor-reopen.json`、`performance-unity.json`、`workflow-evidence.json`、`workflow-reopen.json`、`delivery-audit.json`、`fbx-independent.json`。这些是原机实际验收记录，保留原来的执行环境与来源信息，不代表在下载机器上已经重新执行。

`qa/run-editor.ps1` 在临时工程不存在时可自动准备唯一 QA 目录；来源使用 `candidate`。引擎、Blender 路径沿用验收机器配置，换机器时需先核对相应脚本的可执行文件位置。`qa/recycle-validation-project.ps1` 是原机收尾脚本，带有原目录的严格路径保护；换目录后会主动拒绝清理，不应绕过它去操作其它工程。可通过系统回收站回收本目录下实际生成的 `qa/unity-session`。融合目前采用确定性过渡，未开放随机种子变化。

原始验证归档 [LE-04-source-v0.1-20261103.zip](LE-04-source-v0.1-20261103.zip) 与其 [SHA256](LE-04-source-v0.1-20261103.zip.sha256) 原样保留，归档 SHA256 为 `E8B9B799DF90621E8EE74DFBFD1836783BFD26ED39EBA769F7AEC00811E58B8A`。展开的发布目录略去本机历史保护清单及部署／清理记录；原归档仍保留其当时的完整快照。

当前设计与实施依据为 [设计](docs/superpowers/specs/2026-11-03-le04-terrain-reference-editor-design.md)、[实施计划](docs/superpowers/plans/2026-11-03-le04-overnight-terrain-editor.md) 和 [任务记录](docs/tasks/LE-04.md)。旧 `plan-explainer` 是历史讨论，`overnight-plan` 是计划讲解，均不作为实机成果。
