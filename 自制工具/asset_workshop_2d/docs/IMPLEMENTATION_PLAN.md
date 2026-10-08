# 2DW 第一轮执行计划

**Goal:** 独立 Electron 工程 + 权威 PNG 规范 + 可离线解压校验的 Codex 任务 ZIP，停在审阅点。

**Architecture:** 使用 TS 核心构建不可变规范，参考图读取与 ZIP 写入独立，Electron 仅暴露固定 proof 检查/导出 IPC。原图只读，先验证临时包再以无覆盖方式发布。

**Tech Stack:** Node 24 / Electron 44.5.1 / TypeScript 7.0.2 / esbuild 0.28.2 / fflate 0.8.3 / pngjs 7.0.0。依赖由自身 pnpm-lock.yaml 锁定；没有旧源码运行依赖。

**Spec:** 用户提供第一轮详细计划 v0.1；批准范围见项目任务单。用户已要求执行，按当前团队并行实施；不依赖未提供的 superpowers 子技能，不提交/推送。

## 全局边界

只做 2DW-00/01 与 04/05 的最小样例；默认100 PPU可覆写；输出PNG、正尺寸、明确Alpha；不调用AI/联网、不做完整表单、拼接、生图、导回、Unity导入器。参考图自制，原参考图不改。旧工坊与用户维护区受保护。

## 接口

`resolveSpec(draft, facts)` 返回唯一规范；`serializeSpec(spec)` 固定 JSON 字节；`compileTask(spec)` 返回 `{ entries: Record<string,string> }`，不含 manifest 或参考图。

Draft.references 为 `{refId, role:'content'|'style', sourcePath, note, priority?}[]`。`readReferenceFacts(inputs)` 返回 `{facts,binaries}`，facts 对应 `{refId,sha256,byteLength,widthPx,heightPx,sourceName}`，binaries 是 refId→Buffer。规范参考图包含 role/refId/note/priority、sourceName、sha256/byteLength/widthPx/heightPx 与 `packagePath=references/{role}/{refId}.png`，不保留 sourcePath。

`exportZip({spec,entries,binaries,outputDirectory,fileName,signal?})` 返回 `{path,sha256,entries}`；`validateZip(buffer)` 独立重新读取校验。输出目录拒绝软连接，取消/失败不留下成品，已有成品不覆盖。

## Task 1：唯一规范和文本编译

- [x] 写测试：100→3.84、200→1.92、错误尺寸/PPU/引用/相对路径拒绝、溯源与冲突、稳定序列化、Prompt不改变规范，先运行记录失败。
- [x] 实现 core/schema.ts、resolve-spec.ts、render-codex.ts、task.ts；按上述接口从同一规范输出 README/spec/style/plan/prompt/checklist。
- [x] 运行核心测试并记录通过；不将目标 output/asset.png 伪装为已有产物。

## Task 2：PNG 与真正 ZIP

- [x] 写真实 PNG/ZIP 测试并观察失败：CRC/损坏/缺图、重复/路径穿越、同名不同图保字节、清单与Hash、取消/同名/权限失败。
- [x] 实现 archive/export-zip.cjs 与自制 fixtures；采用本地锁定ZIP库和完整PNG解码校验。
- [x] 运行重新读包与受控解压验收；proof固定两图且不写原图。

## Task 3：复制桌面基础与独立启动

- [x] 按选择性复制表取旧安全配置/IPC格式/token；新建 desktop/main.cjs/preload.cjs/index.html/app.ts/theme.css 和独立build/proof脚本。
- [x] Electron测试验证实际app/name/userData、新旧进程独立、网络被拒绝、renderer无Node权限、固定样例经IPC导出。
- [x] 构建/类型检查；在仅保留2D副本和自身依赖的目录运行proof及Electron，验证无../map_editor运行依赖。

## Task 4：收尾与审阅

- [x] 检查原398保护文件哈希、当前差异；更新FIRST_ROUND_CONTRACT/VALIDATION、项目任务/状态与当日日志。
- [x] 交付真实ZIP路径和已运行测试边界，停止等待用户审阅，不进入2DW-02。
