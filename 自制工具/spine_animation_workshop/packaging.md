# Windows 便携包

在本目录运行：

```powershell
pnpm build
node scripts/package-portable.mjs
```

默认生成 `release/xinghai-spine-animation-workshop-0.1.0-win-x64/`。若当前磁盘空间不足，可明确指定一个尚不存在的绝对目录：

```powershell
node scripts/package-portable.mjs --output 'C:\SPW-01-release\xinghai-spine-animation-workshop-0.1.0-win-x64'
```

将生成目录整体复制到目标 Windows 电脑，并运行其中的 `星骸 Spine 动画工坊.exe`。脚本在打包前检查 UI 构建文件、Electron 44.5.1 和运行时许可证；已有输出目录会被拒绝，避免覆盖。包中只有 Electron、构建后的应用文件、使用说明，以及 Electron、Spine WebGL、Spine Core、three.js 的许可声明。角色工程、GLB 样本、导出 JSON 和图片不进入包。

如需无窗口检查 EXE 内的 Electron 版本，可在 PowerShell 中临时设置 `ELECTRON_RUN_AS_NODE=1`，然后执行 `& '<EXE 绝对路径>' -p 'process.versions.electron'`。不要直接使用 `--version` 做无窗口检查；重命名后的 Electron EXE 可能启动应用窗口。
