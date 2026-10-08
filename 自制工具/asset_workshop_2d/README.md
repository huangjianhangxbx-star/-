# 星骸 2D 素材任务工坊 · 第一轮

本轮完成独立 Electron 启动壳、统一静态 PNG 规范，以及固定 Codex 任务 ZIP 样例。当前是 **2DW-00/01 + 04/05 最小纵向验证**，停止等待规范、Prompt 和 ZIP 组织审阅。

本机可双击 [启动工坊.cmd](启动工坊.cmd)。固定样例为“地下石墙独立素材”：384×384 px、默认100 PPU、3.84×3.84世界单位、要求未来图片透明背景。

- [真实任务 ZIP](samples/2dw-proof-codex.zip)
- [已解压的阅读入口](samples/extracted/README_开始阅读.md)
- [验收记录](docs/VALIDATION.md)
- [规范契约](docs/FIRST_ROUND_CONTRACT.md)
- [选择性复制说明](docs/COPY_SOURCE_MATRIX.md)

这是任务说明和两张自制参考图；**没有生成目标 output/asset.png**。窗口提供检查、预览规范/指令和导出。已有同名 ZIP 时明确拒绝覆盖，第一轮没有另存为或完整表单。

## 开发与复现

需要 Node≥24、pnpm11.25.0；本轮实测Node24.19.0、Electron44.5.1、Windows。全部依赖由本目录pnpm-lock.yaml锁定。

```text
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm test
pnpm start
```

初次安装依赖可能需要下载；运行和导出不需要网络。首次全新安装若Electron安装脚本没有执行，需按本地pnpm策略允许已列出的Electron/esbuild安装步骤。当前本机已准备好自身运行时。

`pnpm run proof`与界面导出使用同一个模块，固定写入validation/proof-output/2dw-proof-codex.zip。`pnpm run smoke`用于**尚无同名ZIP的测试副本**，会真实启动、封闭网络、导出、验证同名拒绝后退出；已有样例时不重复覆盖。可通过TWO_DW_OLD_EXE显式指定用于并行验证的旧应用，默认不启动其他程序。

独立审计脚本scripts/verify-proof.py需要Python及Pillow，只用于测试：重新解压到尚不存在的validation/proof-extracted，检查CRC、SHA256、引用与PNG解码。它不参与产品运行。

完整预设/表单、参考图管理、生图、拼接、导回和Unity导入器留待后续；用户在第一轮验收后明确授权将本轮成果提交并推送 GitHub main。samples/保留已校验的审阅ZIP及解压阅读副本；运行生成物仍在忽略的validation/内。未启动2DW-02。
