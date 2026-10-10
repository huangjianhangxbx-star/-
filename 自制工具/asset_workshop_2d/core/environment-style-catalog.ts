import type { EnvironmentRule, MaterialFamily } from './environment-style.ts';

export const ENVIRONMENT_CATALOG_VERSION = '1' as const;
export const MATERIAL_FAMILIES: readonly { id: MaterialFamily; label: string; status: string }[] = [
  { id: 'general', label: '通用 / 不指定', status: 'common-only' },
  { id: 'stone', label: '石材（已批准）', status: 'approved' },
  { id: 'wood', label: '木材（实验候选）', status: 'candidate' },
  { id: 'soil', label: '土壤（细则待补）', status: 'reserved' },
  { id: 'metal', label: '金属（细则待补）', status: 'reserved' },
  { id: 'vegetation', label: '植被（细则待补）', status: 'reserved' },
];
const rule = (id: string, layer: EnvironmentRule['layer'], ruleType: EnvironmentRule['ruleType'], text: string,
  scope: MaterialFamily | 'all' = 'all', status: EnvironmentRule['status'] = 'approved', conditional = false): EnvironmentRule => ({
  id, version: '1', layer, domain: 'environment', applicableMaterialFamilies: [scope], ruleType, text, status,
  origin: status === 'approved' ? '2DW-05B M0：用户批准及三项修订，2026-10-10；docs/ENVIRONMENT-STYLE.md'
    : '2DW-05B M0：AI 木材试验建议，尚无用户认可木材成图；docs/ENVIRONMENT-STYLE.md',
  checkMode: 'visual-review', ...(conditional ? { appliesWhen: 'repeatable-or-connected' as const } : {}),
});
export const ENVIRONMENT_RULES: readonly EnvironmentRule[] = [
  rule('ENV-CHAR-01', 'L0', 'positive', '成熟二次元手绘环境美术；以概括形状、克制块面表达结构，可借鉴赛璐璐组织但不强制所有物件纯两色。'),
  rule('ENV-CHAR-02', 'L0', 'positive', '先读整体与结构，再读材质；安静的大面与必要细节保持主次。'),
  rule('ENV-CHAR-03', 'L0', 'negative', '避免写实抛光和密集精修，也避免塑料般空洞的廉价几何平涂。'),
  rule('ENV-CHAR-04', 'L0', 'warning', '共享表现原则，具体画法随材质与用途变化；不把石砖颜色、裂缝及构图统一施加给全部素材。'),
  rule('ENV-COM-01', 'L1', 'positive', '大形建立整体，中形补结构，小形点缀；约 6:3:1 仅为视觉启发，不是像素面积或形状数量验收公式。'),
  rule('ENV-COM-02', 'L1', 'positive', '普通高亮从主体色体系内稍提亮，必要转折少量提结构，允许整段不画；发光/特殊反射依任务另审。'),
  rule('ENV-COM-03', 'L1', 'negative', '不要整圈偏白亮描边、密集短碎亮线、细锯齿与频繁小起伏；断续不等于碎线更多。'),
  rule('ENV-COM-04', 'L1', 'positive', '背光、闭塞和接触关系用少量深色块概括；近黑处停止精细刻画，保留结构信息。'),
  rule('ENV-COM-05', 'L1', 'negative', '暗部避免层层精细渐变与复杂内部体积，也不机械切成重复斜向三角形。'),
  rule('ENV-COM-06', 'L1', 'positive', '材质变化按需保留，允许极弱、整体化色差；结构已经成立时，不为表现材质额外填充纹理。'),
  rule('ENV-COM-07', 'L1', 'positive', '裂纹、磨损与破损从属于形体，疏密有主次；不平均遍布显眼的小裂口。'),
  rule('ENV-COM-08', 'L1', 'warning', '明确重复利用/联通时，减少强识别的独特破口与孤立大斑；这不是已实现的无缝拼接算法。', 'all', 'approved', true),
  rule('ENV-COM-09', 'L1', 'warning', '色彩服从材质、用途及项目主色关系，不统一灰绿色板，也不全面禁止饱和色。'),
  rule('ENV-COM-10', 'L1', 'warning', '暗部与亮部各最多 3 阶指主要明暗块面的层级，不是整张图的颜色数量；允许极弱、整体化材质色差。'),
  rule('ENV-STONE-01', 'L2', 'positive', '用块体厚实、结构转折和接触关系表达石材；表面弱色差按需，不靠密集小棱面堆砌。', 'stone'),
  rule('ENV-STONE-02', 'L2', 'negative', '避免每块同样圆润、同宽粗黑缝及全边白亮线；缝宽、色调、破损随用途决定。', 'stone'),
  rule('ENV-STONE-03', 'L2', 'warning', 'V1 代表成熟手绘环境质感方向，不规定统一灰褐/灰绿色，也不强制复用大裂缝或地砖构图。', 'stone'),
  rule('ENV-WOOD-01', 'L2', 'positive', '实验建议：先表达板块、切面与接合结构，木纹少量概括，不以细密木纹取代结构。', 'wood', 'candidate'),
  rule('ENV-WOOD-02', 'L2', 'negative', '实验建议：不照抄石材裂缝、黑缝与冷灰色板；磨损和亮部依木材任务，不默认亮漆精修。', 'wood', 'candidate'),
  rule('ENV-FAIL-01', 'failure', 'failure-signal', '微纹理、小高光和精细暗部盖过大形与结构。'),
  rule('ENV-FAIL-02', 'failure', 'failure-signal', '概括退化为均匀、机械、空洞的塑料几何平涂。'),
  rule('ENV-FAIL-03', 'failure', 'failure-signal', '普通转折被整圈白亮边、过粗描边或密小锯齿抢走注意力。'),
  rule('ENV-FAIL-04', 'failure', 'failure-signal', '近黑区域继续精描，或不相关物件出现同类机械斜面切分。'),
  rule('ENV-FAIL-05', 'failure', 'failure-signal', '破损平均铺开、过碎；明确重复/联通任务中，显眼独特标记反复出现。'),
  rule('ENV-FAIL-06', 'failure', 'failure-signal', '非石材被石材的裂纹、粗黑缝或统一石色污染。'),
];
export const POSITIVE_VISUAL_ANCHOR = Object.freeze({
  id: 'V1', sha256: '41c21aa13228c01f15034d213e2e948d2f032fa4ebd0d8f6c87c17185332b559',
  file: 'resources/style-references/approved-stone-v1.png', domain: 'environment',
  origin: '用户于 2026-10-10 明确指定最后认可石砖图 V1 为持久正向参考；会话 6ac6fd96-ecd0-83ea-85f5-d628ccf3a6ef',
  scope: '成熟手绘环境美术质感方向；其他材质不继承其颜色、裂缝或构图。仅实际选为参考时图片进入任务 ZIP。',
});
