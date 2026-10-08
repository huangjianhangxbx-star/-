# EN02 主僵尸合同

基准 main@13b151f；显式 `/?enemies=v2`，普通首页与 EN01 fixture 不替换。复用原僵尸 unit.json/atlas/僵尸1.png 及独立 Spine4.1。原 attack Flash/Lock=0、Dash/Hit=.5667，原有限方向左下＋镜像；没有原 Break/End，2秒双 Ready/Finish 是 SAMPLE。原素材仅本机白名单服务，构建不分发。

SOURCE 与 LAB SAMPLE 来自 EN00/AL01 既有证据；实际 JSON 逐项核对，原作动态 actualResult/OBS=null。主新增 Sense/Decision/Motor，复用地图导航、AR02身份、单一主时间及 resolveHit，不复制 LabWorld。感知8、记忆3秒、牵引12、目标粘性.6秒/优势.8、重规划.6、速度1.2、转向3、近战距离1.3、资格范围1.6/35度、扇区半角.8、寿命.1、伤害5、Dash .7/.2、恢复.24及反应硬度均 SAMPLE。明确严格 incoming>defensiveHardness 才打断；本命中接缝 incoming=1，基础 defensive=0，等值仅扣HP不取消。受击击退.3/.24按主地形裁切。僵尸死亡清危险，普通取消保留已经释放的短危险。

通用来源注册初始等待2.5；专用双角色测试入口局部 HP220/首轮等待.6，避免离手阿尔在首次出招前击杀，不改已认可玩家。所有 V2 清旧 Kit/Intent/Sense，不并行运行两套 AI。发现/搜索仅消费已见点；目标不可见不持续追踪其新位置。

每单位独立 skeleton/track/context，姿态只读主时间与 action acceptedAt；渲染事件不结算。Ready 前停止专用模式模拟，缺资源显式错误，不以旧红袍替代。Reset 用新世代、旧加载完成后安全释放；死亡时间在复活重置。音效复用原 release/hit/hurt录音，绑定为 SAMPLE，受主静音/暂停控制，不声称原动态消费者闭合。敌架势层关闭，EN04不在本轮。
