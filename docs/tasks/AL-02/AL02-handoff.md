# AL02 交接与停止点

本轮唯一主任务为 [凿冰与大斧结构联动](../AL-02-凿冰与大斧结构联动.md)，计划为用户提供 v0.1，增量契约见 [AL02-contract.json](AL02-contract.json)。目标 GitHub `main`；最终提交号在交付回复给出，不为回写自身再造提交。AL01 M3 手感认可与 AL02 待试玩分别记录。

试玩：http://127.0.0.1:5173/action-lab.html 。默认基础；构筑下拉可选 B1 凿冰、B2 大斧、B3 组合，也保留旧能量回复。选择新构筑后按需加载原冰柱/斧子，切换安全重置。WASD 移动、左键普攻、右键架盾、Space 闪避、Q 按住瞄准松开盾冲；可慢速、暂停、重置、导出 JSON。

若本机服务结束，在 `E:/WORLDCREATOR/XingHaiHuiLang/Origin/game` 使用 Node 22.14.0 执行 `npm run dev`。原小蓝/僵尸 Spine4.1、音效及 vendor 仍在本机 `../work/AL-01/assets`；本轮两个原贴图位于 `../work/AL-02/assets/effects/column.png`、`axe.png`，哈希/源对象见契约。没有复制全资产库；空冰柱骨架不是有效视觉来源，实际取效果 prefab 的 SpriteRenderer。斧子取 ParticleSystem UVModule.sprites[0]，不是空 MainTex 或白色蒙版。限本机插件服务，不是可公开分发的完整游戏包。

本轮收口停止在用户 AL02 试玩：工程通过不等于用户认可，不等于原作 OBS。原作 actual 保持空白。没有修改原作、父研究正文、用户维护区、开发细则、第二敌人/角色或主游戏玩法；不启动全 RQ，不同步 Gitee。

本地证据 `work/AL-02/` 含普通 B0/B1/B2/B3 JSON、截图、构建/测试日志与提取记录；仓库 [evidence/normal-input.json](evidence/normal-input.json) 保存必要普通操作日志，[AL02-freeze.json](AL02-freeze.json) 固定源码和原资源哈希。[验证与差异](AL02-validation.md) 说明通过范围及保留缺口。
