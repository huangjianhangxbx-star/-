# 2DW 第一轮验收 · 2026-10-08

已完成2DW-00/01及未来04/05的最小纵向样例，停止等待审阅。当前ZIP只有任务文本和两张自制夹具，没有目标图片；两张32×24 PNG不代表最终素材风格。

## 基准、范围与保护

接手时本地main与GitHub main均为1b0ca76a3bcab3f8b2da22a84ba7dbabc20b3fc8，工作树已有727条状态。本轮未commit/push/reset/clean。收尾时HEAD已由并行AR06任务推进至ae4613c16436433be964209c5fbb128a388c639f；比较两个提交，本轮新旧工具、AGENTS与开发细则没有差异，未构成实施冲突。

新代码仅asset_workshop_2d；项目任务单、状态与当日日志仅追加本轮记录。未修改游戏、Unity工程、用户维护区、开发细则或原作研究文件。

保护基线在仓库work/2dw-first-round/protected-before.json。**398/398指定保护文件SHA256一致**，含旧重要源码/package/build、四个发行目录的EXE/asars/版本配置及必要稳定配置；结果validation/protected-after.json。没有把浏览器缓存、日志、整个旧profile所有易变文件都算作哈希保护；并行启动只会产生正常运行缓存。旧最近项目/主题/草稿不由新应用读取或写入。

## 实际运行环境

Windows、Node24.19.0、pnpm11.25.0、Electron44.5.1、TypeScript7.0.2、esbuild0.28.2、fflate0.8.3、pngjs7.0.0。自身锁文件与依赖安装有效；运行时缓存复用的具体范围见COPY_SOURCE_MATRIX.md。

## 已执行验证

| 检查 | 真实结果与证据 |
| --- | --- |
| 单元与模块集成 | **51/51通过**，validation/unit-tests.txt；含100默认、200覆盖、3.84/1.92、非法PPU/尺寸/路径/引用、硬约束冲突、确定性与自由数据边界 |
| 类型、构建 | 均exit0，validation/typecheck.txt、build.txt；独立dist输出 |
| PNG | 完整PNG解码和CRC、尺寸/字节预算、缺失/损坏/同名不同源/重复ID/父级junction与点路径拒绝，源字节保持 |
| ZIP | 真实压缩、中央目录/本地头/CRC、manifest全包SHA与长度、spec引用/身份一致、路径穿越/重复/缺图/伪装目标拒绝 |
| 失败保护 | 已取消、写入中取消、模拟不可写路径、已有同名与并发同名；原成品保持、临时文件清理。未声称做了真实系统ACL拒绝实验 |
| Electron实际窗口 | 身份/profile、无renderer Node、2图加载、HTTP探针未到达本机服务、浏览器context离线仍可检查/导出；重复按钮导出报EEXIST且原ZIP字节不变，validation/electron-smoke.json |
| 新旧并行 | 新PID42312、旧PID40732，旧便携M2.0自己的.cache/desktop-profile；新自己的.cache/asset-task-2d-profile。本次创建的旧实例退出后新窗口仍可响应，两者最后正常退出。没有终止既有用户进程 |
| 独立副本 | validation/isolated-project仅复制新项目文件，以自身锁离线安装21包、0下载，独立build/typecheck及实际Electron导出通过；证据其validation/electron-smoke.json |
| 独立解压审计 | Python zipfile + Pillow复核9条目、CRC、8条manifest长度/哈希、2原图字节、引用/默认PPU与派生尺寸；validation/independent-zip-audit.json及proof-extracted |

初次隐藏窗口截图超时，导出已成功但该轮不计完整UI通过；产物保留于proof-output-hidden-attempt。改用可见窗口后重新完成整套烟测，截图validation/electron-export.png。没有通过忽略截图错误冒充成功。

集成时实际发现并修复：规范JSON属性顺序不同误判不一致；manifest缺少任务/版本/参考身份；文件系统点路径段绕过预期检查；极小正PPU导致派生Infinity序列化为null。均先观察相应测试失败再修复，核心与archive各自记录保留。末项只改变非法输入处理，正式固定样例字节未变化。

## 审阅实物

ZIP：`validation/proof-output/2dw-proof-codex.zip`

SHA256：`1f90a6b529c54cf3bda2fe9f1f90221fb19025b99ad113ca846aa325e663e504`

九个文件：README_开始阅读.md、manifest.json、spec/asset-spec.json、spec/style-profile.md、plan/production-steps.md、prompts/codex.md、validation/checklist.md、references/content/content-01.png、references/style/style-01.png。

manifest逐项记录其他8个文件，自身不做递归哈希；ZIP整体哈希由包外报告记录。源绝对路径不自动写入规范或manifest。Prompt区分唯一规范、参考角色、低优先级自由需求与执行边界，图像能力缺失时明确停止；本机没有调用生图工具。

## 未覆盖与停止点

没有完整表单/参考管理、2DW-02、预设引擎、拼接、AI API、裁切、去底、Unity导回和便携EXE。本轮没有正式图像生成或最终美术验收。无缓存机器的依赖首次下载、目标设备长期性能与恶意并发替换文件系统目录不属于本次证明范围。当前无覆盖发布使用文件系统hard link，非支持文件系统应明确失败并保留已有成品。

请审阅规范字段、Codex指令和ZIP组织；审阅后再决定下一轮。

## GitHub 发布授权（2026-10-08）

用户在首轮交付后明确要求“推送github吧”，授权提交并推送GitHub main。本次发布以ae4613c16436433be964209c5fbb128a388c639f为父提交，仅纳入独立2D工程、本任务单和共享记录中的2DW块；其他未提交修改保留，Gitee不操作。

GitHub审阅样例位于samples/2dw-proof-codex.zip，保持原包SHA256 1f90a6b529c54cf3bda2fe9f1f90221fb19025b99ad113ca846aa325e663e504；samples/extracted提供9文件阅读副本。依赖、Electron运行时、缓存、dist、独立验证工程及整份本地validation不纳入提交。初轮“未提交”的描述保留为该阶段历史，当前发布授权以本节为准。发布不构成启动2DW-02的授权。
