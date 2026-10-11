# RFC-MAP-EX01 地图 PNG 研究交接（2026-10-11）

已按用户批准计划完成本地研究库；结果保留明确阻塞与待判定用途，不宣称原画无损恢复或全游戏100%覆盖。本记录仅含自写方法和汇总，不含原作图片、图集或可还原第三方资源的完整数据。

本机库：`E:\WORLDCREATOR\XingHaiHuiLang\Origin\work\参考研究\ReturnFromCore\24101688-RFCMAPEX01`。入口 `gallery/index.html`；主报告 `reports/study-report.md`；覆盖/异常 `reports/coverage-and-failures.md`；复核边界 `reports/review-notes.md`；复跑方法 `reports/handoff.md`；完整性 `validation/final-gates.json`。

Steam Build24101688、Unity2020.3.3f1c1。清点2089 manifest、19274逻辑路径、315232对象头；不会把这些数当图片数量。初选4779 Sprite，视觉复核排除37，最终纳入4742，成功4722（99.578%），阻塞20。直接安装原PNG=0；导入前作者画布不可恢复。

| 来源/用途族群 | Sprite PNG | 阻塞 |
|---|---:|---:|
| crop | 124 | 0 |
| farm | 6 | 0 |
| ground | 978 | 0 |
| overlay | 2 | 0 |
| prop | 1113 | 0 |
| stone | 465 | 0 |
| uncertain | 528 | 20 |
| vegetation | 784 | 0 |
| wall | 722 | 0 |

另外完整关联纹理1056张（明确SpriteAtlas对象31个；其他包括独立纹理）、直接地图候选纹理876张，合计有效PNG6654张。直接纹理中389张是ColorTex地图编辑辅助图，不冒称运行时美术。原图与缩略图/联系表分目录，图集可能混用，全部原作图仅本机ignored目录保存。

32个前序代表对象均与当前对象身份关联，其中15个实际Sprite全部对应真实PNG。墙631001与石1000各48/48索引闭合；RT_Ground_8权重60/20与邻接分开；6种农田及124张作物视觉阶段有独立分组。石2006的48个Tile原字段无Sprite/Prefab，因此不假填图片。

验证B级：9项安全/解码模块检查通过（其中分离Alpha为合成夹具）；有效PNG存在/可解码/尺寸/模式/SHA一致；稳定身份不重复、pathID字符串、引用闭合、pending=0。索引丢失恢复测试保留全部原成功哈希并3项verified-skip；随后按最终分类重验九族离线浏览、搜索/PPU/尺寸/透明度与原图加载，没有外部网络请求。78项图册及两组48序列做代理目视复核；未冒充人工美术批准或实机接缝验收。

解码边界：UV异常导致原工具部分失败，使用自写exact-rect-mesh-mask-v2，保留原尺寸切片/转向/有效轮廓；223项实际切片超出取整SpriteRect不强裁。61项纯色经原生矩形对照保留为辅助例外，3项全透明ColorTex保持blocked；20项模板Sprite纹理指针为空。不会用假图凑数，也不会把GPU解码PNG说成作者源PNG。

保护核验4658文件：游戏与前序成果、规则/人工区未变；19个game/src文件在执行期间发生其他工作区变化，本任务没有写这些路径、不会纳入提交。2D/3D工坊、Unity工程和开发细则未由本任务修改。既有未提交内容不回滚、不清理。

原作PNG、Atlas、完整索引/复原数据不发布。仅选择性提交本记录、任务自己的项目状态块和当日日志到GitHub main，不同步Gitee。未启动RFC-ART02或后续工坊开发；人工下一步为uncertain用途复核及另行批准的实机接缝/原创规格任务。
