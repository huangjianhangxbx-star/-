# R1 → CL-01A 连续实施记录

2026-10-09，接手本地/远端 main@cc6e858。用户明确授权两份上传草稿按顺序连续实施，不在 R1 Gate 再询问。R1 是已有表现桥接的局部修正；CL-01A 是已有入口/授权/UI 的专项改造。两份批准草稿作为设计，局部推荐采用本轮可验收方案，不启动后续玩法。

采用 writing-plans 组织以下步骤，本会话顺序执行；所提 superpowers 执行子技能不在实际技能目录，不冒称调用。已核查真实 brainstorming、TDD/writing-good-tests、motion-design、frontend-design。保护快照 work/R1-CL01A/intake.json；无战斗源码冲突，工坊/人工区/细则/AGENTS/既有暂存不纳入任务。

## R1

- [x] 只读原 yellow/unit.json 与自然按住 A3 分阶段观测，记录全局倍率/模拟时间/trackTime/Hitstop。
- [x] 表现测试先红灯：A3 前0.4秒保持原采样；0.4后原尾部压到0.24秒并自然回待机（表现 SAMPLE），战斗Finish1.2667/下一套1.5167不变。
- [x] 独立 pure presentation 映射接 reference-spine41，仅Yellow a3；位移/受击/技能姿势优先，不搬动事件或原素材。
- [x] 单元、自然两场景/两视口逐阶段截图，R1收口后直接CL。

## CL-01A

- [x] 明确 sessionMode='exploration'/'legacy'；普通/与新怪具名路由使用正式授权，显式 ?legacy=1 / ?scenario=exploration / ?en01=1 / ?xx=1 为隔离开发入口，Legacy标识可见。
- [x] 核心负例红灯：正式会话拒绝旧抽卖/召影/影庭/塔防节点，不扣费/不改变队伍；newExpedition保留session权限并回探索。
- [x] 普通页预选exploration，伙伴来自原EXPLORATION_COMPANIONS；开场只显示伙伴/开始探索/过渡资源说明/帮助，不增加存档与新怪正式整合承诺。
- [x] 独立 ExplorationHUD 不实例化选中详情、牌组、抽屉；紧凑二人真实HP/虚血/架势/异常与DirectActor动作条；Z/G/F/E旧能力保持，原HTML HUD仅Legacy使用。
- [x] 正式Q/H/B/Tab/C/V输入无旧消费者；统一释放鼠标/键盘/模态/失焦/Reset，旧命令API防线独立。
- [x] 深灰石板#172125、墨灰#0c1317、暖灰#d6d2c7、黄铜#c8a86c、冷蓝#85b8c6、暗红#b56262；标题宋体/正文系统黑体/数值等宽。唯一签名是两人状态的主控菱形切换，战斗中心留空，微动80–160ms，尊重reduced-motion。
- [x] 默认入口/取消重开/两人Z与实际动作/旧键长按/模态/核心负例/G-F/六具名敌场/Legacy/缺资源提示/两分辨率浏览器验证；类型、主/Lab构建、全量回归。
- [x] 附加工程记录与规则对账、选择性GitHub main提交推送；未决主观手感与美术保留，停止CL用户验收，不Gitee、不关机。

## 验证与交接

技术交付，待用户试玩 Gate。原始资料与动态 OBS 不补写；新包没有宣称原作动态消费者闭合。

## 交付与证据

R1 来源：本机 work/AL-04/assets/yellow/unit.json 原事件 a3 Hit/Dash=0.1667、Break=0.3、End=0.4；可视动画总长1.2667，多个身体/披风轨道在End后继续缓慢归位。自然普通页与具名远程场的 .17/.30/.40/.60/.85/1.10/1.27/1.52 模拟秒观察记录了动作、Spine trackTime、倍率、真实/模拟时钟和轨迹；根因是原素材长尾被完整逐时采样，未发现独立a3播放倍率。只在Yellow Basic a3的表现桥接将0.4后的原尾部压到0.24模拟秒，再回原待机。0.24为本轮推荐表现SAMPLE；不改Source动画/Hit/Break/End、Combat Finish1.2667或下一套门1.5167，受击/死亡/特殊动作姿势继续优先。A1/A2与猎人均不改。

CL：新增独立session能力防线与 ExplorationHUD。正式普通 / 先选原名单一名伙伴，再开始探索；携入/兑换置于“过渡测试资源”，零携入合法，不宣称永久存档。账号页不展示旧塔防战场。原地图、结算与双人死亡/复活保留。新版 HUD 两名 isPartyBody、controlledBody 高亮，真实生命/虚血/架势、异常和离手G指令；动作条按当前主控生成普攻、副动作、机动、主动以及实际CD/弹数/次数与不可用状态，不造体力/QER/CV。

正式路由：普通 /；原 ?enemies=v2&mode=zombie/ranged/mix/three/four/five 具名开发场同样用正式能力/HUD，显式可见“非正式怪物整合”。Legacy只有 ?legacy=1、?scenario=exploration、?en01=1、?xx=1，显示历史夹具标签；xx-preview.html 与 action-lab.html 原独立入口不改。普通暗牢还没有整合全部新敌人，不能把具名测试当成正式地图已换代。

正式 Q/H/B/Tab/C/V 在唯一键盘入口提前退场（包括repeat）；旧UI树不实例化详情、抽屉、召影与牌组。核心session门拒绝 party、collect/extract/rescue、clone/destroyClone、draw/autoDraw/sellCard/card、start/deploy、旧enter/rest/continue/探索节点、abandonBattle/safeExit/selectScenario、Tower selectJourney及xxExperiment。拒绝发生在消费/队伍变更前；当前探险出口、abandon、新开会话、篝火/资源交互仍走原消费者。G集合保留，与旧召回不共用；Z/F/WASD/LMB/RMB/Shift/E和非原生伙伴已有E/R/T过渡技能保留。禁止节点防线不是强行删除共享伤害、加载或经济底层。

暂停、帮助、取消、失焦/隐藏、重置统一释放物理输入与捕获，防止 held/guard/prepare 漏到下一会话；没有新增逐帧事件监听。旧代码回调作为Legacy共享底层继续保留，不声称CL01B深清理已完成。HP与动作区域使用可替换独立容器，为后续NR/QST/CB/EQ/SK留接口；后续要显式新增机制合同/状态，而非让旧影体命令回流。

## 验证结果与限制

- R1原始红灯与实现后红灯分别留档：缺模块、身份映射不能压尾；完成映射后39定向通过，修前/修后各两条自然浏览器通过。CL权限负例先16项红灯，补start/deploy边界再2项红灯；UI原页缺“开始探索”红灯。最终23新增逻辑用例、60定向通过；全量112文件1490通过，2项既有录制用例跳过。
- 类型检查、主构建和Action Lab构建通过。主构建仍有既有大于500kB包体警告，未为此越界重构。
- 15种真实浏览器用例全部取得通过（最终主批6、补充回归9），最终UI小修后再跑两档首屏/双人及Legacy3项通过。涵盖1440×900/1280×720、Z真实身份/右键扣弹/F/G、Q/H/B/Tab/C/V按住/松开、真实Space清LMB、help退出、结束取消/重开、六场/Reset、原生完整连击门/暂停/0.1×轮盘、双向G与自由AI实际Basic目标。
- CL第一轮3/4通过：测试保持LMB捕获时调用help.click，事件仍送战场，帮助未打开；保留失败日志，改真实Space暂停释放后松键再点帮助，未删原断言。额外实际新建浏览器页触发blur，方向格挡清理通过。
- 人为阻断Spine4.1网络加载时，正式页可见错误，未当作正常原模型或隐式占位通过。五怪20次真实Reset（代次+20），ready视图数量、第二次起纹理/几何数量稳定，实体清零、日志上限与无pageerror通过。仅证明这些短程计数，未测GPU耗时/长程浏览器堆或全部监听内存。
- 旧黄金JSON及767个历史已跟踪输出已按接手快照逐字节恢复；EN06当前浏览器输出另存本任务后恢复接手版本。G01权威browser-final保持原样，本次重跑单独归档；既有人工区、工具、细则、AGENTS、并行暂存与工作内容不纳入提交。选择性GitHub/main，禁止强推/Gitee，未关机。
- [冻结证据](R1-CL01A/frozen-evidence.json)；日志、时序与两档实拍在[R1-CL01A/validation](R1-CL01A/validation)。全量既有基线录制跳过与过去未修失败不冒称重新通过。

本轮主观小黄收尾/新HUD/双人操作仍待用户试玩确认；不自动进入NR-01/QST-01A/CB-02等下轮，不新增地图、工坊或渲染资源。

发布前 diff --check 查出8个归档日志的行末空格/结尾空行，归档展示副本仅规范这些空白；原始运行日志在 work/R1-CL01A 保持不变，测试结果未改。
