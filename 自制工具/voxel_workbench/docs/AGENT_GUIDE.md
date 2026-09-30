# Agent 建模与接力

先读API_CONTRACT和VALIDATION。以实际 `.blend` 为事实来源，不以旧recipe为事实来源。

首次创建可从 `recipes/wall.json` 拷贝结构，改变asset_id/request_id和构造参数。生成可由同一API继续修改的mesh，不另建一套建模器。

PowerShell示例：
```powershell
& 'D:\steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python-exit-code 1 --python 'E:\WORLDCREATOR\XingHaiHuiLang\Origin\自制工具\voxel_workbench\scripts\run_recipe.py' -- --recipe '已批准的recipe完整路径' --output-dir '已批准的输出完整路径' --render
```

已有资产增加 `--input '实际输入.blend'`。先用只读Blender脚本调用inspect，确认修订和实例ID，然后生成局部修改recipe。不要在修改前清空已有场景。新输出目录保留原输入。

验证结果应包含实际模型数量/尺寸、预览与导出文件；区分Blender渲染、独立查看和想象中的效果。CLI输出result.json；异常返回非零并写error.json。使用普通未修改的Blender可打开结果，材质不依赖自定义游戏赋色。

所有能力当前是开发验证版，尤其预设笔刷、全局色板UI与完整录屏未完成，不应向用户承诺已验收。
