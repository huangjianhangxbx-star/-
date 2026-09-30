# 角色资产核验

2026-10-01 显示修正：Charlotte的待机源包围盒约369×272，受统一宽度限制，其可见高度仅0.90逻辑单位；猎人／伊内丝约1.30／1.32。T-008在世界显示层为Charlotte设置1.45倍等比校准，保持512×512源画布、脚底锚点与全部原文件。见[任务](tasks/T-008-模型比例与默认倍率.md)及[修改前测量](../记录/验证/T-008/model-probe-before.json)。该校准作用于菲奥蕾各职业和复制体，不调整逻辑占地或命中范围。修改后待机可见高度1.305；[后测量](../记录/验证/T-008/model-probe-after.json)及[画面](../记录/验证/T-008/models-after.png)已核对。五种动作源像素边界前后一致，既有跑步采样触及画布底边另列任务待办。

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

## T-007 新角色接入与运行时证据（2026-09-30）

上文“未知／尚未运行”是2026-09-27核验时的历史状态，不代表本轮新增角色接入状态。

| 身份／作用 | 只读原始目录 | 工程副本 | 实际动画映射 |
|---|---|---|---|
| 伊内丝主角色 | `C:/Users/Administrator/Desktop/新建文件夹 (3)/rina_f_summer` | `game/public/assets/characters/Rina_F_Summer/` | stand、run、attack_01、skill_03、dead |
| 菲奥蕾三职业主角色 | `C:/Users/Administrator/Desktop/新建文件夹 (3)/charlotte` | `game/public/assets/characters/Charlotte/` | stand、run、attack_01、skill_01、dead；治疗／冰系近似skill_02，真实滑行用run |
| 伊内丝原生攻击／技能特效 | 同上rina_f_summer | `game/public/assets/effects/Rina_F_Summer_effect/`，5页 | attack_effect_01、skill_effect_03_02 |
| 菲奥蕾原生攻击／技能特效 | 同上charlotte | `game/public/assets/effects/Charlotte_effect/`，3页 | attack_effect_01、skill_effect_01_01 |

四骨架实际解析均为Spine3.8.86，动画表与atlas页面见[主角色报告](../记录/验证/T-007/asset-audit.json)、[特效报告](../记录/验证/T-007/fx-audit.json)。工程副本18文件SHA256与原始对应文件全部一致，见[指纹报告](../记录/验证/T-007/source-fingerprint.json)；只复制骨架、atlas及引用页面，未修改原目录。新增头像由角色运行时生成至portraits，两张PNG为工程输出。

真实浏览器逐个运行新模型待机／移动／攻击／技能／死亡及各两种原生特效，共14项像素检查全部通过，见[运行时报告](../记录/验证/T-007/rendered-source-actions.json)。素材动作总时长内分段采样，避免把开头暂时透明误判为素材缺失。原地图正常UI部署直接显示新骨架，领域可见，截图见[战斗展示](../记录/验证/T-007/battle-field.png)。现有旧模型与特效注册、原始资源保留。

Charlotte源素材带枪主题，新镰刀／治疗／冰系借用已有动作并补几何范围和时序，尚无定制镰刀动画。真实动作表不支持的专用动作没有伪造名称。高频箭雨只抽样渲染／音效，使用原有特效上限24与0.12秒限频，真实逻辑命中不删减；此验证不是高负载GPU性能测试。
