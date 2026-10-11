'use strict';
const {isDeepStrictEqual}=require('node:util');
const rules={off:[],standard:['成熟手绘，以主要结构和大明暗块面组织视觉主次。','继承ENV-COM-10：暗部与亮部各最多3个主要块面层级，非整张图RGB颜色数量限制；允许极弱整体材质色差。','亮边少量、接近主体色且不连续；暗部停止精修。','弱整体材质变化按需保留；结构已成立时不额外填充纹理。'],extreme:['有目的的黑色结构线、近黑暗块与大中型色面解释接触、遮挡、折转和破损；不统一加粗所有外轮廓。','每种局部材质以主体色和一组暗色构成两级主要块面；暗面合并为稳定大色块，不补纹理或渐变。','禁止用高光细线描绘硬边、轮廓与每个转角，禁止发白均匀整圈亮边。','减少碎裂纹、小缺口、铆钉、碎斑和零碎折面；大中小元素有主次，不为丰富画面堆小元素。','保留材质辨识与必要体积；不得以模糊、整体变脏、弱对比、儿童卡通、矢量粗黑图标代替成熟概括。']};
function resolveStylePressure(mode='standard'){
 if(!Object.hasOwn(rules,mode))throw Error('未知风格压制档位；仅允许off / standard / extreme');
 return {schemaVersion:'2dw-style-pressure/1',id:`XH-SP-${mode.toUpperCase()}-01`,mode,version:'0.1.0',scope:'current-task',catalogStatus:'candidate',
  inheritsApprovedStyle:true,applyToNumericContour:false,pixelQuantization:false,majorMaterialGroups:mode==='extreme'?2:null,
  highlightEdgePolicy:mode==='extreme'?'forbidden':mode==='standard'?'limited-noncontinuous':'inherited-approved-rules',additionalRules:[...rules[mode]],
  interpretation:'Major local material value groups, not a limit on global RGB colors; dark structural lines do not require a third colored highlight; material colors remain distinct',
  protected:['hard-format','fixed-view','approved-L0-L1','applicable-approved-L2','numeric-contour','approval-identity']};
}
function assertStylePressure(value){if(!value||!isDeepStrictEqual(value,resolveStylePressure(value.mode)))throw Error('风格压制契约不匹配，不能改变作用域或长期规则');return value;}
function renderStylePressure(value){assertStylePressure(value);return `# 本任务风格压制\n\n${value.id} / ${value.version}；模式 ${value.mode}；current-task / candidate。不修改已批准目录。\n\n${value.mode==='off'?'无额外压制：项目已批准L0/L1及适用L2仍然有效。':value.additionalRules.map(r=>'- '+r).join('\n')}\n\n${value.mode==='extreme'?'两级指每种局部材质的主要明暗块面，不是整张图只有两种RGB颜色；不进行PNG硬量化，不改变透明通道。黑线承担结构语法，不等于每个部件统一粗黑外轮廓，也不强迫不同材质同色。\n\n':''}只作用于小样及materials的美术表现，绝不作用于contour.png数值控制。固定视角、尺寸、格、PPU、邻接、相位、Pivot与审批身份优先于压制档位；已批准L0/L1和适用L2继续有效。\n`;}
module.exports={resolveStylePressure,assertStylePressure,renderStylePressure};
