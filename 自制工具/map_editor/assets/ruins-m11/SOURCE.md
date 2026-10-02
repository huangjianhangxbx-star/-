# M1.1 真实资产子集

源目录：`art/探索地图样例/重建-v2`。本目录是验证副本，原件不改。

- AR_COLUMN_02：1.25 × 1.25 × 2 m，GLB 7248 B，Blender 源 105882 B；源 SHA-256 840afa5ec63ffc40fe65fc5ebc4e848692da9d74407d4166e9ac5f00ae4e2131。
- AR_FRAME_01：5.75 × 1 × 4.25 m，GLB 13416 B，Blender 源 102618 B；源 SHA-256 a6647c515799dbb49cd350914ae8a8863a92d944f7ca59dcec0980ee68ffad3a。
- EX_ROCK_01：2 × 1.25 × 1.25 m，GLB 4952 B，Blender 源 105452 B；源 SHA-256 380c5927dfb56d930e7921c2be16aad52db7910d4b897cdde76a67320108b981。
- IT_LIGHT_01：0.75 × 0.75 × 1.25 m，GLB 7856 B，Blender 源 101193 B；源 SHA-256 66d0fad9b4662ddcdc437f7a0d81120a5cab11b57d4bfe466852b7d25b988b36。
- EX_LANDMARK_01：3 × 3 × 8.5 m，GLB 7112 B，Blender 源 105815 B；源 SHA-256 04f9fcc87a0c990be17170d59cc36303adf0f2209c0ad93c0d215a57d393bc28。
- PT_EMBLEM_01：3.5 × 3.5 × 0 m，GLB 5884 B，Blender 源 101266 B；源 SHA-256 4524042864d152e94e002eed0daacf4f214c32d790cd27b41f37951412a82a64。

已用 Blender 5.1.2 从上述 `source.blend` 副本导出同名 FBX：`axis_forward=-Z`、`axis_up=Y`，每件只导出 Mesh。`PT_EMBLEM_01.png` 是从同名原有平面模型正交渲染得到的透明贴花，不是场景截图；512×512、RGBA、中央有色而角落透明。已在桌面检视、游戏样本和团结双实例中实际载入子集；最终比例、方向与配色的人眼逐件验收仍待用户复看。
