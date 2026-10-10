# 2DW-05B 规则溯源矩阵

本表及 resources/environment-style-catalog.json 是冻结目录1的可读导出，不是另一套任务权威或可运行的用户覆盖入口。执行只读取每个 ZIP 的 spec/asset-spec.json；运行目录由 core/environment-style-catalog.ts 管理。候选不能自动升格。

|身份|层|状态|适用材质|触发|检查|来源与内容|
|---|---|---|---|---|---|---|
|ENV-CHAR-01@1|L0|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：成熟二次元手绘环境美术；以概括形状、克制块面表达结构，可借鉴赛璐璐组织但不强制所有物件纯两色。|
|ENV-CHAR-02@1|L0|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：先读整体与结构，再读材质；安静的大面与必要细节保持主次。|
|ENV-CHAR-03@1|L0|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：避免写实抛光和密集精修，也避免塑料般空洞的廉价几何平涂。|
|ENV-CHAR-04@1|L0|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：共享表现原则，具体画法随材质与用途变化；不把石砖颜色、裂缝及构图统一施加给全部素材。|
|ENV-COM-01@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：大形建立整体，中形补结构，小形点缀；约 6:3:1 仅为视觉启发，不是像素面积或形状数量验收公式。|
|ENV-COM-02@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：普通高亮从主体色体系内稍提亮，必要转折少量提结构，允许整段不画；发光/特殊反射依任务另审。|
|ENV-COM-03@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：不要整圈偏白亮描边、密集短碎亮线、细锯齿与频繁小起伏；断续不等于碎线更多。|
|ENV-COM-04@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：背光、闭塞和接触关系用少量深色块概括；近黑处停止精细刻画，保留结构信息。|
|ENV-COM-05@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：暗部避免层层精细渐变与复杂内部体积，也不机械切成重复斜向三角形。|
|ENV-COM-06@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：材质变化按需保留，允许极弱、整体化色差；结构已经成立时，不为表现材质额外填充纹理。|
|ENV-COM-07@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：裂纹、磨损与破损从属于形体，疏密有主次；不平均遍布显眼的小裂口。|
|ENV-COM-08@1|L1|approved|all|repeatable-or-connected|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：明确重复利用/联通时，减少强识别的独特破口与孤立大斑；这不是已实现的无缝拼接算法。|
|ENV-COM-09@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：色彩服从材质、用途及项目主色关系，不统一灰绿色板，也不全面禁止饱和色。|
|ENV-COM-10@1|L1|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：暗部与亮部各最多 3 阶指主要明暗块面的层级，不是整张图的颜色数量；允许极弱、整体化材质色差。|
|ENV-STONE-01@1|L2|approved|stone|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：用块体厚实、结构转折和接触关系表达石材；表面弱色差按需，不靠密集小棱面堆砌。|
|ENV-STONE-02@1|L2|approved|stone|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：避免每块同样圆润、同宽粗黑缝及全边白亮线；缝宽、色调、破损随用途决定。|
|ENV-STONE-03@1|L2|approved|stone|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：V1 代表成熟手绘环境质感方向，不规定统一灰褐/灰绿色，也不强制复用大裂缝或地砖构图。|
|ENV-FAIL-01@1|failure|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：微纹理、小高光和精细暗部盖过大形与结构。|
|ENV-FAIL-02@1|failure|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：概括退化为均匀、机械、空洞的塑料几何平涂。|
|ENV-FAIL-03@1|failure|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：普通转折被整圈白亮边、过粗描边或密小锯齿抢走注意力。|
|ENV-FAIL-04@1|failure|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：近黑区域继续精描，或不相关物件出现同类机械斜面切分。|
|ENV-FAIL-05@1|failure|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：破损平均铺开、过碎；明确重复/联通任务中，显眼独特标记反复出现。|
|ENV-FAIL-06@1|failure|approved|all|场景/对应材质|visual-review|2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md：非石材被石材的裂纹、粗黑缝或统一石色污染。|
|ENV-WOOD-01@1|L2|candidate|wood|场景/对应材质|visual-review|2DW-05B M0：AI 木材试验建议，尚无用户认可木材成图；docs/ENVIRONMENT-STYLE.md：实验建议：先表达板块、切面与接合结构，木纹少量概括，不以细密木纹取代结构。|
|ENV-WOOD-02@1|L2|candidate|wood|场景/对应材质|visual-review|2DW-05B M0：AI 木材试验建议，尚无用户认可木材成图；docs/ENVIRONMENT-STYLE.md：实验建议：不照抄石材裂缝、黑缝与冷灰色板；磨损和亮部依木材任务，不默认亮漆精修。|

V1来源/固定SHA见 ../resources/style-references/provenance.json；其他材质保留扩展身份而没有伪造规则。
