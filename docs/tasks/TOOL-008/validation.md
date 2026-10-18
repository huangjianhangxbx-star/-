# TOOL-008 验证记录

## A 包：项目管理（2026-10-19）

基线为 GitHub `main@3e75288ee4cb0a7e463bf163e68a8b4bb140e630`。在独立工作树和临时测试项目中实施；未直接改写用户项目。原始计划见 [plan.md](plan.md)。

| 范围 | 验证 | 结果 |
| --- | --- | --- |
| 项目、场景、资产改名；未存草稿移除；保存资产回收/恢复；场景回收/恢复；最近项目重开；搜索/列表布局 | `node tests/workshop-tool008-names-ui.mjs`，真实 Electron、真实临时磁盘项目 | 通过 |
| 事务删除、回滚、进程中断恢复、符号链接及外部修改保护、被实例引用时拒绝无提示删除 | `node --experimental-strip-types --test tests/workshop-store.test.ts tests/workshop-ipc.test.ts tests/workshop-recents.test.cjs`，19 项 | 通过 |
| 模块与旧工作流定向回归 | `node tests/workshop-module-ui.mjs`、`node tests/workshop-workflow-ui.mjs` | 通过 |
| 类型、构建 | `npx tsc --noEmit`、`npm run build` | 通过 |
| 便携包 | 重新打包后 `node tests/workshop-tool008-package-ui.mjs` 启动打包 EXE，并核对打包内最近项目模块字节 | 通过 |
| 项目页尺寸 | 真实 Electron 在 1920×1080、1440×900、1000×700 截图并查看 | 通过基本布局检查 |

截图位于 `自制工具/map_editor/validation/tool008/`：`project-management-1920.png`、`project-management-1440.png`、`project-management-1000.png` 和 `package-home.png`。缩略图使用当前可编辑体素生成；超大资产有明确待生成占位。

删除一个保存资产时，原路径 `scenes/<scene-id>/assets/<asset-id>.json` 被同一事务移到 `.workshop-trash/<trash-id>/scenes/<scene-id>/assets/<asset-id>.json`，回收索引写入哈希与原路径。恢复读取并核对回收文件与目标路径，再反向事务写回。删除场景只移动该场景目录下的受管文件；`releases/` 不在事务范围。临时项目与临时 Electron 用户数据目录在测试结束时清理；用户真实项目未作为删除样本。

未通过自动验证替代用户手感：按钮可发现性、缩略图是否足够直观仍待用户试玩。A 包不包含项目级资产、旧工程迁移或单资产 FBX；这些属于 B/C 包。长期高负载、所有用户旧工程和团结运行时未覆盖。
