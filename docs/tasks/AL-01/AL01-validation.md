# 当前验证：M3有限收口（2026-10-07）

基准 ae999aa4bc94ef82afa8503cbbf00856ad45d196，唯一任务AL-01。最新两轮对话与M3接续指令已读取；不重读整篇研究历史。接手暂存为空，本任务路径干净，16项输入SHA匹配；5402份既有文件、12份实验源码建立指纹。本轮不改基础细则、用户维护区或研究OBS。

| 栏 | 当前状态 |
|---|---|
| reference_contract | 已知配置/事件轨与批准的SAMPLE保持分离；M3未改变窗口、速度、伤害、几何或音效绑定 |
| asset_readiness | 原角色、atlas、贴图、三录音继续实际加载；3源文件、9导出资产和本地4.1.56运行时共13项SHA复核一致；原VFX未移植 |
| playable_implementation | 已认可的M2循环保留；仅修复暂停前接受、下一帧未消费的声音通知会在暂停后播放的问题 |
| automated_validation | 6文件43逻辑通过；原M1五项、M2四项通过；整批11项10通过/1组合截图超时；最终增强M3两项单独通过；类型、默认/独立构建通过；主游戏旧异常单列 |
| original_observation | 待完成；没有原作正常输入录像/OBS对照，静态配置与绿测不等于原作消费者或手感保真 |
| user_acceptance | M1“没问题，手感通过”；M2最新对话“AL-01 M2 攻防与成长循环已交付，试玩后角色没问题”已记录；只覆盖ae999aa的角色/手感，不覆盖M3新修复或原作OBS |

## 唯一验收ID与证据映射

下列沿用主计划AL01-T01—T16。逻辑测试会设置夹具参数验证边界；普通浏览器组合不注入HP、位置或结算函数。自动通过、已批准差异、待原作观察分别记录。

| ID | 检查与代码匹配证据 | 状态/限制 |
|---|---|---|
| AL01-T01 | readiness/assets逻辑；al01.spec.ts原资源就绪/缺失、独立请求 | 通过；本机资源前提 |
| AL01-T02 | world接受与输入身份、Break/End移动取消；普通页面普攻 | 通过；不等于原作移动消费者 |
| AL01-T03 | kernel边沿覆盖/期限/held；world松开及过期；旧页面挥空/焦点 | 通过 |
| AL01-T04 | world四段/挥空/连段；M2/M1七组回放复用 | 通过；M1核与reference/sample SHA未变 |
| AL01-T05 | m2/m2-edge闪避一次支付/重复拒绝/墙边无敌独立；页面Space；M3普攻接闪避 | 通过；闪避参数SAMPLE |
| AL01-T06 | m2/m2-edge正反方向、启动错时、资源不足；页面正反格挡、M3真实格挡 | 通过；角度/生效窗口SAMPLE |
| AL01-T07 | m2/m2-edge根Attack前后取消/挥空付款/实际命中回收；页面主动；M3导出根/父/施法者断言 | 通过；映射仍SAMPLE |
| AL01-T08 | m2-edge订阅清理、旧代次/多目标去重；页面构筑安全重置和3次重置 | 通过；只一个样本 |
| AL01-T09 | world候选距离通过而最终朝向失败；原页面僵尸普通攻击 | 通过；单根近战裁剪 |
| AL01-T10 | world Hit前打断/Hit后旧危险寿命、严格硬度；m2-edge取消子事件 | 通过；接触一次含无敌拒绝为批准SAMPLE |
| AL01-T11 | world实际扇区/位移；m2-edge墙边运动与无敌分离 | 通过夹具；非完整导航/障碍系统 |
| AL01-T12 | kernel跨事件一次；world低帧；m2低帧付款/命中、m2-edge 0.25倍钟 | 通过；未测所有硬件帧率 |
| AL01-T13 | 原录音+原Spine呈现；al01-m3.spec.ts真实WebAudio排队声音暂停/恢复/新普攻回归 | 通过工程绑定；原作映射/主观音色同步待OBS |
| AL01-T14 | 原页面失焦/重置；M2自然玩家死亡重置；M3组合胜利、3次重置、瞄准blur清理 | 通过；blur用浏览器事件夹具，非OS窗口切换录像 |
| AL01-T15 | 默认导入/构建与主src SHA未变；复用M2 37项报告、原Vite隔离对照 | 35通过/2失败历史保留，不能写主游戏全绿 |
| AL01-T16 | assets精确白名单、默认dist无实验资源、独立3文本壳；文本审阅ZIP | 通过；无素材分发许可扩展 |

## 一个真实修复与回归证据

旧entry在暂停时停活动声源，却未消费本帧之前接受的动作日志。真实WebAudio观察到：冻结呈现帧→Space接受闪避→暂停→恢复帧，仍启动1次声音。audio-red.log保留失败（期望0，实际1）。仅在pause函数同步logCursor到当前sequence，保留模拟状态与原日志，阻止暂停/失焦前的表现通知回放。恢复后无旧音效，新普通普攻仍启动真实声音；不把AudioContext mock成成功。

game/tests/al01-m3.spec.ts组合：普通左键→闪避→右键实际格挡→Q主动释放/回霜寒→普通攻击击杀→导出→三次重置→Q准备中blur→恢复不复发。导出断言付款-1、子action父/根等于支付根、退款在付款之后且仅一次、施法者blue、僵尸死亡。回霜寒实际只+1，因为先仅消费1且池上限3；不是把配置+2改成+1。截图combined-victory.png是原WebGL素材实际画面，无调色/HP注入。

日志位于work/AL-01/M3：audio-red.log、browser-final.log（11项：10通过、1截图超时）、browser-target-final.log（最终增强2项）、unit.log（43项）、build-main.log/build-lab.log、combined-round.json、event-summary.json、resource-check.json、protection-final.json。最终类型检查见types-final.log。录屏仍未生成，本机缺FFmpeg；按计划用正常操作事件和实拍，不虚称已有录像。

## 差异与不扩大修复项

| 分类 | 已知与边界 |
|---|---|
| 参考事实 | 原事件/Spine4.1.23、已保存配置；Active cost0/CD8/charge1、盾冲75、霜寒base3/恢复.8等保留来源 |
| 工程映射 | 原姿势/三音效与模拟钟绑定；4.1.56本机评估运行时，主3.8未改；原粒子尚未接入 |
| 已批准SAMPLE | 格挡±60°/.08s、霜寒初值3/恢复延迟2s、闪避2次/CD2.5、主动准备最长2模拟秒、命中几何/一次接触策略、原动作/音频消费者映射；本轮不自动调优 |
| 未知 | 原作输入延迟、完整消费者、复杂碰撞/AI与OBS保真；配置轨不是动态行为录像证据 |

## 实际架构收益和取舍

输入边沿/held期限、EventTrack、运动/防御来源、四资源池、HitEffects订阅及施法者/根/波身份提供可复用的小接口；成长与支付分离，重置取消订阅，不向UI暴露结算入口。world仍固定blue/zombie、单根技能、扇区+半径、一个场景边界，Spine方向与姿势也专属两角色；它是验证裁剪，不是通用战斗引擎。第二样本需重新审阅角色注册/能力策略及姿势映射，本次不提前搭建。

## 主游戏与审阅停止点

M2主游戏整批37项35通过/2失败：T035在prototype.scene初始化前失败，原Vite5175复跑通过，根因未闭合；T036自然遭遇缺结果trace仍未闭合。T036速度/RMB/resize/Tower在M2已通过，不能沿用M1旧失败说它当前仍失败。本轮默认src、T035/T036测试与M2一致，仅实验entry一行改变，复用版本匹配证据，不机械重跑重型主游戏全量。M2全量78文件1149项只作匹配历史证据，不能加本轮43重复计总数。

停在AL-01总体审阅点：M0/M1/M2/M3工程样板交付；原作OBS仍pending。没有第二样本、装备、主游戏融合、T037/EC11、CR06、迁移或Gitee操作。提交仅GitHub main本任务增量。审阅ZIP仅文档/配置/日志；不含原素材、vendor、DLL、PNG或整个research。


以下保留前阶段历史记录。

# 当前验证：M2（2026-10-07）

| 栏 | 当前状态 |
|---|---|
| reference_contract | 配置来源与M2缺项SAMPLE分开；2026-10-07用户明确允许M2 SAMPLE；不宣称原作消费者复原 |
| asset_readiness | 既有原骨架/atlas/贴图/3录音复用；原作源文件与9资产SHA全部一致；原VFX未移植 |
| playable_implementation | 闪避/自动冲刺攻击、方向格挡、四池资源、根准备/盾冲、首次有效命中成长已接入；M1基线保留 |
| automated_validation | 全量78文件1149项通过，之后新增缩放反例定向43项通过；最终类型/两构建通过；AL01旧5+新4页面用例全部通过，主游戏结果单列 |
| original_observation | 未执行；研究线OBS不改写 |
| user_acceptance | M1手感通过；M2仅SAMPLE实施获准，M2试玩待用户验收 |

M1前后七组确定性回放，HP/位置/连段/关键事件字段精确一致。原24逻辑和5页面用例断言保持。新增19逻辑用例覆盖成本/窗口/墙边、正反/错时/不足格挡、根Attack前后取消、挥空付款、施法者/根/波去重、老代次、清理、暂停/死亡、低帧与0.25×。

初次M2逻辑测试因缺少能力失败后实现。浏览器最初缺HUD/新绑定失败；真实连续格挡第三次因敌位移/转向不能维持接触，改为两次真实格挡→实际盾冲命中测试，资源不足反例仍由逻辑独立覆盖。构筑select焦点修复，新增操作不通过控制台改HP。

最终事件与截图：work/AL-01/M2/normal-round.json、native-guard/aim/return.png；精简事件进入同目录AL01-round-sample.json。录屏仍受本机FFmpeg缺失限制，交正常操作日志，不虚称录像。页面表意、声音绑定、诊断线为SAMPLE；原粒子、完美格挡退款、第二样本、主游戏融合、M3没有新增。

保护：接手5402份既有文件指纹已复核；历史四个测试生成JSON按精确接手SHA恢复；三工程记录仅追加M2标记块，索引仅HEAD+本块，不提交既有脏记录。源资产只读，分发白名单未扩展，主dist无AL01页或受限资源，独立构建只有3文本壳。审阅ZIP仅任务文本/配置/日志，不含PNG/atlas/骨架/WAV/vendor/DLL。无Gitee操作。

M2最终页面4项复跑全通过（1.3m），包括普通僵尸攻击自然击杀小蓝与重置四池，无HP注入。普通页面截图/导出无pageerror：成功两次格挡，HP100；盾冲后僵尸110→35，霜寒1→3；根付款在子命中退款之前，导出含父根与施法者身份。

主游戏与AL01整批37项：35通过/2失败。AL01旧5与新3全部通过，T036速度源本轮通过；T036自然遭遇仍失败，沿用历史未闭合项。新增T035失败实际发生在准备阶段prototype.scene未初始化，未进入AI断言；使用无AL01接口的原Vite配置5175单独复跑通过（10.4s）。只能记初始化波动与隔离对照，不能据此宣称主游戏全绿或根因已修复。主游戏src、T035/T036代码与本次接手完全一致，不放宽旧断言。

以下为M1历史验证。

# AL01 M0＋M1 验证

## 分栏状态

| 项 | 本轮状态 |
|---|---|
| reference_contract | 原事件轨与已保存规则可追溯；未知运行消费者按明确批准SAMPLE，未宣称全原规则 |
| asset_readiness | 两单位Spine4.1.23/原图及3原录音实际加载；原粒子VFX尚未移植；本机evaluation资源不分发 |
| playable_implementation | M1正常输入→动作→真实接触→HP/硬直/死亡→重置可玩；M2不在本轮 |
| automated_validation | 1130单测/类型/两构建与AL01五项浏览器通过；主游戏旧浏览器两失败单列 |
| original_observation | 未执行，不修改CR02/03A/04 OBS |
| user_acceptance | 2026-10-07用户反馈“没问题，手感通过”：M1试玩手感通过；不代表原作保真对照或M2授权 |

## 测试环境与命令

Windows/Edge SwiftShader，Node22.14.0，仓库现有依赖；起始main@8b002c7。697项既有差异及本轮未提交实现均在受测工作树，不能只用旧HEAD表示最终代码。

- game下 `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --no-file-parallelism`：76文件1130用例，50.90s。初次默认fork并发OOM，之后低并发完整通过。旧生成证据4JSON恢复到接手精确SHA，未提交重跑覆盖。
- AL01新增24逻辑/白名单测试：现实时间期限/held、事件越界、Break/End与真正cancel、挥空推进但零伤害、Ready两次检查、实际扣血/打断、已有危险寿命、严格硬度相等反例、敌人真实击杀玩家、重置代次、暂停、零时间。
- `node node_modules/@playwright/test/cli.js test al01.spec.ts`：最终全套5项通过。修复日志输入编号后，受影响逻辑/T035/T036共68用例再验通过。自然页面动作，没有给样板挂可任意改HP的测试全局。检查独立4.1加载，无main.ts/3.8请求、正常输入扣血、held击杀僵尸、重置、挥空、不复发缓存、按钮焦点WASD、blur和原资源缺失拒绝开玩。
- `node node_modules/typescript/bin/tsc --noEmit`通过；主构建及`--config vite.action-lab.config.ts`通过。Vite主包已有大chunk警告，本轮未为此重构。
- 独立包3个文本壳文件，无受限素材。主dist无action-lab页面及原资源4.1运行时；dev-only接口只有精确白名单，编码路径穿越/非本机地址/错模型/任意query被拒绝。

## 正常页面回放

本机 work/AL-01/playable-round.json：普通近身重置、鼠标指向/按住→有效命中→僵尸HP0→松开→重置，导出包含动作ID/输入ID/真实与模拟时间/角色/位置/HP变化/代次。native-ready.png与native-victory.png未经调色，是实际WebGL原角色画面。没有把固定HP或造结果当验收。录屏因本机Playwright缺FFmpeg未生成，按主计划允许的自动操作日志交付；不虚称已有录屏。

原声音来自release“匕首斩改”、hit“a击中”、hurt“人物受击”。初始化预载解码，首次手势解锁AudioContext；无接触不播hit，pause/reset/blur停止活动声源。death复用hurt的SAMPLE挂接，不是原作死亡音效映射已证实。

## 主游戏回归与边界

T035/T036及AL01首3共32浏览器：30通过，2旧T036失败；失败为S8 speed source/RMB/resize/Tower与S8 normal encounter。单独重跑仍失败。另启5175无AL01接口原Vite配置对照：1失败/1通过，speed source同样失败，normal encounter通过。因此速度源用例失败可在原配置复现；自然遭遇用例有波动，尚未闭合，不能宣称主游戏全绿。本轮独立实验源码未进入主游戏导入图。主游戏运行源码/T035/T036测试均没有本轮改写，不为使表全绿静默修改旧规则或断言。

## 保护与交付

原两单位源束及resources.assets哈希未变。用户维护/基础细则未改，既有551文件指纹复核无意外变化，README/项目状态/当日记录保留原字节仅追加本任务块。暂存策略：旧脏记录只暂存HEAD＋AL01块，其他旧增量留工作树。

审阅ZIP只包含本目录文档、contract/manifest/精简对战日志和本任务记录，不含PNG/骨架/atlas/WAV/vendor/DLL或整个research；没有同步Gitee。本轮M1试玩手感已通过，仍停在M1，未启动M2/M3或研究CR06。
