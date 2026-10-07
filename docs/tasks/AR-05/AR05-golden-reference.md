# AR05 黄金参照
用户试玩认可版本为 M2 ae999aa4bc94ef82afa8503cbbf00856ad45d196；执行参照 M3 002396ce656331768e9677f68df2aa3ca4d95606 仅修暂停声音泄漏。接手基准 cc5fd5a85c649a98df16758cf0790a92cb594456。

冻结代码来自 git show M3 的 profiles/reference.ts、sample.ts、m2.ts 及 runtime；本机副本 work/AR-05/frozen。黄金 JSON 先从冻结版本录制，再执行主运行时差分；正常测试只读 JSON，不重新录制。生成工具保留在 ignored work/AR-05，禁止用主实现反向生成期望。

AR05-golden-reference.json 是 held 1.45 实秒的原事件回放；AR05-frozen-cases.json 是 dodge/active/cancel/pause/slow 各 1.2 实秒回放。事件顺序严格相等、模拟时点误差≤0.010001秒，独立动作位移误差<0.04，held总位移按2位小数比较。碰撞条件一致：敌人不决策但身体仍参与碰撞。

REFERENCE 是原资源事件/动画与已核数值；SAMPLE 是已批准 M1/M2 判定、位移、无敌、格挡与恢复实验消费者。迁移不把 SAMPLE 改称原作事实。原作实际结果 OBS 保持 null。来源及文件 SHA256 见 AR05-provenance.json。
