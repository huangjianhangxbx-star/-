# 自制测试参考图

`content-01.png` 是简化石块分缝线框，`style-01.png` 是两块低饱和配色。二者均为 32×24 RGBA PNG，由 `scripts/create-fixtures.mjs` 使用 pngjs 的确定性像素绘制创建，没有 AI 生图、游戏资源、截图或外部素材。

测试与 proof 只读取这两张图。重新制作夹具应显式运行生成脚本；普通导出不会改写它们。`.tmp/` 用于真实 PNG/ZIP 测试的受控目录，各案例结束后清理自身随机子目录。
