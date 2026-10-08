# AR05-F03 原生与主探索视觉证据

证据全部保存在本机 ignored `work/AR-05/F03/`；不提交原素材或 PNG。

- `red-key.log`：真实 ReferenceBlueVisual.draw，已应用的站立方向转左上攻击，头部分支计数为 2，RED。
- `minimal-red.log`：去掉 A1–A3，仅站立转 A4 仍 RED。A1–A3 并非复现必要条件。
- `probe-update0.log`：AnimationState.update(0) 没有清退旧链，仍失败。
- `probe-pose-clear.log`：仅清 Track0，仍失败。
- `probe-direction-clear.log`：仅清 Track1，同一场景变为单身体。
- `native-diagnostic.json`：方向/pose/time、头部 attachment、骨骼分支、alpha、world位置、transform约束与轨道。`real-key.json`：真实主探索 A4 .2292 秒，单 Hunter，zuoshang/shang 两套头部处于中央身体区。
- `before-held.png` / `main-held.png`：相同左上 A4 .375 秒，旧方向残留与修复结果；`comparison.png` 左旧右新。仅拼接，无调色。
- `main-F01-protection.png` / `main-F01-old.png`：A1 左 .1333 秒完整上半身与粗暴删英文分支的缺失反例；Lab 对应图相同用途。
- `single-body-matrix.json`：两个真实 draw 入口，13×5×2×6 各 780 组。中央身体区域 cranial attachment 按分支计数，要求恰好一套且 Track1 无 mixingFrom；同时检查权威状态不被视觉改写。
- `real-after.json`：真实主探索 held 45 帧单头部/无旧方向链/一个 Hunter/唯一身体 CanvasTexture；`after-native.png` 与 `after-main.png` 为最终实拍。

头部计数能捕获本次多方向身体叠画，但不能证明所有身体像素都正确。另结合 F01 部件保留测试、旧遮罩缺失反例、两入口像素矩阵和人工查看原生/主场景截图。两入口像素一致本身不等于原作还原或单身体正确。对照不作原作动态消费者已闭合声明。
