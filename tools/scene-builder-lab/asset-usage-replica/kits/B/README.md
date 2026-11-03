# Kit B — 潮石与浅木

独立供应的 `bridge-orthogonal-v1` 九角色完整套件。机读入口为 `kit-manifest.json`，身份为 `workshop.bridge.B`、版本字符串 `1`。所有路径相对此目录；登记来源 SHA 留给登记工具计算，manifest 未手填 SHA。

每个角色目录包含原生 `<role>.blend`、`recipe.json`、共享 API 导出的 `*.palette.fbx` 与 `*.palette.png`、可选 `*.palette.glb`、真实中性 `preview.png`。原生文件中的实际 mesh 是来源事实；后续编辑不得用 recipe 重建覆盖。

造型为暖色退台石基、青绿／石板色帽沿、浅木双窗格栏。踏步负 X 挑鼻、平台退台承座、束腰柱身与宽柱帽、开放木框均为实际几何。没有继承第一套角色、灰盒补件或装饰性标记代替母件。

作者使用唯一资产设计输入 `../../kit-spec/bridge-orthogonal-family-v1.md`，以及共享 voxel_workbench 的 SKILL/API/AGENT_GUIDE/VALIDATION。未读取桥梁生成器、第一套 recipe 或第一套几何。无桌面、游戏或 Unity 启动，无 Addon 安装或用户配置修改。所有几何由共享 `api.apply_recipe` 创建。

Blender 原生 X 沿路、Y 对称横路、Z 向上；集合底部中心为原点。`logicalSizeMeters` 按契约的 X 长／Y 高／Z 宽登记，`unityAdapterYaw` 均为 180。每个新源单独使用 `workshop.bridge.B.detail125` 的 0.125 m 细节 profile；旧资产与用户默认 profile 不受影响。

供应侧验证已通过：九个保存源重新打开、精确实际包络、Y 对称、固定顶面／鼻口／真实栏杆孔洞、FBX 独立空场景重导入后几何签名与包络相等、所有网格 UV 和 palette 贴图引用齐全。完整报告在 `../../qa/kit-B/independent-validation.json`。原生文件 SHA 与导出 SHA 只在该验证报告中记录，不写入登记输入。

四个角色的十二张实际正交渲染与精确尺寸图在 `../../qa/kit-B/orthographic/`、`orthographic-contact-sheet.png` 与 `measured-interfaces.svg`；九件总览为 `kit-B-overview.png`。

契约解释记录：

- 原文同时使用逻辑 Y 向上与 Blender Z 向上，因此制作采用原文明确指定的 Blender 源坐标，逻辑尺寸只交换高度／宽度轴；不在资产中整件缩放补偿。
- 0.125 m 厚栏杆／柱身围绕中心线自然产生 ±0.0625 m 边界。构件尺寸仍为 0.125 m 的整数倍；采用 API 明确支持的 custom anchor 放置，所有原生对象变换为单位值，集合原点不偏移。
- 接口允许非接触部分内缩，故 tread/deck 保留完整连续 0.25 m 顶面，coping 保留连续全长顶帽，arch-stone 保留全长顶部及左右承接边界，keystone 用对称全宽上肩连接。其余退台全部落在固定包络以内。
- “风化”表达采用块状退台与石材拼色；未要求也未伪造高频磨损纹理。

本交付为供应侧通过，不自称整族认证。实际换件、导入适配、接缝、洞口与重开编辑认证由冻结后的消费者验收完成。
