# 文件选择目录记忆（0.2.3）



按用户反馈，为来源 .spine、目标 .spine、GLB、配置及输出分别保存最近确认目录，使用用户配置目录中的 dialog-directories.json，重启/更换便携包可沿用。首次选择来源或目标可借用另一侧目录；取消不更新，旧目录丢失回退到存在的上级，配置损坏可恢复，打开/保存配置共用目录。首次使用新版仍需选择一次，旧版没有目录历史。

125 测试中 116 通过、9 跳过、0 失败，类型检查/构建通过。最终包的真实主进程 IPC 代码使用临时真实文件与替代对话框验证四项跨重启/分离/取消/路径删除/损坏恢复场景，全部通过；最终 EXE 隐藏启动验证通过。未占用鼠标手动选择系统对话框。交付 E:\SPW-02-release\xinghai-spine-animation-workshop-0.2.3-directory-memory-win-x64\星骸 Spine 动画工坊.exe。旧版保留，GitHub 新进展已基于远端合入；无 Spine 源码冲突。

验证入口：tests/dialog-history.test.ts。设置 SPW_TEST_MAIN_PATH 为便携包 resources/app/desktop/main.cjs 可验证实际打包代码；未设置时使用源码。
