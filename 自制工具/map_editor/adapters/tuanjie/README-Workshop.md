# 团结工坊接收器 Workshop-M2.0

安装 `星骸地图团结插件-Workshop-M2.0.unitypackage`。受测：团结2022.3.62t13、Built-in、Gamma；沿用工程已有 Newtonsoft.Json 配置，不自动安装依赖。旧 `星骸地图 → 烘焙地图` 和 MapRegistry 路线保留。

1. 工坊先保存项目，再发布。选择单件或当前场景，填新版本身份；外部模型接入 Unity 必须选择 GLB+FBX，并使用已安装的 Blender5.1.2。
2. 在 Unity 菜单 `Tools → Xinghai → 接收工坊发布包` 选择 `releases/<publishId>/manifest.json`。保留整个发布目录，不能只拿目标 FBX。
3. 接收身份默认 `primary`。生成物位于 `Assets/Generated/Workshop/<publishId>/<receiptId>/`。同包同接收身份重收会核对指纹并保留 GUID；新版或新接收身份使用独立目录。手改/缺失生成物会拒绝重收，可点“新接收副本身份”。
4. 原始冻结输入保存于生成目录的 `Frozen~`，Unity忽略该文件夹的导入。模型接收使用有事务保护的派生副本；FBX旁车的贴图路径缩短，原始FBX/旁车/贴图仍按原字节保存。Generated是工具生成区，功能脚本、碰撞与额外对象放在用户包装中。
5. 新包装根添加 `WrapperState`，`visualRoot` 指向接收场景的Prefab实例，填对应publishId/receiptId。受支持的实例手调在 `overrides` 中明确登记instanceId、源坐标sourcePositionM和90度rotationDeg。源为右手Z-up、米；Unity显示坐标为(X,Z,Y)，旋转为负Y角。
6. 接收候选新场景后，在接收窗口指定原包装，先预检，再生成新的包装Prefab。原包装保留。自有对象/碰撞/组件复制；指向稳定视觉实例根的序列化引用重映射。未知视觉子节点引用、内部Prefab覆盖、未登记Transform、已手调实例被删除或改Root会阻止升级。

原生体素直接按冻结cells/色板/Root生成视觉网格，无需GLB importer；PNG水平贴花使用冻结图像。模块比例参考PNG不会进入Unity视觉。外部模型按明确FBX资产级绑定解析，不访问公共库或MapRegistry最新版本；Blender5.1.2配方只做一次180°Y校正，并保留导入根旋转。无需手动补旋转或调灰阶。

源Root只减一次；固定0.25米体素，实例无缩放，场景无Gameplay。材质保持源sRGB、粗糙度、金属、发光、MASK/双面和PNG绑定。实际Unity顶点/参数及视觉证据分别保存；不同光照下不承诺像素相同。URP/HDRP、任意Blender节点图、透明复杂排序、用户自定义内部Prefab覆盖和自动更新不在本版支持范围。

验证见 `docs/Validation-Workshop.md`：真实包接收、A/B冻结、GUID、手改冲突、包装副本、失败/进程中断恢复及旧路线回归。
