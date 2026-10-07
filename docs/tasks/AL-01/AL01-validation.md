# AL01 M0＋M1 验证

## 分栏状态

| 项 | 本轮状态 |
|---|---|
| reference_contract | 原事件轨与已保存规则可追溯；未知运行消费者按明确批准SAMPLE，未宣称全原规则 |
| asset_readiness | 两单位Spine4.1.23/原图及3原录音实际加载；原粒子VFX尚未移植；本机evaluation资源不分发 |
| playable_implementation | M1正常输入→动作→真实接触→HP/硬直/死亡→重置可玩；M2不在本轮 |
| automated_validation | 1130单测/类型/两构建与AL01五项浏览器通过；主游戏旧浏览器两失败单列 |
| original_observation | 未执行，不修改CR02/03A/04 OBS |
| user_acceptance | 待试玩，不自动通过 |

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

审阅ZIP只包含本目录文档、contract/manifest/精简对战日志和本任务记录，不含PNG/骨架/atlas/WAV/vendor/DLL或整个research；没有同步Gitee。本轮停M1用户试玩，未启动M2/M3或研究CR06。
