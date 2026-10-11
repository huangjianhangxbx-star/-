# 2DW-TILE-02A 交接

执行用户 2026-10-11 批准的计划，在现有独立 2D 工坊增量交付 **0.4.1 / spec 1.5.0 / ZIP v7**，保留 v1–v6 与旧工程语义。没有重建工坊，没有修改游戏、3D 工坊、开发细则、用户维护资料或研究资产。

## 使用

双击工坊的 [启动工坊.cmd](../../../自制工具/asset_workshop_2d/启动工坊.cmd)，或在 `Origin/自制工具/asset_workshop_2d` 运行 `pnpm run build`、`pnpm start`（依赖已安装时）。打开“样品到正式联通”：新任务默认标准压制，选择草地／石质模板后查看只读视角及原创示意图；首次样品返回先逐项核对形式，再做风格收口与准确版本批准。错误视角填写理由并“退回样品重新试制”。

在锁格式或风格收口步骤均可选择无额外／标准／极端压制，两处同步；有有效批准时改档需确认，可以取消。改档产生新规格，旧请求／检查／批准／正式结果失效，切回不复活。旧 PNG 可在当前新规格下明确重新登记并核对，原版本和字节继续保留。

历史 v6 工程不自动获得形式认证。明确选择升级后，重新检查并批准准确版本。极端档是当前任务候选，不是新的长期美术规范；两级主要块面不是整图双色。

## 成果

- [形式规范](../../../自制工具/asset_workshop_2d/docs/TILE-FORM-CONTRACT.md)、[操作说明](../../../自制工具/asset_workshop_2d/docs/TILE-WORKFLOW.md)、[协议](../../../自制工具/asset_workshop_2d/docs/TILE-WORKFLOW-PROTOCOL.md)。
- [验证报告](../../../自制工具/asset_workshop_2d/docs/VALIDATION-2DW-TILE02A.md)：28 项矩阵、实际命令、原件 SHA 和待验边界。
- [8 个原创技术任务 ZIP](../../../自制工具/asset_workshop_2d/samples/2dw-tile02a/README.md)：两族 standard／extreme 四小样包，以及两族 standard 的收口／正式包。技术批准均标 synthetic/test-only。
- 四次实际内置 imagegen：两族从相同说明图独立试制 standard／extreme；原件、调用正文和四份未批准工程保留在本机 ignored `validation/2dw-tile02a/ai-1791729049882/`，A/B 入口 `originalindex.html`。模型名未知，未裁切／改色／拉伸。

## 验证与人工边界

受影响模块 140/140、类型检查、构建及最终真实 Electron 14 项通过；两套真实技术 PNG 各 47 态／188 变体、九图 9/9，结果 ZIP 依源像素验真。24 个旧包字节和六项保护 SHA 保持；8 个新任务包验真，技术／AI 证据 61 项 SHA 回读通过。四真实 AI 工程未检查／未批准，正式任务均被门禁阻止。桌面证据在 ignored `validation/2dw-tile02a/desktop-EU3May/result.json`；两次测试假设失败保留，见验证报告。

草地更接近平面，但有碎叶与外角表达问题；石材前暗面更统一，但孔洞仍带透视且极端档还有连续亮边。不能宣称稳定成熟手绘或免修。用户形式／美术批准、手修分钟数、真实 AI 正式母版与 Unity sorting 继续待验。

期间并行游戏提交推进 main 从 56c954d 到 f428490，未触及本任务路径。选择性发布仅本轮源码／原创说明与夹具／任务记录，共享记录仅追加本块；AI 原件／密钥／原作素材不上传，不 Gitee、不强推。提交／远端核验的实际 SHA 单独记录于本机 ignored `validation/2dw-tile02a/publication.json`，不将待推送状态冒称已发布。

任务到本轮技术交付为止，不启动后续美术或引擎专项。
