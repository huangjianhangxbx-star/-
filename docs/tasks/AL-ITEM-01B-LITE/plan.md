# AL-ITEM-01B-LITE Implementation Plan

用户本条“理解并执行”授权附件第1节与第4节范围；附件自身的草稿标记不是对本次授权的撤销。P1–P4候选不实施。接手 main/GitHub 为56c954d65582ca4c573336744e107504cef9c1bf；已有目标源码无差异，其他工坊/旧测试与共享状态dirty保留。按已批准有限设计在本会话执行，无新代理或不可用技能调用。

**Goal:** 阿尔真持有第二种道具，安全释放真实投弹，保留紧急治疗与已有战斗。

**Architecture:** world-inventory登记团队bomb2；al-items纯候选先治疗再炸弹，复用现有.2模拟秒决策。offhand提取releaseBombEntity，库存瞬时释放复用原entities/飞行/主resolveHit与Scene，不绕过玩家queryOffhandAction。新实体使用al-item usage身份，不写副手装备实例。死亡/卸载依原cancelOffhand。

**Tech Stack:** TypeScript / Three.js / Vitest / Playwright Edge。

**Spec:** approved-plan.md；关联AL-ITEM-01A合同、EQ-01 equipment-contract。

## 约束与取舍

5槽/交1沿用；新世界团队bomb2/阿尔0。治疗优先于偏好炸弹，偏好炸弹可单敌；无偏好须两敌覆盖，敌人可见同层、4.5范围/原路径合法。复用45HP/25架势/.45飞行/1.25半径，库存投弹SAMPLE间隔5模拟秒，不消费正式CB/装备资源。瞬时Release没有新动作或前摇；非法或取消操作不扣，生成后不退款。不要修改FARM/Y/黄金动作/地图/用户维护/细则，不Gitee、不实施候选后轮。

- [x] RED：注册/守恒、医疗优先、单敌与双敌、纯拒绝、真实实体唯一扣1/主伤害/trace关闭/生命与访问。
- [x] GREEN：offhand共享释放；al-items扩展有限两种候选与唯一消费；原位文案状态，不新HUD。
- [x] B：定向ALITEM/EQ/库存/FARM/Y/NR核心、tsc/双build；真实交付→投弹→命中与Z抑制、自然治疗、玩家RMB炸弹代表。
- [x] 交接：记录SAMPLE和未试边界，保留保护SHA与shared前缀，选择性GitHub main，停用户Gate。

命令：game目录运行 node node_modules/vitest/vitest.mjs run tests/alitem01b.test.ts tests/alitem01a.test.ts tests/eq01.test.ts tests/world-inventory.test.ts tests/inv01b.test.ts tests/farm01.test.ts tests/healing-bottle.test.ts tests/world-session.test.ts；tsc --noEmit与Vite两入口；浏览器只新故事，不全量退休系统。

交付：74项核心、6个分批键鼠故事、tsc和双构建、ActionLab启动通过。日志含首轮夹具失败与定向补测。停用户试玩Gate，后续横向候选另批。
