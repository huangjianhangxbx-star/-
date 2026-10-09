# UI-01A 参考、选型与阶段验收

基准：计划 0a475ba；实际 9e32c97（其差异仅 Skill 归档，无游戏冲突）。用户已授权五阶段连续实施、普通实现自行决定。无新增代理；按实际 Skill 及批准工作包执行。

## 来源观察
PowerPoint COM 只读打开旧格式 PPT，导出 8 页并提取正文；源未改。总览为固定左上主角、左下同行者、右上世界、中下十格、右下技能。第6页标题写右上与总览冲突，采用总览右下 PROVISIONAL。PNG分别观察方槽、菱形、武器方槽和角色绘像；仅借几何，不发布原图、原头像、商用图标。

## 用户最新覆盖
每人被动槽从5改3，左至右 level1、2、3；level0全部不生效，每次升级一个。规则 USER_CONFIRMED；本批只布局预留，不实现完整成长/费用/睡眠。世界天气/13日、Y、自由道具、Tab背包及1–0均未接入，不造假库存或日数。

## 选型
黑底 #090B0D，纯色细边 #8CA9A3，生命 #AF6067、架势 #C9B16B、正文 #DBDDD4。字体：宋体角色名、微软雅黑操作、Consolas数值。圆框和方/菱形选 v01，条选v03细边；所有 PROVISIONAL，选择理由是缩小后单线仍可读、统一且少装饰。12个候选均在ignored工作区，精选哈希见asset-manifest.json。来源哈希/选区/命令/Alpha验证在 work/NIGHT-UI-20261010/generated 与 p1-skill.log，原始输入不入Git。

## 验收
真实调用本机 xinghai-ui-geometry v0.2 的 run_pipeline.py 四次，每类count3；pytest 12通过，各validation自动检查尺寸/Alpha/差异。圆框来源图片含角色、源无Alpha，脚本风险已保留，形状/色彩均操作者明确输入，不宣称算法自动识别。1440×900及1280×720组合预览无模拟数值，位于ignored work/NIGHT-UI-20261010/hud-assembled-*.png。P1未改产品源码；技能/资产技术通过，用户审美Gate待验。
