# 可视与骨架证据
原资源只读核验：五个中文方向根 左/左上/左下/上/下，以及八个英文受约束分支和标记骨骼，共16个root下子骨骼。方向Track1主要定位中文方向根；攻击Track0切换attachment并改变transform约束。
A1在 .0333～.4667 期间启用 zuoshang_zuo 等约束，把英文分支身体移到当前姿态。旧遮罩按照“根名不是当前方向”清空这些attachment，导致上半身消失。并非atlas丢失、Spine资产损坏或Three.js裁剪。

本机 work/AR-05/F01：before-a1-D.png 为旧过滤 .1333秒只剩下半身；before-a1-E.png为同骨架同时间仅中文方向根过滤，完整上半身恢复。B无方向/无过滤、C方向无过滤（允许多方向）、D实际过滤、E确认分支过滤的同帧原生PNG均保存；前后矩阵分别render-before.json/render-matrix.json。原先780组中60组画布像素不同；修复后实际D与E逐像素一致。A3/A4原本也可完整，并不捏造每段都丢部件。

attachments-before.json与attachment-repro.json对比真实动画apply后的attachment/alpha/active及过滤结果；指定A1左向 .1333追加12个关键slot ancestry、Track0/1时间/mixing、drawOrder及clipping边界。原模型数据和PNG只在ignored work，不上传。
Lab和主Hunter共240个连续四段/快速转向/左右镜像实际draw帧逐像素一致，且draw前后输入状态JSON不变。主Three.js最终画面使用AR05浏览器实拍work/AR-05/main-hunter.png/main-active-controls.png；原生Canvas先已完整，未改Sprite/CanvasTexture/缩放。

站立画框负向回归曾检测到height从164.198446变成1769.310243（包含画外模板骨骼）。blueStandingBounds只在测量时临时选择左向主身体，finally恢复全部动画attachment，使画框保持原尺寸，运行绘制保留受约束分支。
