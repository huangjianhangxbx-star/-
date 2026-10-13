# 双网格权威契约

新任务ZIP9与xh-dual-grid/1独立分流，原v1–v8、single-contract/session/store及47态编译文件保持原SHA。批准由原workflow.productionGuard唯一授权，不建立第二份用户批准。

DataGrid为1..32维的0/1数组；Render为(W+1)×(H+1)，越界B。R[x,y]四角TL D[x-1,y-1] bit1、TR D[x,y-1] bit2、BL D[x-1,y] bit4、BR D[x,y] bit8。改变D(x,y)只更新R(x,y)/(x+1,y)/(x,y+1)/(x+1,y+1)。批操作验证后原子写入；保留最多64步会话撤回。场景切换重新建立撤回历史。

形状使用确定性Lp角域，6/9分离、0纯B、15纯A。c为16..256偶数，PPU1..10000，K1/2/4/8，16×K²×c²不超过16MP；UI开放K2/4/8。像素覆盖边缘采样固定0/1，避免内侧采样造成兼容边缘墨线错位。墨线是声明的A侧暗色混合，无亮边/模糊/源图平均。

源PNG必须cK×cK且全不透明。原件与处理输入分别SHA入库；显式准确裁剪不得重采样且面积覆盖>=25%。世界Render格modK选连续源窗口，所有相位合计覆盖处理母图100%，原稿覆盖单独记录。canonical仅phase0，覆盖1/K²，不可冒充完整继承。内部生成16K²缓存sprite；ZIP用K²相位atlas与独立16canonical保证有界条目。

任务/结果Ed25519签名覆盖权威、文件SHA与长度；独立验真重新执行规格/来源/编译，对照全部派生PNG、atlas、场景和映射，外部发行签名不授予本机用户批准。底层生产工程使用原store签名并嵌入原上游工程；异机批准不可信。保存对话框期间审批撤销也阻止发布。

拓扑检查穷举兼容边覆盖/墨线、mask唯一性、atlas切片与PNG一致性。像素色差/黑线告警基于源周期边界，阈值平均RGB差8、暗像素错配5%；这不是成熟美术评分或所有内部裂缝语义判断。重复率是相同图块SHA占比，超过25%且>=16放置给警告。人工美术永远pending-human，Unity实机unverified。

静态Unity适配与16状态表分别见工坊docs/DUALGRID-IMPORT-UNITY.md、dual-grid/16-state-table.json。发布范围仅2D工坊通用代码、原创技术夹具与本任务记录。
