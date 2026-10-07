# AR03 验证

- 生产前冻结旧基线；Runtime RED：7 失败/4 通过。新增漏 terminal 检查确实抓出 buffer 覆盖问题后最小修复。
- 最终逻辑回归：90 文件，1286 通过、2 个受保护旧基线录制器跳过。旧 gameplay/identity 两组冻结等价与新 Runtime 16 项、T033 三段完整执行通过。
- 六个不同浏览器用例通过：AR02 真实空挥/暂停/新副本/Tower 重入，T035 按住移动切人，T036 轮盘取消不漏 Basic、同键 Shift、正常遭遇战术交替，新增 AR03 正常空挥唯一 Start/Release/Finish 与跨世界重置。正常遭遇及 AR03 smoke 不注入 HP/命中结果；其它资格 fixture 沿原回归保留。
- main 与 Action Lab 分别 tsc+Vite 构建通过。仅构建 Lab，不改冻结 Lab 源码/素材/映射；未声称目标设备 GPU 性能验收。
- 原 releaseAttack/resolveHitLegacy 文本比对；旧验证输出被测试重写后，归档本轮产物并按 intake SHA256 恢复原字节。
- 5438 条既有 Git 状态路径、开发细则指纹保护。共享工程记录采用原工作树追加，Git 索引只纳入 HEAD+AR03 本块，不夹带用户旧修改。

原始日志位于本机 `work/AR-03/`；必要终结结果见 [validation-logs.txt](validation-logs.txt)，冻结文件与保护校验见 [AR03-verification.json](AR03-verification.json)。

全量首轮曾有一个 T033 旧可变 Profile 测试入口失效；迁到新 definition 测试入口后保留三段真实执行断言。无未解决逻辑或浏览器失败。AR03 是架构等价验收，用户新手感验收/下一角色设计尚未开展。
