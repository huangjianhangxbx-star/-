# AL-01 M3：CR05A r2研究输入核对与冻结回报

2026-10-07；沿用AL-01唯一主计划与T01—T16，C01—C06仅为研究视图。实施冻结版本 `002396ce656331768e9677f68df2aa3ca4d95606`；M2 `ae999aa4bc94ef82afa8503cbbf00856ad45d196`。本轮只有文档/契约说明和冻结回报，运行源码、参数、测试均不改。

## 包与版本

指定目录严格6文件：清单自排除，其他5项大小/SHA全部符合；外附CR05A-cases.csv与包内相同。研究r2在13:32捕获“未取得AL-01实现回报”，不是当前原型没有实现。保留原报告与CSV字节及父OBS状态；在独立派生CSV另填实际原型列。研究包父sourceRefs的路径/SHA是其导航声明，本包未附raw，本轮没有宣称全部父研究已重跑。

当前M1“没问题，手感通过”；M2最新对话“AL-01 M2 攻防与成长循环已交付，试玩后角色没问题”是实际用户认可，限定对应版本角色/手感。M3修复及本次来源核对是工程验证，不自动变成用户/原作观察通过。主契约原scope仍残留“待M2/no M3”，本次仅纠正元数据并设说明revision；不改采用值。

## C01—C06与已有来源

| 视图 | 已核原型证据及边界 |
|---|---|
| C01 | kernel/world输入、OnCast近似接受、四段挥空推进；原页面单击/held；原型没有通用非零普攻cost或真实BeforeCast消费者 |
| C02 | Break/End/finish分开，move是真取消；闪避运动与无敌独立；旧危险寿命不等于未来事件；每危险接触SAMPLE不推广原作 |
| C03 | 僵尸两道Ready、真实伤害、严格硬度/打断、旧危险；attack具名事件已提取；原作横移挥空恢复片段仍无，单根不等全AI |
| C04 | 四池与格挡正反/错时/资源不足；初值/延迟等既有批准SAMPLE；不推无限续航或备用霜寒分支 |
| C05 | 付款在root Attack、成长在有效child hit；原主动保留，退款名义+2且夹上限；caster/root/wave门、退订与reset分列 |
| C06 | 原骨架/录音加载及原型反馈、暂停声音回归已有；原作实际播放/动态消费者/OBS未证，原型卡肉保留明确SAMPLE差异 |

详列见 [派生六视图CSV](AL01-CR05A-r2-comparison.csv) 与 [来源桥接](AL01-CR05A-r2-evidence-bridge.json)。CSV的sourceActual和originalDynamicComparison全部空白；prototypeActual写工程证据，不能填进原作结果。共享M3片段供多个视图引用，不计成六次原作实验。

a2（Dash/Hit缺time键、Break.2、End.2333）、a3（Dash/Hit.0333、Break.2667、End.3）与僵尸attack（Flash/Lock缺time键、Dash/Hit.5667）已由M1选定原束提取的Spine4.1.23 JSON支持；源束SHA、TextAsset导出SHA、animationKey和原events包括缺省标记写入桥接。a3与CR03-R04/SYN-16的静态坐标相符。冲刺攻击与盾冲前3/盾冲！也已存在于同一原型资源。只复看已有导出，不再Load/Invoke DLL或提取源束；不因父报告未核就重复取证。最大timeline作原型finish、事件string消费者的裁剪、真实原作ModelKey/Configure绑定、音效最终映射及OBS仍分开。

## 六种语义独立审计

1. 普通伤害：world.collide的每个Hazard.hit在接触后消费（无敌拒绝也消费）；不同危险无全局root去重，固定一目标没有多Collider模型。仅批准SAMPLE，不声称原作每段每敌一次。没有调用成长paid门裁决普通damage。
2. 成长首次门：HitEffects有效正伤shield-charge事件，key为generation限定中的caster/root/wave，target不扩退款次数；重复/多个目标夹具不是第二可玩角色。bus publish不扣HP，paid不重结算普通伤害。
3. 扣费：普通基础cost0裁剪，没有替换cost消费者；主动资源资格先检查，root release原Hit映射Attack扣charge/CD（MP cost0），有效命中不是付款时点。前取消免费/后保留成本是批准映射，非普遍原作退款结论。
4. 施法者/受益者：原报告限定Character.Inst全局小蓝；本原型按有效hit.casterId寻址资源，单可玩blue限定明确。这是架构适配，不把owner通用化称原作事实。
5. 取消：track.cancel阻止未来事件；a1—3/dash清自己的危险，a4/僵尸/盾冲按批准寿命；退订不删除世界已有危险。重置换代次、清状态/危险并退订重绑，M2反例/M3三重置证据复用。
6. 卡肉/音画：原CR02更正为a4 unscaled寿命.15、程度.045；当前原型既有a4寿命.045、scale.15（其他蓝.03/.15、敌.2/.5）。本次显式登记为实验反馈差异，未无依据重调已认可手感，也不再暗示.045是原时长。没有同步原作输入/片段，不报原作延迟毫秒或保真评分。

本次检查范围内未发现违反批准行为契约的新实现错误；发现旧scope元数据和卡肉差异记录不足，已仅补说明。未知消费者和明确SAMPLE差异不自动判Bug。

## 证据复用、冻结包与停止点

M1/M2 profiles、world/kernel/resources/abilities/成长模块在当前冻结版与M2一致；M3只有既有暂停声音一行修复。代码SHA详见bridge，包内freeze-manifest记录确切源码、测试、契约和必要日志SHA，不用单一旧HEAD代表工作树。新鲜定向6文件43逻辑通过（logic-check.log）；原M1/M2页面9项及M3最终2项复用匹配版本证据，整批组合截图超时保留，不机械重跑全部原作/RQ/主游戏。

主游戏M2 35/37、T035初始化波动/T036自然遭遇缺trace仍按现有validation明示；原作sourceActual空白，OBS0。录屏缺FFmpeg仍用事件/截图本机证据，不虚称音画录像。研究回报ZIP位于 `work/AL-01/M3/CR05A-r2/AL01_M3_CR05A-r2_研究回报.zip`，仅文本、契约、manifest与必要有限日志，没有原Spine/atlas/贴图/WAV/vendor/DLL、截图或全research；本机既有截图只作本机链接，不扩发布许可。打包与文件保护核验后按本任务GitHub main授权提交推送，无Gitee。

停现有AL-01 M3总体审阅点。没有凿冰、大斧、第二敌人/角色、全部RQ、CR06或主游戏融合；不发送另一线程消息，研究侧可自行取得本冻结回报。
