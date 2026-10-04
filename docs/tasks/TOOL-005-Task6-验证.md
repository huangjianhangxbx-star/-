# TOOL-005 Task6 冻结 GLB 与不可变发布

2026-10-04，沿用户“持续实施，仅决策时停下”的授权继续。Task6 退出条件通过，下一 Task7。

发布页已接入真实场景/体素单件发布、显式版本身份、取消和经文件闭包校验的历史。发布前要求保存草稿；主进程从已登记磁盘源读取，记录实际输入 hash，构建期间立即复制冻结内容。发布与保存分离，旧包不会随草稿、公共源或材质修改而更新。

`payload/source` 保存制作源，`payload/runtime` 移除编辑参考并使用冻结 revision/contentHash 绑定；`output/target.glb` 是实际目标，每个模型依赖另有 GLB。manifest 登记每个源/输出文件的路径、hash 与长度。contentHash 仅由制作依赖的规范清单计算，不包含输出，避免自引用或 FBX 转换改变绑定。

GLB 共用原静态组合器内部实现，旧 exportSceneGlb 仍验证旧地图。新场景无旧 terrain 支撑要求；保留隐藏组与独立实例节点，共享模型数据。源 Root 只减一次，PNG 模块参考不进入 GLB/runtime；水平美术贴花 PNG 内嵌。外部 GLB 增加扩展、buffer/accessor 范围、引用、节点图与图片依赖检查。

发布先在本项目 `releases/.staging-*` 写入并同步文件，校验实际闭包与输入，再同盘 rename 成 `releases/<publishId>`。已存在身份拒绝。取消/失败清理本次暂存，转换返回前不会删除其工作目录；子进程中断留下的目录不进入历史，死进程锁可恢复重试。Windows 暂时文件锁在提交阶段有限重试，每次仍检查目标不存在与取消信号，不覆盖旧目录。

## 验证

累计 **174/174** 核心测试、类型与构建通过。新增 16 项覆盖冻结边界、Root/参考排除、隐藏分组/共享几何、PNG 内嵌、缺源/错相位/不支持扩展/越界/节点环、全部 hash、内容绑定与 runtime 一致性、重复 ID、取消/输入变更、转换失败、进程退出恢复、后续真实文件写入失败和短暂 Windows 文件锁。

实际 Electron：十一实例墓室导入 PNG、复制贴花、保存；发布场景 A，逐文件核对 hash，并从目标 GLB 内直接提取图片字节与导入 PNG 对比；重复 ID 拒绝；修改草稿未保存时拒绝发布；保存后发布 B，A 的 GLB 字节不变；单模块发布；重开后验证三版本历史。PNG 注册→复制→保存→GLB 内嵌→发布 hash 的 Task4 联动要求已完成。二进制和旧图迁移回放仍通过。

证据 `自制工具/map_editor/validation/workshop-task6/`：all-tests.log、types.log、build.log、publish-ui-result.json、publish-ui.log、publish.png、published-project、store-tests.log 与各 red-* 日志。中断用真实 Node 子进程退出 73 后在另一调用重试；转换失败测试使用受控 runner，不记作 Blender 通过。实际后续输出写入失败由超长文件名触发，没有填满用户磁盘来模拟空间耗尽。

复跑 `pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build`、`node tests/workshop-publish-ui.mjs`；针对性 `node --experimental-strip-types --test tests/workshop-glb.test.ts tests/publish.test.ts tests/publish-store.test.ts`。

## 边界

本阶段完成 GLB-only；新 FBX/Blend 转换在 Task7。GLB-only 外部模型的 Unity 绑定明确为 unsupported-glb，Task8 Reader 必须拒绝并提示 FBX 路线；原生体素和 PNG 可使用独立 runtime。新 Unity 接收、包装升级与新便携包尚未完成。旧入口仍为默认，本任务未提交推送。

历史只列通过完整闭包校验的版本，损坏/半成品目录不算有效发布。发布原始文件仍是可访问的本地文件，手动删除/改写会失去校验资格；“不可变”指工具没有覆盖更新旧发布的操作。大型场景与长期性能尚无承诺。
