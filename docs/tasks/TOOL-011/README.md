# TOOL-011 岩体结构化塑形

本轮批准：用户转交较新工坊对话和 v0.1 计划包，要求“理解较新对话并执行”。按该对话的两轮安排实施 **R0–R3 造型原型**。正式工坊接入 R4–R7 必须等岩体 Gate R-A 用户反馈及后轮授权；本轮不代表完整 TOOL-011 已完成。

## 基线与依据

- 本地与 GitHub main：`9e4d1ce8370be05ff39ce01a0115d7afae09fcea`；开工时 tracked tree clean，fetch 后远端一致。TOOL-010 B0–B2 功能代码为 `cd66cc7`，Gate B 待用户试玩；B3/B4 没有冒充完成。
- [转交计划原文](approved-plan-v0.1.md)；其中“只出计划、未授权实施”是原会话编制时的历史状态，后续本轮请求已授权第一轮执行。
- [实施分工与步骤](../../superpowers/plans/2026-10-24-rock-shaping.md)。本轮为 B 级模块验证，不重复整个游戏或历史 UI 套件。
- 适用根 AGENTS 与《开发细则》v2.2 登记草稿；目标目录无额外 AGENTS。使用本机 `C:/Users/Administrator/.codex/skills/` 下 brainstorming、writing-plans、test-driven-development 及 writing-good-tests。既定方案已由用户转交执行，不重新询问同一设计批准。
- ZIP 中5个文件逐项验证大小/SHA256一致。两张实际参考已查看，原字节解压留 `.local/TOOL-011-plan/references/`，不提交第三方截图、不随程序发行。

## 形态目标

柱状岩壁对应第一张参考左侧高墙：条带宽窄有变化、竖向长段连续、深浅错落；断阶稀疏，不用逐格随机洞模拟结构。

层阶崖岸对应第二张参考平台外缘：中心平顶保留，少量不等高主层产生水平退台，层间沿同一轮廓收缩；L 形凹角也需成立。雪、颜色、植被和原图光照不属于本轮。

只用原创体素夹具、固定中性灰和普通照明展示。技术检查与用户美术验收分开，AI 不代替用户宣布造型通过。

## 保留边界

独立 `prototypes/rock-shaping` 验证入口与纯计算 `core/rock-shaping*`。现有随机工具、renderer、材质源、会话历史、保存、FBX 与便携 EXE 均未接入新工具。已绘画生产资产不作为试验输入。

后轮需适配实际 B 源：画布内 `paintSource`，owner整数坐标+六面方向稳定键，稀疏覆盖像素；删除/保留/新露面分别处理。原子历史、base/copies 不复活、保存及材质联动仍属 R4–R7，不能拿本轮纯夹具测试冒充正式编辑事务验收。

## 验证与当前状态

**R0–R3 造型原型已实现并完成技术验证；用户 Gate R-A 未确认。正式工坊接入/材质兼容尚未实施。**

直接打开 `自制工具/map_editor/prototypes/rock-shaping/index.html`。本机已构建本地脚本，无 CDN；新检出环境先在 `自制工具/map_editor` 执行 `node prototypes/rock-shaping/build.mjs`。操作说明与只读复现接口见该目录 README。

- 两种预设各固定种子17/73/211，灰色真实体素结果。单面墙、四侧厚体、矩形平台、L形平台、薄体和悬挑失败样例可选。原形切换、右键旋转、中键平移、参数滑条与原形/结果/配方 JSON 下载均可用。
- 预览从原形重新计算；四侧联合处理，局部厚度限制计数可见。柱状沿闭合周长分段；层阶以外部空域起算有界3/4距离、相关轮廓和正向累积不等宽退台。围孔不作为新岸线，原空洞不填充。
- `samples/原创灰模与参数.zip` 含三份实际原生资产（厚体、矩形平台、L平台，种子17）和九组参数/指标。`generate-samples.mjs` 可重新生成，原生文件经现有 validateAsset 写入再读取，独立审查还经现有 mesher/GLB 路线读取；这不是正式塑形保存/FBX集成。
- `validation/` 内六固定种子、L平台和悬挑截图来自真实算法与浏览器，不是AI概念图。最后浏览器报告与样例配方可按seed重现，不靠挑一张好图证明通过。

### 技术验证

命令均在 `自制工具/map_editor` 执行：

```powershell
node --experimental-strip-types --test tests/rock-shaping.test.ts tests/modeling-tools.test.ts
npx tsc --noEmit
npx tsc --ignoreConfig --noEmit --allowImportingTsExtensions --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --lib 'ES2022,DOM' prototypes/rock-shaping/viewer.ts
node prototypes/rock-shaping/build.mjs
node tests/rock-shaping-ui.mjs
node --experimental-strip-types prototypes/rock-shaping/generate-samples.mjs
```

21项定向测试通过（15项新结构内核+6项原建模工具），类型检查、独立构建通过。真实 Edge/Playwright验证六种子输出、旋转、原形/结果实际显示变化、深度及边缘带归零、调参往返不累积侵蚀、下载内容逐项一致、L凹角与悬挑拒绝通过；pageerror为空。Node22.14会输出实验性 strip-types 提示，不是业务错误。

测试先于实现。红测及实际审查发现并修正：四侧厚度限制级联抵消全部削切、尾段超宽、层阶名义退台等宽、超长延续把断阶挤到同一顶行。浏览器增强测试一度把JSON自动省略的undefined字段与内存对象直接比较，改为比较同一JSON语义后重测通过；未放宽体素结果断言。

### 性能与边界

Windows，i7-14700KF / RTX4080 SUPER，Node22.14，真实Edge浏览器1440×960。六标准样例浏览器计算约135–274ms，贪心网格约29–92ms；displayMs约0.1–0.6ms仅为renderer.render调用提交耗时，不能当成GPU帧时或FPS。精确原始记录见 browser-report.json；Node批量指标在 samples/recipes-and-metrics.json。

| 输入 | 种子17结果 | 种子73结果 | 种子211结果 |
|---|---:|---:|---:|
| 柱状厚体46,080格 | 38,646格 | 37,252格 | 38,764格 |
| 矩形平台73,728格 | 56,386格 | 56,929格 | 53,398格 |
| L平台55,296格 | 37,974格 | 39,038格 | 35,761格 |

原型上限300,000格、平台平面范围1,000,000位置；层阶只接受共同平顶/平底的轴向实心柱，重叠层、悬挑和变底明确拒绝。高度轴首轮固定局部Z，不支持任意方向、生产资产导入或画布源层历史处理。层阶缺损固定为零，仅柱状提供少量缺损参数。三精度使用同一整数格算法，米数由cellSize换算，查看器为便于比形保持同一格坐标相机。

### 造型观察与停点

柱状远看保留矩形作者大形，侧面读成长条，断阶较克制；层阶保留中心平台与相关外缘，主层高度/退台宽度有变化。当前默认仍明显继承矩形/L形原轮廓，保守层阶可能偏人工，柱状断阶也可能显得不足；这些是待用户观察的差距，技术测试不能证明已达到参考图的自然程度。

本轮停在岩体 Gate R-A。保留原始矩形体作为对照、零幅度为无变化样例、悬挑为明确失败样例。等待用户对两个预设的造型反馈，再决定修形及后轮R4–R7，不自动接入正式工坊或重打包EXE。

### 追加：分项随机种子

用户反馈“看起来不错”并询问分项种子；同意保留总种子、按结构类别拆种子、折叠高级面板和单项重抽的建议。本轮仅追加该原型能力，不启动正式接入。

新增可选randomSeeds：layout/breaks/chips/terraces/contour，默认0保留此前所有种子结果；每组与总种子异或后驱动已有独立随机流。布局控制宽度/排列/基础深浅，断阶控制高度/变化，缺损独立；层阶分段与边缘轮廓独立。配方保留全部分项，界面支持输入、重抽、重置。缺损为零无效果，厚度保护仍照常执行。

两项新核心测试先红后绿，覆盖单项变化与其余结构保持、零值兼容、复现、配方JSON回读和非法种子拒绝。总计23项定向测试通过；TS/独立构建及新的真实浏览器 tests/rock-seeds-ui.mjs 通过，覆盖输入、单项重抽、重置、预设切换、下载配方；截图validation/independent-seeds.png。原九组固定种子样例结果保留。主工坊和EXE未改变。
