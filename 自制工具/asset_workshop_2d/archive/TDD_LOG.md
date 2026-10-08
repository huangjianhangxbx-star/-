# PNG 与 ZIP 导出 TDD 证据

范围：`archive/export-zip.cjs`、`tests/export-zip.test.mjs`、自制 PNG 夹具及生成脚本。未访问游戏资源、旧工坊、用户维护区，未提交推送。

已读取 test-driven-development 和其 writing-good-tests 依赖。现有批准计划按模块接口执行。

## RED

执行 `node --test tests/export-zip.test.mjs`：12 项失败、0 项通过。首项期望三个公开函数存在，实际 `undefined`，`ERR_ASSERTION`；当时尚未创建 archive 模块。其余真实行为测试因接口尚缺失败。

第二个安全补证：`node --test --test-name-pattern='dot segments' tests/export-zip.test.mjs`，1 项失败、`Missing expected rejection`。已存在的合法 PNG 经 `child/../reference.png` 路径被接受，证明归一化前必须拒绝点路径段。

真实 core 集成补证（Node 24 runtime）：新增 `resolveSpec→compileTask→exportZip` 测试，单测运行失败 `Text spec and authoritative spec disagree`。规范稳定序列化会排序 JSON 键，原来的字符串顺序比较错误；改为对象语义深比较，仍拒绝有值变化的文本规范。

manifest 字段补证：新增身份/版本/期待输出路径/参考意图测试，单独运行失败 `undefined !== fixture-task`。随后从唯一 spec 派生 manifest.taskId、assetSchemaVersion、presetId/presetVersion、adapterId/adapterVersion、expectedOutputPath、references（refId、role、packagePath、note、可选 priority 及既有图像事实），独立验包逐项对账；没有改写规范 JSON 来迁就导出。

## GREEN

实现后首轮 12/12 通过；追加真实路径段拒绝、core 集成及 manifest 补证后，Node 24.19.0 运行完整测试为 15/15 通过。测试包括完整 PNG 解码/CRC、损坏与缺失、预算、符号链接/父目录 junction、真实 ZIP 读取与受控解压、同名不同来源保字节、ZIP CRC/manifest/hash/规格引用一致性、不伪造未来产物、预取消与异步取消、模拟不可写输出路径、已有成品及并发同名无覆盖、真正 core 规范及文本编译的导出链、manifest 的任务与引用语义一致性。

固定预算：最多 8 图，每图最多 4 MiB、长边 4096，总参考像素最多 16,777,216；ZIP 压缩和展开各最多 32 MiB，最多 64 项。目标绘图尺寸由 core 独立规范约束，不混用参考读取预算。

发布：临时文件独占创建、同步落盘、原生重新读取独立校验，再同目录硬链接原子创建最终名称；EEXIST 绝不覆盖。取消/失败清理自身临时文件；已发布后取消会撤回自己创建的成品。

限制：当前异步取消不抢占同步 PNG 解码或同步 ZIP 压缩中的 JavaScript；将在下一检查点终止并避免最终产物。目录链接在每个阶段检查，未宣称跨进程恶意重定向父目录的 Windows 句柄级防护。本轮模拟不可写通过“输出路径是已有普通文件”的真实 ENOTDIR/EEXIST 故障，不代表所有 ACL 故障类型均已测试。
