# TG-ASSET-REPLICA-01｜素材使用复刻与母件供给

2026-11-04，北京时间。执行依据为用户提交的《星骸_TinyGlade_素材使用复刻与母件供给验证_执行计划_v0.1.md》及“理解较新对话并执行”。用户随后要求避免重复此前两轮验证；本轮先复用相同游戏版本和已有证据，桌面暂不占用。

## 范围与依据

- 开发细则正文v2.2，相关AGENTS已核对；采用B级模块验证，限定本轮路线、素材接口和必要生命周期，不冻结无关文件或回放全项目。
- SB-03实际位置是 `work/scene-builder-lab/SB-03`；`tools/...` 是GitHub发布布局。原研究工程仍为 `work/procedural-world-editor/LE-01/project`，不创建新永久工程。
- 九份SB03生产代码与原工程逐字节一致，聚合SHA256为 `A97EA1E4175F9368BCDD199ABEF96A8A25981410CF52F3211C1C3D42E705C203`。原有作者保留；后续线路使用明确的新作者版本和显式旧桥导入，不静默改写旧作品。
- 游戏Steam build25804425；EXE SHA256 `4627EC9F9A8ABE03DD30751F6A8E22868E0DFDDF9F40029A1B848A3773495FE5`，与旧研究相同。旧版截图为v1.16.5a，尚未本轮重新在窗口查看版本。
- 对话接口返回访问校验，网页读取无正文；现有Edge窗口最小化且当前控制入口未能读取。不能声称已读最新对话全文。附件执行计划可完整读取，按它推进不受影响部分。

## 实施路径

1. R0/R1：定向复核旧研究与2—4个真实源件。严格分别标记原文件事实、原作实测、推断、我方实现和用户验收。
2. R2：先查是否已有等效受控几何替换证据；缺少时只准备最小独立Mod，不改安装文件，不把静态图谱/仅变色当因果证明。桌面未获当前可用时段前不启动实机占用。
3. R3：保存真实有限折线路线和稳定节点/路段身份，支持中间点/局部高度、续接删除和转角平台。开口只放合法水平直线路段。相同起终点不同中间路线必须得到不同结构。
4. R4：冻结固定接口族，第一套复用SB03源；第二套由只读制作规范的独立制作步骤产出不同几何，固定生成器基线只换素材/配置。工具计算哈希，提供检查、预览、采用、取消及保存。
5. R5：相关小集、独立重开、两套对照、必要真实键鼠入口；前台不可用的项如实记未执行。原作几何、其派生参考包及本机研究模式保持私有，不进入公开源码。

本轮使用writing-plans/test-driven-development进行计划细化和实现，工坊共享API制作自有源；computer-use仅用于必要的窗口证据。既定用户授权优先，不再按小阶段要求设计批准。

## 状态

R0完成只读定位与基线核验；旧图谱与报告不包含受控几何替换因果证据，G1仍待关闭。R1后台识别与R3线路核心正在并行推进。尚未整体完成，不把此前SB-03的合成事件和后台截图改称真实人工验证。

<!-- TG-ASSET-REPLICA-01-backend-20261104:begin -->
## 后台工具子集收尾（2026-11-04，较新状态）

**本轮整体仍为部分落实；本节更新前述“正在推进”的历史状态，不把工具通过写成原作素材使用复刻完成。** 用户质疑重复此前两轮验证后，本轮继续复用相同游戏版本、旧研究、SB-03来源消费和生命周期基础，没有重新占用桌面回放旧研究。附件计划可读取；ChatGPT较新对话正文未完整取得，不能声称已读全文。

计划来源：用户提交的 [执行计划v0.1](E:/迅雷下载/星骸_TinyGlade_素材使用复刻与母件供给验证_执行计划_v0.1.md)，2026-11-04；用户指令为“理解较新对话并执行”。采用开发细则v2.2的B级模块验证，不重建通用工具、不改开发细则或人工原稿。

### 已落实的原创工具范围

- 保存真正的有限正交折线路线、节点、路段和局部标高。相同起终点但不同中间路线产生不同结构；可移动中间节点、调整局部高度、续接/删除，转角使用平台与收边；合法直段可保留真实拱洞。
- 连续落笔形成一个线路作者；候选、采用、取消、原生Undo/Redo、导航及关闭工具行为经相关检查。普通保存、路线文件及A/B独立进程重开保留可编辑线路、套件身份、网格和碰撞；合成SceneView输入单列为合成验证。
- 两套自有工坊件与图解接口规范已提供。第二套8种实际使用职责的几何改变，在同一路线/标高/开口下只换素材及合法配置成功；换件前后生成器与接口规范指纹相同。此结论仅认证本轮固定接口族，不代表任意尺寸、任意格式或所有建筑的通用接口。
- 已把248份后续切片文件增量部署到原研究工程 `work/procedural-world-editor/LE-01/project/Assets/BridgeReplica`；11份相关保护源指纹一致，旧SB-03与A所有权保留，无新永久Unity工程。入口为“星骸 → 专用搭建 → 打开折线桥样例”；旧桥仍走旧入口。
- 桥底墙芯继续明确列为规则生成区域，不冒称工坊模板；B不自动挖改A地形。首轮限正交折线、最多32节点，固定母件尺寸；平滑曲桥、多跨、任意交叉网和复杂地形支承不在本轮认证范围。

当前受测生产源SHA256：`9C3AA3E11AC05B540E2960E2B33D9B149BDF0891C71F97FC68642DD15F6C4841`。A工作流、A重开、冻结基线换B及B重开报告均对应此基线；旧报告的其他源码指纹不代替本版本结论。

### 阶段门与剩余硬验收

| 阶段/关卡 | 本次状态 | 准确边界 |
|---|---|---|
| R0 | 已核对 | 同版原作、实际路径、旧成果和相关源；不重做全量基线。 |
| R1 | 静态事实与标记准备已落实 | 2—4件原始候选、属性保真及识别标记留私有研究目录；实际建筑角色仍须原作因果确认。 |
| R2 / G1 | **未通过，受控替换未执行** | 旧资料不等于几何替换因果证据；不能拿静态素材板或仅变色补写通过。 |
| R3 / G2 | **原创工具子集通过；R3整体部分** | 真正中间路线及可编辑重开通过；原作源件的私有参考消费路径及两组逐项对照尚未完成。 |
| R4 / G3 | **固定接口族技术换件通过** | 第二套仅换素材/合法配置，基线不变；风格和人工制作易用性仍由用户验收。 |
| R5 / G4 | **部分落实** | 后台相关检查、保存重开、性能与部署通过；实际鼠标键盘完整流程和用户试玩未完成。 |

**仍未完成：**原作中受控几何替换及两类参数变化的G1证据、已确认原作源件的私有参考消费模式、正常前台鼠标/键盘完成绘制—局部改高—换件—保存重开的流程。此次不占桌面，未把合成输入或后台相机图改称这些项目通过。只有三条均完成后，才可评估整轮素材使用复刻完成。

### 已有验证与交付依据

[工具说明](../../tools/scene-builder-lab/asset-usage-replica/README.md)；[核心规则](../../tools/scene-builder-lab/asset-usage-replica/reports/route-core-tests.json)；[合成输入](../../tools/scene-builder-lab/asset-usage-replica/reports/route-input-synthetic.json)；[冻结基线双套件](../../tools/scene-builder-lab/asset-usage-replica/reports/workflow-kit-swap.json)；[A重开](../../tools/scene-builder-lab/asset-usage-replica/reports/workflow-A-reopen.json)；[B重开](../../tools/scene-builder-lab/asset-usage-replica/reports/workflow-B-reopen.json)；[部署核对](../../tools/scene-builder-lab/asset-usage-replica/reports/delivery.json)。

[代表性性能](../../tools/scene-builder-lab/asset-usage-replica/reports/representative-performance.json)采用5次预热/10次采样：A解算/预览/采用P95为0.7738/20.2555/5.349ms，B为0.7356/21.7503/11.9454ms；同为620构件、10显示块，三角面A19020、B34068。它是实际后台主线程编辑成本，不是物理输入表现或屏幕FPS。

本次可发布范围仅为原创工具子集、工坊来源、规范与对应报告；原作JSON、派生图谱和待执行原作研究资料保持本机私有。提交/推送由主任务按AGENTS核对后办理，本补记本身不证明已发布。下一步先复用既有操作经验关闭上述具体证据缺口，不自动进入整屋或大规模资产制作。
<!-- TG-ASSET-REPLICA-01-backend-20261104:end -->
<!-- TG-ASSET-REPLICA-publication-20261104 -->
原创工具子集已推送并核对 GitHub main：4089ec3a5c409de3ee6826e86e284ca8bdb6f4ff。原作G1、私有参考消费与物理键鼠仍未完成，整轮保持部分落实。临时QA工程和编译缓存已送回收站，原研究工程及可编辑样例保留；未同步Gitee、未占桌面或启动游戏。

<!-- TG-ASSET-REPLICA-01-physical-followup-20261104:begin -->
## 获授权后的真实输入补测（2026-11-04，晚于上述发布记录）

用户随后授权最小前台补测。主任务通过CUA打开原研究工程，在Top视角点击“连续绘制路线”，以一次真实鼠标从屏幕(100,300)拖至(1350,1100)，创建新的5节点L形作者（修订1），可见转角、台阶与桥洞，旧样例仍在。该输入是对角拖动被规则正交化为L，不是手绘U形或任意曲线验证。

准备退出绘制时，工具报告用户输入；重读AX仍指向研究工程，但截图已是另一正式工程在前台。主任务立即停止输入并归还桌面控制，未继续移动中段、改高、换B、保存或重开。**新作者尚未保存，研究编辑器仍开着，不能关闭或声称已有新路线存档；原始样例未保存覆盖。**

G4保持**PARTIAL**：实际连续绘制PASS，剩余完整操作链NOT_RUN；旧A/B后台证据仍有效，生产源9C3AA3…不变。原作R2/G1仍未通过，不以这次绘制、合成输入或后台验证代替。现有公开包、README、代码与规范均未修改，本补记未发布。

[补测报告](../../tools/scene-builder-lab/asset-usage-replica/reports/physical-input-followup.json) · [说明](../../tools/scene-builder-lab/asset-usage-replica/notes/physical-input-followup.md) · [自有工程截图](../../tools/scene-builder-lab/asset-usage-replica/samples/physical-input-20261104/01-real-mouse-draw.png)。后续先确认未保存作者仍在，再完成真实中段修改、局部标高、换件、保存和重开。
<!-- TG-ASSET-REPLICA-01-physical-followup-20261104:end -->

<!-- TG-ASSET-REPLICA-freehand-gap-20261104 -->
### 用户反馈：硬折线路线未满足随鼠标延伸转弯的核心目标

用户明确指出当前原创桥被强制排成Z字形，不认可其等同Tiny Glade式连续智能搭建，并询问与未落地原作素材模式的关联。本次仅后台核查，没有占用桌面或改代码。

直接运行未修改生产RouteSketch.Build（PowerShell Add-Type加载纯核心，无任何套件加载）：输入(0,0),(5,5),(10,10),(15,15),(20,20)，默认高度0，得到(0,0),(20,0),(20,20)，偏离输入斜线最大14.142m。原因已确定：轨迹简化后强制X/Z分段，RouteSolver另拒绝斜向段；套件几何在结构解算之后才被读取组合。因此换Tiny Glade素材本身不会消除硬折，主体是当前路线/连接规则和固定接口族的实现限制。

原作参考消费模式也尚无实质实现：ResearchOnly只是显示标签；没有TG网格属性适配器、原作套件登记或消费对照。游戏内发现/启用Mod与私有静态识别不等于Unity里已经消费原作素材。R3/A3仍是实质开发缺项，不能只归因于真实鼠标补测未完成。

此前G2/G3只认证有限正交工具子集和同接口原创件换件。后续不得把连续采样、正交L形生成或后台预览通过写成用户期望的随笔迹自由转弯与智能拼接完成。改进验收应先验证笔迹与实际中心线走向一致、拖动中结构随路径更新、连接与内外侧边缘协调，再独立验证原作参考模式；本条是缺口记录，不宣称已实施新方案。
<!-- TG-ASSET-REPLICA-v02-execution-20261104:begin -->
## v0.2 纠偏执行（已获用户本轮授权，实施中）

用户提交《星骸_TinyGlade_随笔迹搭桥与原作素材接入_纠偏计划_v0.2.md》并要求理解较新对话后执行。此次已实际读取所链接聊天的最新完整答复，与附件一致。附件快照见 work/scene-builder-lab/asset-usage-replica/notes/approved-correction-plan-v0.2.md。v0.2取代正交折线作为绘制收口条件；不以继续补测代替功能开发。

当前工程使用 LE-01/星骸地编，旧project仅兼容链接。P0确认研究Editor未运行，正式ANKALUTE保持独立。沿用9C3AA3旧BridgeReplica与A97EA1旧SB03源，记录小范围基线；只用一个可回收临时后台验证工程，不增加长期工程。

实施与接口：
- [x] P0：固定W=2m、半径6m的代表性U/S及五点斜线，双向及沿程中心偏差目标0.1m；先记录旧生产真实失真红例。
- [x] P1A：新增CurveSolver/CurveSketch/CurveEdits，RouteDocument schema2以连续坐标控制点为唯一权威。CurveResult提供弧长Frames、实际左右边界和各自累计长度、稳定Span与直段Opening。schema1继续旧求解，显式另存转换。
- [x] P1B：ResearchKitImporter.Import(源目录)解析真实TG源的索引与全部通道；私有Mesh资产/兼容材质进入ResearchPrivate，三职责实际参与，同一kit明确标注继承A的其余职责。源码适配器可公开，原作数据与派生几何不得公开。
- [x] P2：CurveGeometry.Build(CurveResult,ReplicaKit)沿路径构建连续铺面与支撑；两侧分别分配栏杆/柱距；柱与装饰保持刚性，结构模板的受控弯曲/余量为v2使用契约，不暗改v1固定母件约定。直段洞口与可见碰撞一致。
- [x] P3：共享ReplicaSession事务，按版本派发旧/新生成。新版实际绘制、端点续画、自由中点与高度编辑；新格式保存重开，旧样例不静默改形。缺失研究源失败保持有效桥，不伪装回退原创。
- [ ] P4：针对T1—T11的最小相关验证；来源受控变化、A/B同路线、失败恢复、保存后独立重开；实际鼠标与原作使用行为分别记未验/通过，不用合成输入冒充。当前仅后台，桌面另按有效可用时段集中进行。

采用开发细则v2.2的B级模块验证、writing-plans/TDD及已批准设计的brainstorming边界核对。人工原稿和开发细则不改；不再制作第三整套原创件。完整功能、真实输入、源消费与原作行为对照全部有证据前，整轮不标完成。

后台证据已落盘：CurveCore15项，实际斜/C/U/S与A/B桥面2460射线无漏、真实直段洞口和旧版形状指纹保持；Window输入API在松手前连续28次显示真实结构、最后预览=提交、同作者续画/一次Undo/导航保持；生命周期5项与独立进程原生Mesh重开通过。精确14m直线复现0/0.5m偶数舍入跳阶，已改为明确0.25m步高，并以真实碰撞顶面Red→Green验证。拱脚局部180°朝向保留，下行踏步鼻口朝下。对应公开报告见工具reports/v02-*。

原作三件源JSON确实进入持久Unity Mesh与桥中tread/deck/rail片段，兼容材质保留UV0/颜色、形变后重算法线，其余源属性归档，不称原着色器已恢复。导入16项、实际片段受控顶点变化36项、独立进程原生研究场景重开4项通过，原作数据/派生图与网格全部留在本机参考游戏研究和ResearchPrivate。六种其余职责明确继承原创A；这不证明原作内部消费规则。

研究隔离有真实边界：工具作者/场景保存及Bake能拒绝公开位置；实际依赖闭包连公开目录伪装研究kit、清ResearchOnly后仍依赖研究Mesh的场景也拒绝导出。直接Unity原生SaveScene会绕过sceneSaving异常并写出场景，本项实测FAIL保留，不宣称原生另存绝对拦截。公开交付必须按实际闭包白名单选择，不能只按ResearchOnly标签或原始JSON名过滤。

用户在后台开发完成后明确选择“先完成后台交付，桌面实测稍后进行”。T3真实鼠标与T11原作构造母件使用行为对照记为deferred_by_user，本轮不启动游戏、不占桌面、不休眠。旧实机图缺少可判读台阶长度/标高提交变化，不能替代T11。P4仅后台部分通过，整轮保持部分落实，部署及公开交付另以本轮delivery报告为准。
<!-- TG-ASSET-REPLICA-v02-execution-20261104:end -->

<!-- TG-ASSET-REPLICA-v02-published-20261104 -->
v0.2后台阶段已增量部署到星骸地编，302份旧SB03/场景保护文件核对保持，未替换旧meta。公开包511项逐字节解压校验通过，SHA256 4C022BDA100A214B97E501B132B1826E33CFD80DC5D6C104398F84E9DDDBBB8D；旧v0.1包保留。GitHub main已选择性更新并读取核对：8a3db2137e356c7983368eb075743d498d8a5f2d（149文件），未改真实工作区HEAD/索引、未推Gitee。原作数据和派生产物不公开；新ZIP本机交付，GitHub提供对应源文件。T3/T11由用户延后，整体仍PARTIAL。

<!-- TG-ASSET-REPLICA-drawing-fix-20261104 -->
## 用户试玩后：普通绘制失败与接续分段修复

用户指出十次常有九次失败、只能画一小节、续画产生独立段。本次按diagnosing-bugs/TDD做B级相关模块验证，先复现再修复，不把旧理想U/S API通过当真实可用性。

未改生产时，固定10条密集笔迹仅6条最终到达；3cm抖动r6弧125次只有1次接受，留下0.52m；无噪声45度三点路线也被误判边界自交。真实Engine端口反馈环2PASS/6FAIL，首端、错选、无选、高端放大视图均可错误新建作者。根因是逐中心站法线偏移与单个角点miter突变造成假自交，原始抖动直接进入严格曲率检查，以及续接只认当前作者末端且12px/0.6m命中标准不一致。另有无候选失败复用旧成功提示。

已修复CurveSolver、CurveSketch、ReplicaWindow三文件：先按作者几何角点求两侧边界再重采样；仅新笔迹在原始输入双向0.08m预算内消化抖动/局部拟合，保持真实首尾与严格几何校验；同一端面解析支持可见自由桥首尾及目标kit，Prepend/Append保留原作者/节点/开口；桥身不静默退地面新建，场景内显示端面和失败原因。

最终：旧15核心PASS；固定10及专项PASS；24普通噪声+8条5cm压力均到真实末点；实际Window/Mesh12组18项PASS；SceneView Hit/合成SceneGUI10项PASS；两处接缝198条射线、45度转弯63条射线、12/14m步高与原生独立重开PASS。后台API预览P95约13—24ms，仍不冒称物理鼠标试玩已验收。

已按用户明确“不需要保存，只是随便尝试一下，关掉就行”关闭并丢弃研究Editor未保存试玩；未占桌面。补丁已部署同一星骸地编，源码SHA256 9ADDDAC98149C4BBDA2E188551744517E10DFCB68BD86EB5706A87C08D01F5F0。只替换三份源码，旧GUID、场景和套件资源保持。只支持首尾延伸，不宣称桥身分叉或两座既有作者路网合并。物理试玩及T11原作行为保持待验/延后。

绘制修复已选择性同步GitHub main并读取核对：6a6a57120dadf6e764c2f52b7d31afe7fc7b7086；源码补丁27项解压字节校验通过，SHA256 E309A7B310BE2D0AD667DF3B99D689AB01CD297F5FD3752872950331435B18A6。真实工作区HEAD/索引保持，未同步Gitee。

<!-- TG-ASSET-REPLICA-grab-fix-20261104 -->
## 再次试玩反馈：端面抓取偏移丢失导致续画被拒

用户确认“有接续提示，但拖动后接不上”。本轮沿实际SceneGUI命中—起笔—连续拖动—松手链复现：端面侧边命中后，旧代码把起点吸到中心，却没有保存鼠标抓取偏移；后续仍沿侧边自然向外拖动时，横向偏移被当成新笔迹的急转，造成大多数续画被拒。上一轮偏心夹具在后续采样中错误地消掉了该偏移，因此通过证据没有覆盖真实抓取动作，现已纠正。

新增7个完整事件用例未改代码时1PASS/6FAIL，修复后7PASS。修复仅在ReplicaWindow保存起笔抓取位置与端口中心的关系，后续使用鼠标相对位移，命中端点身份保持到同一笔结束。真实Window/Mesh密集12组18项、原端口/失败反馈10项及原生独立重开同时通过。仍属于后台事件/网格验证，不冒称物理鼠标试玩已验收。

已向同一星骸地编部署一份Window源码，生产源SHA256：909A925A36D63FA97629F2BEC6745533AFDAAD5F27B21F27B3B4F551E50E23E9。Core、Geometry、场景、套件及既有GUID保持。本轮用户允许丢弃试玩并关闭研究Editor，正式Editor 31176未动，未占用桌面。GitHub发布由主任务另行核对；本条不证明已上传。

另读取到真实Editor.log的ReplicaWindow GUILayout异常；实际显示窗口的2项GUI检查通过，但本轮未稳定复现该异常，也未修复，不得将2PASS写成真实日志问题已解决，亦不能用它替代抓取链验证。

[完整抓取事件红例](../../tools/scene-builder-lab/asset-usage-replica/reports/continuation-actual-gesture-red.json) · [回绿7项](../../tools/scene-builder-lab/asset-usage-replica/reports/continuation-actual-gesture-green.json) · [最终密集输入](../../tools/scene-builder-lab/asset-usage-replica/reports/drawing-usability.json) · [独立重开](../../tools/scene-builder-lab/asset-usage-replica/reports/drawing-usability-reopen.json) · [部署](../../tools/scene-builder-lab/asset-usage-replica/reports/grab-fix-delivery.json)。


<!-- TG-ASSET-REPLICA-grab-fix-published-20261104 -->
端面抓取偏移修复已选择性同步 GitHub main 并读取核对：ae91f89eecb1bc27950030a2f0706bdfa6aa24c6（29文件）。源码补丁23项解压字节校验通过，SHA256 868010F68A1B4730B60778EABC986E30CFD243449DB1D6F5B9CBE9802E59D487。本轮临时 QA 工程及新建编译缓存已送回收站，同一星骸地编工程保留；真实工作区 HEAD/索引保持，未推 Gitee、未占桌面，物理鼠标手感未重验。

<!-- TG-ASSET-REPLICA-recovery-fix-20261104 -->
## 快速续画、红线后恢复与真实桥面接缝修复

本轮进一步区分三个问题。ReplicaWindow 原先将每个指针点先加入整笔历史，Build/Preview 拒绝后也不移除，因此一次短暂侧偏会持续污染之后已经回正的笔迹；不足最小长度的正常等待也显示为红色错误。当前改为只保留已经接受的样本前缀，每次用当前位置尝试候选，被拒绝的尾点不进入后续历史；短笔等待用黄色、有效范围用青色、未采用的当前范围用红色显示，最后有效候选仍由一次松手提交。

第二个问题是旧50度上限和局部估算半径会误拒实际可铺设的接点，快速采样尤其容易触发。CurveSolver 改为80度上限，加上实际桥面四边形两个三角形均为正面积的检查，并继续拒绝明显硬折、倒回与自交。不能仅凭放宽转角把不安全桥面视为合法，也没有放宽既有笔迹误差预算。固定旧版 Build 输出回放中，24条采样路线及128条接续路线全部通过，158个旧基底均保持合法；这份152项矩阵直接复用固定旧输入，未用新生成输入替换原失败证据。

第三个问题是真实网格缺口：完整母件仅按固定cell两端映射时，跨作者折点的桥面用长弦截掉miter外角。独立QA在实际左右边界内90%的横截面射线命中失败，已排除普通法线取点错误。CurveGeometry 在cell分界中合入所有span终点，边缘也按对应弧长分界，避免完整模板跨越折点。旧规则下R6、45度起笔、2m采样不能提交，0.25m采样虽到终点仍有2/327条真实桥面漏射；仅放宽转角后快速采样另有3/327漏射。最终独立Engine曲线4例全部通过，实际桥面漏射为0，同时核对真实顶面三角形、同一作者/套件、旧节点和一次Undo/Redo。纯核心28项通过。

Session.Rebuild 同步重算派生MappingJson，避免修正cell切分后仍沿用旧素材顶点/三角范围。旧mapping缓存到真实重建、范围一致及原生Undo/Redo相关3例通过；路线原生权威、既有场景和套件不因缓存同步被改写。

恢复9项、原偏心抓取7项、端口10项及上述曲线4项最终通过；Window/Mesh 12组18项及原生独立重开也已通过。短笔端口测试移除了“等待文案必须逐字包含于松手文案”的脆弱要求，保留EndDraw返回false、原作者/实际网格不变、状态非空且不等于旧成功、不含“已采用”等行为检查；同时修复产品短笔未提交却报告采用的真实假成功。

本轮修正了三套QA原生输入夹具：先在真实Layout回调中独立投影world→GUI→screen→原生窗口坐标，再发送MouseDown/Drag/Up，记录type/rawType及控制捕获信息，不再到duringSceneGui才篡改Event坐标。原生输入每轴最多半像素取整，GUI坐标交付检查允许合成0.75px；按下/松手的预期位移由实际交付像素的相机射线独立求水平面交点，未调用产品Hit计算预期，世界终点0.11m等产品断言不放宽。纯hover事件交付与恢复验收解耦，原7项抓取保留hover覆盖；按下、拖动和松手必须真实经过SceneGUI回调，这仍不等于物理鼠标试玩。

最终已部署源SHA256：1D90F68BF3D636FA56F106FE053857F28362E44DB79DF4A224FF5463981034B3。ReplicaWindow、CurveSolver、CurveGeometry、ReplicaSession四份源码已实际增量部署到同一星骸地编，部署报告PASS，场景asset、套件和既有GUID保持。研究Editor保持打开、当前试玩场景保留，正式Editor 31176未动。GitHub发布仍待主任务核对，本条不声称已上传。未占用桌面，物理鼠标本轮未重验。独立真实GUILayout日志异常仍未修复，不得借本轮回归或shown GUI通过宣称解决。

[恢复原始红例](../../tools/scene-builder-lab/asset-usage-replica/reports/drawing-recovery-red.json) · [恢复最终9项](../../tools/scene-builder-lab/asset-usage-replica/reports/drawing-recovery-green.json) · [曲线原始红例](../../tools/scene-builder-lab/asset-usage-replica/reports/drawing-curve-tolerance-red.json) · [曲线最终网格验证](../../tools/scene-builder-lab/asset-usage-replica/reports/drawing-curve-tolerance-green.json) · [核心28项](../../tools/scene-builder-lab/asset-usage-replica/reports/recovery-curve-core-green.json) · [固定旧输入兼容回放](../../tools/scene-builder-lab/asset-usage-replica/reports/bend-fixed-baseline-compatibility.json) · [派生映射重建3项](../../tools/scene-builder-lab/asset-usage-replica/reports/rebuild-mapping-green.json) · [实际增量部署](../../tools/scene-builder-lab/asset-usage-replica/reports/recovery-fix-delivery.json)。


<!-- TG-ASSET-REPLICA-recovery-fix-published-20261104 -->
本轮已选择性同步GitHub main并读取核对：74665d05845d42a8790b6c5bf2cef3cb5d89f704（59文件），四份生产源码与实际部署一致。源码补丁53项解压字节校验通过，SHA256 E0DB113401E95D5993F37992D2FF1F10F0052E209F6910DA2F6E5422FE69287E。真实工作区HEAD/索引保持，未同步Gitee。临时QA工程、反事实探针及编译缓存已回收，研究Editor和formal Editor仍打开；未占桌面、未重验物理鼠标。

<!-- TG-ASSET-REPLICA-retract-height-20261104 -->
## 回拉裁短与绘制中升降（2026-11-04启动，11-05验证与部署完成）

用户反馈“好画多了”，本轮补足回拉回退与真正升降。普通鼠标仍在XZ平面绘制；按住Shift上下移动只调整正在绘制的新笔端点高度，12px对应0.25米，端点XZ锁定。Unity高度为Y轴；目标世界高度转换到作者局部，0.25米吸附，保持局部0—8米及最大0.5坡度。释放Shift按当前实际端点重新设置抓取偏移，随后平面绘制不重复消费升降期间的鼠标位移。

本笔沿已接受路径回拉会裁短后缀，退回或快速越过起点会清除实际候选，新建临时作者销毁，不提交回拉前较远桥段；仍可继续向外绘制。已有桥从首尾首次明确向内起笔时锁定缩短旧桥，向外起笔则锁定延长，延长中的回拉止于原端口。缩短保留同作者、套件及未受影响的节点，破坏启用洞口完整原路段时拒绝，不静默移除洞口。松手一次提交，Esc取消，一次原生Undo/Redo恢复整笔。

高度使用独立弧长分布，不把每个密集采样锁成高度锚；失败不改变已接受的笔迹、分布或真实候选。已经完成的坡段在继续平画时保留，末高度锚之后维持该高度；回拉保留截点原高度。无显式升降的新建笔迹继续原自动接近段。有效引导线取实际已接受的新笔高度，未采用的试探尾段单列。

首轮实际Engine回拉红例8项全部FAIL、0ERROR；扩展后的Window API/完整合成SceneGUI共14项现已PASS。独立纯Core的回拉、投影、作者裁短及高度分布20项PASS。旧恢复9项、偏心抓取7项、端口10项，以及Window/Mesh12组18项及其原生独立重开回归PASS。新升降的实际阶梯网格/碰撞3项及1152条独立桥面射线均PASS、零漏射，专门原生独立重开PASS。重开前持久Mapping原文exact；重建后仅排除临时Material/Mesh的instanceID，另以独立资产GUID/path/name/localFileId/role/hash签名核对，Doc/Mesh/Kit仍exact，同进程Undo/Redo的Mapping仍完整exact；这是QA对临时对象身份的比较修正，不是产品格式迁移。

最终已验证并部署的源聚合SHA256：739EB9587E8931E7F8D317CD328AD6F6986FA0CEFC5CF7B7F326373E3DE5EA3D。生产变化限定ReplicaWindow.cs与新增纯Core CurveGesture.cs及其新meta；旧Kit、Scene和既有GUID不改。两份生产源码已增量部署同一星骸地编研究工程，[部署报告PASS](../../tools/scene-builder-lab/asset-usage-replica/reports/retract-height-delivery.json)。补丁打包及GitHub发布待主任务最终核对，此处不写已上传。研究Editor保持打开，不占桌面、不启动游戏；本轮仍未物理鼠标重验，独立GUILayout日志问题未因此宣称修复。

[本轮边界](../../tools/scene-builder-lab/asset-usage-replica/notes/retract-height-20261104.md) · [实际回拉红例](../../tools/scene-builder-lab/asset-usage-replica/reports/stroke-retraction-height-red.json) · [实际Window/SceneGUI十四项](../../tools/scene-builder-lab/asset-usage-replica/reports/stroke-retraction-height-green.json) · [纯Core二十项](../../tools/scene-builder-lab/asset-usage-replica/reports/stroke-gesture-core-green.json) · [高度真实网格与1152射线](../../tools/scene-builder-lab/asset-usage-replica/reports/stroke-height-geometry-green.json) · [专门高度原生重开](../../tools/scene-builder-lab/asset-usage-replica/reports/stroke-height-reopen.json)。

<!-- TG-ASSET-REPLICA-height-turn-ux-20261105 -->
## 升降可达范围与新笔宽圆角（2026-11-05，验证及源码同步完成）

用户确认有升降但成功率低、限制条件不明，同时大转角无响应。原生SceneGUI的33项红例仅9项高度变化、24项受限，0事件错误/静默；原因是整次超坡请求被拒、自动接近段尾部短高度锚及新笔半米前置。排查时确认上一版高度方法已编译并完成域重载，不能把当时失败简单归为未加载代码；本轮新源码在当前打开Editor中的加载边界另列于下。

严格SetDrawHeight API继续拒绝越界/过坡；人类Shift按实际拟合弧长计算可达区间并限制到合法0.25米高度格，显示实际高度、允许范围及原因，大步先到合法边界，饱和后反向无超量死区。短新笔不足0.5米明确说明尚无新候选。旧端点可直接升降，受相邻节点、坡度及启用桥洞保护；先留在workingBase，随后外延及全回拉新增段保留该明确高度编辑，Esc取消，松手一次提交/Undo。

首次新笔升降采用原自动桥体与整段目标坡的单调包络，轻抬端点不压低桥身；同一升降阶段参考同一原轮廓，恢复平面绘制后固定已完成高度锚，保护近重合交点而不放宽既有最小段长/坡度门限。CurveBrush只对本笔明确宏观尖角设计按桥宽圆角，密集自然曲线继续严格噪声处理；旧作者及真实折回/自交保护保持。空间不足或紧贴旧接头时明确要求先沿旧方向延长；实际圆弧会偏离鼠标尖角，成功Preview后才原子接受，回拉沿可见弧。

源模板四分之一Yaw采用精确轴变换，端点直接使用规范start/end station，声明接口平面使用统一整数lane边界，消除导出、旋转及端点重算的浮点接缝。此为产品接口数值规范化，不是放宽射线/世界终点验收容差；来源UV、颜色、拓扑及模型哈希保持。原生六夹具纠正Show恢复68px视口的问题，先Show后设窗口位置，要求真实camera高度至少600px；此为夹具纠正，不冒充物理鼠标验收。

最终源聚合SHA256：3E0171E40CEE13FB56936F7935532D1DEDA22D3443934A811273A163559F3C4E。[十二阶段fresh最终套件PASS](../../tools/scene-builder-lab/asset-usage-replica/reports/height-turn-final-suite.json)，所有阶段报告均晚于本阶段启动时间：

- 原生Shift33项PASS：24项高度变化，0静默、0事件错误、0可行请求误拒；其余边界按明确条件处理。
- 宽圆角5项PASS，1458条实际桥面射线零漏射，含可见弧回拉、旧节点/套件保持及折回/自交负控；直接端点事务5项、回拉/高度14项、旧恢复9项、抓取7项和端口10项PASS。
- 实际升降阶梯网格3项、1152条射线零漏射及原生独立重开PASS；密集Window/Mesh12组18项及其独立重开PASS。
- 专门高度包络近重合边界PASS，纯Core40项PASS。中间失败证据保留，不用新输入或放宽几何断言覆盖原红例。

[实际源码增量同步PASS](../../tools/scene-builder-lab/asset-usage-replica/reports/height-turn-delivery.json)：同一星骸地编新增CurveBrush、更新ReplicaWindow与CurveGeometry，三份代码及配套meta核对，旧场景/套件和既有GUID保持。**当前打开研究Editor的新程序集加载尚未确认**：最后一次只读检查时其磁盘DLL仍为此前00:16版本，需用户切回Unity让自动导入/编译完成后再试；没有强制抢焦点或关闭研究Editor。已通过的是隔离Editor对最终源码的编译和十二阶段验证，不能把源码同步等同于当前窗口已运行新版。

本轮所属临时QA工程及编译缓存已回收，研究和正式Editor仍打开；未占用桌面、未物理鼠标重验。GitHub发布收据待主任务补记，当前不声称已上传。独立GUILayout日志问题仍不在本补丁已解决范围内。

[原生Shift红例](../../tools/scene-builder-lab/asset-usage-replica/reports/gesture-shift-robustness-red.json) · [Shift最终33项](../../tools/scene-builder-lab/asset-usage-replica/reports/gesture-shift-robustness-green.json) · [宽圆角最终5项](../../tools/scene-builder-lab/asset-usage-replica/reports/brush-corner-green.json) · [直接端点事务](../../tools/scene-builder-lab/asset-usage-replica/reports/endpoint-height-transaction-green.json) · [高度包络边界](../../tools/scene-builder-lab/asset-usage-replica/reports/height-envelope-boundary.json) · [纯Core40项](../../tools/scene-builder-lab/asset-usage-replica/reports/curve-brush-core-green.json)。
