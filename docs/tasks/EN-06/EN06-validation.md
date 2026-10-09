# EN06 验证记录

## 逻辑与构建

最终完整受影响逻辑：109文件、1445通过、2既有跳过（共1447），`work/EN-06/full-unit-final.log`。初次完整回归108文件通过、1文件1项失败；原因是新场禁止自动手动技能的边界误覆盖旧Hunter闪现托管，已收窄至具名新架势World，原`companion-combat.test.ts`与EN06共31项先定向通过，再做上述最终回归。没有删除旧断言或调整黄金手感。

EN06核心7项包括可见准备危险、三条承诺/待生运输、隐藏落点不泄露、独立落点不依赖caster身体、双人独立扣弹与受控、隐藏集火成本、离手不启动手动RMB/E。独立落点用例先失败`source.pos`不存在，再由主面积几何修复。初次实现6项先失败2项，再补只读观察。

`typecheck-final.log`无错误；`main-build-final.log`与`lab-build-final.log`成功。Lab初次配置文件名误写，保留执行记录；按package.json的`vite.action-lab.config.ts`重跑成功。主构建既有大包警告保留。源码/新文件diff check通过。

## 自然浏览器与受控夹具

EN06六个不同自然剧本分段通过：可见扇形且诊断收起、R3连续双人、3/4/5正常速度击杀、四怪双弓自然六独立承诺及Shift回应、五怪Al归零后恢复步行、20次真实Reset。另两项当前普通探索黄金兼容通过：Blue41＋Yellow38同时就绪与Hunter四段[0,1,2,3]；Al四次原扣弹及独立装弹。自然输入无State写入，无H召回替代双人。

- `browser-second.log`：扇形与20次Reset通过；旧R3失败因Hunter站在后排、合法敌人攻击Al，不能包装成挡盾证据。
- `final-affected-browser.log`：普通双骨架/四段、Al扣弹、最终R3通过；当时尝试Hunter自然破势未观察到，失败保留。
- `player-control-observed.log`：五怪Al真实归零与恢复移动通过（36.9秒），`player-zero.json`记录before15/after0，来源僵尸2；`player-recovered-walking.json`记录真实步行。Hunter准备阶段具有原无敌/位移，重复准备不适合作被击破势剧本，未因此改参数。
- `six-arrows-response-final.log`：四怪场自然形成来自两弓的6个独立承诺运输，随后真实Z/Shift回应通过（21.8秒）；首次脚本读尚未创建的runtime报错，改为等实际初始化；Shift同样保留原动作解锁门，以真实重复按键等待合法输入。六箭截帧`four-six-committed.json/png`，不是逐2秒性能抽样拼成并发。
- `browser-first.log`：三、四、五怪实际键鼠击杀通过；20次Reset首次断言把首次地图预热也当作稳态，后修正统计分栏。首行18纹理/32几何，后20行83/95稳定，所有21行7份骨架就绪、实体0、Trace有界。不是逐帧GPU泄漏测量。
- `compat-browser.log`：选取14项、13通过、1失败；EN01入口/时钟、EN02资源404显式失败、XX、EN03三箭自然落空/Hit后杀caster仍落地/失视归位、原E/Shift/RMB、Al四弹装弹/主动、G取消/慢时钟与Tower隔离、Lab真实音频启动通过。

该1项失败是旧`ar05.spec.ts:5`要求伙伴旧`.spine.names.attack_01`，而AR06已改用`.reference`黄色原骨架；C2源码已经如此，本轮未改角色资源分支。旧用例保留失败记录；新`en06-compat.spec.ts`验证当前两原骨架和真实四段行为，不称旧脚本通过。两条既知T036历史`.evasion.charges`用例未作为本轮通过项；T036逻辑全回归及上述当前键鼠片段通过。

自然截图/JSON与fixture核心结果各自明确。EN04全面挡盾/背面/无敌/重复控制/DOT/慢时钟/TraceOFF为逻辑fixture，不能用自动逻辑代替新怪手感认可。资源原OBS实际动态结果留空。玩家黄金既有认可保留；新怪架势/群体读招、声音主观效果待用户。

## 历史文件保护

跑前备份的768份生成证据，完成逻辑/兼容回归后按原字节恢复，见`generated-restoration.json`；本轮兼容JSON/PNG另存`work/EN-06/compat-evidence/`。147份接手源码/规则/用户文件指纹按累计任务白名单核对，其余未修改；共享5份工程记录只附加本阶段块，发布时以HEAD＋阶段块构造Git暂存，保留其他未提交工作字节。

性能与最终发布见[性能记录](EN06-performance.md)和[交接](EN06-handoff.md)。本页不把原研究/工具改动、历史测试输出或素材二进制纳入提交。
