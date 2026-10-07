# AL04 实施步骤

架构任务，用户v0.1计划及2026-10-07 Q1已批准执行。当前入口world.ts混合小蓝语义，需要一次有限抽离，不扩通用技能引擎。

1. RED：通过LabWorld安全角色选择验证实例ID/HP/三段/挥空/AttackEvent和EffectiveHit/翻滚费用无攻击/右键扣弹/装弹/Q运输和取消/Reset；已有87逻辑和25浏览器已全通过。
2. PlayerController以basic/secondary/mobility/active/cancel输入解释与step/updateAction/interrupted/resourceRows为接口；IsdaraController容纳原小蓝动作和资源，CannoneerController容纳新弹夹及火箭跟随。registry只在构造/Reset选择。
3. LabWorld只保留Actor实例、时间、moveActor碰撞、动作ID与beginAction、publishAttack、danger、Projectile、EffectiveHit、敌人集合和实际伤害/清理。旧blue/resources/nextStage兼容入口指向当前角色或小蓝专属运行时；新HUD读取当前controller的资源行。
4. 逐批GREEN：原小蓝回归→真实Basic对僵尸→独立翻滚与RMB→Q跟随共享Projectile并在落地生成独立子Action/爆炸。禁止每帧或各处按playerKind分支；模块间循环仅type import。
5. 页面增加安全Reset角色选择；新角色失败只禁新角色，不阻断旧版；原小黄骨架本机白名单加载；角色对应HUD/操作提示/只读诊断。角色切换停止所有输入和声音，第二角色不加载小蓝成长构筑。
6. 新行为测试及正常键鼠浏览器A–H；旧87/25回归，tsc与两个构建；视觉截图、缺资产降级、取消/死亡/暂停/速度/Reset身份日志。
7. 冻结契约、必要日志、来源差异和分层表；比较保护清单，更新任务/项目状态/当日记录，精确暂存任务增量并推GitHub main，不推Gitee。停用户试玩，不自动AR01/AL05。

页面沿既有动作实验台布局，角色选择与其实际资源最突出；炮筒弹夹使用四格读数作为本角色记忆点，原有配色/字体沿用，不重做整个页面。位移由模拟事件和transport驱动，HUD反馈短促、辅助标记轻量，无装饰性ambient动画。
