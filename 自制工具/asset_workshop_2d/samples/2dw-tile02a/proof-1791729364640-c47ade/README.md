# 2DW-TILE-02A 原创技术夹具任务包

八个 ZIP：草地、石材各有 standard 的 sample/style/formal 三阶段任务，以及 extreme 的 sample 任务。均使用真实 desktop pipeline、session、v7 package API；全部图像为本工程原创程序诊断夹具。没有原作、用户图片或真实 AI 成图。

形式检查和批准来自明确标记的 synthetic/test-only 夹具，只证明工作流技术门禁；不是用户人工美术认可，也不是程序自动识别了相机/美术。V2、V3 仅模拟风格回传与人工回传，未调用图像 AI。正式候选仍为 artAcceptance: pending-human-review；Unity Sorting: unverified。

固定技术规格：逻辑格64px、PPU100、seed17；materials.png 256×128，contour.png 128×64。47合法态、188真实变体和九地图检查留在本机 validation/2dw-tile02a。sample 2×2是语义契约，软件未作自动语义裁切。

SHA256.json 列出本目录八包的真实 SHA256。包内 spec/asset-spec.json 是唯一硬规格权威，guides/view-guide.png是原创说明图，不是生产美术。发行签名只认证该发行密钥的字节完整性，首次接收仍需核对指纹；不是权利、美术或异机工程审批认证。工程 ZIP、原始诊断PNG、结果包和本机签名私钥仅保存在 ignored validation，未列入此公开目录。

复现：node scripts/tile02a-proof.mjs。每次新增 proof-时间戳目录，拒绝覆盖旧证据与旧任务包。旧v1–v6包、旧程序生成物和2DW-TILE-02样包不修改。
