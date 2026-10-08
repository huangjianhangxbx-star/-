# EN-01 验证与证据

2026-10-09；冻结实现基准为 EN00 提交 `877a3f4` 上的本任务增量。

| 状态 | 结果 |
|---|---|
| Implemented | 单敌 V2、六事件、独立 Ready、身份/实体生命周期、主结算、Legacy gate、opt-in 面板 |
| Auto-tested | EN01 定向 29/29；全量 104 文件、1379 通过/2 跳过（随后补充 Hitstop 和无敌窗外两项，由定向 29 项覆盖） |
| Browser verified | EN01 9 项 + AR06 黄金 2 项，11/11；最后面板目标/方向文字增加后入口 smoke 1/1 |
| User accepted | 既有 Hunter/Al 黄金认可保持；EN01 最终怪物手感未请求、未声称认可 |
| Pending | EN02–06、具名 AI/音画、架势、目标 GPU 性能、移动端完整布局 |

TypeScript 无错误；主构建、Action Lab 构建通过。主 chunk >500 KB 提示仍在，未把已有体积提示包装为性能验收。软件 WebGL 浏览器运行较慢，轮询依据模拟事件而非固定墙钟 5 秒。

## A01–A18

| 项 | 证据及边界 |
|---|---|
| A01 | action tests：方向/range/LOS/control/death 拒绝不付 CD、不造 ID |
| A02 | entity + main integration：同一扇区两人各一次；浏览器分别以自然输入让 Hunter/Al 真扣 HP |
| A03 | 缓存方向、目标离开单元回归；真实 held A 挥空（B），真实 Z/W/D 站位（A-Al） |
| A04 | 同实体多帧一次、同 root 不同实体各接触；不是普遍 root 伤害去重规则 |
| A05 | 主方向盾正面 block、背面真实扣血；浏览器实际 RMB 格挡（D） |
| A06 | 正常 Al roll 命令的主无敌窗接触；过窗后返回受控扇区扣 HP。后者明确是 logic geometry fixture |
| A07 | 单元真实墙挡扇区/运输；浏览器 E 在既有墙两侧注入运输提交，不称自然 AI 资格通过 |
| A08 | 有释放但无 contact；主 HitOutcome 不因释放产生；浏览器 B 释放仍有而 Hunter HP 不变 |
| A09 | Hit 前真实受伤/control cancel，未来事件不补发 |
| A10 | retain/clear 单元验证；浏览器真实 LMB 杀死已释放身体（G），落地保留。LMB 前冲离开落点，因此浏览器该次落地合法挥空；真实死后伤害另由 main integration 验证 |
| A11 | 延迟 2 秒的受控 fixture：Finish 后 spawn，出生前无接触；低帧 child 身份时间回归 |
| A12 | generation reset + 同 ID 重入；浏览器 24 次切换/Reset，实体归零，无旧 delayed contact |
| A13 | Trace on/off 比较真实净 HP、ID、RNG、诊断决策/时点；authority 不依赖 Trace |
| A14 | .1/1/2、低帧有序事件、暂停以及共享 Hitstop 单元；浏览器真实 Space/G/Alt。时点用模拟时钟比较 |
| A15 | 缓存 target/caster/point；浏览器 windup 中真实 Z |
| A16 | 无旧 Intent/reaction/telegraph；主断点式 gate 审查+integration 计数，未加入假旧系统 counter |
| A17 | 默认入口无 V2；104 文件回归涵盖 identity/黄金/XX/切人/Tower/Legacy；真实 AR06 2 项再通过 |
| A18 | 24 次同页面重入仅一个 panel/overlay，渲染 actor 数不增长；构造只一次监听，dispose 可清理。没有测浏览器堆 GC 或长时 GPU 内存 |

原始日志/JSON/PNG 在本地 ignored `work/EN-01/`，其中 `browser-frozen.log` 为 11/11，`core-final.log` 为 29/29，`full-vitest-final.log` 为完整 1379/2。主实际输入截图：`browser/A-hit-Z.png`、`A-Al-hit.png`、`B-whiff.png`、`D-guard.png`、`G-death-after-release.png`、`H-reset.png`、`I-clock.png`。注入障碍：`E-wall.png` 及 placement JSON。方法字段随各 JSON 保存。

## 失败记录与保护

早期两浏览器失败已修正测试：软件渲染需等待真实 finish；发射后 LMB 前冲不应硬要求落地必中。另一轮 G 测试遇到编辑产生 Vite HMR；冻结代码后重跑 11/11。早期 Al 等待原站位扣血失败，因为陪伴 AI 已把他带出范围；改为真实 Z/W/D 走近后命中，未改黄金参数。Hitstop 新测试第一次采样尚未到 Finish，延长模拟观察窗口后有序六事件通过。失败日志保留。

已知 T036 旧浏览器基准单独回跑三项：S4 冻结目标现在通过；S3/S7 仍因读取已移除的 `evasion.charges` 报错，与接手前 AR06-G01 记录的失败一致。S5 历史失败本轮未重跑。未删旧测试，未宣称全浏览器套件绿色。

接手保护清单 143 文件：允许变化的既有文件仅 combat-identity/types/engine/engagement/main 五项；其余 138 项包含开发细则、用户区、黄金角色包和研究合同，发布前逐字节 SHA256 复核。共享记录仅追加本任务块；暂存使用 HEAD 内容加增量，保留他人工作区修改。没有新增二进制、GitHub 以外推送或 Gitee 同步。
