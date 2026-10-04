# 团结接收器 M1.2

受测环境：团结 2022.3.62t13、Built-in、Gamma。使用 release/星骸地图团结插件-M1.2.unitypackage 安装；包包含正式接收器和两份双面 Shader 及其元数据。Newtonsoft.Json 依赖沿用原有工程配置。

地图 JSON 主链路不变。属性坐标是面平面坐标（体素 z=-1 的顶面为 z=0），接收器验证所属体素与相邻空间；walk/highground 只允许 face=4。旧 deploy/ground 顶面规范化为 walk，非法面明确拒绝，源文件不改。编辑参考 PNG 不生成游戏对象。

## FBX 与材质依赖

地图工坊正常“导出 FBX”生成 name.fbx、name.xhmaterials.json；含图片时还生成 name.xhtextures/。必须将这组文件一起放进团结 Assets 同一目录。NativeAssetMaterials 按实际材质名恢复源 sRGB、透明、粗糙度、金属和发光参数，并读取受约束的相对贴图路径。若先导入 FBX 后才补旁车/依赖，或首次扫描提示 Shader 未就绪，资源完成导入后对 FBX 执行 Reimport。

仅导入 FBX 不保证灰阶。本机原始 FBX 的灰色材质为 .2158605，旁车恢复源 #808080 的 .5019608。不要修改母版色号或灯光补偿。原生 name.xhasset.json 仍兼容；通用 xhmaterials 旁车优先。

本轮 GLB→Blender→FBX 配方经非对称三轴实测，原始 FBX 需要一次 Y=180° 才与地图 x/y 正方向一致。注册表 blenderFbxAxes 保持开启，MapBaker 同时保留 FBX 自带根转换旋转。不要再手动给资产叠加180°。其它导出配方须单独验证。

单面采用 Built-in Standard；双面 OPAQUE/MASK 使用 Xinghai/Exchange Double Sided，双面 BLEND 使用其 Blend 版本，均 Cull Off。MASK 保留旁车 alphaCutoff；贴图依赖来自转换器，颜色乘数保持源值，避免重复乘色。URP/HDRP 和任意 Blender 节点图不在本轮支持范围。

## 已验证与限制

- reader-result.json、reader-cross-engine-green.log：真实团结30项读取检查，包含 TypeScript EditorDocument 生成的负坐标六面源。
- axes-final.json、integration.json：旧三轴90°/锚点路线，以及原样旧地图模块/事件/稳定GUID/重开/回滚。
- exchange-import.json/png、exchange-common-sidecar.log：灰/R/G/B、尺度与一次轴修正；图片是引擎 RenderTexture，不是操作系统截图。
- ui-exchange-source-bounds.log、ui-exchange-import.json/png：真实主UI run-okPb25/assembly.fbx 加自动旁车直接接收，未补原生源字段。GLB/团结完整包围盒一致，材质恢复 #59737a。
- material-contract.json：带PNG转换样本的6材质颜色、1贴图绑定，以及受控MASK变体的alphaCutoff=.35通过。shader-package-check.json 另核对实际双面 Shader 绑定和两 Shader 编译状态。

上述为参数、资源绑定、几何和编译验证。透明重叠排序、复杂光照下双面视觉、金属/发光风格与用户操作手感仍需视觉验收，不以材质参数通过代替。

开发中一度将面plane误作所属cell而拒绝旧图，现已修复。旧图原件未改；最终证据为原样旧图重跑成功。贴图缺失和双面不支持的早期失败日志也保留，最终状态以上述本轮结果为准。证据都在 validation/m12/。
