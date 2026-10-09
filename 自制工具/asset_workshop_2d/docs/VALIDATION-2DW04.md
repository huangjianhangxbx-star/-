# 2DW-04 创作减负与快捷任务验证（2026-10-09）

本记录按用户的《星骸2D素材任务工坊_2DW04_创作减负与快捷任务_详细执行计划_v0.1》G01–G32 逐项登记。**自动测试通过不等于用户亲自试用通过。**本轮使用本机 Node 24.19.0、pnpm 11；系统默认 Node 22 不满足工程要求。证据均为本地真实运行或可复核的测试与产物。旧 `smoke:workflow` 脚本沿用 `validation/2dw03/` 输出目录，因此本轮重跑回执也位于该目录。

## 运行与产物

| 验证 | 结果与证据 |
| --- | --- |
| 完整回归 | `pnpm test` **119/119**、`pnpm run typecheck`、`pnpm run build` 通过；[测试日志](../validation/2dw04/delivery-2.log)、[类型检查](../validation/2dw04/delivery-0.log)、[构建](../validation/2dw04/delivery-1.log)。 |
| Electron 工作流 | `pnpm run smoke:workflow` 通过；[回执](../validation/2dw03/ui-cT80ej/electron-workflow.json)记录 0/2/1 参考图的真实 ZIP、取消保存、同名保护、窄窗滚动与 Tab 检查，网络请求 0。 |
| 2DW-04 快捷工作流 | `pnpm run smoke:quick` 通过；[回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)记录三个 ZIP、五张 1080×820／760×640 截图、离线 0 请求、renderer 无 Node。脚本用独立的 fflate 解包，比较 UI 完整规范与 ZIP 规范、Prompt、目录，并核对每个 manifest 条目的 SHA256 及参考 PNG 原字节；[运行日志](../validation/2dw04/delivery-4.log)。 |
| 原生 Windows 对话框 | 实际打开系统选图和另存为对话框，选入一张自制 PNG 并保存 [ZIP](../validation/2dw04/native-AqUBvx/native-selected.zip)；[独立审计](../validation/2dw04/native-AqUBvx/native-independent-audit.json)记录 8 条目、CRC/manifest/源图原字节通过，规范为 512×256、100 PPU；[保存后截图](../validation/2dw04/native-AqUBvx/native-after-save.png)。这属于实机自动操作，不代替 G32 用户试用。 |
| 受保护对象 | [哈希对账](../validation/2dw04/protection-hashes.json)的十项 `match` 全为 `true`：首轮黄金 ZIP、2DW-02 三包、2DW-03 四包、旧 3D 工坊 package.json 与发行 EXE。仅对这十项作定向保护结论。 |

本轮快捷工作流的三个可审阅 ZIP：

| 场景 | 条目 / 参考图 | SHA256 |
| --- | --- | --- |
| [A：零图正方形](../validation/2dw04/quick-ui-fwg0ga/A-zero-square.zip) | 7 / 0，384×384，100 PPU | `6e0d79795d815f0569ce2bdfdb22f50bf287df92bb4d94e2f2a8fc9ba5463a2d` |
| [B：双图矩形](../validation/2dw04/quick-ui-fwg0ga/B-two-rectangle.zip) | 9 / 2，512×256，200 PPU | `22a7e6f2f3bc847b8d4abbdbb5cc33e1ef2608d17ede47d4e1f49b774fda8646` |
| [C：复制后新 ID](../validation/2dw04/quick-ui-fwg0ga/C-copy-new-id.zip) | 9 / 2，规格和参考图继承 B，任务 ID 不同 | `6daecf513fe11c5f343bca3f76358afff6f0538eaf1adf0d0e3d282850c5eba0` |

## G01–G32 逐项结果

| Gate | 状态 | 证据与边界 |
| --- | --- | --- |
| G01 初开免填 ID/标题 | **通过** | [快捷工作流](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)的 A 在真 Electron 窗口从自动 ID/标题直接导出；[1080×820 截图](../validation/2dw04/quick-ui-fwg0ga/A-zero-square-1080x820.png)。 |
| G02 ID 合法、≤64 字符、无设备保留名 | **通过** | [会话测试](../tests/ui-session.test.mjs)与 [快捷工作流](../scripts/desktop-quick-smoke.mjs)核对 `asset-…` 身份；可信生成器固定安全前缀及短随机段，核心 [ID 校验](../core/resolve-spec.ts)继续拒绝保留名。 |
| G03 同任务修改后 ID 稳定 | **通过** | [草稿模型测试](../tests/draft-model-2dw04.test.ts)验证跨模式 ID；[会话测试](../tests/ui-session.test.mjs)验证预览与参考变更后仍使用当前任务身份。 |
| G04 新建、复制各得新 ID | **通过** | [快捷回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)的 A/B/C 为三个不同 ID；[真实窗口测试](../tests/quick-flow.test.mjs)覆盖复制及新建。 |
| G05 复制内容/规格/参考，新 ZIP 身份不同 | **通过** | [快捷回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)与 B/C 两包独立解包对比：内容、规格、两张参考图一致，ID 和 ZIP 哈希不同；[草稿测试](../tests/draft-model-2dw04.test.ts)覆盖可见字段与要求。 |
| G06 默认非空可读标题 | **通过** | [模型测试](../tests/draft-model-2dw04.test.ts)检查描述、尺寸、模式生成标题；A/B [实际包回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)记录中文自动标题。 |
| G07 自动更新、手动覆盖稳定 | **通过** | [模型测试](../tests/draft-model-2dw04.test.ts)覆盖描述、尺寸、模式变化和手动覆盖；[真实窗口测试](../tests/quick-flow.test.mjs)验证再改描述不改手动标题。 |
| G08 清空手动标题后仍可导出 | **部分通过** | [模型测试](../tests/draft-model-2dw04.test.ts)验证空白恢复自动；[真实窗口测试](../tests/quick-flow.test.mjs)验证空白操作后旧预览仍有效，A 包证明自动标题可导出。尚无“先手动命名→清空→在同一真实窗口导出”的完整链路测试。 |
| G09 中文、标点、极长描述的安全文件名 | **部分通过** | [文件名边界测试](../tests/desktop-export.test.mjs)覆盖保留设备名、中文标点和极长**标题**；模型将描述压缩为有限长度，A/B 包使用中文描述。未单独执行极长**描述**经自动标题到实际保存的端到端边界。 |
| G10 默认 100 PPU，200 覆盖不改画布 | **通过** | A/B [快捷回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)分别为 384×384/100 与 512×256/200；[预设测试](../tests/presets.test.ts)核对世界尺寸与像素尺寸。 |
| G11 新建后恢复 100 PPU | **通过** | [模型测试](../tests/draft-model-2dw04.test.ts)验证新建清除 200 覆写；[真实窗口测试](../tests/quick-flow.test.mjs)验证新建后 PPU 控件显示核心默认 100。 |
| G12 方形仅显式宽度推导高度 | **通过** | A [实际 ZIP](../validation/2dw04/quick-ui-fwg0ga/A-zero-square.zip)为 384×384、100 PPU、3.84×3.84 units；[预设测试](../tests/presets.test.ts)核对高度来源为 `derived`。 |
| G13 显式冲突不被暗改 | **通过** | [模型测试](../tests/draft-model.test.ts)保留显式高度；[预设测试](../tests/presets.test.ts)定位 `square-locked` 冲突；[真实窗口测试](../tests/quick-flow.test.mjs)验证错误指向可修正的方形锁。 |
| G14 快捷项与自定义宽高产生不同规范 | **通过** | A/B [快捷回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)来自正方形快捷项与自定义宽高，实际 ZIP 的方形锁和尺寸不同。 |
| G15 正方形不暗示拼接/八邻接 | **通过** | 检查 A [实际 ZIP](../validation/2dw04/quick-ui-fwg0ga/A-zero-square.zip)的 `prompts/codex.md`：仅规定静态单图及结构化尺寸，未写八邻接、自动拼接或虚构瓦片规则；[Codex 文本测试](../tests/codex.test.ts)守住规范优先级。 |
| G16 风格文字可空且可用风格参考 | **通过** | B [实际 ZIP](../validation/2dw04/quick-ui-fwg0ga/B-two-rectangle.zip)的 `styleDescription` 为空，参考列表仍含 `style` PNG；[快捷回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)核对原字节。 |
| G17 零参考纯文字任务 | **通过** | A [实际 ZIP](../validation/2dw04/quick-ui-fwg0ga/A-zero-square.zip)只有 7 条目、0 参考图；[快捷回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)的 manifest 与规范核对通过。 |
| G18 两图原字节、角色、SHA 一致 | **通过** | B [实际 ZIP](../validation/2dw04/quick-ui-fwg0ga/B-two-rectangle.zip)有 content/style 各一张；[独立快捷审计](../scripts/desktop-quick-smoke.mjs)逐图比较源字节、角色、哈希和尺寸。 |
| G19 八图上限、第九图与坏 PNG 拒绝 | **通过** | [会话测试](../tests/ui-session.test.mjs)覆盖 8/9 张边界；[归档测试](../tests/export-zip.test.mjs)覆盖坏图、CRC、尺寸和预算。 |
| G20 普通模式不带 custom 要求 | **通过** | [草稿测试](../tests/draft-model.test.ts)、[会话测试](../tests/ui-session.test.mjs)和重跑的 [Electron 工作流](../validation/2dw03/ui-cT80ej/electron-workflow.json)覆盖切回普通模式后的 spec/Prompt。 |
| G21 custom 三层要求与顺序 | **通过** | [草稿要求顺序测试](../tests/draft-model.test.ts)、[预设测试](../tests/presets.test.ts)、[Codex 文本测试](../tests/codex.test.ts)及 [Electron 自定义包](../validation/2dw03/ui-cT80ej/ui-custom-reference.zip)。 |
| G22 修改后旧预览/导出失效 | **通过** | [草稿 revision 测试](../tests/draft-model.test.ts)与 [会话测试](../tests/ui-session.test.mjs)覆盖改字段、参考图；[并发预览单测](../tests/desktop-export.test.mjs)证明旧异步预览不能覆盖新预览或保存对话框中的新快照。 |
| G23 复制前后源图改写仍须复核 | **通过** | [复制源图重写单测](../tests/desktop-export.test.mjs)覆盖复制前源字节变化使复制拒绝且 ID 不变；恢复后复制成功，再改写源图会使新任务预览拒绝。 |
| G24 摘要、完整规范、ZIP 一致 | **部分通过** | [快捷审计脚本](../scripts/desktop-quick-smoke.mjs)对 UI 完整规范与实际 ZIP 规范做对象相等比较，并逐条核对 Prompt、目录、manifest、SHA、参考原字节；摘要核对了任务 ID、标题、画布与 PPU。摘要中的其余展示字段未逐字段自动比对。 |
| G25 Codex 规范与内容优先级 | **通过** | [Codex 文本契约测试](../tests/codex.test.ts)覆盖结构化输出和已验证参考事实先于自由文字，hard/preferences/creativeFreedom 各在自己的段落且不得覆盖 PNG、尺寸、PPU、路径。 |
| G26 无生图工具不假称已有 PNG | **通过** | [Codex 测试](../tests/codex.test.ts)验证无工具时停止；[快捷 ZIP 独立审计](../scripts/desktop-quick-smoke.mjs)检查三个 ZIP 均不包含 `output/` 下的目标 PNG。 |
| G27 取消另存为保留草稿与有效状态 | **通过（模拟对话框）** | [桌面会话测试](../tests/desktop-export.test.mjs)证明取消后同一预览仍可再次导出；重跑的 [Electron 工作流](../validation/2dw03/ui-cT80ej/electron-workflow.json)使用系统对话框的自动替身验证 UI 取消提示及原 ZIP 字节不变。未将原生手动取消误称已测。 |
| G28 同名不覆盖、失败无残留 | **通过（定向测试）** | [桌面会话测试](../tests/desktop-export.test.mjs)、[归档测试](../tests/export-zip.test.mjs)覆盖同名、并发、取消和失败清理；重跑 [Electron 工作流](../validation/2dw03/ui-cT80ej/electron-workflow.json)验证旧 ZIP 字节不变。真实 Windows ACL 拒写专项未执行，见下文。 |
| G29 双窗口尺寸、Tab、焦点 | **通过（已测路径）** | [五张真窗口截图](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)覆盖 1080×820 和 760×640、无横向溢出及导出可滚动可见；[Electron 工作流](../scripts/desktop-workflow-smoke.mjs)检查模式至描述的 Tab 顺序，[真实窗口测试](../tests/quick-flow.test.mjs)检查冲突错误焦点。 |
| G30 离线、renderer 无 Node、IPC sender | **通过** | [快捷回执](../validation/2dw04/quick-ui-fwg0ga/quick-smoke.json)记录离线、网络请求 0、rendererNodeAccess=false；[隔离测试](../tests/electron-isolation.test.mjs)和 [会话/预加载测试](../tests/ui-session.test.mjs)覆盖 IPC sender。 |
| G31 黄金包、2DW-02/03、旧 3D 原字节 | **通过（定向保护）** | [十项 SHA256 对账](../validation/2dw04/protection-hashes.json)均 `match=true`。其他并行工作树文件不在此结论范围。 |
| G32 用户独立从空任务导出 | **未执行** | 真 Electron 自动流程与原生对话框实机自动操作已经完成；仍待用户本人按计划独立试用并反馈，不能由自动验证替代。 |

## 未执行及交接边界

真实 Windows **ACL 拒写目录**的专项保存测试未执行；G28 仅以文件系统失败/清理测试和 Electron 同名保护为证。不把原生选图、保存对话框的实机自动操作写成用户体验认可。G08、G09、G24 的剩余验证范围已在表中明示；G32 保持未执行。本轮不据此启动 2DW-05。用户在初次交付后已明确授权将 2DW-04 提交并推送 GitHub；发布不改变上述验收状态，Gitee 不同步。
