# 双网格技术决定

只读参考：[Jess](https://github.com/jess-hammer/dual-grid-tilemap-system-unity/tree/c9f948dfffbfcd9818c765f6653c648684ffaf99)，[skner](https://github.com/skner-dev/skner.DualGrid/tree/493500b6ac59f5713b7d9d9bdff6d6a37016da78)。两者LICENSE为MIT（2024，各作者）；skner package2.1.0依赖Tilemap Extras3.1.2和Tilemap1.0.0。已读固定源码、切片生成器、工具和说明；没有执行第三方Unity场景，也未下载贴图或把开源代码复制进产品。

Jess DualGridTilemap.cs从四个Data格查字典并在SetCell后更新四个显示格；skner DualGridUtils也列相同四格更新，注释约定Render offset(-.5,-.5)。skner AutoDualGridRuleTileProvider按16个固定索引配置四角，DualGridRuleTileExtensions按sprite名称最后的数字排序，不能把我们的mask值直接作为其后缀。

从两个源码的tuple/配置逐项推导，本项目mask→外部索引是 `[12,15,8,9,0,11,14,7,13,4,1,10,3,2,5,6]`。会用独立字面测试核对16项与重排atlas实际像素；这证明静态适配关系，不声称Unity实机成功。

采用原创CJS纯算法、前端同模块构建：Data格0/1，Render以Data交点为中心。屏幕Data格左上原点(0,0)，Render格R(x,y)中心(x,y)，左上(x-.5,y-.5)，有(W+1)×(H+1)格。Canvas多出半格边界，Data叠加格从(.5,.5)开始。c/PPU为世界格长。Unity Data单元索引(x,-y-1)，Render索引(x,-y)，Render Tilemap局部位移(-c/2PPU,-c/2PPU)，对默认中心pivot可重建相同物理中心。只在适配层反Y，不照抄计划示意的正偏移符号。

16几何使用确定性的marching-corner族：单角/对角分离按L_p角距离，三角状态为缺角的补集，两相邻角为半平面；p=1+roundness。共边使用同一端点函数。6/9中部留B，不桥接；0/15不添加接触线。墨线只在A侧、厚度/暗度显式声明，几何与笔触独立，艺术轮廓始终候选。

连续母图K=2/4/8；世界Render坐标模K选择完整c×c像素窗，预编16×K²图块与相位atlas，不随机换相位，不抹黑缝。canonical16仅phase(0,0)，明确有限重复/可能接缝降级；完整预览/推荐结果使用相位图。源尺寸错误保存原件，默认拒绝；如Agent明确裁剪，保留原件和窗口/覆盖比例，不缩放。

新ZIP9自包含旧批准原图/签封身份、独立生产spec、连续绘画契约、16态几何导引、任务级风格与诊断。权威镜像重建、Ed25519与实际字节沿用安全边界；外来签名不变成人类批准。新生产记录只保存原图编译与数据地图，所有授权仍由旧workflow.productionGuard判断。
