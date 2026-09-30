# T-007 原始验证证据

本目录保存2026-09-30角色技能重制的失败、通过、素材报告、版本指纹、截图与真实地图命令轨迹。结论和边界以[验证记录](../../../docs/tasks/T-007-验证记录.md)为准，技能含义看[内容表](../../../docs/tasks/T-007-内容与界面方案.md)。

最终逻辑268项与构建通过；完整浏览器第一次55通过／1条旧名称断言失败，修正测试预期后personal7项通过，最终全部56项有通过覆盖。`final-browser.log`保留失败，不覆盖成虚假的全绿日志。P1—P5及后续*-red日志保留定位过程；旧P1-models截图不是最终新模型证据。

从项目根目录运行：

```powershell
npm --prefix game test
npm --prefix game run build
node game/node_modules/@playwright/test/cli.js test --config game/playwright.config.ts --workers=1
```

浏览器配置使用Windows Edge、单worker、1440×900与SwiftShader；需原型开发服务。可从game目录启动 `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`。新素材／构筑测试在`game/tests/rework.spec.ts`，可单独指定此文件。新行为测试在rework-*.test.ts，342种配置枚举在rework-boundaries.test.ts。

额外证据脚本同样从项目根目录运行，输出就地写回本目录：

```powershell
node 记录/验证/T-007/real-map.cjs
node 记录/验证/T-007/ui-scene.cjs
node 记录/验证/T-007/fingerprint.cjs
```

real-map只通过生产command/step推进原45敌人地图；ui-scene用真实界面配置、消费36／40碎片、点击部署与施放，用生产step加快观察，不直接赋值HP／余额／波次。后者的首轮重复入口选择器失败在ui-scene-first.log，修正脚本后结果见ui-scene.json／log。

fingerprint是本机源核对脚本：除仓库源码／资产外，只读E:/迅雷下载中的原计划和C:/Users/Administrator/Desktop/新建文件夹 (3)中的两个新素材目录；其他机器没有这两个原始位置时，可直接查source-fingerprint.json及工程素材，不必为游戏运行恢复这些路径。原始源资产无需修改，复制文件均完整进入工程。

素材解析：asset-audit.json、fx-audit.json保存本机原源的真实动画表；rendered-source-actions.json由浏览器对工程副本采样真实像素。最终展示battle-models.png／battle-field.png；三角色完整培养截图build-*.png保留面板滚动后的实际状态。
