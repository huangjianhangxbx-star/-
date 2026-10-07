# AR03 角色化 BasicRuntime 零手感迁移

**Goal:** 仅Standalone己方Basic迁入共享Definition和唯一动作timeline，现两段/参数/输入/结果等价。
**Architecture:** basic-chain保留请求/资格/buffer/stage；basic-definition共享只读legacy定义和稳定profile映射；basic-runtime保存小型已接受动作，负责Release/MoveReady及Finish/Cancel。attackTimer保留旧资格权威，Runtime共源消费，不另倒恢复时钟；attackPending只为兼容投影。engine/releaseAttack/resolveHit权威不变。
**Tech Stack:** TypeScript / Vitest / Playwright / Three.js。
**Spec:** 用户批准AR03 v0.1，main@5cb9e488c30a472a729e01b4bcf0334271eb639b；最新设计聊天实际读取2轮，与附件一致。

接手：细则v2.1、AGENTS、AR01架构/迁移、AR02契约/覆盖/交接及T021/T035/T036相关路径核对。已有修改逐字节保护见work/AR-03/intake.json。brainstorming用于核对已批准架构，writing-plans按本任务指定路径组织，TDD先旧基线/RED。引用的superpowers执行技能未提供，由本线程执行；不安装新技能、不反复请求已批准设计。没有关键语义缺口须启动grill访谈。

## 范围与步骤

- [x] M0：生产改动前冻结玩家循环、AI/order、buffer/过期、目标变化、whiff、移动/闪避取消、出手后移动、切人、weight/snipe/reap/poison/dance的旧逐步gameplay和AR02 trace。
- [x] M1/M2：RED后建立Definition registry/profile映射与Runtime，真实start单一ActionContext，缓存accepted target/facing与四节点。
- [x] M3：engine仅迁己方Standalone Release，保留兼容pending逐步值；旧releaseAttack/resolveHit与basicRelease照原节点执行。
- [x] M4/M5：前摇取消统一cancelBasicAction，Direct切换不取消；AR02唯一start/release/cancel/finish。
- [x] M6：attackTimer唯一资格时钟，Runtime共源读取；pending不独立递减。交权威表与有限兼容边界。
- [x] M7：旧逐步等价、新Runtime失效边界、相关回归与正常键鼠浏览器smoke、双构建。
- [x] 文档/工程追加、保护核对、精确提交GitHub main；不推Gitee。

正式角色首版全部共享legacy-main-basic：两段、.25前摇、.12buffer、.45continuation；period沿原weapon/weight/recoveryScale/snipe，不固定恢复。旧AR02在windup release即记Basic finished；本轮按已批准Finish语义延后至身体周期结束，因此冻结完整旧trace并另外比较action/start/attack/hit来源投影；Basic生命周期单独验证不重复，不把这一观察语义变化称Gameplay差异。非Basic trace继续原样。

不新增正式角色拓扑/素材、Lab映射、RMB、资源/盾防、Projectile、消费者或EC11；不迁敌人/Tower。用户维护区、细则、规则原稿、冻结Lab与其它既有修改只读。完成停AR03，下一角色设计需用户决定。

状态：complete。

## 交付（2026-10-08）
共享legacy Definition / 稳定职业映射、唯一Runtime前摇/Release、共源旧恢复、缓存target/facing、统一取消/唯一终结已接入。buffer接受顺序保持原样，补齐覆盖前Finish。2196点新冻结等价与1808点AR02基线通过；90文件1286通过/2保护录制器跳过，6个不同浏览器用例通过，main/Lab双构建通过。消费者主体文本相同；5438旧路径及细则指纹保护，共享记录只追加且索引只HEAD+本块。契约/权威/等价/验证/manifest/交接见[AR03交接](AR-03/AR03-handoff.md)。原作实际结果留空，本轮停AR03，不启动下一正式角色设计；仅GitHub main发布。
