# TOOL-005 Task2 项目事务与桌面 IPC

日期：2026-10-04。Task1与Task2实现完成，真实四工作区仍待Task3接线。

新增 `desktop/workshop-store.cjs`：选定项目根内多文件保存、读取哈希、写前复核、持久旧字节备份/事务日志、提交标记及重开恢复。拒绝绝对/越界路径、Windows流/设备名、链接目录、大小超过64MiB及大小写重复目标；使用项目队列与跨进程锁。`expectedHash=null`只允许新路径，不覆盖已有空文件。

新增 `desktop/workshop-ipc.cjs`：项目token与主进程登记的文档lease决定保存位置和读取哈希；renderer不能给保存任意绝对路径，也不能用自报哈希解除冲突。提交验证schema、身份、项目→场景→私有模块登记；缺失源阻止整个文件组。`main/preload`增加workshop命名空间，保持原来源/主frame校验、sandbox及旧API。`core/workshop.ts`与构建增加CJS出口。

## 实际验证

- store先6项失败，IPC先4项失败，再实现。补充恢复期间外部竞争测试，实际出现“未拒绝”失败后修复，避免删除外部新字节。
- 最终新增**13项**（store9、IPC4）；Task1+Task2新增42项、既有80项，`pnpm test` **122/122通过**。类型检查和构建通过。
- 独立子进程在第2个文件已重命名、第3个文件未写、未提交时退出23；另一个子进程恢复成功退出0。原a内容与哈希恢复，新增b/c不存在。
- 注入第2次重命名失败，原源恢复，新增登记不存在；保存中竞争保留外部字节，歧义恢复明确拒绝并保留日志。故障注入仅在测试进程，不成为产品入口。
- 真实Electron/Playwright经contextBridge与ipcMain完成项目/场景/空草稿三文件提交、重开一致、取消保留dirty/会话、外部冲突保护和绝对路径拒绝，**5项通过**。
- 旧UI回放首测因M1.2新增“厚度方向”与旧测试模糊匹配“厚度”产生歧义；仅给既有测试加exact定位后，实际绘制2格及撤销回放通过。
- 原145保护文件中142个字节不变；3个计划内文件main/preload/build增加新接口/出口。未覆盖M1.2既有未提交代码；Unity、原样本、用户工作簿未改。build产生本地生成物。

证据：[全套测试](../../自制工具/map_editor/validation/workshop-task2/all-tests.log) · [类型](../../自制工具/map_editor/validation/workshop-task2/types.log) · [构建](../../自制工具/map_editor/validation/workshop-task2/build.log) · [实际IPC](../../自制工具/map_editor/validation/workshop-task2/electron-ipc.json) · [旧UI](../../自制工具/map_editor/validation/workshop-task2/legacy-ui.log) · [恢复竞争失败反例](../../自制工具/map_editor/validation/workshop-task2/red-recovery-race.log) · [保护文件变动](../../自制工具/map_editor/validation/workshop-task2/protected-changes.json)。

边界：恢复无法确定文件属于旧/新版本时拒绝继续写入并保留证据，尚无用户可视的恢复冲突处理页；该情况未冒称自动修复。子进程测试覆盖进程突然退出，不等于断电/磁盘损坏认证。默认UI仍是M1.2；没有发布新便携包、运行FBX/Unity新流程或提交推送。

下一实现点：Task3独立模块会话、实际四工作区和原M1.2编辑能力接线；随后按计划推进装配、迁移和冻结发布。
