# 2DW-03 桌面工作流审阅样本

三份 ZIP 均由真实 Electron 窗口填写表单、预览后导出。自动化只替代 Windows 对话框选定的测试路径；主进程、真实 PNG 解码、规范编译、归档写入和重新校验均走产品代码。另已在真实 Windows 原生选图和保存对话框中完成一次 E 盘选图、C 盘保存；其[回执](native-dialog-receipt.json)与 [8 条目 ZIP 审阅副本](native-dialog-export.zip)也保存在本目录。该副本 SHA256 为 `c273a80bd665e78cd71d4bfedc0f5579f69c57add444e07521308163a7f8f51b`，CRC 和 manifest 全条目哈希另行通过复核。原生对话框没有可用截图，回执不替代用户本人试用。

| 样本 | 条目 | 参考图 | ZIP SHA256 |
| --- | ---: | --- | --- |
| [零图普通模式](ui-zero-reference.zip) | 7 | 0；384×384 / 100 PPU，方形高度推导 | `2d443c69254d2ec8c475b39effac573a6d2dc319eddd5dc6b50f4be122322c73` |
| [两图普通模式](ui-two-references.zip) | 9 | 内容 + 风格；512×256 / 200 PPU | `253d16631dce4ddc39c04a8fbbd67dc3473847b6baf531a09fa01f878e07f843` |
| [单图自定义模式](ui-custom-reference.zip) | 8 | 内容；三层要求各一条 | `dfb24396e26f1aa0af4b79bbb85c0bf12525dc4f2558f42e6e75caca0f475643` |

两图包的文本已独立解出到 [extracted-two-reference](extracted-two-reference/README_开始阅读.md)。[samples-report.json](samples-report.json) 记录每包和参考图 SHA256。[两图窗口截图](ui-two-references.png)、[窄窗口截图](ui-narrow.png) 等对应最终 UI。独立 Python `zipfile` 检查通过 CRC、manifest 中每条 SHA256 与长度、原自制 PNG 字节比较；规范没有本机绝对源路径，ZIP 不含 `output/asset.png`。

这些是任务说明包，不是已生成的素材图片。后续人工体验仍须用户确认。
