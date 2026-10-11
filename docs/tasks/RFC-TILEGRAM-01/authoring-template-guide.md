# 原创绘制母版工作台说明

这三套均无原作像素、无原作索引。两套结构可执行、一套墙叠层draft。它们是候选规格，不是已生效风格规范，也不是成品美术。

## 条件八邻 XH-TILE-8COND-01

[模板目录](original-templates/XH-TILE-8COND-01/asset-grammar.json)。blank-master.png为4800×4800透明/空白结构底板；structural-demo.png给出原创几何示范；cut-windows.png标注47个整数切割窗。48×48格工作台保留16×16连续主体填充区，并包含、凹凸边、洞和孤岛，47种局部状态在连续区域内取样；不是先画47张独立格再排图。

绘制顺序：读契约→在整块连通区域建立统一轮廓与材质平面→在中区做可选整体材质变化→沿共用相位处理边角→按cutRegions无缩放裁出100×100片→根据自己的maskIndexMap回拼19场景→修结构/alpha→再做风格人工验收。底板可直接在图像编辑器作画；刀线预览另层保存，不画进成品。默认Unity100PPU/1单位，可同步覆盖cellPixels与PPU；源图PPU不是模板默认。

同一平面不能直接当作任意拓扑唯一作者母图；本工作台以一个连通绘画主体、洞及独立单格样本提供局部取样板，跨区边界须统一相位。RuleTile旋转/随机/动画和异材质边界不在本模板唯一推导范围。人工还需检验4800工作台的绘制便利性、易混刀线、纹理重复和跨材质泛化。

19回拼同时与独立几何生成器逐RGBA比较，包含2×2、L/T、洞、固定随机；这是结构演示正确，不是手绘完成后必然无缝。

## 非联通随机 XH-GROUND-RANDOM-01

[契约](original-templates/XH-GROUND-RANDOM-01/asset-grammar.json)。300×100统一画面，三个100格中心变化，共用8px边区/100px相位；权重3/1/1是原创示例，可调整。先在连续材质平面统一边界，再中区变化，按三个整数窗切片，检查共用边精确及2×2/随机8×8/A-only/B-only四种回拼。不以随机挑图代替联通轮廓规则。

## 墙叠层 XH-WALL-LAYER-01

[draft契约](original-templates/XH-WALL-LAYER-01/asset-grammar.json)。100×150、1×1逻辑占位、1.5单位可见高度、pivot(.5,1/3)，向上50px越格。body可裁单片；cap/underlay和层级绑定仍须明确，未通过墙联通回拼，禁止直接当成正式可接入模板。

## 契约

[asset-grammar.schema.json](asset-grammar.schema.json)，schemaVersion= xh-asset-grammar/1，templateVersion=0.1.0。包含生产机制、整数画布/刀线、PPU、pivot/trim/alpha/overhang、mask/corner、层级、共享形状约束、阶段与适用/不支持条件。旧alias字段保留便于研究工具，但不等于现有2dw ZIP已支持。
