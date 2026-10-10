# 2DW-05B 验证与交付

工坊0.2.0，用户批准M0并纳入三项修订后完成M1–M8技术实施。基准 main/GitHub cc04ac2（游戏体力/HUD新增，目标工坊无冲突）。旧05A契约与13份旧ZIP保持，原未提交游戏/其他工具内容没有进入本轮。

## 验证

- 最终 Node24 模块测试176/176，无跳过；类型检查和构建通过。最后补充Codex Prompt重哈希篡改断言，定向3/3通过。
- 实际Electron UI：场景/石材/明确重复，V1风格PNG、384×384/200PPU→1.92×1.92，真实导出19条目v4并重读。木材2候选、无石材污染；候选JSON另存不改目录；复制保留/新建恢复1.1普通任务、100PPU。页面错误0。
- PNG位图与本地文件URI的Ctrl+V均导入成功、2缩略图，测试后恢复原剪贴板。
- 13个旧ZIP /1、/2、/3全部重新核验，SHA前后相同；开发细则、AGENTS及原风格契约SHA不变。
- 原字节V1固定SHA 41c21aa13228c01f15034d213e2e948d2f032fa4ebd0d8f6c87c17185332b559；A/B中为style，C零图。三样包每项manifest长度/SHA及未来输出缺席独立核对。
- v4拒绝镜像、Prompt、candidate状态篡改，拒绝版本降级、权威缺失与覆盖已有文件。当前解释冻结目录1。

## 过程修正及证据边界

先运行失败测试，再写核心/归档/草稿实现。桌面首轮隐藏窗口截图等待失败，后用正常窗口完成；新建空任务须明确选择画布，烟测已补齐这一步。另发现快速参考图更新会使进行中的表单结果被丢弃、预览按钮无法恢复；现于参考变化后重请求当前表单，真实复测通过。严格2阶项目预算可保留，空项目基线不能放宽已批准3阶场景上限。

pnpm在manifest版本更新后自动依赖复核触发本机esbuild构建策略提示；没有扩大权限或重新安装依赖，移除该命令自动写入的占位配置，以已有锁定依赖直接执行等价Node24测试/tsc/build通过。原锁文件与依赖声明保持。本轮无全游戏回归。

Electron系统文件选择器/另存返回值由自动化注入，后续真实主进程PNG核验、镜像编译、写盘和独立ZIP复读未替代；本轮不声称人工操作系统弹窗或已进行图像AI分析。截图仅检视布局，未代替人工美术验收。机器冲突检查有限，未测视觉色阶/6:3:1比例。

证据：Origin/docs/tasks/2DW-05B/tests-final.log、desktop-smoke.json、desktop-environment.png、compatibility-and-protection.json、implementation-validation.json；原M0文件保留历史待审状态，当前批准和修订见[风格规范](ENVIRONMENT-STYLE.md)。本机完整烟测目录 validation/2dw05b/ui-xhcmFb/，被忽略，不公开运行缓存。

## 验收映射

|Gate|状态|证据/结论|
|---|---|---|
|G01|passed|M0独立文档保留，用户意图/AI提炼/失败试验分栏|
|G02|passed|木材候选隔离，草稿保存固定candidate|
|G03|passed|非场景无environmentStyle，wood无STONE/锚点|
|G04|passed|比例/低饱和/赛璐璐按适用性解释|
|G05|passed|保护文件哈希及选择性差异核对|
|G06|passed|本轮明确批准M0后才实施M1-M8|
|G07|passed|原05A契约文件SHA不变|
|G08|passed|目录1/场景1/spec1.2/ZIP4版本分层|
|G09|passed|spec唯一权威，JSON/Markdown仅镜像|
|G10|passed|每条规则含身份、层、范围、来源与触发|
|G11|passed|stone/wood/reserved实际解析测试|
|G12|passed|木材候选不强制，状态重哈希篡改被拒|
|G13|passed|继承旧停刻与预算来源；Prompt共享稳定段落|
|G14|passed|严格预算保留，空项目基线不能解除场景上限；视觉待人工|
|G15|passed|ENV-COM-08只在显式重复/联通触发|
|G16|passed|桌面领域/材质选择无需手写规则ID|
|G17|passed|概览/候选/判错可见，原任务偏移保留|
|G18|passed|复制/新建/尺寸/参考/Ctrl+V实际烟测|
|G19|passed|13份旧ZIP1/2/3重读与SHA不变|
|G20|passed|v4 snapshot/4镜像/Codex Prompt严格派生比对|
|G21|passed|V1批准来源/原字节/角色/SHA保持，未拷贝其他源图|
|G22|passed|三包无output/或reports/伪造成果|
|G23|passed|A通用+石材+明确重复+本次偏移|
|G24|passed|B正视墙面/非地砖/无重复条件|
|G25|passed|C仅通用+2候选无石材|
|G26|passed|机器数据校验与人工视觉审阅区分|
|G27|passed|176模块测试/类型/构建/真实Electron导出|
|G28|passed|100默认/200派生/离线和防覆盖保持|
|G29|passed|文档、迁移表、3样包、索引、人审待项完成|
|G30|publish-verify-at-delivery|选择性提交Github main；远端SHA回读在最终交付时核实，不同步Gitee|

## 人工美术仍待验

三份ZIP都是待执行任务，无成品。需要实际出图后看整体成熟手绘质感、形体主次、近黑停刻、高亮是否碎/白、材质色差是否必要、是否变塑料平涂。A检查重复标记，B检查墙体用途与地砖差异，C审阅木材候选是否值得正式批准。土壤/金属/植被仍待补，自动无缝拼接、专业材质批量库、图像生成、Unity导入不在本轮。
