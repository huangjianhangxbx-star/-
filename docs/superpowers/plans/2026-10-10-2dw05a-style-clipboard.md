# 2DW-05A 项目风格契约与 PNG 粘贴实施计划

> **For agentic workers:** Implement each independently testable task with RED → GREEN → regression checks.

**Goal:** 让离线 2D 素材工坊保留项目绘画基线、表达本次局部偏移，并从 Windows 剪贴板直接加入经过校验的 PNG 参考。

**Architecture:** `spec/asset-spec.json` 继续是任务权威来源；可选 `projectStyleContract` 与 `taskStyleDelta` 嵌入该规格。新任务 ZIP 使用增量 `2dw-zip/3`，`style/` 是可读镜像，旧 `/1`、`/2` 仍读取。剪贴板只在 Electron 主进程读取，临时 PNG 进入现有参考图校验流程；renderer 仅调用受限 IPC。

**Tech Stack:** Node 24、pnpm 11、TypeScript、Electron 44、pngjs、fflate、Playwright。

**Spec:** `E:/迅雷下载/星骸2D素材任务工坊_2DW05A_项目风格契约与PNG剪贴板粘贴_执行计划_v0.1.md`；用户于 2026-10-10 明确授权执行。

## Global constraints

- 仅写 `自制工具/asset_workshop_2d/` 与本轮任务/验证/工程记录；保护 `design/开发细则.md`、`design/用户维护/`、3D 工坊、游戏源码及现存并行修改。
- 离线，不下载 URL，不声称工坊已看图或生图；Unity 默认 100 PPU 不变。
- 图像来源必须是真实本地 PNG 或剪贴板位图；预览与导出须读取同一已核对字节。
- 四边明确的 512×512 地块要求只属于其他具体任务，不能提升为全项目基线。
- 验证通过后选择性提交推送 GitHub `main`，不强推、不推 Gitee。

---

## Task 1: Baseline and protection snapshot

- [x] 核对本地与 GitHub `main`、目标工作树、适用 AGENTS 和开发细则。
- [x] 运行当前测试、类型检查、构建；记录现存未跟踪样包解包目录和受保护旧样包哈希。
- [x] 将结果写入本轮验证记录的基线段。

## Task 2: Structured style data and conflict gate

- [x] 先写失败测试：默认契约、空契约、任务偏移、字段限制、显式明暗预算冲突与旧数据兼容。
- [x] 新增项目契约与任务偏移类型、内置手绘块面模板及纯数据校验；任务偏移的预算若放宽项目上限须标记冲突，不自动覆盖。
- [x] 让 preset composer 将风格数据嵌入 `spec/asset-spec.json`；既有 `styleProfile` 保持兼容。
- [x] 运行目标测试和类型检查。

## Task 3: Workflow and ZIP v3

- [x] 先写失败测试：`style/` 三文件、manifest SHA、spec 一致性、旧 `/1` `/2` 仍可读、未分析图片不产出假报告。
- [x] 编译项目契约 JSON/Markdown 与任务偏移 Markdown；工作流、README 和 Codex 适配文本明确先读风格约束，再分析参考图与冲突。
- [x] 扩展严格 ZIP 校验：`/3` 必需且只允许规定 `style/` 条目，镜像与权威 spec 一致；保留旧版读取。
- [x] 运行归档与工作流测试。

## Task 4: Clipboard import

- [x] 先写失败测试：位图与 Windows 本地 PNG 文件引用、URL/非 PNG/超预算/重复/坏图拒绝、添加按钮回归、预览后变更失效。
- [x] Electron 44 主进程读取 `ClipboardItem` 的 `image/png` 或 `text/uri-list`/本地文件文本；不让 renderer 获取任意文件读取能力。
- [x] 位图先写到受控会话临时 PNG，再走既有 `readReferenceFacts`；只添加经过 CRC、大小与像素核验的源。
- [x] 保留旧文件选择入口，明确用户可读错误；加入会话结束清理。

## Task 5: Desktop form and preview

- [x] 先写失败 UI/草稿测试：项目默认契约、局部偏移、复制与新建、修改后旧预览失效、粘贴区域焦点和反馈。
- [x] 在现有视觉体系内加入可折叠的结构化项目风格与本次偏移编辑区；支持显式保存项目默认值、空基线提示和预算冲突警示。
- [x] 参考区提供 `Ctrl+V` 入口与旧按钮，并显示缩略图、尺寸、体积、角色和说明。
- [x] 用 Electron 截图复核布局及键盘焦点。

## Task 6: Brick sample, regression and delivery

- [x] 定位用户实际图 1、图 2；只在来源可验证时制作真实砖块任务 ZIP，至少内容参考一张、风格参考一张，不以夹具冒充原图。
- [x] Windows Electron 实测位图与文件剪贴板粘贴；独立核对样包 manifest、CRC/SHA、参考原始字节及旧样包兼容。
- [x] 跑完整测试、类型检查、构建及适用烟测；保存 `VALIDATION-2DW05A.md`、任务记录和必要工程记录，诚实列出无法覆盖的人工验收。
- [x] 精确暂存本轮文件，`git diff --cached --check`，复核远端 SHA，提交并非强制推送 GitHub `main`，核对远端 SHA；不推 Gitee。
