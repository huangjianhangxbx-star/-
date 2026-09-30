# T-006 验证证据

最终：209项逻辑测试、51项完整浏览器测试、生产构建通过。对应本地main@95a4226上的第三轮修改；证据冻结时没有提交/推送；后续GitHub发布按任务最新记录。详细验收和限制见[任务验证](../../../docs/tasks/T-006-验证记录.md)。

| 文件 | 用途 |
|---|---|
| r3-final-unit.log / r3-final-build.log / r3-final-browser.log | 最终完整验证结果 |
| r3-initial-full-browser.log | 首次全量50通过1失败，失败未忽略 |
| r3-movement-repro.log / r3-movement-green.log | 原旧用例连续5次失败，CSS修复后同用例连续5次通过 |
| r3-movement-diagnose.json / .cjs | 在3次操作中捕获拦截地面点击的透明world-skill容器；诊断脚本，没有生产调试日志 |
| r3-core-*-red.log / r3-core-green.log | 培养、状态缓存、权限和重复请求的先红后绿 |
| r3-engine-review-red.log / green.log | 旧视野残留、本次施放范围快照修复 |
| r3-real-map-playthrough.json / .log / .cjs | 不改生命/钱/敌人/波次的原地图命令闭环、环境指纹与台账 |
| r3-build-desktop.png / compact.png / shield.png | 最终界面尺寸与实际施法护盾截图；shield是显式受控场景，不是45敌人通关截图 |
| source-manifest.json | 最终src/tests TypeScript与CSS文件SHA256 |

复跑需先在项目根启动game的Vite服务，依赖已安装。以下从项目根执行，不从证据子目录执行：

```powershell
npm --prefix game test
npm --prefix game run build
node game/node_modules/@playwright/test/cli.js test --config game/playwright.config.ts --workers=1
node 记录/验证/T-006/r3-real-map-playthrough.cjs
```

复制到本目录的脚本已调整依赖相对路径；脚本重新运行输出仍写项目work目录，不覆盖本次冻结证据。原地图脚本为自动战术命令加速模拟；用户真人UI试玩、正式平衡和真实性能另行验收。
