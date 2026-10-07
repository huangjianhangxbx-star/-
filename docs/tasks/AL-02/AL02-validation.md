# AL02 验证、差异与试玩状态

2026-10-07；冻结基准 main@be1c30a，采用 AL01 002396c 已认可手感。最终源码哈希见 AL02-freeze.json；原作实际结果为空，AL02 用户试玩待确认。

## 实际执行

- `npm --prefix game test -- tests/action-lab`：8 文件 / **64 项通过**，含原43项。覆盖新释放门/一次付款/独立消费/取消/死亡/代次、柱伤害与爆炸、低帧/.25×及双施法者装备句柄。
- `npm --prefix game run test:browser -- tests/al01.spec.ts tests/al01-m2.spec.ts tests/al01-m3.spec.ts tests/al02.spec.ts`：**16 项通过**，Edge + 软件 WebGL，1440×900、单 worker。11项旧回归与5项AL02正常输入/资源边界；没有手改CD或伤害来制造页面成功。
- `npm --prefix game run build` 和 `build:action-lab`：TypeScript与Vite通过。主构建保留原有较大chunk警告；不是本轮失败。主页面不导入action-lab，旧Spine3.8/vendor路线未改；新sprite和原4.1运行库不进入生产壳。
- 本地日志：work/AL-02/unit-final.txt、browser-frozen.txt、build-main.txt、build-lab.txt。必要普通输入事件已冻结在 evidence/normal-input.json；同名normal-*.png仅本地过程截图。资源提取/哈希 receipt 为 visual-extraction.json。

## 验证矩阵

| 主题 | 证据与结论 |
| --- | --- |
| T01 B0 / T02 energy | 旧kernel/world/M2/hit-effects与11项页面回归通过；普通B0第三段仍小蓝a3；主动首次有效命中霜寒回收保留，新派生不冒充盾冲命中。 |
| T03 / T20 装配重置 | 模块代次隔离/退订与页面连续3次重置；B3→base清旧柱/派生/输入。装备只重绑一次，不新建第二角色。 |
| T04—T07 替换/门/付款/时序 | 实际新戳地而非双a3；预检不足推进a4；预检后失资源释放拒绝；挥空仍扣1、不扣MP，节点前取消不生成；原clip轨与最大key结束策略明确。 |
| T08 / T19 延迟/中断 | 本体取消后0.2延迟仍到缓存落点；死亡未生成柱；已生成大斧有限存续、注销不再接新事件；新代次旧延迟无回写。 |
| T09 柱/爆炸 | 正伤害普通波次HP-1且去重；0伤害/不碎冰拒绝；实际盾击999；HP耗尽才派生，真实空间命中80；7秒静默到期不爆。此项是模块诊断，不冒充原作OBS或普通页面全流程。 |
| T10—T13 攻击/资格/CD/重入 | 空挥发攻击但不减血；CD先提交、重复事件拒绝；实际技能左键门、抑制门；辅助独立isLeftMouse=false/tags[]，自身发事件拒绝资格，无递归。 |
| T14 / T15 身体与独立判定 | 大斧不调用身体special、不重置combo；命中实际hazard空间筛选，来源和wave独立；B3普通操作仍可闪避。 |
| T16 B3真实链 | normal-b3-ice-axe-chain：正常鼠标、WASD与页面CD等待，实际小蓝a4.8戳地攻击事件触发斧，0.12延迟后 axe-contact真实伤害；双方默认HP，僵尸AI正常。 |
| T17 / T18 资格/归属 | 非左键辅助拒绝，实际tag优先；两纯测试caster句柄不串CD或订阅；来源、槽位/实际技能、父根、attack/effect/wave和代次可定位。 |
| T21 时钟 | .016/.25帧分割、0.25×和暂停不重复付款/柱；CD使用既有模拟时钟；没有以真实时间跳过CD。 |
| T22 音画 | 原blue戳地、原柱与原斧sprite显示；release与真实damage经原音效队列，CD拒绝不播成功；旧M3失焦/暂停清声游标回归通过。音色/完整粒子仍SAMPLE，未做原作音画OBS。 |
| T23 / T24 隔离/发布 | 精确localhost白名单，只2项新增sprite；B0/energy零新素材请求；阻断斧图仅禁用axe/both，ice/base继续；主导入图/用户区/细则/父研究未改，GitHub只任务增量。 |

## 正常页面片段

B0/B1/B2相同反向挥空输入可比较原a3、戳地付款/延迟柱与斧CD；normal-b3使用Space闪避后左键新效果，随后转向敌人完成胜利并切回基础、三次重置与暂停恢复。normal-b3-ice-axe-chain单独验证真正由戳地启动的大斧伤害，不拿a1触发斧冒充组合。旧页面验证仍有正向命中、格挡正反向与合法死亡重置。

## 本轮发现与修正

测试先暴露setBuild/身份/真实辅助事件缺失、CD拒绝日志缺失、新素材错误禁用与基础提前请求问题、已释放戳地被旧a3取消路径清除及其来源日志丢失，逐项最小实现后通过。页面首次短操作依赖固定等待出现计时波动，改为正常读取UI CD后出手；没有重调已认可运行参数。Playwright对option的toBeDisabled与实际disabled属性不一致，断言改查HTML属性，未删掉资源缺失验收。

## 明确差异 / 未执行

Q1批准的新几何/付款不退款、柱位置/半径/静默到期、斧延迟/寿命与表现为SAMPLE，数值完整在契约。模拟时间沿现有hitstop/速度；clip End开放而最大keyframe完成沿AL01采用。原资源sprite不等于原粒子/消费者/OBS；原3D效果层运动未复制。原大斧0伤害卡肉.05节点未接入，保留既有AL01获准击中反馈，不能声称原卡肉已还原。全免费/热卸/零CD网络、原最终伤害、原作正常获得与观察结果没有补成通过。

主游戏旧T035初始化波动、T036自然遭遇缺trace不属于本轮修复；未重跑全项目浏览器。只做本轮必要构建/导入隔离检查。目标设备性能未测；AL02用户试玩未做，下一步只等本轮试玩，不扩角色/敌人/正式装备系统。
