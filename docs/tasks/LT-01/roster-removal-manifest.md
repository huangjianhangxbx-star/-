# ROST-01 删除与保留清单

基准 cc04ac2。普通 roster 物理减至 hunter/ranger；默认固定阿尔。旧 ID 查询失败，无对应角色注册、预加载或角色专属资源映射。新副本默认和开发复制夹具已迁移到明确 ranger 身份。

## removed
角色类型/专属武器配置、菲奥蕾影庭回血与救援例外、伊内丝配置、旧压力调参项、专属音效/动作声明、页面选择处理删除。CB02 两个已退休角色用例移除，原两人基础、AI、支付去重、中断、世界、篝火检查保留。以下文件物理删除，原文件可从父提交追溯：

| 文件 | 删除前 SHA256 |
|---|---|
| `game/tests/rework-fiorre.test.ts` | `06ced29e55bc0682d000ce306d14383362ebe5c922745832cd930bb0e2c59c1f` |
| `game/tests/rework-ines.test.ts` | `3c1e9b311742d51d2e4c5b5ae738168c4be7d483f4b85cc5a8da016eff43f8c8` |
| `game/public/assets/characters/Charlotte/Charlotte.atlas` | `1aba5806416b3b114bd5032b31b6d894807d76cfd72bd95564fc8c4767b8dc70` |
| `game/public/assets/characters/Charlotte/Charlotte.png` | `706abf66461df25503ebbdf330465bd19b5f1e19e622e8dff657d355606c63e7` |
| `game/public/assets/characters/Charlotte/Charlotte.skel` | `3f17759fee7a46dbc65a429782731efc18e345f1a24a927ab248ce4f64bdc1fc` |
| `game/public/assets/characters/Rina_F_Summer/Rina_F_Summer.atlas` | `4b5415552012b28c631df3781be97342215a400ddbaaab1cc5783c88a54f6da3` |
| `game/public/assets/characters/Rina_F_Summer/Rina_F_Summer.png` | `412d9fbdf8aef6c0fc611707c126fc6a2989f4a76bd68aadc0512cd98b5d3171` |
| `game/public/assets/characters/Rina_F_Summer/Rina_F_Summer.skel` | `d4e46edbf48c28484ce4c9d1f01b7e357a95098ddd9b267a55e0d049d9c5aa9f` |
| `game/public/assets/effects/Charlotte_effect/Charlotte_effect.atlas` | `bd6269c15f7ab65eaf663f0e05f3a62169ffdd528490c5df1e772735e6d26190` |
| `game/public/assets/effects/Charlotte_effect/Charlotte_effect.png` | `f3f5df218e8416e5182ef60db5f0573430d4ab880c12045b5093e7d21c490ec0` |
| `game/public/assets/effects/Charlotte_effect/Charlotte_effect.skel` | `0e4b07b078dd03f235c4e676e6222d3d11ea78e46e8cab646ff88c242c337252` |
| `game/public/assets/effects/Charlotte_effect/Charlotte_effect2.png` | `73bbc4dc8771500dd0e09fdb7a8bfaf6e7747b7b9f2ff5d8d13e5db2325304db` |
| `game/public/assets/effects/Charlotte_effect/Charlotte_effect3.png` | `0955c343765e1acc12ffbee3569ea1e3b747e026df2544520205fe05ceed396d` |
| `game/public/assets/effects/Rina_F_Summer_effect/Rina_F_Summer_effect.atlas` | `8e10d16c405e5388de75a78e8c9221723753be8041b607789232483d4a28a10f` |
| `game/public/assets/effects/Rina_F_Summer_effect/Rina_F_Summer_effect.png` | `3b398a8e57aee01db43bd569977666ec8ac004dcbb59b3ce315fe6629ab81086` |
| `game/public/assets/effects/Rina_F_Summer_effect/Rina_F_Summer_effect.skel` | `bc0e95d5b4a847cc1cd4e2f1d86e9f19ba4fad9ab563225658b36c6e9aea4cd0` |
| `game/public/assets/effects/Rina_F_Summer_effect/Rina_F_Summer_effect2.png` | `01b58c86ffdb7078330a560bfdcefdf65bd56c161ee31edbaaf6e95d9e51af11` |
| `game/public/assets/effects/Rina_F_Summer_effect/Rina_F_Summer_effect3.png` | `171e1d4c09d2f51505d27e300ef240bbc40d42dd7f449924e18b7a63063f76e2` |
| `game/public/assets/effects/Rina_F_Summer_effect/Rina_F_Summer_effect4.png` | `a7f87671c5ac241dd0b8f262a10333db138e073b56eb9300e9ce4ff96c6fe22e` |
| `game/public/assets/effects/Rina_F_Summer_effect/Rina_F_Summer_effect5.png` | `e3b3b117e43acecf6a0702bb7c99d6dda5a54f6572cee55de3fe1565a08bbe2a` |
| `game/public/assets/portraits/Charlotte.png` | `1d30a3baa2502ced76a40da6729e0470a52b600ea257193098690ba39b8c0bf2` |
| `game/public/assets/portraits/Rina_F_Summer.png` | `2c1d0c583932b523733459000779d3b6a0153f66c265dce2cefd46b70efa5b11` |

## retained
猎人/阿尔原动作 profile、stamina 支付底座、共用三槽/装备职业/成长和技能执行模块保留。healer/cantor/shieldguard/scythe 是按武器 profession 查询的共用技能树，并非正式角色注册；AR02/AR03 仍用真实 hunter 实体配不同职业武器检查事件/派生/付款，夹具的搭档由旧 ines 迁为 ranger。本轮不为旧角色新建兼容对象、包装或素材目录。
敌人使用的 Arina/Livia/Dustin、其他有效开发资源、Action Lab 与 xx 原素材保留。固定阿尔用户头像未改。

## source-protected
`角色/` 原始模型/Spine、人工截图/PPT、开发细则及用户维护区、其他项目/工坊不修改。Git 历史作为删除追溯，无第二份生产兼容包。

## unresolved / 验证边界
不声称全部历史四人/Tower 套件通过；仅删除两个纯专属 rework 测试文件。旧 mixed/rework 资料保持历史，不能当当前产品验收。静态 src 不再包含 fiorre/ines/Charlotte/Rina 可执行引用（旧 ID 拒绝测试有意保留字符串）。80 项当前定向测试、TypeScript、主构建和实际默认入口 Z/F/G 通过。首次浏览器检查用了错误观察器名 __xinghai，修为项目真实 prototype 后通过，未改产品为测试让步。
