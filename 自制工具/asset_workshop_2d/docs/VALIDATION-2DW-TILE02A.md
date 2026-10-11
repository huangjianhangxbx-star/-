# 2DW-TILE-02A 验证与交接 · 2026-10-11

工坊增量版本 0.4.1，新任务 spec 1.5.0 / ZIP v7。软件与任务契约验证、真实 AI 观察、用户美术批准分别记录。本轮不修改已批准 L0/L1、石材 L2、V1 参考及联通编译算法。

## 结论与范围

新任务锁定草地正交俯视或石质统一顶面／朝画面下方前暗面，四形态固定 2×2。off / standard / extreme 是任务级候选；默认 standard，极端档的“两阶”指每种局部材质两组主要块面，不限制全图 RGB 数量。

形式检查须逐项显式确认当前准确样品；未检查、退回、旧规格及异机未信任记录不能导出风格收口或正式任务。改档后旧检查、批准、请求、母版和结果失效；切回不复活。旧工程保留 v6 行为，通过明确升级和重新登记／检查进入新契约，不篡改历史批准或 PNG。

两套原创 synthetic/test-only 技术工程各完成三版小样、准确检查／批准、正式双层、47 态、188 变体及九地图。真实 AI 四张小样仍未批准，没有进行真实 AI 正式母版生产。

接手基准 main@56c954d65582ca4c573336744e107504cef9c1bf；期间并行游戏任务推进至 f428490814dcb4da7ca29b55dcaf856f67f6eefd，未触及工坊或本任务路径。其修改和共享记录前缀保留，发布仅选择本轮文件。没有游戏／3D 全量回归、重新解包或素材研究。

## 定向工程验证

受影响模块测试 **140/140** 通过，包括已有 116 项及新增 24 项形式、v7 包、会话、UI Gate 与 pipeline 测试。RED→GREEN 覆盖错误形式、未检查禁止进入下一阶段、模式失效、明确旧工程升级及重新签名的镜像篡改。使用真实可用的 brainstorming、writing-plans、TDD、frontend-design 和 imagegen；缺失的计划执行 Skill 名称没有冒称使用。

两工程通过实际源 PNG 编译及结果 ZIP 独立重算验真。materials 为 4c×2c、contour 为 2c×c（技术夹具 c=64），R/G/B/A、共享相位、来源像素与已有规则不变。单层缺失被拒绝，先导入的一层重启后可恢复；完整两层重新编译成功。跨机导入仍须明确重新检查和批准，模拟审批只属于 test-only 夹具。

24 个实际历史 ZIP（18 个 v1–v5、6 个 v6）全部 SHA 不变且可解析；8 个新公开样包全部 canonical 校验通过。六项保护文件 SHA 不变：开发细则、正式风格 catalog、V1 正向图、原 v6 package、art-directed 编译器及验收器。没有运行旧 proof 覆写历史样包。

最终类型检查和构建通过。全新空工程初始化 v7 的回归已补齐；独立审阅发现打开同身份失信工程可能复用旧勾选，新增 RED 后绑定版本号／原件 SHA，并在打开工程时重置检查草稿，复测通过。

真实 Electron 最终 **14 项检查通过**，pageErrors=[]。覆盖新空 profile 默认 standard、实际 v7 小样包、未经检查的文件图 Gate、同身份失信工程打开后清除四项 DOM 勾选、明确重新检查和审批确认／取消、实际 style/formal 包、两处模式同步和真实确认／取消、旧原件重新登记、拒绝原因进入新小样包、双层 47/188、系统位图与文件路径剪贴板、保存／重启、历史 v6 明确升级及普通／经典入口。正例审批只使用已声明的 signed synthetic/test-only 工程。

原生选择／保存对话框只注入返回路径，主进程的 PNG 读取、ZIP 写出／验真和剪贴板确实运行；JS 确认与 HTML 批准窗口确实操作。此测试不声称自然点击 Windows 文件选择窗口或异硬件安装已验证。

前两次桌面失败证据保留：第一次烟测使用 check() 后要求取消的 radio 仍处于新档，与产品正确恢复原档位的行为冲突，改为点击验证；第二次假设 PNG 经过 Windows 位图剪贴板后编码字节不变，改为记录 OS 实际返回 PNG 的 SHA，另检查尺寸／Alpha／不透明 RGB；文件路径模式仍核对源文件完整 SHA。没有放宽产品门禁或改动实际 AI 图。

复现命令（工坊目录，Node 24+；依赖来自本工程）：

```text
node --test tests/tile-*.test.mjs tests/export-zip.test.mjs tests/clipboard-png.test.mjs tests/electron-isolation.test.mjs tests/environment-archive-2dw05b.test.mjs tests/ui-session.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node scripts/build.mjs
node scripts/tile02a-proof.mjs
node scripts/desktop-tile02a-smoke.mjs validation/2dw-tile02a/proof-1791729364640-c47ade/verification.json
```

proof 创建新的带时间戳目录，不覆盖既有证据或任务 ZIP。AI 记录脚本读取已经存在的原件，不能凭它声称重新执行了 imagegen。

## 28 项验收矩阵

| ID | 证据与边界 |
| --- | --- |
| F01–F02 | 两套固定契约、严格解析及 Prompt 同源；不以字段断言实际 AI 已遵守。 |
| F03 | 两张原创 640×560 视角图、2×2 四角色及统一坐标。说明标注不得进入成图。 |
| F04 | 错模板、方向、跨族视角及未知压制枚举负例拒绝。 |
| F05 | 标准档两族 sample/style/formal 三包的契约与 specHash 一致。 |
| F06 | 形式退回保留版本与理由，新小样任务携带负向诊断，不进入 style。 |
| P01–P02 | off 保留已批准基础风格；新 v7 默认 standard，legacy 不静默升级。 |
| P03–P04 | extreme 黑线、暗块、禁连续亮边及每材质两组主要明暗；明确非像素量化。 |
| P05 | 正式 contour 数值图与 materials 美术层分离，控制编码验证保留。 |
| P06 | 压制候选不能覆盖硬尺寸／形式，非法 spec 及镜像被 canonical 校验拒绝。 |
| V01–V02 | 三档改变 specHash；旧请求、检查、批准、正式源与结果陈旧；切回仍陈旧。 |
| V03 | 四项准确版本人工检查及显式批准均必要；模拟检查／批准标 test-only。 |
| V04 | 原字节、SHA、父子与修订历史保留；新规格明确登记旧字节产生新版本，旧记录不改。 |
| V05 | 旧 v6 仍可读，不获 v7 认证；显式升级后重新检查／批准。 |
| Z01–Z02 | spec、prompt、guide、formReview、压力镜像重建；改内容后重签 manifest 仍拒绝。 |
| Z03 | 24 历史 ZIP 字节与原验证语义保持，8 新公开 ZIP 验真。 |
| C01–C02 | 两族原始双层 PNG 分别实际编译 47/188，输出 ZIP 依源像素重算。 |
| C03 | 各九图 9/9、既有 3×3 和来源定位测试保留；桌面来源检查另立证。 |
| C04 | 错尺寸、缺层、Alpha／通道／共享边等负例保持拒绝，失败原件不丢弃。 |
| U01–U02 | 真实 Electron 的只读形式、两处档位同步、确认／取消、文件／位图剪贴板、恢复与旧入口见桌面记录。 |
| E01 | 草地标准／极端真实原图、调用 Prompt／包／SHA 留本机；仍有碎叶、外角语义问题，未美术批准。 |
| E02 | 石材前暗面总体更统一，孔洞／侧面仍有展块透视感，极端档仍有连续亮边；未美术批准。 |

矩阵记录实现与证据范围，不将 28 项统称“美术全部通过”。四项形式勾选是人的声明，程序不自动识别图像视角。

## 四次真实图像调用

实际内置 imagegen 共四次，两族各 standard / extreme，从同一族原始说明图独立重绘，并各引用原已认可石砖 V1，仅表达成熟手绘质量方向；不是把 extreme 作为 standard 成图的风格收口。模型名工具未暴露，记录 unknown。输入是从实际 v7 小样包取出的 Prompt 加说明图与正向图路径；工具没有直接读取 ZIP 的能力，不声称它独立解包执行了任务。

没有缩放、裁切或改色，原件保存 SHA 并登记四份未批准工程。原图 A/B 页用 CSS 显示四张原件；实际 AI 图及含私人参考的调用 ZIP 不发布 GitHub。

| 返回图 | 实际尺寸／Alpha | SHA256 | 观察 |
| --- | --- | --- | --- |
| grass-standard.png | 1341×1173／opaque | fca44fd54e094050316dce913ab4ff9e523f65312665c8367c461d5d8379f43f | 更接近平面，未见明显草土台；碎叶／花／石子多，外角仍像整方区域。 |
| grass-extreme.png | 1341×1173／opaque | e9c3b41767e7da3e14e09478cfcc009f00d47b9b53402d67bb537adbf484fc3c | 细叶减少但仍零碎，外角未明确形成联通角。 |
| stone-standard.png | 1254×1254／opaque | ddc894a6d7c6174c9e93ae7387186aac96d2aead393d430e67f428872c5d4d68 | 前暗面大体朝下，孔洞内壁仍带透视，外角趋向完整方块，亮边与斑驳较多。 |
| stone-extreme.png | 1254×1254／opaque | 79e09474ab95f20042a42c5b19da04c51ab906effc581bd8b1a4a78c95234bde | 暗块有所合并，连续顶沿亮边仍违反极端档；部分样例仍像 3D 展块。 |

这些是 Codex 可复核观察，不能代替用户的形式勾选或美术批准。四工程 formReview=unchecked、approval=null；正式生产全部被门禁拒绝。

## 交付与证据索引

公开：[任务级形式规范](TILE-FORM-CONTRACT.md)、[操作流程](TILE-WORKFLOW.md)、[协议](TILE-WORKFLOW-PROTOCOL.md)、[8 个原创技术任务包](../samples/2dw-tile02a/README.md)。四个主要包是两族标准／极端小样；另附两族标准的收口与正式包，审批为 synthetic/test-only，不代表实际用户认定。

以下相对工坊目录，仅保留 ignored 本机：

- `validation/2dw-tile02a/baseline.json`、`baseline-checked.json`：接手与 24 历史包／6 保护文件／8 新包核对。
- `validation/2dw-tile02a/tests-final.log`：140 项受影响模块；`typecheck-final.log` 和 `build-final.log` 为类型／构建结果。
- `validation/2dw-tile02a/proof-1791729364640-c47ade/verification.json` 与 `SHA256.json`：两工程真实编译、来源、九图、恢复、跨机、模式切换与 8 样包。
- `validation/2dw-tile02a/ai-1791729049882/report.json`：四次实际调用、原件／Prompt／ZIP／参考 SHA、未批准工程与门禁；同目录 `originalindex.html` 是 A/B 入口。
- `validation/2dw-tile02a/evidence-checked.json`：37 项技术证据与四次 AI 原件／任务／Prompt／工程／参考，共 61 项 SHA 回读核对通过。
- `validation/2dw-tile02a/desktop-EU3May/result.json`：最终 Electron 14 项、确认／取消记录；同目录 `compiled-form-gates.png` 为实际界面截屏。之前 `desktop-tKdzC0`、`desktop-6ri4mo` 与两个 failure.log 保留，没有作为最终通过证据。

新增程序涉及 form-contract、style-pressure、独立 v7 package、session Gate、pipeline、output snapshot、桌面相关面板及证明脚本。原经典／多贴片编译算法、v6 package 和批准风格文件未修改。只读独立集成审阅与桌面身份草稿问题修复均已完成。

## 待人工或后续专项

用户仍需看真实图、检查四形态能否按同相机实际联通、判断黑线与成熟质感、亮边／暗面／重复感，并明确批准准确版本。手修分钟数未测；真实 AI 正式双层没有产出，不能推断“免修稳定生产”。Unity sorting、另一朝向遮挡及最终墙材可用性尚未验证。

本轮只交付候选形式和压力控制；不把新候选接入长期美术规范，不启动下一轮扩展。
