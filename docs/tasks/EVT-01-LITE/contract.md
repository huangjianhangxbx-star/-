# EVT-01-LITE｜异常回响契约

USER_CONFIRM：触发一次奇闻、Galgame式叙述和两个选择、不同选择对应真实结果。用户本条“理解并执行”批准有限实施与GitHub开发提交；附件其它原“未授权写入”是提案身份，原样保存。

SAMPLE：事件sample-echo-event《异常回响》、铁匣/低语文案、A团队实验缓回药1、B随身生命力10、黑底青灰/金灰细边和楷体叙述。不是正式剧情与永久平衡，用户审美/剧情体验待试玩。

IMPLEMENTED：
- 当前正式世界地点WorldPlace.sampleEvent唯一状态notStarted→offered→resolved，revision/choiceId；正常beginWorld初始化。Legacy/XX/具名样板不初始化。不写旧objective/mechanisms/cleared，QST/SUR无变更。
- 世界区原事件预留小按钮提供入口，日历/天气仍未实现。非交战、当前活实控、身体动作结束才可打开；UI另拒绝暂停、其它模态、瞄准/指令/物理held/文本/失焦。未来场景触发器可用同一Trigger接口，不做TileMap/新场景物体。
- EventRequest携worldId/visit/placeId/eventId/actorId/controlRevision/expectedRevision，Choice再加salvage/listen。纯query和接受事务分开，复核当前世界/地点定义引用、阶段和身份；offered新请求可重新打开但不重复递增/奖励，旧revision拒绝；resolved不得再触发或结算。
- A只给唯一团队药栈安全加1；缺栈可新建，重复/非法整数/溢出拒绝，不改变后备、优先意图、Y或经济账户。B复用credit及稳定事件rewardKey，只记随身+10和原rewards，重复键/溢出/结算失败不完成。两项成功后才记resolved/choiceId/revision，互斥一次。
- 叙述页两条竖排选项，选后同框结果页与真实增量，继续关闭。未选择Esc/关闭或失焦只收起UI，不发奖励，仍offered可重开。已选择入口显示已处理。同世界合法离区/继续保留，显式新世界未触发，刷新不存档。
- 对话自己的token只管可见性与身份，进度和钱不在DOM。打开前清物理held；捕获对话期间键鼠/焦点，关闭后在面板内按住的键需松开才可重新动作。controlModal、advanceTacticalFocus、effectiveTimeScale与simulationDelta显式接入open；选择本身可在该模态暂停中提交，速度设置不改写。

只一个事件/两种选择/一个结果页。没有立绘CG、语音打字机、日志回看、分支树、随机库/NPC/好感、建造/成长、剧情编辑器或长期存档。完成停用户试玩Gate。
