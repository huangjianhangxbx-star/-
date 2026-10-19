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

## B/C 包：项目级资产、试摆引用与单件 FBX（2026-10-19）

基于已推送的 A 包 `main@080af290` 继续在同一隔离工作树验证。没有把任何用户真实项目作为删除或迁移样本。源代码与协议细节见 [compatibility.md](compatibility.md)。

| 范围 | 验证 | 结果 |
| --- | --- | --- |
| v2 项目与场景严格校验、跨场景引用、路径拒绝、v1 不静默升级 | `node --experimental-strip-types --test tests/workshop-v2.test.ts tests/workshop-v2-migration.test.ts tests/workshop-v2-store.test.ts`，12 项 | 通过 |
| 2 场景×10 实例共享源、改源不挪实例、独立化、分类文件夹、整项目另存副本、外部改动拒绝、回收恢复、旧工程复制迁移与原 `releases` 字节保持 | 同上，真实临时文件事务 | 通过 |
| 新建资产、分类文件夹、保存/缩略图、单件 FBX 同名备份覆盖、试摆放置、独立化、资产/场景回收恢复、场景/资产/项目另存、重开、公共库两次拖入只复制一次 | `node tests/workshop-tool008-v2-ui.mjs`，真实 Electron 与磁盘读回 | 通过 |
| FBX 二进制与材质旁车、Blender 5.1.2 转换及重导入；0.25 米样本尺寸；同名旧版完整备份；未创建 `releases/` | `node tests/workshop-v2-fbx.test.cjs` | 通过 |
| 旧版 v1 项目管理和旧编辑/发布流程 | `node tests/workshop-tool008-names-ui.mjs`、`node tests/workshop-module-ui.mjs`、`node tests/workshop-workflow-ui.mjs`；旧 UI 脚本改为显式打开 v1 夹具 | 通过 |
| v1 存储、事务、最近项目回归 | `node --experimental-strip-types --test tests/workshop-store.test.ts tests/workshop-ipc.test.ts tests/workshop-recents.test.cjs`，19 项 | 通过 |
| 类型、构建、便携包 | `npx tsc --noEmit`、`npm run build`、`node scripts/package.mjs --target workshop`、`node tests/workshop-tool008-package-ui.mjs`；打包模块字节比对、EXE 启动并新建 v2 项目 | 通过 |
| 布局 | 实际 Electron 的 1920×1080、1440×900、1000×700 截图 `project-v2-*.png`；人工检查卡片、试摆预览、当前项目路径与操作入口 | 基本可用 |

缩略图和预览是自动生成的真实图像，但试摆缩略图只显示平面位置，不展示完整三维构图。真实项目长时负载、所有历史 v1 样本、团结端导入和用户手感仍未验收。旧工作流回归脚本会改写仓库内历史验证样例，提交范围必须排除其随机重生成文件。

## 项目资产浏览修正（2026-10-19）

Electron 回放 `tests/workshop-tool008-v2-ui.mjs` 增加断言：v2 模块页不显示旧 GLB/PNG 目录按钮，自动显示项目根目录；保存到分类文件夹后 `.xhmodule.json` 和预览 PNG 实际落盘，底部立即显示带图资产卡片和完整保存位置；试摆默认打开「项目资产库」，可见同一资产的预览卡片并放入场景。截图 `validation/tool008/module-project-assets.png` 与 `assembly-project-assets.png`。旧 v1 目录入口继续由旧版定向回归覆盖。

`npx tsc --noEmit`、`npm run build`、上述 v2 Electron 回放、`node tests/workshop-module-ui.mjs`、`node scripts/package.mjs --target workshop` 和打包 EXE 启动回放 `node tests/workshop-tool008-package-ui.mjs` 均通过。实际用户模型的辨识度及不同窗口下长期操作手感仍待用户验收。

用户 `12fbe8a` 截图触发的 v1 入口缺失复现：在真实 Electron 打开旧项目并进入模块编辑，旧 GLB/PNG 选择目录仍作为默认底栏，项目资产转换只能返回项目页查找。`tests/workshop-tool008-names-ui.mjs` 已加入模块页入口断言，先失败、修复后通过；同时检查外部素材库默认收起且可重新展开、未存模块改名先保存、转换创建 v2 副本并自动显示对应原生资产图卡，旧项目文件字节保持不变。截图 `validation/tool008/legacy-module-convert.png`。

原生资产右键定位：`tests/workshop-tool008-v2-ui.mjs` 在真实 Electron 中验证未保存资产的定位项禁用；保存后从模块页与项目页分别右键图卡，选择定位，拦截系统 shell 调用并核对被定位的绝对路径是项目登记的 `.xhmodule.json`；无效项目 token 被拒绝。右键菜单缺失时该用例先失败，接入后通过；截图 `validation/tool008/asset-context-menu.png`。
