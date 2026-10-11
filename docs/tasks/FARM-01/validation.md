# FARM-01 验证记录（B级）

## 方法与证据
先RED：farm01五项因缺API/plot真正失败。首轮GREEN中一项夹具访问尚未初始化hunterCombat失败，改夹具初始化；没有放宽业务断言。最终 farm01八项 + INV01A/INV01B、NR01世界、LT01、Y瓶 六文件 **54项通过**。

核心覆盖：两田独立、纯查询、播种/收获/再播种；陈旧world/visit/revision/selection/owner、忙碌/死亡/复制/影子、远距/墙/楼层、无货/重复栈/负数/溢出、零种子返还、trace关闭去重；非法候选不建田、多个seed安全入口；具名敌人不获农田。死亡/团灭、合法篝火、真正exitExploration与continueWorld、离区时间冻结、新世界重建均为明确操纵的核心夹具，不冒充全地图自然故事。

## 自然键鼠
Edge软件WebGL，读取公开state及scene.project仅观察/定位，**没有注入游戏state、内部command或模拟时间**。四条全通过：
- S1 1920：Tab选择后键盘绑1农具/2种子，WASD靠近，开垦→播种扣1→真实等待6模拟秒→收获+1作物/+1种子→再播种；农田未产生角色accepted动作。
- S2 1280：空选择、距离、错种子、未成熟和Tab模态失败；冻结时间，库存/Y/activation/装备无差异；追加Space暂停与F瞄准点击保持田/瞄准、不确认技能或Basic，定向通过。
- S3：两个独立plot、物理重复点击不重复扣种或收获；阿尔自由栏同源×3；Z固定ranger后仍共享；普通地面LMB实际接受Basic。
- S4：从界面确认新世界→重新携入，田raw/revision0、seed5/crop0、数字栏/阿尔引用空。

1920/1280六区和Y/自由槽几何都与INV01B冻结JSON逐项一致。截图检查成熟可见、原人物与场景未换；标记和标签遵循深度，身后土面会被角色正常遮住。隔墙/隔层由核心实际改tile夹具覆盖；两块周围都是合法开阔层，未伪造浏览器穿墙操作。普通敌人点击路由代码保持；本轮自然保留检验是地面Basic，未声称重新完成敌人全流程。OS失焦只实施hasFocus/blur边界，未报告实际切窗验证。

## 首轮真实失败
第一轮S1/S2通过；S3用未启用的全局combatIdentity.trace作动作观察导致误判，改读角色始终记录的accepted日志；S4状态已重建但读取DOM几何早于下一帧，改等待原位HUD出现。随后四条全通过，无改游戏攻防参数。脚本最初路径错误未启动测试，同样保留work日志；不算产品失败。

## 构建、隔离及预算
TypeScript noEmit、主Vite、ActionLab独立Vite构建通过，保留既有chunk警告。ActionLab实际HTTP200/5canvas/无pageerror仅启动smoke，不重新验手感。代码复核：farm命令早路由，查询失败不进旧ensureControl；同源库存，无第二计时器；前端农田优先截LMB，非农田原逻辑不变；资源释放与迷雾/深度独立。

验证预算为B级定向小集，未跑全历史/RQ或Unity。所有原始日志在 validation/；本机work/FARM-01保留发布临时索引和基准快照。保护SHA与共享前缀/未相关索引在发布前核对；不修改开发细则、用户维护区、导入地图/原角色/Y/装备战斗参数，不联系Gitee。
