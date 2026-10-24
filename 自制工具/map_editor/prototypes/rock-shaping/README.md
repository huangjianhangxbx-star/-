# TOOL-011 岩体塑形：独立造型原型

本入口用于 R0–R3 / Gate R-A 的造型确认。正式工坊、材质绘制、撤销历史、FBX 和便携程序尚未接入。

在 `自制工具/map_editor` 运行：

```powershell
node prototypes/rock-shaping/build.mjs
```

随后直接打开本目录的 `index.html`，支持 `file://`。脚本本地打包，没有 CDN、网络字体或远端资源依赖；缺少 `viewer.js` 时先执行上述构建。该生成文件不属于源代码。

查看器使用 Three.js；构建时保留其 MIT 许可证为 `THIRD-PARTY-LICENSE.txt`，分发入口与本地 bundle 时须一并保留。

左侧切换两种预设、原创模型、固定种子 17 / 73 / 211 和 SAMPLE 参数；右键拖动旋转，中键平移，滚轮缩放。“查看原形”比较真实源模型，“复位视角”统一对比相机。更改参数总是重新读取原形，不会累计侵蚀。侧面选择仅用于柱状预设；层阶使用平台外轮廓影响带。

原始夹具为整数格坐标，Z 向上，颜色索引统一为 0。三档格尺寸只改变物理尺寸说明和配方元数据，不更改整数格形态。显示使用同一中性灰材质与固定灯光、真实表面贪心网格，无逐格内面叠加。

下载的 JSON 包含源 `source.cells`、结果 `result.cells`、删除清单、源指纹、配方和参数，可复现本轮造型；它不是已经接入工坊的导入格式。技术失败样例保持原形并显示原因。结果的艺术方向需用户确认，自动测试不代表 Gate R-A 通过。

用于复现与核对的只读浏览器接口：`window.rockPrototype.getState()` 返回 `source`、完整 `result`、`options`、`timings`（计算/网格/显示毫秒）、当前夹具、`showingOriginal`、`visibleCellCount` 和贪心网格片数。DOM 控件 ID 与参数名一致，入口为 `preset`、`fixture`、`seed`、`cellSize`、`original`、`reset`、`download`、`viewport`。

本轮保存的实际灰模在 `samples/原创灰模与参数.zip`，内含种子17厚体、矩形平台、L平台的原生 `.xhmodule.json` 和九组配方指标。其余固定种子的完整源/结果可从验证页下载。原生样例经过现有格式校验和读取；正式工坊中对生产资产塑形、历史和材质处理仍未接入。

“高级随机”默认折叠：柱状提供岩柱布局、竖向断阶、局部缺损；层阶提供层高与退台、边缘轮廓。每项可输入0～2147483647整数或点击“重抽”。0保持原默认结果，非零分项种子与总种子做32位异或后供该组随机流使用；改总种子仍影响所有组，改分项只改变对应结构场。换预设重置分项，换总种子/格尺寸保留分项。“重置分项种子”恢复当前总种子的默认形态。分项也写入下载的options/recipe；缺损幅度为零时，重抽缺损不会改变几何。厚度/连通保护仍可能约束最终削切，独立的是结构随机流。

重新生成：`node --experimental-strip-types prototypes/rock-shaping/generate-samples.mjs`。生成的未压缩模型留在本机，不重复入库；ZIP是本轮保存快照。真实浏览器证据在 `validation/`，模块验证与当前边界见仓库 `docs/tasks/TOOL-011/README.md`。Three.js MIT许可见 `THIRD-PARTY-LICENSE.txt`。

时间通过浏览器 `performance.now()` 记录；“显示”是 `renderer.render` 的 CPU 提交耗时，不代表 GPU 渲染完成时间或帧率保证。
