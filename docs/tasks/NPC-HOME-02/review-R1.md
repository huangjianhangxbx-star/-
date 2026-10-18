# NPC-HOME-02 独立监工 R1

日期：2026-10-18。基准：`a4f89cb7b395a5bc3312db66e666caa635bb32bc`。依据：本任务 plan、ZIP 原执行计划与四项评分表。只读审查产品与测试；本监工仅写本报告。

结论：**R1 通过，9.6 / 10，无发现的硬失败或阻断项。** 本轮首份评分在 A/B/C 图与 JSON 齐全、相关单元和构建结果齐全后出具。首轮评分前的诊断补充不计第二轮。

| 维度 | 得分 / 2.5 | 依据 |
|---|---:|---|
| 行为可信度 | 2.4 | 三条 Goal 均由两个真实活动站位与停留构成；A 自然备餐到餐桌，B 书柜到座位，C 自然经后门去水点。固定输入评分稳定，有完成记忆、冷却和承诺。表现仍是计划允许的无产出占位动作。 |
| 打断与恢复 | 2.4 | B 在第二次移动 step 2 被 F 菜单与对话冻结，恢复同 step 后到 rest/step 3，未重跑书柜；单元另覆盖 dwell remaining 保留、等价点、危险超时放弃及旅行恢复。真实故事未遍历所有交错中断组合，扣留少量验证余量。 |
| 控制权安全 | 2.5 | 原 resident/party、hold、路径引用身份与 engine 移动入口保留。C 组队取消后去 102 战斗，生活 clock 不再增加，实例数为 1；测试检查同一 Unit 引用、旧 release 不清新 party 路径、离图冻结、有限阻塞重试与移动连续性。 |
| 架构扩展性 | 2.3 | home-goals 纯评分与步骤数据、home-schedule 薄适配、home-routine 唯一执行器、home-activity 兼容转发分层明确；坐标来自布局 tag。活动 tag 仍为一般 string，runtime 与当前 GameState/布局读取耦合较紧，后续扩展宜维持此边界，当前无需扩大重构。 |

## 实看证据

证据目录：`work/NPC-HOME-02/evidence/`。独立打开并检查 A-prepare、A-dine、B-dialogue、C-outside-rear-door、C-joined、C-field-combat 和 F10-prototype-night 的 PNG；读取 A 三份、B 三份、C 三份及 F10 的 JSON，并核对故事测试的输入与断言。

- A：`fixture:false`。prepare 到达约 2.2916 模拟秒、step 1 停留；dine 到达约 11.0541 秒、step 3 停留；约 14.0582 秒完成同一个 prepare-meal，随后自然选 quiet-reading。图中角色分别位于备餐台与餐桌旁。
- B：`fixture:false`。菜单/对话均保持 quiet-reading / step 2、同一位置与 remaining，clock 为 17.8667；恢复记录仍是 step 2，随后到 rest / step 3；arrived 序列仅 read、rest。浏览器断言另确认对话时世界时间继续推进。
- C：`fixture:false`。自然完成前两 Goal 后约 30.1585 秒选择 garden-care，后门外位置为 (3.7702, 5.7702)；到 garden-water 后于 step 1 成功组队，取消生活控制。外图 102 仍 cancelled，clock 与组队时同为 32.6756，instances 为 1；截图显示原角色参与现有战斗，浏览器断言确认同一 Unit 引用与实际敌人受伤。
- F10：新 JSON 明确 `fixture:"prototype-phase"`，不计自然故事。night 使阅读评分居首，prepare-meal 的当前承诺保留；界面明确“原型日相位（仅本会话）”，来源为 prototype-phase。

录像文件已提供，但本监工**没有完整播放录像，也没有听音**；本报告的实机判断基于上述截图、JSON、测试代码与执行结果。

## 独立测试与边界审查

独立执行计划最小集合加布局保护：home-goals、home-routine、home-activity、home-resident、home-join、dialogue-game、role-interaction、map-travel、map-companion、companion-combat、home-layout-fix01，共 **11 文件 99 项 PASS**。首评期间补入 Goal 历史回归后，独立仅复跑 home-routine，**6 / 6 PASS**；相关集合现在为 100 项，未重复跑已绿全组。

主执行者报告并提供本地结果：浏览器 A、B、C 与 F10 四分项均 PASS；末次 A/C/F10 同命令 3 / 3 PASS。`npm run build` 类型检查与 Vite 234 模块构建 PASS，仅原有 chunk 体积提示。监工未与其抢跑浏览器，也未重复构建。

代码核对结果：

- home-goals 无导航调用或路径写入；routine 的评分上下文只读取活动元数据、距离与物理可站性，不逐 Goal 寻路。
- 相位只改变后续评分，不抢当前承诺；恢复保留 stepIndex，dwell 恢复不重新生成 remaining；活动失效可选当前 tag 的等价点或有限退出。
- 重试间隔 1 秒、最多 3 次阻塞、失败 Goal 短冷却 8 秒；单次 navigate 预算 1600。无发现每帧无限规划路径。
- 原路径数组引用身份保护、hold 租约、组队同步取消与离图早退继续有效；没有新增移动系统、第二角色实例或奖励发放。
- home-layout 只给现有 garden-water 加语义 tag，没有改坐标、碰撞或已验收布局。

## 首评前发现与关闭

发现 F10 的“最近六次 Goal 转换”原先从通用 32 条 history 过滤，频繁对话可将 Goal 转换挤出。执行者先新增 24 次 hold/release 的失败回归，再改为独立六条转换环；监工核对修改并独立复跑 6 项通过。此项关闭。

早期 A 采集等待失败保留为失败证据，JSON 为 clock 10.7269、step 2 moving、path 3、retries 0；其原因是墙钟等待未覆盖所需模拟时间。仅放宽浏览器墙钟等待后 A 完整通过，没有改变模拟时速、坐标或 Goal。旧 F10 样本的 fixture 标记也已由明确的 prototype-phase 新样本替换。

验收范围止于当前 101、单 resident 与三条无产出生活样板。正式日历、需求、生产、离线和跨刷新存档均未实现，也未作为本轮已完成功能计分。
