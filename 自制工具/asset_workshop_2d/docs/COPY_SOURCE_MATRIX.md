# 第一轮选择性复制与隔离

旧根：自制工具/map_editor/。复制前已审查直接依赖；原文件未修改。全部新文件位于asset_workshop_2d，运行时不读取旧源码或旧node_modules。

| 旧路径 | 新位置 | 处理 | 直接依赖与理由 |
| --- | --- | --- | --- |
| desktop/main.cjs | desktop/main.cjs、runtime.cjs | 采用隔离配置/主框架IPC判定思路，重写 | Electron、Node path/url；只保留固定样例3个IPC，拒绝远程请求/导航/新窗口/权限 |
| desktop/preload.cjs | desktop/preload.cjs | 采用成功/失败包装方式，重写白名单 | Electron contextBridge/ipcRenderer；不迁入体素API |
| desktop/files.cjs | archive/export-zip.cjs | 采用临时写/冲突/哈希理念，新写实现 | Node fs/crypto、fflate、pngjs；先重读验证，再原子无覆盖发布 |
| desktop/workshop-theme.css | desktop/theme.css | 复制开头语义色变量，其余布局新写 | 纯CSS，无旧页面依赖 |
| scripts/build.mjs | scripts/build.mjs | 重写入口与输出 | esbuild；仅core与桌面renderer写入自身dist |
| scripts/package.mjs | 无 | 舍弃 | 旧固定发行路径、3D示例、Unity/Blender插件不适用 |
| package.json | package.json/自身锁文件 | 新建独立身份及最少依赖 | 不继承Three、体素与旧workspace |

独立身份：xinghai-asset-task-workshop-2d / 星骸 2D 素材任务工坊0.1.0。userData固定为自身.cache/asset-task-2d-profile，输出固定为自身validation/proof-output。第一轮未制作便携发行EXE，启动脚本使用本工程的Electron运行时与已构建dist。

依赖通过自身锁文件安装。因Electron安装器下载停滞，本机复用了已有**同版本第三方Electron44.5.1运行时dist与path.txt**到新工程自己的包目录；未复制旧node_modules整树、旧应用代码或用户配置。独立测试副本从pnpm本机内容缓存离线安装21个包（0下载），再放入同版本运行时并独立构建/运行。该结果证明当前缓存环境可复现，不代表无缓存机器可免下载首次安装。
