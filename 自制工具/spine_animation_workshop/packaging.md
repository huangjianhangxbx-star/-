# Windows 便携包

在本目录运行：

```powershell
pnpm install --frozen-lockfile
pnpm build
node scripts/package-portable.mjs --output 'E:\SPW-02-release\xinghai-spine-animation-workshop-0.2.0-win-x64'
```

输出目录必须预先不存在。把整个目录复制到目标 Windows 电脑，运行其中的 `星骸 Spine 动画工坊.exe`。程序默认进入 Spine → Spine；右上角可进入旧 GLB 模式。

打包脚本会检查两个页面的构建结果、Electron 44.5.1 和运行时许可证，并拒绝覆盖已有目录。包内只有 Electron、已构建程序、使用说明和依赖许可证；不包含角色 `.spine`、JSON、atlas、贴图或映射证明素材。完整导出和 `.spine` 工作副本须另外准备。

如需无窗口读取 EXE 内 Electron 版本，可在 PowerShell 中临时设置 `ELECTRON_RUN_AS_NODE=1`，再执行 `& '<EXE 绝对路径>' -p 'process.versions.electron'`。
