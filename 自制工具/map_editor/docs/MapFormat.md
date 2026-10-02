# 源格式 v1

权威几何是稀疏体素 cells，不同时保存另一份高度图。JSON schema 版本1，voxelSize 固定0.25米，源坐标右手 Z-up。整数格 `(x,y,z)` 占 `[x,x+1)×[y,y+1)×[z,z+1)`；高度笔刷 h/t 展开为 `[h-t,h)`。

|字段|约定|
|---|---|
|mapId|1–80位 ASCII 字母、数字、下划线或连字符，稳定模块身份|
|revision|0至2147483647整数，本地命令修订号|
|palette|1–64个 sRGB #RRGGBB；无光照检查，不以灯光倒改颜色|
|sideColor|可空；固定侧面/底面色板索引。顶面仍用 cell.color|
|cells|x/y/z整数绝对值≤8192，color色板索引，owner为height或volume；最多250000，不允许重复坐标|
|protectedColumns|`x,y` 集合；三维删除后空洞保护仍保留。volume来源列也自动保护|
|instances|id、assetId、x/y/z米、rotation绕源Z轴正转，90度倍数；kind=event时另需registryKey。anchor可选源X/Y/Z米|
|decals|独立id、assetId、x/y/z米、rotation、width/height米，水平PNG平面；order只作预览顺序提示，不保证不同透明表面的全局排序|
|surfaces|x/y/z格单位、face、tag；坐标代表面所在平面，其余两个轴代表单位格区间；独立于视觉颜色|

face为 `0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z`。例如 `(0,0,0,4)` 是地台顶面0，`(0,0,3,5)` 可以是桥板底面3。tag 首期只接受 walk/deploy/obstacle/highground。每一面只有一个标签；同高不同标签、不同高相同标签可共存。

实例/贴花列表各最多10000，ID跨两个列表不重复，id及assetId最多80字；位置与锚点绝对值≤2048米，贴花尺寸大于0且≤256米。明确不支持scale字段；旋转是90度整数倍，绝对值≤360000度。

Three.js 几何映射 `(x,z,-y)`；团结几何映射 `(x,z,y)` 并反转三角绕序；团结旋转绕Y取负角。模型本地转换与实例变换分开，FBX额外校正见AssetContract。顶点色转换到渲染器所需空间，Shader与色板不混为光照结果。

16³格为一个渲染块，负坐标用floor分块。剔除内部面时查全图邻居，分块边界编辑同时失效相邻块；同块、同方向、同平面、同色可贪心合并。块与网格均为派生缓存，不是新的几何权威。

后台网格队列一次只运行一个任务，记录单调请求序号；新操作合并待更新块，旧结果不能发布。取消笔画恢复文档并发起新序号。模型加载也用代次屏障防迟到覆盖。

另存为保留mapId；复制模块生成新mapId，局部实例ID可保持。团结场景内每份模块有独立 placementId，事件身份由场景路径、placementId、局部实例ID组合；不是正式游戏存档接口。
