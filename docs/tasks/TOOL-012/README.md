# TOOL-012 · 视口显示与光照预设

用户于2026-10-24转交[详细计划](spec-v0.1.md)并要求实施；基线 bf4aaed，与 GitHub main 一致。按 B 级模块验证执行 M0～M6，最后停在用户视觉 Gate V。没有回退至计划编制时的旧基线204e2bc。未改人工资料、开发细则、TOOL-010/011作者算法、游戏本体或依赖版本。

## 实际接线

| 位置 | 实现 |
|---|---|
| 显示状态 | `desktop/viewport-display-state.ts`：四预设、范围校验、版本1偏好，edit/preview/assembly/rock-lab独立 |
| 材质 | `viewport-materials.ts`：每视口只读源的缓存变体，每帧结束恢复源；灰模覆盖RGB保留Alpha，Basic原色，统一Standard哑光基础面和彩绘 |
| 灯组与角色 | `viewport-display-controller.ts`：中性主/补/半球光，摄像机正交基或固定方向、0–360旋转；作者几何/绘画/辅助角色；边线懒缓存 |
| 凹槽 | `viewport-cavity.ts`：锁定版本SSAOPass，固定核与噪声，16样本、0.65倍线性尺寸；深度/法线仅模型；合成写回真实深度，再正常遮挡辅助层，最后一次OutputPass |
| 编辑双视口 | `view.ts`、`renderer.ts`：fillTerrain含新画布/Undo/临时岩体/笔画新面，外部GLB有模型角色；菜单不取消岩体草稿，不进入作者历史 |
| 多画布与彩绘 | 现有CanvasView、SurfacePaintLayer只提供原几何/源材质，显示在渲染时适配；不改paintSource，彩绘纹理已有基础色，变体保持白因子 |
| 试摆 | `assembly-view.ts`复用控制器，保留几何共享缓存；新复制实例继承当前显示；原模型黑边按钮移入辅助显示 |
| 查看器 | `prototypes/rock-shaping/viewer.ts`使用同一控制器及菜单，Z-up、每格1渲染单位适配；没有改造型配方 |
| 缩略图 | 已检查`thumbnail.ts`自建场景、`workshop-preview.ts`固定有色2D配方，两者均不读取显示偏好，保持原链路 |
| 便携样例 | `scripts/build-display-samples.mjs`生成三份原创样例，package脚本复制至“示例/视口显示” |

UI遵循现有深灰/金色工具风格：原位“显示”菜单，折叠辅助项，不增加左侧大面板、不遮暗场景。同步默认关；菜单Esc优先关闭并释放焦点；Ctrl+S可穿过菜单。灰模进入绘画临时原色，退出恢复，用户显式更改优先；笔画/轴拖拽中禁用切换。

## 已完成验证（源码阶段）

- `npm test`：448/448；新增5项显示/材质/手势合同测试。初次缺模块及类型剥离失败有记录，已修正并实测转绿。
- `npx tsc --noEmit`、主构建、独立查看器构建通过。未升级依赖。
- GPU实测 `tests/viewport-gpu.mjs`：NVIDIA RTX4080 SUPER / ANGLE D3D11，DPR1，640×480渲染。五个原色色块通道误差0；同色基础面/真正SurfacePaintLayer各预设采样完全一致。
- U槽中档增强：正交15,969像素、透视9,337像素局部变暗>2；平均变化约10/255，远离遮挡平面变化1/0。正交六方向×三格尺寸均启用；真实裁切输出改变；透明状态明确暂停增强。
- 20轮×四预设切换，缓存建立后几何13/纹理11/程序14保持稳定。此为有界样例资源趋势，不是任意场景泄漏证明。
- `workshop-viewport-display-ui.mjs`：真实1800×1100窗口，四预设同镜头截图、左右独立与同步、原色禁用项、保存JSON哈希不变、岩体预览格数/种子保持、菜单Esc优先、绘画临时切换与手动覆盖、Resize、真正退出重启及偏好恢复、试摆Ctrl+D确实增加实例并继承显示。
- 中等原创岩壁3,582格，同机同视角off/low/medium帧间隔中位与P95约16.7ms。仅当前GPU/分辨率样例，不以CPU提交耗时代替GPU帧耗时，不承诺任意大模型60FPS。
- `surface-paint-ui.mjs` V2：真实六面/三精度/填涂/吸色/撤销/复制/保存重开通过（`validation/surface-paint-ui-Jukpto`）。
- `workshop-rock-shaping-ui.mjs`：真实两造型/预览取消/彩绘保护/范围隔离/Undo/Redo/保存/失焦/实际重启通过（`validation/rock-workshop-RVGpri`）。
- `viewport-viewer-ui.mjs`：离线两造型四显示、光向、刷新偏好，统计/种子不因显示变化，无网络请求和pageerror（`validation/viewport-viewer-8Pz9G2`）。

源码证据：`validation/viewport-display/gpu-result.json`、`validation/viewport-workshop-OBtjzx/`。最终包证据与版本在下方交付补记中登记。测试项目均为原创副本，没有写用户生产资产。

## 边界与未执行项

- SSAO不处理透明/X-Ray/Alpha-cutout场景，主动暂停并显示说明；特殊PBR材料按基础色哑光回退，不提供法线/金属/透射的完整PBR验证。辅助线、Root、选择反馈、参考图、Ghost和彩绘重复面不进遮蔽输入。
- 未另建阴影贴图、烘焙AO、材质编辑器或新渲染依赖。SSAO是屏幕空间效果，离屏遮挡不计算。
- 未冻结旧版GPU基线，截图是本轮四种预设同镜头对照；未把技术截图当用户审美验收。
- 本轮没有改UV/作者源/导出器；未重复整套Blender/Unity接收矩阵。以源JSON哈希、只读材质测试及既有彩绘回归约束隔离；FBX实际回读仍沿用TOOL-010/011既有证据，不冒称本轮重测。
- 未覆盖所有显卡/超大项目、复杂外部ShaderMaterial，未进行长时间压力测试；透明回退及软硬件差异如实保留。
- TOOL-010 Gate B、TOOL-011 Gate R-B与本轮Gate V分别待用户确认；本轮不代替其余造型/性能/接收验收。

## 操作

见应用内文档[视口显示](../../../自制工具/map_editor/docs/Viewport-Display-TOOL012.md)。打开便携包“示例/视口显示/project”，点击各视口顶部“显示”。灰模辨形、原色校色、柔光看彩绘、侧光看错台；侧光菜单内旋转灯光。同步仅同步显示，复位不改变模型。

## 最终便携包交付

- 主功能提交 `3cabe6d778f6a30b8704fbcfaea4b88b508f665c`；追加画布透明度与彩绘一致性修正 `8990f14bc108bf8929947dbd270045b477137c5e`（最终功能SHA）。该修正先写真实GPU材质不透明度失败用例，再实现，已实测转绿。
- 实际EXE：`E:/WORLDCREATOR/XingHaiHuiLang/Origin/work/TOOL-008/checkout/自制工具/map_editor/release/星骸地图工坊-Workshop-M2.0/星骸地图工坊.exe`。
- 包内build-info：commit `8990f14bc108bf8929947dbd270045b477137c5e`，sourceFingerprint `9e299706439a1b228464c475bf494013584edfa1cd6ebb9f074290c747593126`，builtAt `2026-10-24T08:57:10.559Z`。后续仅交接文档提交不改变此功能包SHA。
- 旧包完整备份：`release/星骸地图工坊-Workshop-M2.0-TOOL011-866509a/`，保留原build-info及资源；没有覆盖Legacy包。
- 最终EXE实际显示故事：`validation/viewport-workshop-btny0P`，四预设/同步/岩体草稿/画笔状态/保存重启/复制实例/Resize全部通过，无pageerror。关/低/中帧间隔中位16.7ms，P95<=16.8ms，环境同上。
- 最终EXE完整彩绘回归：`validation/surface-paint-ui-Ghi5PB`，六面、三精度、笔画历史、填涂/擦除/吸色、复制、保存重开通过。最终源码全核心再跑448/448通过。
- 归档证据：[灰模](evidence/studio-gray.png)、[原色](evidence/albedo.png)、[柔光](evidence/studio-color.png)、[侧光](evidence/raking-gray.png)、[试摆](evidence/assembly.png)、[正交凹槽](evidence/cavity-orthographic.png)、[透视凹槽](evidence/cavity-perspective.png)、[GPU数值](evidence/gpu-result.json)、[EXE故事/帧间隔](evidence/result.json)、[包版本](evidence/build-info.json)。同镜头四预设为真实程序截图，没有AI概念图。
- 原计划下载副本SHA256 `0b516c9099ec7863703334f586f8f4bd9ff78cde1729f7231879d84fe9306e15`；受保护开发细则SHA256仍 `fa8ba103b456d76bf371f3f504c442356a6b891ec6969e1e9e25b39af035a94e`。未改用户生产资产。

技术交付完成，**Gate V等待用户观察**。限界见上；不将本轮通过解释为所有显卡、任意大模型或完整PBR/FBX接收均已重新验真。
