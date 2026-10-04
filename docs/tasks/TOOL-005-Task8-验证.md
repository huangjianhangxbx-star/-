# TOOL-005 Task8 Unity冻结接收与包装升级

2026-10-04。新增正式Runtime冻结类型、独立文件的MonoBehaviour身份、PublishReader、AssetBaker、SceneBaker、WrapperUpgrade和PublishWindow。旧Reader/MapBaker/MapRegistry/Journal接口保持。接收窗口位于 `Tools → Xinghai → 接收工坊发布包`。

Reader验证文件闭包/hash、contentHash、身份/revision/源与runtime、严格JSON字段、轴/配方/Root相位/实例/材质与PNG。原生cells和PNG允许GLB-only；外部模型必须冻结完整FBX组和Blender5.1.2配方，不访问latest映射。实际Windows junction依赖拒绝。PNG校验块CRC、压缩头、解压预算及Adler校验。

接收目录为 `Assets/Generated/Workshop/<publishId>/<receiptId>/`；同包同receipt重收核对全部文件/meta指纹及未保存编辑，GUID稳定。新receipt和新版本独立。Frozen~保留原字节；Unity导入派生FBX旁车仅缩短贴图路径，原始冻结旁车不改。所有输入/派生/meta/输出在受限Generated事务内。原生Root减一次，轴/反绕序及FBX一次Y180校正保留导入根旋转。

包装升级Preview与CreateCopy按instanceId工作；只允许明确登记的源坐标/90度旋转覆盖。自有组件/对象/碰撞复制，视觉实例根引用重映射；未知内部引用/Prefab覆盖/scale、删除已手调实例与改Root冲突拒绝。目标为安全Assets内不存在的新Prefab，原包装字节不变；临时包装失败只清理本次物件，不用Generated Journal虚称根外回滚。

## 真引擎证据

团结2022.3.62t13、Built-in、Gamma。实际接收原生单件、7实例A和10实例B；灰128/255、RGB、MASK alpha0.5/双面、PNG材质绑定，负坐标、半格Root及四旋转检查。独立Blender GLB预期与Unity世界顶点集A468/B524完全一致；1440×900实际Unity渲染已查看。有效Legacy点号资产身份另有受测包。

首轮10类坏包及补充7类重新计算hash的坏包拒绝；后者实际发现并修复小数旋转、小数长度、源资产闭包、未知组字段、网格Root、体素相位与PNG CRC漏洞。冻结manifest被内存修改和生成材质未保存手改也拒绝。完整源字节与Runtime保持冻结，不随后来源修改更新。

实际包装副本保留组件/碰撞/位置/旋转/视觉引用；未知视觉子节点和scale覆盖拒绝，源删除/改Root冲突另有真实新发布包。中途缺Shader导致生成失败，先前输出/meta/包装保持，本次派生物清理；真实引擎进程退出73后在新进程恢复文件/meta并移除半成品。接收窗口单件/场景路由通过。旧ReaderM12、Integration、Axes、分进程Recovery分别通过；正式插件25文件与源字节一致性由导出入口核对。

证据位于 `自制工具/map_editor/validation/workshop-task8/`：unity-publish-proof、unity-extra-proof、unity-geometry-proof、unity-visual、wrapper-proof、wrapper-conflicts、reader-edge-proof、link-proof、fault-proof、recovery-proof及final-results。red-*保留发现问题的实测；验证工程Proof不进正式插件。Node发布并发保护新增1项，累计182核心测试、类型/构建通过。

## 边界

本版不安装GLB importer或新依赖；不支持URP/HDRP、任意材质节点图、复杂透明排序或自动接收更新。代码/短渲染不替代长期性能与用户手感。Task9正在完成实际UI产包跨Unity接收与便携交付；本任务未提交推送。
