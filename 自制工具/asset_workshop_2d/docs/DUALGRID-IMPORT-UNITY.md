# 双网格 Unity 静态接入（未实机验证）

本轮没有打开/修改 Unity 项目。结果ZIP内 unity/mapping.json 给出16个可解释切片与固定外部映射；完整数据在map.json。

工坊坐标X右/Y下。Data D[x,y]格中心(x+.5,y+.5)，Render R[x,y]中心(x,y)，左上角(x-.5,y-.5)。R四角取D[x-1,y-1]、D[x,y-1]、D[x-1,y]、D[x,y]，bit分别1/2/4/8。边界外为B。Unity适配才翻Y：Data索引(x,-y-1)、Render索引(x,-y)，Grid单格世界尺寸c/PPU；Render Tilemap localPosition=(-c/2PPU,-c/2PPU)。c128、PPU100时单位1.28、偏移-.64。

canonical atlas按屏幕行主序mask0..15、4×4。Sprite Multiple，准确格尺寸，Pivot(.5,.5)，Point，保留全部切片。Unity底部起始的切片Y=(3-floor(mask/4))*c，不假设自动编号顺序。Bilinear需独立验证padding/extrusion，不能在原稿上模糊修缝。

固定skner版本的数值后缀index→mask：4,10,13,12,9,14,15,7,2,3,11,5,0,8,6,1。skner-atlas.png已依此排序；名字dual_N必须依mapping.json明确赋值。与canonical顺序不同。

**canonical兼容降级**：16张仅phase(0,0)，不代表完整艺术母图。推荐自行在实际引擎适配时按Render世界格(x mod K,y mod K)选phase-atlases，并按mask切片。已有结果含每个相位的16切片矩形和PNG SHA；本轮未提供已实测的Unity运行时代码，不能据静态映射宣称实机通过。

参考Jess c9f948dfffbfcd9818c765f6653c648684ffaf99、skner493500b6ac59f5713b7d9d9bdff6d6a37016da78，两者MIT；只阅读语义并独立实现，没有复制外部代码/美术。证据与链接见任务tech-decision.md。未升级Tilemap依赖，未验证排序、碰撞、不同相机、目标GPU性能。
