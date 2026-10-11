# SK-01A B 级验证

2026-10-11，约14:18–14:37完成实现与定向验证，真实问题继续定向修复。不是全历史自动回归。

- 新模块先 RED：7项因正式模块不存在失败，red.log。最终 SK01A 10项：两人 Q真实HP/架势、单次支付与重复拒绝、Accept武器/形态来源、E父子来源与独立资源、配置互换/清空与CD、职业/纯查询/体力/身体锁、墙阻/trace-off、RMB松键、Z中断、死亡复活/同世界卸载继续/新世界默认。
- core.log 初始48项（SK/EQ02/F01/CB/LT）；native-core.log 28项（SK与Hunter黄金/Al原生），core-final.log 46项（最终SK、F01、LT和两原生小集）；最终来源资格补齐后 core-source-final.log 40项（SK10/EQ01/CB02）。这些日志有重叠，不相加为总数。TypeScript、主 build-final.log 和 lab-build.log 通过。保留既有大包警告，未声称GPU优化。
- 五类真实 Edge 键鼠最终分段通过：Hunter（browser2首项）、Al（browser3首项）装炸弹→C II→原生E→RMB真实投弹→WASD接近自然敌人→Q/R实际命中；配置/CD/互换/清空、F/G/暂停/repeat/Z，以及帮助取消held E+真实HUD E点击（browser4两项）；1280几何和键盘配置（browser2末项）。所有 evaluate 只读观察/几何资格查询，无运行时状态、位置、生命、资源注入。EQ02-F01独立浏览器另已通过；B收尾又定向复测见其 browser-final.log。
- 自然 Hunter：Q实际扣20HP/25架势，R18HP/30架势；Al：Q20HP/20架势，R18HP/30架势。两人日志均 form II、正确右手实例、独立 action/Release，见 browser/*natural-QR.json。护盾/原射击器消费者由F01/EQ01/Al原生小集保护。
- 1920配置图及1280 HUD实际查看，阿尔用户头像、三菱形坐标/外框保留；未添加UI图片资源。

## 失败与处理

browser.log 初四剧本通过。补充 RMB 后 browser2 的阿尔固定落点未成功投弹：只读选择可通过原 queryOffhandAction 的附近点，真实鼠标投弹后通过，不放宽墙/落点资格。browser2 同时暴露动作条整块重建导致编辑按钮反复被移除：改为保留按钮DOM身份后通过。

browser3 另记录：开发中热更新重载使配置测试观察到未初始化 prototype；稳定代码后仅定向重测。尝试头less另开页验证失焦未实际交付可证明的window blur，不能记为真实失焦验收。改为实际帮助模态验证同一 releasePhysicalInputs 清理入口；其取消和迟到keyup通过。实际OS失焦/切应用保持未测，源码仍沿既有blur/visibility处理，Q/R接入pause取消。

核心夹具允许明确操纵位置/障碍/死亡来覆盖拒绝及生命周期，这与自然浏览器无注入证据分开。仍未验证全部地图、刷新存档、目标GPU/音质/所有设备；Q/R临时手感与命名未获用户试玩认可。原生E动画带盾外观仍是F01已记录的表现待适配项。未执行SK01B、成长或自动施法。
