# 2DW-TILE-02 数据协议与候选编译

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
