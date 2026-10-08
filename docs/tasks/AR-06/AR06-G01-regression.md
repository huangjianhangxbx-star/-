# AR06-G01 回归与既有失败

本轮受测game与5d77f90相同；当前33688da仅素材工坊和共享记录变化。没有修改游戏、旧测试断言或冻结合同。

## 本轮实际执行

工作目录game，Node22.14，Edge SwiftShader，1440×900，localhost Vite。命令日志位于ignored work/AR-06-G01/。

- `node node_modules/vitest/vitest.mjs run tests/ar02-equivalence.test.ts tests/ar02-combat-identity.test.ts tests/ar03-equivalence.test.ts tests/ar03-runtime.test.ts tests/ar05-golden.test.ts tests/ar05-combat.test.ts tests/ar05-boundaries.test.ts tests/ar06.test.ts tests/ar07.test.ts tests/t036.test.ts tests/companion-combat.test.ts tests/command-reservation.test.ts tests/exploration-control.test.ts`：**13文件257通过/2原有skip**，373.87秒。跳过的是历史基线录制入口，不改冻结基线。
- `node node_modules/@playwright/test/cli.js test tests/ar05-f01.spec.ts tests/ar05-f02.spec.ts tests/ar05-f03.spec.ts tests/ar06.spec.ts tests/al04-f01.spec.ts --output ../work/AR-06-G01/browser-results`：**26通过**，5.4分钟。含实际声音首击链路、原枪声替换、held/装弹、Lab真实两敌类型，F01/F03单身体、F02指向/切人/输入隔离与AR06两页。
- 普通页natural-playtest.cjs与encounter-playtest.cjs，键鼠实战，最终pageerror=[]。主自然枪击与格挡的主权威日志见dual-playtest；未将初始采集失败抹掉。
- 主页、action-lab、xx-preview HTTP200。音频自动证据是事件/音源；本轮用户另行给予RMB总体认可。

原工作树大量修改保留。游戏源码与6份保护文件SHA一致；原rozeul目录没有访问。没有构建代码变化，因此复用AR07相同代码的1352通过/2skip、TypeScript/Vite成功，不把它们计成本轮新执行。xx原Canvas解析及dispose证据同样注明复用。

## EC10四项：复用已取得基准，不重复制造通过

基准对照来自AR07只读main@ae4613c副本的baseline-results；当前同源game没有改动。本轮没有再跑整个EC10浏览器套件。

| 旧失败 | 分类 | 依据与未解决部分 |
|---|---|---|
| S4冻结非最近目标 | baseline_reproduced | 基准与AR07均失败，失败位置/加载时序有差异；完整原因未定，不写new_regression |
| S3 real Ability defense | baseline_reproduced / needs_test_adaptation | 仍读Al已移除evasion.charges；新Al使用独立rollCd，不据字段变化宣布全防御效果通过 |
| S7 Shift旧次数 | baseline_reproduced / needs_test_adaptation | 同上；原断言没有删除/削弱，不以新测试替它计green |
| S5自由/谨慎真实位移比较 | baseline_reproduced | 两版同失败，策略语义/夹具适配仍待专项定位；T036核心green不关闭此浏览器失败 |

new_regression：本轮未发现。并不等于全EC10浏览器green。曾有一次同键r加载失败复跑通过是历史瞬态，另与四项失败分开。

普通伤害去重、成长首次门、扣费节点、施法者身份、取消清理仍各依契约，不合并为通用命中规则。原作OBS/动态消费者没有由素材、技术测试或用户手感认可自动闭合。

可回交研究侧的精简冻结证据：[AR06-G01-evidence.json](AR06-G01-evidence.json)，包含基准、冻结合同SHA、玩家主结算日志、格挡与四弹循环及用户认可边界。originalObservedResult保留null，不把原型结果填成原作OBS。
