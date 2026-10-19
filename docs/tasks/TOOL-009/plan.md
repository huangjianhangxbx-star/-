# TOOL-009 第一轮执行范围

依据用户提供的《TOOL-009 3D 工坊资产浏览器多画布与体素步进建模》执行稿及 2026-10-19 对话。本轮仅实施 P1 统一项目资产浏览器与 P2 原生资产拖入试摆场景；P3 体素步进建模、P4 单文件原生资产、P5 多画布模块编辑均未开始，等待 Gate A 手感验收。

基线为 GitHub `main@eb2e7ec5615b863d5333b601060bf4d7f0faf24a`。保护 v1/Legacy、v2 项目/资产/场景 schema、公共库复制语义、FBX/Blender/Unity 契约；只改工坊资产浏览与试摆交互。无 Gitee 更新。

验证入口：`npm test`、`npx tsc --noEmit`、`npm run build`、`node tests/workshop-tool009-ui.mjs`，打包后设置 `XH_ELECTRON_EXECUTABLE` 指向便携 EXE 再运行同一 UI 回放。
