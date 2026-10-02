# 地图工坊 M1.1 验证记录 · 2026-10-02

本轮基准为 `main@52de84a`，在其他任务的未提交修改同时存在的工作区中进行；经用户随后授权，本工具和独立游戏接入作为本轮 GitHub main 更新。Windows、Node 24.19.0、Electron 44.5.1、Three 0.186.1、Blender 5.1.2、团结 2022.3.62t13 Built-in。验证图只对应单表面拓扑，4 个 0.25 米体素 = 1 游戏 U。

|检查|本轮结果|
|---|---|
|工具核心|`node --test tests/*.test.ts`：40/40；包含六面拾取、连通填充、非法附着、旧标签迁移、迟到网格、颜色与批量改名。|
|真实 Electron UI|`tests/m11-stroke-ui.mjs`、`m11-layout-ui.mjs`、`m11-rectangle-ui.mjs`、`m11-real-assets-ui.mjs`、`m11-batch-rename-ui.mjs`、`m11-migration-ui.mjs`：6/6。持续按键截图见 `../validation/m11-stroke-held.png`。|
|样本编辑|`tests/m11-sample-edit-ui.mjs`：真实打开、修改、保存 `samples/tower-ruins/遗迹双路.xhmap.json` 至修订 2；截图见 `../validation/m11-sample-edited.png`。完成后不再运行强制重建脚本覆盖该修订。|
|游戏逻辑|`game` 目录 `vitest run`：39 文件、375/375；本图新用例覆盖携入消费、召影、猎人移动/瞬影、三波胜利、自然水晶失败、重试与奖励去重。`tsc --noEmit` 与 Vite build 通过。|
|游戏页面|`game/scripts/check-workbench-ui.mjs`：真实浏览器进入样本战斗，无页面异常，截图 `game/validation/workbench-battle.png`。页面标题仍沿原型总标题，不代表关卡名错误。|
|团结|真实 2022.3.62t13 批处理 proof，`../validation/logs/tower-sample-proof.json`：8576 体素、100 表面、5 模型、4 事件、1 贴花；双实例、更新、失败回滚、重开通过；Prefab GUID 保持。|
|便携 EXE|`node scripts/package.mjs` 后 `node tests/package-smoke.mjs`：启动、保存、另存、复制、外部冲突保护通过；源码与包内 `renderer.js`、`rename-plan.cjs`、样本 JSON、说明文档 SHA256 一致。|

首次 M1.1 包遗漏 `desktop/rename-plan.cjs`，启动时会弹出 “Cannot find module './rename-plan.cjs'”。已补入包并修正打包脚本；最终包复测通过。该报错并非地图数据损坏。交付路径为 `release/星骸地图工坊-M1.1/星骸地图工坊.exe`，须保留整个便携目录。

已覆盖的自动验证不等于最终人工验收。交接截图中的原始条纹没有可恢复的地图源，故只能用等价最小案例修复与回归；复杂剖切封口、真实资产与角色比例、完整鼠标/WASD/影庭手感、数小时资源增长，以及团结菜单的人手点击仍待复查。当前游戏不支持地图 JSON 运行时热重载，改源后需重新构建/刷新原型。首图不支持同一游戏 U 内混合高度或桥上下同时战斗；不承诺正式性能或美术定稿。
