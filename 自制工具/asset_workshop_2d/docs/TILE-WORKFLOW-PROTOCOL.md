# 2DW-TILE-02A 数据协议与候选编译

# v8单参考增量（0.5.0）

显式protocolVersion8创建spec1.6.0/ZIP8，package-v8独立派发，不改变旧v6/v7定义。四项单图检查使用form-review/2，禁止沿用四图共用相机检查。准确批准/角色/原PNG/最高画法优先级进入包，镜像重建与Ed25519/长度/SHA校验复用。单图只锁画法，不能作为已完成47态的证据。

single-art-adapter/1要求显式非重叠8窗、source-frame-duplication-v1与合法R/G；程序模板轮廓不保留艺术外形。结果可附art-source.png、conversion.json与map.conversion，三者必须完整一致并从原像素重建验证；不能删权威字段绕过来源检查。外部包签名不授予本机批准。输出仍2dw-tile-output/2；人工与Unity状态分别pending/unverified。

[可行性](SINGLE-TO-CONNECTED-FEASIBILITY.md)说明实际转换边界。以下旧协议保持。


## v7 增量（0.4.1）

只有显式 `options.protocolVersion:7` 创建 `lockedSpec.schemaVersion:1.5.0 / 2dw-zip/7`；未标记的历史 options 继续走原 `workflow/package.cjs` v6。新 `package-v7.cjs` 独立派发；旧 v1–v6 文本、图与算法定义不改。`asset-spec.json` 仍为唯一权威，所有镜像在验包时从权威重建比较，Ed25519 签名、文件长度／SHA 和原 ZIP 预算继续适用。

新 `viewContract` 是固定模板枚举快照；`stylePressure` 含 mode、ID、候选版本、任务作用域与保护项。二者进入 specHash，并同时进入小样／风格／正式三个阶段。新增 `guides/view-guide.png`、`guides/view-checklist.md`、`style/style-pressure.md`；sample-layout 改为固定 2×2 语义图。说明图是本工程原创代码绘制，不能作为生产美术或自动视角认证。

`formReview` 绑定样品 ID／revision／PNG SHA／specHash／viewContractId／stylePressureId，四项检查、用户明确来源、时间与说明。状态为 unchecked/conforms/rejected；会话另含本机 HMAC 与陈旧状态，任务包只带纯快照。风格与正式包必须有当前 conforms；正式批准另绑定 `SHA256(canonical(formReview))`，改备注或勾选后重算 manifest／重签任务包也不能沿用先前批准。结果 map 同样携带准确检查并独立核验绑定。外部 ZIP 的签名／snapshot 不是本机 HMAC 授信，也不是图像语义自动识别。

旧工程没有新形式认证。明确升级才写新契约并作废旧 Gate；重新使用旧图是显式采用原字节为当前规格新修订，记录旧 specHash 和父版本。改模式、换图、拒绝形式、异机导入均需要重新核对；切回旧模式不会复活批准。错误图的原因以负向诊断传给新小样请求，不进入正向参考。`SAMPLE_REJECTED` 可以表示用户形式退回，也可以表示 PNG 技术导入失败，原件均保留。

正式 materials／contour、47／188、九地图与来源回拼算法不改。压制不触及控制图数值。`2dw-tile-output/2` 仍兼容历史结果；对 v7 锁定规格额外检查固定契约和形式检查／批准绑定。

复现：`pnpm run proof:tile02a` 新建八个公开原创 test-only 任务 ZIP，真实工程和证据留 ignored validation。`pnpm run smoke:tile02a -- validation/2dw-tile02a/proof-实际目录/verification.json` 使用隔离真实 Electron 运行。AI 对照单独由 `tile02a-ai-prepare.mjs` 生成计划和实际调用文本；图像生成使用可用工具执行，`tile02a-ai-record.mjs` 只登记已有真实返回，不伪造图片。

以下 v6 阶段与编译约束作为兼容说明保留。

## 阶段与权威

`FORMAT_DRAFT → FORMAT_LOCKED → SAMPLE_REQUEST_READY → SAMPLE_RECEIVED → STYLE_REQUEST_READY → STYLE_RECEIVED → SAMPLE_APPROVED → PRODUCTION_REQUEST_READY → MASTER_RECEIVED → COMPILED → STRUCTURE_CHECKED → EXPORTED`。

导入失败进入 SAMPLE_REJECTED/MASTER_REJECTED 并保留原件；撤销进入 APPROVAL_REVOKED；结构失败为 STRUCTURE_FAILED。选择旧版本不把批准转给它。所有修订保存真实 PNG 字节、SHA、尺寸、父版本、来源与目的。子版本继承 test-only 来源，不能通过改 JSON 抹掉。

新阶段任务采用 `spec 1.4.0 / 2dw-zip/6`，唯一硬权威是 `spec/asset-spec.json`。`sample-task`、`style-refine-task`、`formal-master-task` 各只包含当前阶段需要的资料。规范/风格/导引/prompt 由同一权威生成；校验时严格重建比较。签名采用 Ed25519，覆盖全部文件 SHA/长度及任务阶段；单独重算 manifest 不能改变图片、规则或取样表。首次接收仍须核对发行密钥指纹，签名不是公共权利或美术质量认证。

正式身份绑定 sampleId、revision、实际文件 SHA/字节数、templateId/version、profileVersion、specHash、时间、testOnly 与批准记录。项目导入还核验实际 PNG 元信息及版本亲缘。本机 HMAC 保护批准与持久快照；异机项目保留记录但不给正式门禁。

`2dw-tile-output/2` 结果包包括 canonical 47 PNG、188变体、atlas、underlay、批准原图、实际正式层、九地图、map/validation/manifest。独立验证器从正式原图重新编译，核对47态/所有变体/地图实际字节，不能用“passed”文字掩盖假预览。它验证完整性与来源一致性，不替代用户批准。

## art-directed 候选

旧 `grammar/catalog.cjs`、`compile.cjs`、`validate.cjs` 的经典定义不变。新代码独立在 `art-directed.cjs` 与 `art-directed-validate.cjs`。

材料画板 4c×2c：上排 surface-0/1/2/3，下排 edge-0/edge-1/underlay/dark，各c×c。中心使用四个真实贴片，边缘使用两个真实贴片；选取由锁定 seed 和地图坐标确定，反复预览不随机跳变。两类每态四个实际变体，47 canonical 与188 variants 采用不同路径。

控制图 2c×c：两个实际控制变体，R=0–255 映射开放边缩进，G=0–192 混合实际 dark 贴片，B=0、A=255。缩进下限 `max(1,floor(c/32))`、上限 `max(2,floor(c/8))`。控制能改变开放边与暗部像素，但不改变合法八邻拓扑；断开轮廓拒绝。源贴片坐标、尺寸、各层 SHA 及批准样品都进入来源链。

edge-0/edge-1 两像素共享框：depth=0/1 左右对应 RGBA 相同、上下对应相同，两个变体相同坐标框也相等。不能用旋转、缩放、模糊或平均边框补缝。这是当前候选的约束，不是普适环境美术标准。

草地保留透明叶缘候选；石材保留显式厚度/越格/Pivot 和逻辑格区别。底层来自真实 underlay。检验分 hard-fail、warning、human-check；颜色接缝与重复是有界启发式。程序角/轮廓依然可能机械，中心四种也仍可能重复，不能自动称自然。

## 可复现验证

从工坊目录执行 `pnpm run build`、`pnpm run typecheck`。定向测试命令见验证报告，不需要游戏/3D全量回归。

`pnpm run proof:tile02` 每次在 `validation/2dw-tile02/proof-时间戳/` 与 `samples/2dw-tile02/proof-时间戳/` 新建证据；全部是原创 synthetic/test-only。随后 `pnpm run smoke:tile02 -- validation/2dw-tile02/proof-时间戳/verification.json` 用隔离真实 Electron profile 检查文件/剪贴板、正式闭环及恢复。自动化仅注入系统对话框返回路径，不声称自然点击原生对话框或人工审美通过。

真实 AI 图像仅留忽略的 validation。`scripts/tile02-ai-record.mjs` 登记已有四张实际返回图，不自行调用或伪造生成结果。没有实际 AI 图时应报缺失，不用夹具补充。
