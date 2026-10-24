# TOOL-014 技术交付回执

实现U0–U7首轮功能，可试玩；用户审美与易用性验收待反馈。P1–P3没有实施。

- 功能代码/EXE：`c5f60d747a217f84ecab09f9069e9f18d30f84d4`（主功能1865735，两个随后UI修正a690e2a/c5f60d7）。
- sourceFingerprint：`d9085678cf3a7552e322479cd6e0ff034492b5c4bb14c90e5573366f5d671526`。
- 构建UTC：2026-10-24T18:41:54.684Z（北京时间2026-10-25）。
- 本地EXE：`E:/WORLDCREATOR/XingHaiHuiLang/Origin/work/TOOL-008/checkout/自制工具/map_editor/release/星骸地图工坊-Workshop-M2.0/星骸地图工坊.exe`。
- 旧TOOL-013包：同级`星骸地图工坊-Workshop-M2.0-TOOL013-6e85894`；旧TOOL-012回退也保留。运行中的旧窗口需关闭再开新EXE。

## 已执行
470项核心测试通过；TypeScript检查/构建通过。真实Blender5.1.2导入GLB/FBX，几何、六向法线、UV、材质和旁车PNG回读通过。布局/显示改变前后相同源GLB（含内嵌图像）逐字节一致。

最终EXE跑过完整`paint-window-ui.mjs`和`workshop-shell-ui.mjs`：六面三精度、填充/多笔/擦除、共享撤销重做、失效租约拒绝、五次开关、保存失败后重试、主关闭与项目切换取消、子进程崩溃后已提交内容保留、真正退出并重新启动读取；主窗释放写租约后可建模/撤销。自动上色在新布局真实应用/撤销，保存返回/放弃、显示/相机/布局/帮助保持草稿、塑形停靠/折叠恢复；1500×940、1280×800、1000×700及150%缩放定向检查。

v1同故事和Legacy独立页面烟测已在源码构建执行（非逐项重跑所有历史UI）。1万/4万格性能观察见[数据](performance.json)，五次子窗开关进程/内存记录见[数据](paint-window-metrics.json)。它们是短时本机测量，不是跨硬件帧率保证或长期泄漏证明。

## 实际截图
[默认建模](screenshots/model.png) · [自动上色](screenshots/color.png) · [真实独立绘画窗](screenshots/paint.png) · [岩体塑形](screenshots/rock.png) · [1280×800](screenshots/1280.png) · [1000×700](screenshots/1000.png) · [150%](screenshots/150percent.png)。均为原创夹具的实际EXE截图，第三方参考图片未提交。

## 试玩和边界
重启EXE，在模型制作顶部点击建模/自动上色/贴图绘制；高级旧命令在建模命令，Root在资产更多→资产定位。默认副视口及资产抽屉收起，顶部随时打开。

仍为单体素面内笔刷/填充；没有跨面像素完美、一体素笔刷复位、自动结构描边、UV编辑或任意图层栈。窗口32MiB消息上限、4096命令后保存重开是显式边界。旧几何撤销需返回主窗，子窗只撤销本次进入后的笔触。迁移表标明未逐按钮UI重跑项；系统菜单逐组合、拔显示器、主窗重载及长期压力未完整故障注入。详见[实现与试玩](README.md)和[迁移表](FEATURE_MAP.md)。

GitHub开发main按既有授权同步；最后文档提交与EXE代码SHA不同，以本回执和build-receipt.json为准。Gitee未更新。
