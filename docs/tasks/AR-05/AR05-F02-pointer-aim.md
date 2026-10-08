# AR05-F02 战斗指向与拾取边界

scene.pick 原地格 raycast、positionKnown、单位透明像素与可见筛选保持原样。combatAimAt 仅使用相机射线、演员脚下地形高度和平面求交，返回有限逻辑坐标，不查询隐藏敌人/导航/雾，也不改变任何状态。正常战斗使用它，近零向量退回 Hunter 上次合法指向或角色朝向；事件坐标直接传入，避免 window pointermove 比场景监听晚一层造成方向延迟。

正常 Hunter LMB 在按下时按原 held 合同请求，RMB/E 使用方向，不要求 tile。伙伴在原 tap 松开节点请求自己的 Basic。友方点击只构成方向，命中仍由主游戏 team/范围/LOS 决定。鼠标移动继续更新 Hunter 指向。F/SkillAim、卡牌、道具、部署/拖拽、模态、有效机关/出口保留原拾取和优先级。

Z 只有 controlBody 接受后才清场景 pointer/Basic pointer；失败不会修改输入。原 E 与 RMB 放开仍送到各自接受动作的 actor，不能让新角色消费。pointercancel/lostpointercapture 释放正确 Hunter latches；blur/暂停仍走原清理。Z 不取消已接受动作或更改黄金时序。

RED 初始四项真实键鼠测试失败：未接 Z、未知像素无 Basic 请求，及因此无法验证切人/轮盘边界。测试画面加载阶段需避开左侧详情区；已将纯战场点限定在稳定中央区域。攻击位移会按原规则自然更新附近视野，不能把全 memory 不变当作正确期望；独立指向查询本身已验证只读。

不迁阿尔，不做穿墙命中，不制作正式两面角色资源。
