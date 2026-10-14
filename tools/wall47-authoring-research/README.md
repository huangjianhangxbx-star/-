# 47态墙体画师母版研究工具

独立研究页，未接入2D工坊。程序读取本机已有的研究证据，不解包游戏。仓库不提供原作PNG、索引、重建场景或研究数据。Pillow是Python依赖；浏览器测试使用项目已有Playwright与Edge。

## 本机启动

在本目录运行 `./start.ps1`。默认入口 http://127.0.0.1:5294/gallery/artist-workflow.html 。脚本复用本工具的健康服务；端口被其他服务占用时明确失败，不终止他人进程。服务独立于本次终端，但退出Windows或进程被结束后需要重新启动。

先决条件：本机已有RFCTILEGRAM02的gallery/data.json和生成图片，以及RFCMAPEX01的catalog/asset-index.jsonl、登记PNG与tools/gallery_server.py。启动脚本可传Study、Library、Python、Port参数。文件定位复用本机G01的受限ID接口；下载源码本身不能凭空恢复私有研究库。

## 复跑

`python -X utf8 -m unittest discover -s tests`；`node browser-smoke.cjs <研究输出目录>`；`node world-smoke.cjs <研究输出目录>`。两项浏览器测试要求5294新研究页和5293旧研究页已经启动；浏览器测试会真实调用Explorer和暂时使用浏览器剪贴板。

`study.py --old <旧语法库> --library <PNG研究库> --output <独立研究输出> --families <已登记族ID...>` 生成证据与原创提案；`make_steps.py <独立研究输出>` 生成步骤图和原创模板ZIP。只在新的输出区运行，源PNG只读。裁切使用整数窗口，不能把该原创提案的100PPU当成原作PPU。

离线可直接打开输出gallery/artist-workflow.html；复制路径、Explorer定位和精确Alpha点选需要localhost HTTP。冷启动file模式可看图片与模板；不保证停止服务后的HTTP缓存离线可用。
