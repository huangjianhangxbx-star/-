# Spine 3.8 实际接入验证

日期：2026-09-27。原始素材未修改。

## 运行时与接入

使用官方 spine-ts 3.8 Canvas runtime：https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/3.8/spine-ts/build/spine-canvas.js 。官方 LICENSE 随运行时保存于 game/public/assets/vendor/LICENSE。运行时 SHA-256：250eaf578a4654a63de0aef7dfad0fc4bcb613bcf2b3ea8d0d2822e4b9597ce0。

每个角色独立 Skeleton、AnimationState 和 512×512 Canvas；共享解析后的只读骨架与贴图。由 Three.js CanvasTexture 显示，避免旧 Spine Three.js 适配器与当前 Three.js 版本耦合。脚锚点约为 (0.5, 0.1211)。动画仅负责显示，不用动画事件决定战斗伤害。

## 实测结果

1. 官方 SkeletonBinary 实际解析全部 7 个骨架，版本均为 3.8.86；对每个动画应用至中点并更新世界变换，通过。
2. 本地 Vite + Microsoft Edge 无头浏览器真实解码 atlas PNG；7/7 角色的待机、移动、攻击、技能、死亡都有非透明输出。
3. 7/7 角色同一待机动画推进 0.3 秒后像素变化，确认时间推进生效；不是静态图占位。
4. 截图 characters.png 人工检查：角色主体可见、朝向直立、透明背景正确。
5. 接入前 browser test 失败于模块不存在；新增适配器后通过。

复跑：启动 game/npm run dev，然后 node work/spine/parse.cjs 与 node work/spine/validate.mjs。输出证据在 work/spine/parsed.json、browser-result.json、characters.png。

## 实际动画表

### Arina

`attack_01` (2.000 s)、`cheer` (10.000 s)、`dead` (1.333 s)、`injure01` (0.667 s)、`injure02` (0.667 s)、`preskl_03` (0.433 s)、`run` (0.533 s)、`skill_01` (1.767 s)、`skill_02` (1.200 s)、`skill_03` (1.500 s)、`stand` (2.667 s)、`stun` (2.000 s)

事件定义：无。骨骼 92，插槽 44。

### Cynthia

`attack_01` (1.167 s)、`cheer` (4.167 s)、`dead` (1.333 s)、`injure01` (0.667 s)、`injure02` (0.667 s)、`preskl_03` (1.500 s)、`run` (0.533 s)、`skill_01` (1.500 s)、`skill_03` (0.900 s)、`stand` (2.000 s)、`stun` (2.000 s)

事件定义：`Bullet`、`EffectLocal`。骨骼 136，插槽 59。

### Dustin

`attack_01` (1.333 s)、`attack_02` (1.667 s)、`cheer` (6.167 s)、`dead` (1.500 s)、`injure01` (0.667 s)、`injure02` (0.667 s)、`preskl_03` (0.833 s)、`run` (0.533 s)、`skill_01_01` (1.100 s)、`skill_01_02` (1.067 s)、`skill_02` (1.400 s)、`skill_03` (2.133 s)、`stand` (1.333 s)、`stun` (2.000 s)

事件定义：无。骨骼 105，插槽 45。

### Fenia

`attack_01` (1.300 s)、`attack_02` (1.267 s)、`cheer` (1.833 s)、`dead` (1.500 s)、`injure01` (0.667 s)、`injure02` (0.667 s)、`preskl_03` (1.200 s)、`run` (0.533 s)、`skill_01` (2.100 s)、`skill_02` (1.167 s)、`skill_03` (1.733 s)、`stand` (2.667 s)、`stun` (2.667 s)

事件定义：`Damage`、`EffectLocal`。骨骼 84，插槽 61。

### Galore

`attack_01` (1.667 s)、`attack_02` (1.667 s)、`cheer` (2.167 s)、`dead` (1.500 s)、`injure01` (0.667 s)、`injure02` (0.667 s)、`preskl_03` (0.833 s)、`run` (0.533 s)、`skill_01_01` (1.467 s)、`skill_01_02` (0.933 s)、`skill_01_03` (0.733 s)、`skill_02` (1.267 s)、`skill_03` (2.100 s)、`stand` (2.667 s)、`stun` (2.000 s)

事件定义：`Bullet`、`EffectLocal`。骨骼 77，插槽 53。

### Livia

`attack_01` (1.500 s)、`attack_02` (1.500 s)、`attack_03` (1.500 s)、`attack_04` (1.833 s)、`cheer` (7.333 s)、`dead` (1.333 s)、`injure01` (0.667 s)、`injure02` (0.667 s)、`preskl_03` (0.667 s)、`run` (0.533 s)、`skill_01` (1.567 s)、`skill_02_1` (1.333 s)、`skill_02_2` (1.167 s)、`skill_02_3` (0.867 s)、`skill_02_4` (1.267 s)、`skill_02_5` (0.800 s)、`skill_03` (3.133 s)、`skill_04_1` (0.433 s)、`skill_04_2` (1.333 s)、`skill_04_3` (1.633 s)、`skill_04_4` (1.000 s)、`skill_04_5` (1.667 s)、`stand` (2.000 s)、`stun` (2.000 s)

事件定义：`Damage`、`EffectBlade`。骨骼 59，插槽 45。

### Verlaine_bot

`bullet` (0.667 s)、`minion_attack_01` (2.000 s)、`minion_cheer` (2.000 s)、`minion_dead` (1.000 s)、`minion_injuer01` (0.667 s)、`minion_injuer02` (0.667 s)、`minion_run` (0.533 s)、`minion_stand` (2.000 s)、`minion_stun` (2.667 s)、`minion_walk` (2.000 s)、`minion_walk stand` (2.000 s)、`skill_01` (2.433 s)

事件定义：无。骨骼 46，插槽 17。

## 尚未覆盖

8 个独立特效骨架尚未接入挂点；Canvas runtime 的复杂裁剪、双色着色和特殊混合效果未做逐帧与 Spine 编辑器对照。动画事件已确认定义，但当前不驱动玩法或独立特效。极端技能姿势可能超出基于待机范围的画布边缘，需要后续逐动作视觉检查；本次像素测试证明可见而非完整姿势无裁切。美术/运行时许可未因此验证而自动获得，原许可边界保持。
