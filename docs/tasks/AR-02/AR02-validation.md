# AR02 验证与限制

基准 `62a0dc8df9f34c94616fdca2f9a3bb7c0bd41e9c`；Node22.14.0 / Vitest4.1.11 / Edge SwiftShader / Playwright。此轮验证旁路缝合，没有重调已认可参数，也不是原作动态消费者或OBS闭合证明。

## 最终证据

- 全量逻辑：`vitest run --exclude '**/*.spec.ts' --maxWorkers=2 --reporter=dot`，88文件，1252通过、1跳过。跳过的是受保护的旧基线生成器，不是缺失验收。新身份用例26项、等价场景12项；原有相关回归420项曾单独通过，已包含在全量中，不相加。
- 旧源码逐步冻结对比：11场景×2seed×81状态=1782，另正确guard毒刃夹具2seed×13状态=26；共1808状态。trace开/关投影都与旧哈希一致；仅排除新combatIdentity/combatContext/combatAttack，不排除旧HP、姿态、位置、pending/timer、chain、CD/counter、资源、耐久、订单/AI、impact/evasion/budget、RNG、nextId等字段。
- 最初poison夹具使用了不具有该技能的职业，保留原冻结历史；正确guard夹具从Git旧源码单独隔离生成，不用新源码自证旧基线。
- resolveHit旧主体逐字核对：除两处读取原eventId与applyPosture.applied标量赋值，主体不变。正文规范化SHA256见manifest的legacyResolverCheck。
- 浏览器AR02/T035/T036共30个不同用例：批次28通过、2失败；AR02修正重开后漏选Tower的测试步骤并独立通过；正常遭遇目标拾取在真实运行中存在坐标采样到G按下的移动间隔，测试重新瞄准/取消无目标轮盘后独立通过。最终30个均取得通过记录，但不宣称同一全绿批次。未注入HP、击杀、伤害或推进时钟。
- T036已有速度断言由即时读改为poll，等待既有下一RAF更新；DOM显示不代表缓存倍率已更新。正常遭遇测试只调整拾取/重试，不改main/input/AI。轮盘本来有tile回退，此次不修改其规则。
- AR02正常键鼠smoke：出发、空地LMB挥空、Space暂停、只读trace快照、Debug结束远征按钮、新副本、Tower携入/出发/放弃确认/继续/节点重入。T035/T036覆盖切人、移动、E/R/T、Shift、Aim、队友AI/战术、正常遭遇和小视口等现有流程。
- `npm run build`及`npm run build:action-lab`最终均通过（含tsc）；主包仍有既有>500kB提示，未以本轮扩展重构分包。Lab源码/素材没有改动。未做GPU/目标设备性能验收。

## 失败与修正保留

最早基线生成超默认5秒，生产修改前延长测试时限后冻结。最早新桥测试缺模块为预期RED。高并行全量曾1247通过/2失败：一个新增毒刃测试职业错误已修正；另旧经济长流程20秒在并行负载超时，隔离通过，最终maxWorkers=2全量通过。浏览器倍率时序及上述两次失败保留原日志，不将旧失败批次覆盖为全绿。完整本机原日志与保护清单在work/AR-02；发布必要摘要在validation-logs.txt。

## 工程保护与停止点

5438个既有路径逐字节指纹核对（含本来已删除路径），开发细则哈希不变。旧测试自动改写的4份历史JSON用匹配接手SHA256的备份恢复，当前新产物另存work/AR-02/generated-legacy-evidence。共享记录工作区保留原字节，只追加本任务；索引仅HEAD+AR02块。源码/测试/契约冻结哈希见AR02-verification.json。只发布GitHub main，不同步Gitee。无AR03/EC11自动执行；F01体验验收仍待用户，原作实际结果无证据保持空白。
