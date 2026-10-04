# TOOL-005 Task5 旧图副本迁移

2026-10-04。管理页新增“导入旧图副本”和“复制场景”。旧图原件不被转换打开动作替换；导入时将项目登记、场景、私有模块、二进制依赖、完整原文与报告交给同一项目事务。

地形保持原坐标、owner、保护列、色板和 PNG 参考，Root 为零。native 沿用母版 Root，位置按 `Told-R*旧instance.anchor` 补偿；external 按 `Told+R*(新Root-旧anchor)` 补偿。贴花保留尺寸/位置/旋转；旧 surface、event/registryKey 与未知字段在完整原文附件中保留，不声称玩法已迁入。缺源保留登记、位置和占位，并将原因写入报告。

复制场景为场景、私有源/色板和实例生成新身份，变换不变，复制旧原文附件。导入/复制前有未保存修改时要求先保存；项目被外部修改时拒绝写入。未执行旧支撑清理。

## 验证

本阶段 9 项新增测试，累计 **158/158** 核心测试、类型和构建通过。核心覆盖四旋转/不同旧锚点的非对称世界点、负坐标/保护/原文、PNG 参考与贴花分离、事件缺源、独立副本、事务与冲突、持久化诊断、FBX/材质旁车/嵌套贴图实际字节组。red-core、red-store、red-exchange-group、red-report 保存先失败证据。

实际 Electron 回放：取消无新场景；“遗迹双路”和 M1.2 assembly 的测试副本导入、进入装配页、复制场景、重新打开三场景；原文/地形/实例数量/身份与变换核对通过；两个原件 hash 一致。旧标签迁移回放与旧样例编辑保存回放通过。后者原固定笔刷色等于已有颜色会成为无变化操作；改为另一颜色并只编辑验证副本，仍断言实际 revision 增加，未放宽断言。

证据目录 `自制工具/map_editor/validation/workshop-task5/`：all-tests.log、types.log、build.log、migration-ui-result.json、migration-ui.log、migration.png、legacy-migration.log、legacy-sample-edit.log；migrated-project 是可打开的结果。

复跑：`pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build`、`node tests/workshop-migration-ui.mjs`、`node --experimental-strip-types tests/m11-migration-ui.mjs`、`node tests/m11-sample-edit-ui.mjs`。

## 边界

旧资产需从所选旧公共库按身份解析。原生源可转可编辑私有模块；外部 GLB/PNG 与既有配套 FBX/.xhmaterials.json/.xhtextures 字节组可复制。无配套 GLB 的独立 FBX、未知格式或缺源保留占位和报告，不伪造视觉；新 FBX/Blend 转换路线属于 Task7。旧非网格实例保留世界位置并报告相位问题，不自动取整。原文附件只追溯旧玩法，不提供新玩法执行。

Task5 退出条件通过。继续 Task6 冻结发布；默认仍为 Legacy，无新包或本任务提交推送。
