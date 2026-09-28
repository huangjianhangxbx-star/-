# 角色资产核验

核验日期：2026-09-27。来源：`角色/` 原始文件；原素材未修改。可复跑脚本：`work/audit-assets.ps1`；逐文件清单：`docs/asset-manifest.json`。

## 已实际验证

- 共 1,168 个文件：15 个 `.skel`、15 个 `.atlas`、1,122 个 PNG；其中主角色骨架 7 个，按文件名识别的特效骨架 8 个。
- 按二进制头的长度编码字符串读取 hash 和版本，15 个骨架均为 **Spine 3.8.86**；不是从文件名推测。
- 15 个 atlas 共引用 24 张页面图片，全部能在 atlas 所在目录找到；24 张图片的实际 PNG 尺寸均与 atlas 声明一致。
- 全部 1,122 个 PNG 的签名与 IHDR 已读取，色彩类型均为 6（RGBA，有 alpha 通道）。尚未解码像素来检查实际透明像素分布，也未做全部文件 CRC 或运行时解码验证。

## 主角色与特效清单

以下路径均相对项目根目录；主骨架同名 `.atlas` 和 `.png` 均存在。

| 角色 | 主骨架 | 主贴图尺寸 | 配套特效骨架 / atlas 页面 |
| --- | --- | --- | --- |
| Arina | `角色/arina/Arina.skel` | 256×1024 | Arina_effect / 1 页，2048×2048 |
| Cynthia | `角色/cynthia/Cynthia.skel` | 1024×512 | Cynthia_effect / 1 页；other_bear_Cynthia_01_effect / 3 页，均 2048×2048 |
| Dustin（怪物 1） | `角色/dustin/Dustin.skel` | 1024×512 | Dustin_effect / 1 页，2048×512 |
| Fenia | `角色/fenia/Fenia.skel` | 1024×512 | Fenia_effect / 3 页，均 2048×2048 |
| Galore（猎人） | `角色/Galore/Galore.skel` | 1024×512 | Galore_effect / 3 页，均 2048×2048 |
| Livia | `角色/livia/referenceassets/Livia.skel` | 1024×1024 | `角色/livia/Livia_effect.skel` / 4 页，均 2048×2048 |
| Verlaine_bot（怪物 2） | `角色/verlaine_bot/Verlaine_bot.skel` | 1024×512 | Verlaine_bot_effect / 1 页，1024×2048 |

`角色资产.txt` 称猎人为 **Galore0**，实际文件夹与文件名为 **Galore**，配置须显式映射。Livia 主资产位于 `referenceassets`，不能按与其他角色相同的一级目录拼接路径。多页特效必须加载全部 atlas 页面。

## 动画证据与接入边界

`角色资产.txt` 明确要求猎人和 Dustin 使用 `stand`、`run`、`attack_01`、`skill_01_01`、`dead`。对这两份骨架的 ASCII 扫描确实发现同名字符串，但**这仅是候选证据，不代表已解析动画表或播放成功**。完整候选列表见 JSON 的 `animationNameCandidates`；`animationsConfirmed` 暂为空。

其他角色的动画名也不能按通用命名直接假定。例如 Fenia 的扫描结果含 `attack_0167`、`attack_0267`，Verlaine_bot 的扫描仅命中 `skill_01`、`stand`；二进制字符串可能被相邻可打印字节污染，扫描缺失同样不能证明动画不存在。

后续接入需用与导出格式兼容的解析器实际读取动画表，并对每个主角色验证待机、移动、攻击、技能与死亡表现。当前未安装或运行 Spine 运行时，未进行 Three.js 加载、混合模式、朝向、缩放或动画事件验证，因此“可运行”状态为**未知**。许可与分发授权状态为**未知**；本次核验不推定素材或运行时授权。

主角色和特效在实现中宜分别注册；特效需通过明确挂点或事件关联，不能仅凭同名文件判定绑定方式。其余己方角色的职业机制仍属后续设计，不由素材名称自动决定。
