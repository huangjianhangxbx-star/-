# HOME-01 验证记录

2026-10-18，基准 a755361，最终生产工作树由 TypeScript/Vite 构建验证；其后仅增加测试与本文。GitHub main fetch 后仍为 a755361，无基准冲突。未同步 Gitee。

## 实际执行

在 game 目录运行：

- `npx vitest run tests/home-resident.test.ts tests/home-join.test.ts tests/map-companion.test.ts tests/map-travel.test.ts tests/map02.test.ts tests/role-interaction.test.ts tests/inventory-death.test.ts tests/inventory-weight.test.ts tests/item-commerce.test.ts tests/merchant-shop.test.ts`：10 文件、64/64 通过。
- `npx vitest run tests/dialogue.test.ts tests/dialogue-game.test.ts tests/healing-bottle.test.ts`：3 文件、19/19 通过。
- `npm run build`：TypeScript 与 Vite 225 模块通过；保留既有大 chunk 提示，不宣称完成性能优化。
- `npx playwright test tests/home.spec.ts tests/map-companion.spec.ts --workers=1`：4/4 通过。正式标题开始、自然单人往返/交谈/组队/切控，以及两种主控下原队友对实际地图敌人攻击扣血。
- home 与 role-combat 定向浏览器复验：3/3 通过，包括真实 Tab 背包模态下直接调用组队核心被拒；战斗交互测试为状态夹具。
- 最终 `npx playwright test tests/home.spec.ts --workers=1`：2/2，25.1 秒；增加对话前/中/后音乐 transportId、startCount 和 elapsed 连续性断言通过。

浏览器使用本机 Edge 软件 WebGL，1440×900 与 1100×720。截图、音乐 JSON、死亡夹具 JSON 位于忽略目录 `work/HOME-01/evidence`，不是人工全流程试玩。独立评审查看源码和截图，未冒认亲自操作浏览器。

## 验收矩阵与证据类型

| 项目 | 本轮证据 |
|---|---|
| H01–H03 正式入口/驻留/往返 | 自然键鼠主线；逻辑检查原 Unit、位置、受损 HP、装备引用；三次独行往返 |
| H04 控制权限 | 自然 Z 拒绝与直接引擎命令拒绝；共用成员权威 |
| H05–H06 组队/幂等/旧请求 | 自然点击与逻辑身份/修订/访问代/死亡/旅行/对话负例；真实背包模态直接核心负例 |
| H07 原队友行为 | 两种主控自然地图战斗攻击扣血；逻辑加入后往返仍同行 |
| H08 布局 | 两档实机截图、矩形不交叠断言；按钮阻断事件穿透且不暂停世界 |
| H09 单人死亡 | 正式入口走门后调用真实 resolveHit 注入致死，执行权威死亡/掉落/返场；不是自然敌人击杀 |
| H10 物品 | 定向逻辑：safe/居民后备/个人装备保留，team 中原 ranger 武器仍掉；旧双人掉落回归 |
| H11 远程访问 | 定向逻辑：后备食物拒用、钱币不代付、个人装备不能远程访问、携带重量排除、回血仅当前队伍 |
| H12 对话/音乐 | 自然 F 菜单与对话；真实 AudioContext inspect 前/中/后 transport/startCount不变、elapsed递增，未人工听感验收 |
| H13 追兵 | 本轮定向敌人目标/攻击请求拒绝居民、仍可选猎人；原地图追兵相关逻辑回归。未重拍自然追入全片 |
| H14 生命周期 | 三次单人及一次组队往返保持单个原实例；复用既有 WorldPlace。未新增 GPU 长时压力实测 |
| H15 范围保护 | 无新家具运行素材/存档/日程；原稿与开发细则不改；旧 game/docs 排除 |

## 失败与修正

最初驻留等4项测试对旧行为失败，实施后通过；远程食物和独行武器激活负例暴露消费者遗漏，分别接入访问与当前成员查询。独立实装 R1 指出模态仅在 UI 防守及入队旧令牌未失效，已注入现有模态查询到核心并递增 inputEpoch，真实 Tab 负例通过。

追兵定向夹具最初返回 cooldown 而非 target，因为复用敌人携带原冷却；只清除测试敌人冷却，确保测到目标资格，未改变生产规则。最终64项全过。

概念 R1 按钮遮操作提示，R2移到提示上方；加入用户要求的少量魔素科技，概念门8.7。技术实装评分和未验项见 runtime-review-R1.md。用户审美、人工听感与硬件性能另行验收，未冒认完成。
