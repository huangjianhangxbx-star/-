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
