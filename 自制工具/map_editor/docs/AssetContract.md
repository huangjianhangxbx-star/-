# 资产与引擎接入契约

资产清单 `.xinghai-assets.json` v1 由桌面管理。每项稳定id、显示名name、根内相对path、type、bytes、hash、status、anchor；同名同目录的blend/fbx可登记source/exchange。内容哈希用于变化检测，不当身份；外部任意移动改名会显示旧项missing、新项新ID。

GLB以米、Y-up交换，Blender导出器负责从原始Z-up转换；桌面不再旋转模型内部，也不自动缩放。根锚点为源(0,0,0)，可记录自定义锚点。Blender细节0.125米模型作为单一实例，不拆成0.25米地形体素。

团结实测标准FBX：Blender 5.1.2，`axis_forward=-Z, axis_up=Y, add_leaf_bones=False`。团结2022.3.62t13导入后源X/Y方向均取负，模型实例追加Y轴180度旋转，得到目标 `(x,z,y)`。轴校正不再施加给锚点；锚点只按实例的源旋转变换。三轴、90度旋转、非零锚点有真实烘焙断言。其他导出器/配方不得直接沿用此判断；用已对齐的原生prefab并关闭该项校正。

功能事件以registryKey显式映射，不根据显示名称查找、不反射创建任意脚本。资产ID只决定桌面预览。团结样例SampleEvent提供计数交互，用来证明每份模块的事件独立，不代表正式门锁/机关机制已接入。

生成目录固定在Assets/Generated/mapId；持久资源含每块Mesh、统一顶点色Material、MeshCollider、MapSurfaceData、嵌套模型/功能prefab及贴花网格/材质。原始FBX、PNG、功能prefab与映射表不放生成目录，不自动改写。

正式插件文件：Runtime下除ProofPlayer.cs之外的文件；Editor下BakeWindow.cs、MapBaker.cs、BakeJournal.cs、SourceReader.cs、PlacementIdentity.cs、NativeAssetMaterials.cs。验证工程包含额外Proof脚本和固定测试路径，这些不进入交付插件包。

插件仅依赖UnityEngine/UnityEditor（对应真实团结API）与com.unity.nuget.newtonsoft-json 3.2.1。Built-in Shader是当前适配目标；URP/HDRP需专门材质适配，本期未验证。

保存与烘焙失败报告会保留上一有效版。一般异常回滚已改写资源的字节、meta和内存快照；进程退出前未提交的恢复记录在Library/XinghaiBakeRecovery。恢复仅处理生成目录，不回滚外层手工场景。无变化判断包含源、引擎版本、管线颜色空间、绑定依赖、Shader依赖和烘焙器版本；输出资源内部不提供人工编辑保护。

## M1.1 真实遗迹子集与命名

`assets/ruins-m11/SOURCE.md` 逐项登记从现有 `art/探索地图样例/重建-v2` 复制出的柱、断柱、碎石、门框、灯与地标；相应 `.blend`、GLB 和按上述配方实际导出的 FBX 放在副本目录，PNG 贴花由现有纹章模型渲染而来。原美术源文件保持不动。样本地图实例引用稳定资产 ID，名称和实际文件名变化不更改 ID。

批量物理改名先预检 Windows 保留名、目标冲突和关联的 GLB/Blend/FBX，再在所选副本目录执行事务；发生失败时回滚文件和 manifest。重新扫描、Blender 重新导出后，应以同一 ID 重新加载。团结工程使用自己 `Assets/TowerAssets` 内的 FBX/PNG 副本，桌面改名不直接操作团结 `.meta`；改动导入资产时应重新映射或更新副本并复查方向。

## M1.2 原生资产与颜色契约

工坊原生母版为`.xhasset.json`（xinghai-native-asset-1）。选择体素→局部格坐标→底面中心/原点/自定义锚点；GLB已减去原生锚点，资产库anchor为[0,0,0]，不可重复减锚点。更新必须使用打开原生源后的局部文档，保留assetId、局部原点和旧实例变换。Blender改过的网格作为外部模型版本，不反写旧体素。

材质快照是`xinghai-palette-1`：profileId/revision、paletteId/revision、unit=meters、axes=RH_Z_UP、gridStep、colorId、baseColor_sRGB、alpha/roughness/metallic/emissive/emissiveStrength/alphaMode/doubleSided。核心`paletteFromProfile`适配已有Blender Profile；不改旧默认色板、不按RGB或名称合并材质身份。工坊源保留HEX紧凑色槽，导出时按身份快照确定映射，新增色槽生成新身份。

GLB标准材质因子使用线性基础色，顶点/贴图其它乘数保持白；地图按块、模型实例保持独立节点与共享网格；PNG贴花内嵌纹理。编辑PNG参考始终排除。事件节点仅为视觉预览和标识，功能仍由地图JSON与团结注册表决定。

FBX转换使用已安装Blender独立后台进程，输出同名`.xhmaterials.json`与FBX成对保存。二者一起放入团结Assets，新插件NativeAssetMaterials按实际材质名称读取快照纠正Gamma/Linear接收语义。原生`.xhasset.json`旁车继续兼容。FBX单文件不保证接收材质色彩等价；不要漏带旁车，也不要通过手改母版色值补偿光照。

新旧FBX路线各以非对称三轴样本验证。MapBaker保留导入模型根旋转，再叠加实例朝向及受测Blender轴修正；不能覆掉导入旋转。URP/HDRP和任意自定义Shader仍未纳入本轮支持。
含贴图的FBX还必须保持同名 .xhtextures 目录相对路径；转换器保存原始PNG/JPEG依赖，接收器显式绑定，不能只依赖FBX嵌入纹理。Built-in双面材质由随包ExchangeDoubleSided及ExchangeDoubleSidedBlend Shader承接，具体实测边界见adapters/tuanjie/README.md。
