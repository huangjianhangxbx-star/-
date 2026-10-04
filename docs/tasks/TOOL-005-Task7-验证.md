# TOOL-005 Task7 FBX 成组发布

2026-10-04，持续实施授权。可选 `glb-fbx` 配方已接入发布页和主进程；实际 Blender 5.1.2 生成目标及每个外部资产的 FBX、规范材质旁车和 PNG 闭包。原生体素仍使用冻结 cells 作为 Unity 接收绑定。输出写入临时目录，全部成功并核对 hash 后才提交到 `releases/<publishId>`。

验证包括：真实 Blender 三模型转换，GLB/FBX 重导入世界顶点集合相同（组合468，两个外部资产各74个唯一顶点）；灰色/RGB、MASK alpha 0.5、双面及 PNG 依赖保留。真实 Electron 选择 FBX 配方并发布成功。共享贴图重复登记和 Windows 长路径已修复。实际 Node 非零退出、受控 runner 超时/取消、缺 FBX/旁车/贴图、越界及不完整配方均拒绝提交；此前有效版本字节不变。受控 runner 不记作 Blender 实测。

Task7 完成时181项核心测试通过；后续发布会话互斥修复增加1项，目前182项通过，类型和构建通过。发布时新建/打开/复制/保存被主进程在写入前阻止，避免仅在切换会话时拒绝而留下磁盘修改。

证据：`自制工具/map_editor/validation/workshop-task7/` 中真实包、real-fbx-result.json、blender-proof.json、fbx-ui-result.json、截图、all-tests.log和 red-*；Task8的 red-session/green-session 保存并发修复证据。发布目录由最初实现的 publishes 对齐既定设计的 releases，相关回放正在补跑。Unity 接收/包装和便携交付按 Task8/9继续，本阶段没有提交推送或替换 M1.2 包。
