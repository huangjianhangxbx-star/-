# LE-04 基础地貌编辑器通宵 Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> 本机未列出这两个模板子技能。实际执行使用已有多代理、test-driven-development与独立复核，不因缺少模板技能安装新插件或中断工作。并行仅用于互不冲突的任务，世界集成与Unity QA串行。

**Goal:** 在原Unity研究工程交付可用的基础地貌编辑闭环：局部性能、锚点范围、通用绘色、形色参考笔刷、撤销保存及可复现结果。

**Architecture:** 旧TerrainDocument作为未变基础，在同一作者旁保存稀疏局部区间覆盖、独立颜色和参考库；显示使用合并表面及局部缓存。外部模型只采样成参考场，不生成完整实例或12角色套件；专用雪岩／建筑对象后续独立Mesh搭配，不与本线做统一体积组合。

**Tech Stack:** 团结1.10.4／2022.3.62t16、C#、URP14.2.0-t1、FBX Exporter4.2.1、.NET6 Core QA；复用既有认证模型读取和原创工坊源。无Rust迁移、无新通用SDF库。

**Spec:** ../specs/2026-11-03-le04-terrain-reference-editor-design.md

状态：2026-11-03 用户批准执行后，A线实现、同源后台验证和原工程应用通过；归档／QA回收收尾中。旧LE04草案已被取代。执行证据见 LE-04/reports 与 README。

## Global Constraints

- 本夜只做A基础地貌线：形体、通用上色／分色和形色参考；具体雪岩分层、雪帽／雪檐和用途专属构件属于B，不纳入本夜。
- A与B只需同场景搭配，不要求网格焊接或体积布尔；保留旧LE03手放路径，不自动吸收其构件。
- 同一Origin/work/procedural-world-editor/LE-01/project；不新建常驻Unity/Hub工程。
- 不操作或关闭正式ANKALUTE，不启动Tiny Glade、不占鼠标键盘，不休眠。
- 不覆盖用户WorkScenes、Recovery、未保存场景、原生.blend和旧ZIP；本夜QA最多一个，收尾可恢复清理。
- 旧legacy模式同输入作者／全Mesh字节不变；新合并模式以覆盖／体积／法线／颜色／命中语义等价验收，新partial/full须完全同Mesh指纹。
- 参考模型不具有语义理解；其snow标签仅保留来源，不运行任何专属雪岩生成规则。
- 每次失败保留最近通过版本；源、作者、Scene、generation和revision绑定，旧异步结果不得污染新操作。
- 通过关口后再应用原工程；无法安全应用时交ready-to-apply候选，明确未部署，不强关用户Editor。
- 用户批准执行后小阶段不询问；时间是估算，不是到时停工、标完成或休眠的命令。

## 0. 通宵顺序、检查点与预计工作量

| 阶段 | 估算 | 通过后实际得到什么 |
|---|---:|---|
| Task 0 保护与基线 | 20分钟 | 候选范围／源保护、真实成本与复现输入 |
| Task 1 表面与缓存 | 60—90分钟 | 同形体更少共面三角、远区资源复用，局部测量 |
| Task 2 锚点与局部编辑 | 60—90分钟 | 点击实际面→调范围→改形→应用／取消 |
| Task 3 通用绘色 | 50—70分钟 | 连续涂色、区域填色、重建和重开保色 |
| Task 4 参考生成笔刷 | 90—120分钟 | 两个真实来源、拉伸重采样、连续体积融合 |
| Task 5 集成／兼容 | 40—60分钟 | 一笔一Undo、真实窗口与另进程重开 |
| Task 6 发布与清理 | 20—30分钟 | 最终指标、样例、源码、保护及清理记录 |

总量约340—480分钟，即约5小时40分—8小时；按6—8小时级工作量准备。不是完成时间保证。基线或关键架构失败优先定位，阶段超估先缩减页面美化／额外展示源，不删核心正确性和保存检查。

最早可用检查点是Task 2完成的局部编辑；Task 3后得到有颜色的可用基础地貌版本；Task 4和最终验证未过，必须继续追踪，不把前两个检查点当整轮成功。若有确实外部阻塞，报告最近可用版本、未完成项及恢复入口，不写假PASS。

## 1. 文件与责任

所有工程路径相对project/Assets/LE01；夜间候选、QA及交付位于Origin/work/procedural-world-editor/LE-04，后者不是新Unity工程。

| 文件 | 工作 |
|---|---|
| Runtime/Core/TerrainEditTypes.cs | A作者状态、局部列覆盖、颜色、参考、指令及结果 |
| Runtime/Core/TerrainEffectiveSource.cs | 统一读取旧基础与新覆盖，空覆盖是已删空而非回退 |
| Runtime/Core/TerrainLocalEdits.cs | 范围内延伸／顶高／隆起／薄厚／移除，不暗改隐藏基础 |
| Runtime/Core/TerrainSurfaceMesher.cs | 暴露面、共面合并、稳定色槽与位置拾取索引 |
| Runtime/Core/TerrainEditCache.cs | 原基础／有效实体／Mesh缓存、旧新dirty并集及版本 |
| Runtime/Core/TerrainPaintEdits.cs | 普通颜色笔刷与区域填色、手涂优先 |
| Runtime/Core/TerrainReferenceField.cs | 一次认证的源形色采样缓存和目标重采样 |
| Runtime/Core/TerrainReferenceEdits.cs | 连续扫掠、增加／削减／参考色，与有效地貌融合 |
| Runtime/LE04TerrainState.cs | Scene中的v2扩展作者JSON，不写派生实例作真源 |
| Editor/LE04TerrainSession.cs | 冻结／后台／失效／互斥／提交／Undo与保存 |
| Editor/LE04TerrainWindow.cs | partial LE01Window，锚点／范围／绘色／参考UI |
| Editor/LE04TerrainOverlay.cs | 命中表面、实际编辑域与只读封边域 |
| Editor/LE04TerrainFiles.cs | 新A文件、旧基础候选、颜色FBX与Scene资源 |

已有文件按任务需要修改LE01Window.cs、LE01Adapter.cs、LE01Stroke.cs、LE01Export.cs和LE01CStart.cs。TerrainCompilerV2.cs仅抽纯暴露面／矩形合并步骤，不无条件改变legacy输出。VoxelModuleCompiler整体不作为新A组合器。

## 2. 拟建接口与数据约定

    TerrainEditSnapshot TerrainEffectiveSource.Capture(
        TerrainDocument basis, TerrainEditState edits, TerrainEditCache cache);
    TerrainEditResult TerrainLocalEdits.Apply(
        TerrainEditSnapshot source, TerrainEditCommand command);
    TerrainEditResult TerrainPaintEdits.Apply(
        TerrainEditSnapshot source, TerrainPaintCommand command);
    ReferenceCompileResult TerrainReferenceField.Compile(
        VoxelModuleAsset source, ReferenceCompileSettings settings);
    TerrainEditResult TerrainReferenceEdits.Apply(
        TerrainEditSnapshot source, ReferenceBrushCommand command,
        CompiledReferenceField reference);
    TerrainSurfaceBuild TerrainSurfaceMesher.Build(
        TerrainEditSnapshot source, TerrainEditCache previous,
        TerrainDirtySet dirty);

| 类型 | 必需内容与约束 |
|---|---|
| TerrainEditState | version=2、revision、baseTerrainHash、ownedColumns、paintRuns、palette、references、settings；不含B构件语义 |
| TerrainColumnOverride | 最细坐标X/Z（单位0.0625m）、完整排序半开实体区间（Min/Max/BaseColorId）；可空，空为tombstone；相同列可压缩共享，不变区不复制 |
| TerrainVolumeSpan | Min/Max为0.0625m整数高度，半开区间；BaseColorId是普通基础／参考色，不是snow等语义；手涂在独立paintRuns上覆盖 |
| TerrainPaintRun | X/Z、YMin/YMax、FaceMask、ColorId和手涂／参考优先级；坐标权威，不绑定三角编号 |
| TerrainEditSnapshot | Scene/author/generation/revision、旧基础只读快照、有效覆盖及色板；原基础实体与最终有效实体区分 |
| TerrainEditCommand | mode=Extend/Raise/Lower/SmoothRaise/SmoothLower/Thicken/Thin/Erase；锚点、冻结参考、X-/X+/Z-/Z+、Y带、衰减、量、目标Quantum、期望revision |
| TerrainPaintCommand | path或锚点区域、色槽、半径、Y带、FaceMask、可见表面筛选；不包含snow规则 |
| ReferenceCompileSettings | 源单位/坐标、认证版本；不依赖鼠标帧。缓存key含源几何＋颜色＋读取设置hash |
| ReferenceCompileResult | Field、Rejected、Reason；成功Field只读，失败不替换旧参考 |
| CompiledReferenceField | 只读真实占据与RGBA场、Bounds、源hash、尺寸、采样计数；源文件不改 |
| ReferenceBrushCommand | Add/Subtract/ColorOnly、规范化轨迹、冻结参考、目标Quantum、ScaleXYZ=.5—3、Yaw、UseColor、BlendWidth、seed及OverwriteManual=false |
| TerrainDirtySet | 直接改动列、只读halo、旧新chunk并集、颜色dirty、源／色板版本；空变化不上传 |
| TerrainEditResult | Snapshot、Dirty、Changed、Rejected、Reason；错误保留原提交，无半写 |
| TerrainSurfaceBuild | preparedChunks、emptyChunkKeys、palette、SurfacePickIndex、最终有效区间快照、阶段stats与ticket；Upload不二次组合 |
| SurfacePickIndex | 按命中局部坐标＋法向＋高度区间取逻辑面与来源，不能把合并大面的单一key当全墙 |
| BasicTerrainFile | schemaVersion=2、kind=basic-terrain-v2、terrain、editState；旧schema由明确入口另存，不覆盖旧源 |

有新state时，所有A形体／颜色工具都读同一EffectiveSource。不得旧Kernel只改Top、新覆盖却仍盖在上面造成操作看似无效。无新state保持旧路径；密度／种子等程序重排若在体积覆盖区没有可靠适配，暂明确禁用该组合并解释，不写隐藏作者。必做闭环中的延伸、抬压、隆起、薄厚、颜色和参考不能因此跳过。

参考采样数上限65536，激活最细列上限65536、总区间上限262144；从粗目标格展开到最细列后的工作量也需计入，不能只检查导入源很小。超限拒绝，不静默降精度。

## Task 0：保护、基线与候选范围

**Files:** LE04/notes/baseline-source.json、protected-files.json、reports/baseline.json、qa/fixtures/；候选仅LE04/candidate/Assets。

**Consumes:** 当前61份生产C#合并hash16ED74845F845D4A8F65D11D93F46277F127405898A50BFE0216C569ED517C7B及用户实际工程状态。
**Produces:** 本轮冻结基线、保护清单和相同操作输入。

- [x] 读取当前原工程、进程及未提交范围；保存脚本／shader及旧ZIP、源.blend、用户Scene/Recovery指纹。若基线已变化先差异核对，不盲覆盖；不关闭Editor。
- [x] 固定24m/28968叶格A-only作者、平整平台、悬崖与跨块负坐标四夹具；固定1.5m半径/.25格、20次测试输入。记录旧源和实际几何，不用带旧模型341ms成绩冒充A-only基线。
- [x] 测输入、准备、Profile、拓扑、Mesh、Collider/上传、取消、Undo，冷与热分开。已有来源的读取次数也记录。旧module堆差值只作历史背景。
- [x] 首个性能行为红例为平整面仍按叶格发大量顶面、局部操作重建远处Mesh，另保留锚点／上色／参考能力缺失的原症状。建立检查点0并进入Task 1。

## Task 1：有效数据接口、表面合并和缓存

**Files:** 新增TerrainEditTypes/EffectiveSource/SurfaceMesher/EditCache；测试LE04/qa/Core/MeshTests.cs、Core.csproj和夹具TestWorld.cs。

**Consumes:** 旧编译基础，只读；初始state为空。
**Produces:** prepared surface、位置拾取、可复用块cache，新模式同形体优化。

- [x] 写真实红例：

        var source = TestWorld.FlatPlateau();
        var before = TestWorld.LegacyBuild(source);
        var after = TerrainSurfaceMesher.Build(source, null, TestWorld.AllDirty(source));
        Need(TestWorld.TopTriangleCount(after) <= TestWorld.TopTriangleCount(before) / 2, "平面合并");
        Need(TestWorld.SameSurfaceAndColor(before, after), "不改形体和颜色");
        Need(TestWorld.PickAllFaceSamplesEqual(before, after), "合并不丢编辑身份");

  所有Core片段使用using static TestWorld；TestWorld.Need(bool,string)在false时抛InvalidOperationException，Program按surface/local/paint/reference分组运行实际接口。TestWorld是本任务夹具：FlatPlateau返回固定Snapshot，LegacyBuild调用旧Compiler，AllDirty按实际bounds给chunk集合，TopTriangleCount遍历实际朝上三角计数；覆盖比较对每个最细外露原子面检查位置/法向/色/归属。不是只比较三角形数量。

  Run: dotnet run --project Origin/work/procedural-world-editor/LE-04/qa/Core/Core.csproj -c Release -- surface。
  Expected red：缺少实现或共面减面／拾取不等价。

- [x] 先合并顶/底同色共面，再处理侧面；实现SurfacePickIndex后才能跨逻辑anchor合并。若只同key合并收益不足，不能删语义来凑指标。
- [x] 缓存原基础、有效实体与prepared块，按旧/新dirty并集更新并提交空块；无编辑和相机移动不重建。颜色dirty只重做色／Mesh，不重复计算悬崖Profile。
- [x] 对微台阶、凹口、窄柱、材质边界、跨块、负坐标验证原子面覆盖／闭合／拾取等价；同版partial/full Mesh hash一致，域外Mesh对象ReferenceEquals保持。旧legacy全数组精确回归。
- [x] 小性能复测与代码复核后保留检查点1，不能把减面当全部卡顿已经解决。

## Task 2：锚点范围与统一局部形体编辑

**Files:** TerrainLocalEdits、LE04TerrainState、TerrainSession/Window/Overlay最小链；qa/Core/LocalEditTests.cs、qa/Editor/LE04AnchorTests.cs。

**Consumes:** 有效基础＋稀疏覆盖＋SurfacePickIndex。
**Produces:** 先点击真实面，调整各向范围／Y带，预览改形，再一次应用或取消。

- [x] 写空覆盖和高度带红例：

        var before = TestWorld.ColumnWithThreeBands();
        var edited = TerrainLocalEdits.Apply(before, TestWorld.EraseMiddleBand());
        Need(TestWorld.MiddleIsEmpty(edited.Snapshot), "删后不回填旧base");
        Need(TestWorld.OutsideBandEqual(before, edited.Snapshot), "其它高度不动");
        Need(TestWorld.SaveReloadHashEqual(edited.Snapshot), "空列也是有效数据");

- [x] 首次触及列取旧基础真实区间，只改命令Y带，再保存完整最终区间。设置顶高/延伸/隆起/薄厚均经EffectiveSource，测试“参考后下压→再隆起→再削减”不会因旧Top或新覆盖互相遮挡失效。
- [x] 用实际SceneView事件点击顶面/侧面；冻结首命中位置／法向／快照，X/Z正负滑条与Y带产生候选。验证穿洞、背面遮挡、候选自抬高、空地工作平面和边界负坐标。
- [x] 预览节流，滑条忙时保留最新值；应用一次Undo，取消恢复确切Mesh。实编辑范围与只读封边halo分开，不扩大作者范围；锁/原保形区冲突保留旧版。
- [x] 支持检查覆盖受影响原component，削掉唯一支点若产生不受支持的悬空体则拒绝，不偷偷删远方块。不扩成洞穴／桥生成器。
- [x] 真正跑通点击→扩范围→隆起/下压→应用→撤销→重做，保存检查点2。失败优先修这条有效数据链，不先堆上色UI。

## Task 3：通用笔刷涂色和区域填色

**Files:** TerrainPaintEdits、Palette/采样查询，Window/Overlay颜色入口、Files最小保存；qa/Core/PaintTests.cs、qa/Editor/LE04PaintTests.cs。

**Consumes:** 有效实体与稳定256槽色板。
**Produces:** 真实可见面绘色、范围填色、手涂持久，不含雪语义。

- [x] 写颜色红例：

        var painted = TerrainPaintEdits.Apply(TestWorld.FlatPlateau(),
            TestWorld.PaintTopAndSide());
        Need(TestWorld.VolumeUnchanged(painted), "仅颜色不改形");
        Need(TestWorld.BackFaceUnchanged(painted), "区域不穿透背面");
        Need(TestWorld.RebuildAndReloadColorsEqual(painted), "重建/重开保色");

- [x] 存TerrainPaintRun，按局部坐标／Y带／面向查询；mesher按颜色边界拆面。不能只写TerrainCell.Material，因为旧Compiler顶侧槽有硬编码。
- [x] 完成色板／取色、连续颜色笔刷、锚点范围一键填色，顶面/侧面/高度限制有效。可见筛选只影响直接命中区域，不给另一座岩体穿透上色。
- [x] 固定色槽和UV分母，首次新增色资源单列，普通一笔不全场重建；超过256明确拒绝。手涂高于参考色；来源中的snow仅普通label，不调用旧FixSnow或雪帽逻辑。
- [x] 同一范围反复改形、改色、Undo/Redo和另进程打开均对色；新面在已涂区域内继承，范围外按基础色。分别保存Scene与带色FBX检查，不只看内存palette。
- [x] 完成“锚点塑形→区域填色→改形后保色”的实际Window链，保存检查点3。

## Task 4：通用形色参考与连续生成

**Files:** TerrainReferenceField/Edits、Session/Window参考入口；LE04/references/两原创源；qa/Core/ReferenceTests.cs、qa/Editor/LE04ReferenceWindowTests.cs。

**Consumes:** 已认证VoxelModuleAsset或已有可靠静态网格认证结果；不使用VoxelPlacement作输出。
**Produces:** 可改变尺寸／方向、持续绘制并融合为A实体的参考笔刷。

- [x] 写参考语义红例：

        var field = TerrainReferenceField.Compile(TestWorld.AsymmetricSource(),
            TestWorld.DefaultReferenceSettings()).Field;
        var a = TerrainReferenceEdits.Apply(TestWorld.FlatPlateau(),
            TestWorld.ReferenceLine(10), field);
        var b = TerrainReferenceEdits.Apply(TestWorld.FlatPlateau(),
            TestWorld.ReferenceLine(2000), field);
        Need(TestWorld.Hash(a.Snapshot) == TestWorld.Hash(b.Snapshot), "同线细分无关");
        Need(TestWorld.RepaintIsIdempotent(a.Snapshot, field), "重扫不反复堆高");
        Need(TestWorld.NoPlacementsCreated(a), "输出不是一串Prefab");
        Need(TestWorld.SourceCompileCount(field) == 1, "源只采样一次");

  ReferenceLine固定同一折线/尺寸/seed，samples仅插入共线点；辅助方法在本任务TestWorld中调用真实编译与编辑接口，不返回预写形体。

- [x] 一次性读取真实占据／颜色并缓存，验证开放／非法／超预算源拒绝、旧参考保留、源文件字节不变；空洞不被bbox填满。导入路径兼容Unity JsonUtility均匀faces规范化，不能削弱验证。
- [x] X/Y/Z .5—3倍伸展、整体尺寸与水平朝向在目标格重采样，最终落.25/.125/.0625m格，不缩放Prefab。验证1×、X2×、整体.5×及跨块、负坐标；采样与展开列预算都检查。
- [x] 按规范化弧长扫掠参考体积，Add求并、Subtract求差，ColorOnly不动体积；参考空白不自动挖已有地貌。通用融合宽度与固定空间种子控制局部过渡，不逐源特判，不按帧随机。
- [x] Add参考色只写新增实体段；重复覆盖不冲手涂；覆盖手涂要显式开关。忽略snow等具体地貌语义，白色只是白色；Sub不写新色。
- [x] 制作两个普通颜色／形状不同的真实原创参考源，展示源→采样→缩放/伸展→连续融合→削减。不得原样点放，不用雪岩构件库或B端口协议凑展示。源可复用工坊共享API，实际制作前读取Origin/自制工具/voxel_workbench/agent-skill/xinghai-voxel-workbench/SKILL.md与其API_CONTRACT，不改原.blend。
- [x] 真正完成“导入→拖画→改尺寸→再画→局部削减→颜色检查”的Window链。参考后普通抬压仍从有效实体操作，保存检查点4。

## Task 5：事务、旧作、独立共存和持久化

**Files:** LE04TerrainSession/Files与原LE01Window/Adapter/Stroke/Export/Start对应接入；qa/Editor/LE04Transactions.cs、Persistence.cs、SceneAssets.cs。

**Consumes:** 通过的局部形体／颜色／参考候选。
**Produces:** 稳定可继续操作的场景和基础地貌v2文件，不需要B融合。

- [x] 真实事件测试一笔一次Undo/Redo、释放导航保留、未释放右/中/Alt取消释放hotControl、Esc确切恢复、工具／对象／Scene切换和迟到worker作废。
- [x] 输入采集不深拷全世界JSON；generation＋Scene/author/revision共同检查。候选结果只在主线程提交准备资源，上传不再触发旧VMC全层同步组合。普通A编辑/上色/参考互斥，不在半成品时保存。
- [x] 完整文件schema2保存原基础、新覆盖（含空列）、paint、palette、reference快照及设置；加载/历史恢复回填UI。旧schema打开原语义保持，显式另存A副本；旧mixed原样保留，不能自动拆或吞独立件。
- [x] 另进程打开Scene和完整文件，比较作者/空覆盖/颜色/源hash及Mesh，再改形/取色/Undo。FBX独立Blender复核几何、色板；AssetDatabase验证源/meta/包锁和缺引用。
- [x] 放一个现有独立原创物件与A并场景，核对坐标、遮挡和各自保存；分别Mesh/root/source都保持，不要求焊接。它不计B工具完成、不制作雪岩自动分层。
- [x] 旧legacy作者与Mesh全数组指纹回归；新partial/full同策略完整指纹一致，范围外数据及Mesh对象保持。区分native Undo同帧夹具污染和真实失败，必要时隔离进程但保留原断言／红证据。

## Task 6：性能达标、可用交付与安全应用

**Files:** qa/Editor/LE04Performance.cs、reports/、review/、README、操作说明、package-source/verify-delivery脚本、任务/当日日志。

**Consumes:** 最终相同源码／相同参考／相同格度的完整工具。
**Produces:** 已验证候选或原工程更新、完整源包、实际成绩、未完项与清理记录。

- [x] 固定Task0负载，预热5次后20次分别测输入、后台、拓扑/合并、Mesh/Collider上传、取消与Undo；另测跨块/.125m。目标见设计§9：Input2/max8ms、Tick8/max33ms、预览150ms、释放300/max600ms、取消16ms、Undo请求100/恢复500/max750ms、冷1200ms、小局部分配64MB，P95与单次最大值不可混用。
- [x] 新合并平面夹具目标顶面三角至少减少50%，保形/保色/命中语义等价；曲折结构另列，不删细节凑比。新A-only必须同自己的旧A-only基线比较；B／旧mixed不混进统计。
- [x] 若超标，按实际热点修缓存失效、重复源采样、Profile、分配、全场UV重映射或上传/Collider，原条件重测受影响组。不能只报Drag流畅，也不能把managed heap差值报总分配。
- [x] 输出一个同工程可复现工作场景：锚点扩范围→改形→区域上色→参考连续生成→拉长参考→Undo→保存重开；附原始截图／事件日志／参考实际来源、形色对照、功能和性能未达项。计划图不计实机成果。
- [x] 检查旧文件hash和用户场景保护，确认项目状态与源基线无冲突后应用候选。若研究Editor打开／并行改动使应用不安全，保留完整ready-to-apply包和仅在关闭/匹配基线时执行的脚本；明确未部署，不占控制权强关。
- [ ] 源码和参考包逐文件hash验证，最终报告绑定实际源码和数据；最多一个QA可恢复清理、Hub不留新增项、正式工程不动、不休眠。更新项目状态/日志，Git基线不安全仅本地归档，不强推。

## 3. 本夜失败策略与最终报告格式

- 内部代码／QA失败：保留红例，修后重跑相关组；环境失败明确归类，不假装功能红或绿。
- 中间检查点：独立可恢复，不用失败候选覆盖旧用户工程或上一通过的源码包。
- 真正不可自主解除的阻塞：记录具体条件、已经尝试的安全路径、保留版本和下一条可执行步骤，不反复要求睡着的用户交出鼠标。
- 只有完整闭环和必做检查通过才标本轮完成；否则报告“部分可用／未完整完成”及剩余核心工作。6—8小时估算不授予自动休眠／关机或篡改验收状态的权力。
- 早晨报告仅需：可用入口、已完成／未完成、实测性能、已部署或待应用、源包、旧数据保护及QA清理。不能让用户从工具日志里猜结果。
- 已执行的证据与实际局限见 LE-04/README、docs/tasks/LE-04.md 和 reports。肩部融合采用确定性规则，随机种子变化未开放；旧密度／种子重排未接入A体积覆盖，旧作继续走原入口。此取舍不赋予A雪岩或建筑用途语义。