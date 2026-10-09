# 2DW-03 桌面动态表单、参考图管理与真实 ZIP 导出

状态：实现与自动验收完成，待用户试用审阅（2026-10-09）。用户要求按所附 [2DW-03 执行计划](<E:/迅雷下载/%E6%98%9F%E9%AA%B82D%E7%B4%A0%E6%9D%90%E4%BB%BB%E5%8A%A1%E5%B7%A5%E5%9D%8A_2DW03_%E6%A1%8C%E9%9D%A2%E5%8A%A8%E6%80%81%E8%A1%A8%E5%8D%95_%E5%8F%82%E8%80%83%E5%9B%BE%E7%AE%A1%E7%90%86_%E7%9C%9F%E5%AE%9EZIP%E5%AF%BC%E5%87%BA_%E6%89%A7%.md>) 实施；随后于本轮明确授权推送 GitHub。链接对话可读的最近消息是“出计划吧”；实施及发布授权来自用户在当前聊天的后续指令，不把聊天附件的旧状态当作新授权。仅发布本任务范围到 GitHub `main`，Gitee 不在范围。

## 接手基准与保护

- 本地 `main`、GitHub `main` 均为 `33688da66f9502187e21dfddbff654fd7c9d4815`；`自制工具/asset_workshop_2d/` 接手时无未提交修改。仓库其他目录有并行修改，保留原状。
- 已完整核对 `design/开发细则.md` v2.1 登记草稿、根和目标 `AGENTS.md`，按任务读取核心代码、2DW-02 说明与验证。真实可用 Skill：`brainstorming`、`writing-plans`、`test-driven-development`、`frontend-design`；设计和实施范围已由用户提供的细化计划确定。`grill-with-docs` 在本次无关键未决设计问题时不强行启动。
- 默认终端 Node 22 导致 `.ts` 测试被运行器拒绝；切换本机捆绑 Node 24.19.0 后，基线 `pnpm test` 83/83、`pnpm run typecheck`、`pnpm run build` 通过。旧 Electron 烟测须在隔离副本执行。
- 首轮黄金 ZIP 与 2DW-02 A/B/C 三包 SHA256 均与计划 §7 一致；`map_editor/package.json` 与既有 EXE 的 SHA256 也一致。不得改写它们。

## 实施切分

1. 主进程会话：只从系统对话框取路径，登记不可猜测 token，重读并完整校验 PNG；页面只提交允许的字段与 token。预览和导出共用 `readReferenceFacts → composePreset → compileTask`，导出前重核源文件及预览快照。
2. 动态界面：仅列出可信的两种 seed 和 Codex@1；字段由 `describePresetForm` 驱动，允许暂时无效的输入但阻止导出。三层自定义要求在普通模式隐藏且不进入规范；参考图可标注、移除和查看受限缩略图。
3. ZIP 交付：通过系统另存为对话框选择位置；沿用 `exportZip` 的原子无覆盖写入及 `validateZip`。关闭网络和 Node renderer 能力，保留旧固定样例接口供兼容测试。
4. 验证：先红后绿的会话/表单/导出测试，Node 24 下完整 2D 回归；实际 Electron 两个窗口尺寸、离线和系统对话框操作；通过 UI 生成 0 图与两图 ZIP，独立核验 CRC/manifest/SHA/原图字节，并按 G01–G24 登记结果。

## 非目标和交接

不实现 AI 生图、拼接、专业种田/植物规则、其他 Adapter、外部可写预设库、Unity 导入或正式便携发行包；不修改旧 3D 工坊、游戏、人工原稿、开发细则。自动测试不能代替用户最终手感审阅。实施结果与实际缺口将在 `自制工具/asset_workshop_2d/docs/VALIDATION-2DW03.md` 中逐项记录；完成后停在 2DW-03 审阅。

## 完成结果与交接

- 独立 Electron 工作台已接 2DW-02 权威预设接口；主进程令牌化参考 PNG、限尺寸缩略图、来源重读、同源预览/导出、系统选图与另存为、原子无覆盖 ZIP。保留旧 proof 桥接。未修改原 2DW-02 种子/Schema 算法或首轮黄金文件。
- 新桌面工作流先 RED 后 GREEN；最终 2D 全量测试、typecheck、build 通过；真实 Electron 离线 A/B/C 操作，0/2/1 参考图 ZIP 分别 7/9/8 条目。两窗口宽度、Tab、方形冲突、Alpha 三态、取消与同名拒绝均检查。另使用真实 Windows 原生选图与保存对话框从 E 盘选 PNG、向 C 盘保存 ZIP；旧 proof 烟测在隔离副本通过 8 项。
- 三个审阅 ZIP、截图、解压文本及 SHA256 位于 `自制工具/asset_workshop_2d/samples/2dw03/`；独立 Python 检验 CRC、manifest 全条目哈希和原图字节通过。G01–G24 逐项证据及有限缺口见 `自制工具/asset_workshop_2d/docs/VALIDATION-2DW03.md`：真实禁写 ACL 情况未测，G24 用户本人体验待确认。
- 黄金 ZIP、2DW-02 三包及旧 3D 工坊两个指定保护文件 SHA256 不变。按后续授权仅提交推送 GitHub `main` 的 2DW-03 增量，不进入后续预设/素材生产阶段；保留仓库其他并行未提交修改。
