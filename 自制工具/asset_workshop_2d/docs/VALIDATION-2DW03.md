# 2DW-03 桌面表单与真实 ZIP 验收（2026-10-09）

本轮按用户提供的 2DW-03 v0.1 计划实施独立 2D Electron 工坊。实际源码只在 `自制工具/asset_workshop_2d/`；另写本任务记录和必要共享状态。没有改游戏、旧 3D 工坊、`design/开发细则.md` 或 `design/用户维护/`。接手时 2D 目录干净，本地 `main` 与 GitHub `main` 同为 `33688da66f9502187e21dfddbff654fd7c9d4815`；其他目录的既有未提交改动没有清理、重置或纳入本轮。

## 已实现及真实入口

可双击工程内 [启动工坊.cmd](../启动工坊.cmd)，或在本目录运行 `pnpm start`。窗口只列两种真实种子与 `codex@1`；五维身份只读。表单字段来自 `describePresetForm()`，主进程持有参考图路径及不透明令牌；预览、导出都复用 `readReferenceFacts → composePreset → compileTask`。原始 PNG 不改写，窗口只接收尺寸/文件名/有上限的缩略图。导出由 Windows 保存对话框选位置，归档仍以 `fs.link` 无覆盖发布并回读 `validateZip()`。自定义三层要求按顺序进包，切回普通模式则不进包。旧固定证明接口仍可调用。

## 实际运行与证据

| 项目 | 结果 |
| --- | --- |
| Node 运行时 | 本机捆绑 Node 24.19.0；系统默认 Node 22 不满足 `engines >=24`，故以 Node 24 运行 pnpm。 |
| 接手基线 | 83/83 测试、`typecheck`、`build` 通过；首轮旧 Electron 烟测在隔离副本通过 8 项。 |
| 本轮测试 | TDD 中新桌面工作流先因缺少 `#mode-select` 而失败；最终 `pnpm test` **103/103**，`pnpm run typecheck`、`pnpm run build` 通过。 |
| 实际 Electron A/B/C | `pnpm run smoke:workflow` 以真实 Electron 窗口填表，模拟系统对话框返回真实自制 PNG/保存路径；离线 HTTP 探针 0 请求、renderer 无 Node。0 图、两图、自定义单图分别得到 7/9/8 文件 ZIP；方形冲突、Alpha 三态、取消保存、同名不覆盖、窄窗 Tab 与滚动也通过。最后一次回执在 `validation/2dw03/ui-Q1esha/electron-workflow.json`。 |
| 真正 Windows 对话框 | 另在未替换的系统 `添加参考 PNG` 和 `保存任务 ZIP` 对话框中定向操作本地控件；E 盘自制 PNG 被选中，C 盘 `C:\Users\Administrator\AppData\Local\Temp\2dw03-native-20261009.zip` 生成 8 文件 ZIP。审阅副本为 [`samples/2dw03/native-dialog-export.zip`](../samples/2dw03/native-dialog-export.zip)，SHA256 `c273a80bd665e78cd71d4bfedc0f5579f69c57add444e07521308163a7f8f51b`；[回执](../samples/2dw03/native-dialog-receipt.json) 记录实际路径。未取得可用的原生对话框截图。这是实机自动操作，不等同 G24 的用户亲自试用。 |
| ZIP 独立复核 | Python 标准库 `zipfile`/`hashlib` 对三个审阅副本检验解压、CRC、每个 manifest 哈希/长度、规范参考图与自制源 PNG 原字节；三包均通过，回执在 `validation/2dw03/independent-zip-check.json`。 |
| 旧兼容 | 最新源码的旧 `checkProof/exportProof` 桥接在 `work/2dw03-legacy-smoke-final/` 隔离副本通过 8 项；不触碰原 proof ZIP。 |

审阅样包、完整解压文本和截图在 [samples/2dw03](../samples/2dw03/README.md)：

| UI 样包 | 条目 / 参考图 | SHA256 |
| --- | --- | --- |
| [零图任务](../samples/2dw03/ui-zero-reference.zip) | 7 / 0 | `2d443c69254d2ec8c475b39effac573a6d2dc319eddd5dc6b50f4be122322c73` |
| [内容＋风格双图任务](../samples/2dw03/ui-two-references.zip) | 9 / 2 | `253d16631dce4ddc39c04a8fbbd67dc3473847b6baf531a09fa01f878e07f843` |
| [自定义单图任务](../samples/2dw03/ui-custom-reference.zip) | 8 / 1 | `dfb24396e26f1aa0af4b79bbb85c0bf12525dc4f2558f42e6e75caca0f475643` |

三包均不含 `output/asset.png`，只有未来目标约定；不存在 AI 已绘图的宣称。参考图来自本工程自制夹具，没有外部游戏素材。

## G01–G24 逐项验收

| Gate | 结果与依据 |
| --- | --- |
| G01 | **通过**。Electron 真实启动并显示任务工作台；`ui-two-references.png`。 |
| G02 | **通过**。只列普通/custom 两模式，五维 `id@version` 只读显示，Adapter 为 `codex@1`；Electron 与目录测试。 |
| G03 | **通过**。UI 输入宽 384、勾方形、未填高，spec 高 384 `derived`，PPU 100，世界 3.84×3.84；零图包。 |
| G04 | **通过**。UI 显式 PPU 200，512×256 → 2.56×1.28，像素不变；两图包。 |
| G05 | **通过**。UI 故意输入 384×512 后勾方形，`square-locked` 定位高度、显式 512 保留、导出禁用；需自行解除锁或调整输入。 |
| G06 | **通过**。UI 依次检查 `transparent-required` / `opaque-required` / `alpha-allowed` 的 spec 与 Prompt；不修改图片。 |
| G07 | **通过**。桌面真实流程导出 Schema 1.1.0 的 7 条目零图 ZIP。 |
| G08 | **通过**。两张自制 PNG 分设 content/style、备注，9 条目，原字节比较一致。 |
| G09 | **通过**。UI custom 单图、hard/preferences/creativeFreedom 各一条，8 条目；切回普通再预览，隐藏要求不存在。 |
| G10 | **通过**。UI 删除风格图、再切模式；会话测试覆盖角色/备注/优先级修改与移除，预览失效，ZIP 目录与最终引用一致。 |
| G11 | **通过**。会话测试将同名不同源的两图登记为不同 ID，重复源拒绝，8 张上限与第 9 张拒绝。 |
| G12 | **通过**。PNG 完整解码/CRC、扩展名、单图/总像素预算的归档和主进程测试覆盖，坏图不进入有效预览。 |
| G13 | **通过**。源图更改使导出失败且预览永久失效；恢复旧字节后仍必须重新预览。缺图/不可读走同一重读失败边界。 |
| G14 | **通过**。草稿 revision 测试拒绝过时异步预览；实际 UI 每次改动禁用旧导出并重预览。 |
| G15 | **通过**。主进程系统保存对话框；E 盘选图、C 盘自选文件名的原生对话框实测出包；未写固定 proof-output。 |
| G16 | **通过**。选图取消的会话测试与另存为取消的 UI/会话测试均保留草稿、无虚假成功。 |
| G17 | **通过**。已有目标 ZIP 时 UI 报已存在、旧字节未变；会话及底层并发无覆盖测试通过。 |
| G18 | **部分通过**。归档层测试覆盖失败与取消的临时文件清理及旧目标保留；UI 取消/同名错误提示通过。未在真实 Windows ACL 禁写目录做专项实机测试。 |
| G19 | **通过**。三个 ZIP 经独立 Python CRC/manifest SHA/原图字节复核；规范/Prompt 来自同一次预览编译，ZIP 无源绝对路径、无未来目标 PNG。 |
| G20 | **通过**。真实 Electron 离线，HTTP 探针 0 请求，renderer `require` 不存在；主进程禁止 HTTP/HTTPS/WS。 |
| G21 | **通过**。首轮黄金包 SHA256 `1f90a6b529c54cf3bda2fe9f1f90221fb19025b99ad113ca846aa325e663e504` 不变；2DW-02 三个样包与 `samples-report.json` 哈希一致；103 项回归通过。 |
| G22 | **通过（定向保护）**。旧 `map_editor/package.json` SHA256 `844376c36eb02ae09acd6571ddb4ecb9c6b4a81aa8a282cf36d07a28c1d96ad9`，旧发行 EXE SHA256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`；两者与接手值一致。本仓库其他旧 3D 路径已有并行未提交变化，本任务未写这些路径。 |
| G23 | **通过**。1080×820 / 760×640 真窗口全页截图；窄窗无横向溢出、导出按钮可滚动见到，模式→任务 ID 的 Tab 焦点检查通过。 |
| G24 | **待用户试用**。自动实机操作不代替用户独立完成一轮操作和手感确认。 |

## 边界与停止点

拖拽导入、导出中途取消、外部可编辑预设、专业种田/植物用途、其他 AI Adapter、生图、拼接裁切、Unity 导入及便携发行版未做。当前不进入 2DW-04 或新增美术预设。用户随后明确授权仅将 2DW-03 增量推送至 GitHub；Gitee 不同步。请先审阅任务包、界面和手动使用体验。
