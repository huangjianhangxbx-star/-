# TOOL-009 第一轮执行范围

依据用户提供的《TOOL-009 3D 工坊资产浏览器多画布与体素步进建模》执行稿及 2026-10-19 对话。第一轮实施 P1 统一项目资产浏览器与 P2 原生资产拖入试摆场景。用户对修正后的拖放与资产区表示“似乎没问题”，并要求继续；第二轮按原执行稿实施 P3 整数体素步进放大，用户明确选定 B 整体步进语义。P4 单文件原生资产与 P5 多画布仍未开始，分别保留后续 Gate。

基线为 GitHub `main@eb2e7ec5615b863d5333b601060bf4d7f0faf24a`。保护 v1/Legacy、v2 项目/资产/场景 schema、公共库复制语义、FBX/Blender/Unity 契约；只改工坊资产浏览与试摆交互。无 Gitee 更新。

验证入口：`npm test`、`npx tsc --noEmit`、`npm run build`、`node tests/workshop-tool009-ui.mjs`，打包后设置 `XH_ELECTRON_EXECUTABLE` 指向便携 EXE 再运行同一 UI 回放。

P3 验证入口增加 `node tests/workshop-tool009-p3-ui.mjs`；形状语义及用户选择记录见 `p3-shape-comparison.md`。
