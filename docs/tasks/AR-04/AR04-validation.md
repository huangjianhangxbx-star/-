# AR04 验证

完整逻辑回归与最终构建结果见 validation-logs.txt。原 AR02/AR03 fixture 没有重录；历史等价测试明确选 retained legacy 后继续验证旧字段与身份。其他职业自然映射仍为 legacy。T033 仅把 Focus 对攻击释放的观察时间从 .3 延后到 .45 秒，保留原伤害/不自动连段断言。

新测试：命名两段、0→1→0循环、超时/换目标回首段、buffer等待、缓存 Release、取消唯一、Release后移动保留结果、身份与请求来源。真实 engine 调度还检查同伴 AI 和已交战 MoveOrder 的 Hunter BasicV1；不是伪造伤害结果。

浏览器共11个不同用例：B2循环、B3超时、B4换目标、B6释放后移动、B7Shift、B8技能、B9C、B10倍速、双点击A/B、0.1×轮盘以及原真实地图左键/暂停/WASD。10个场景用例使用固定世界初始摆放与相机，所有被测操作来自真实鼠标/键盘；最后1个使用未注入世界的真实探索入口。测试器等待模拟时钟和持久事件，虚拟GPU低帧率下不以墙钟等同模拟时间。最后暂停用例等待实际Canvas动画就绪，以覆盖异步素材加载。

A/B分别使用显式 default legacy 与 hunter V1，真实左键两次，记录四个接受动作的定义、阶段、节点与身份。截图时机为Release已观察到之后，机器渲染延迟和AI位置会变化，不声称像素严格对齐。音效保留原Release路径；未做录音/听感量化。

| 版本 | 第一击 | 第二击 |
|---|---|---|
| legacy | [实拍](default-shot-0.png) | [实拍](default-shot-1.png) |
| Hunter V1 | [实拍](hunter-shot-0.png) | [实拍](hunter-shot-1.png) |

两个原命中消费者 resolveHitLegacy/releaseAttack 文本 hash 与基准相同，冻结 ActionLab 源码、用户维护区、开发细则、其他既有修改保持。单元测试输出重写的旧验证JSON另存工作证据后，依据接手hash找回完全相同旧字节，不提交这些副作用。

边界：Release .4是SAMPLE；区分第二枪/长铳表现待补；未取得原作动态消费者或OBS闭合，原作实际结果空白；本轮用户手感验收待试玩。不声称GPU性能或全部浏览器矩阵验收。
