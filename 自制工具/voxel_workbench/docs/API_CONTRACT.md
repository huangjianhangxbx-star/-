# 工作台 API 0.1（开发中）

在 Blender Python 中将工具根加入 sys.path，然后 `from addon import api`。安装ZIP中的模块名为 `xinghai_voxel_workbench`，用相同相对API。

`api.capabilities()`、`api.get_profile(asset_id=None)`、`api.inspect_asset(asset_id)` 返回实际能力、规范、实例和修订号。`api.set_default_profile(dict)` 修改当前场景的新资产默认规范，旧资产保留自身快照。

`api.validate_recipe(recipe)` 校验结构、引用、ID和修订号，返回展开操作。注意：当前几何占位冲突在 apply 的事务暂存阶段检查，尚未完整加入只读预检。

`api.apply_recipe(recipe)` 用临时对象处理一批操作，然后提交。recipe 顶层必须为：

```json
{"schema_version":"0.1","request_id":"unique-001","asset_id":"example.wall","expected_revision":0,"profile_id":"project.demo","profile_revision":1,"operations":[]}
```

建块：`{"op":"place","id":"stone","template_id":"base.cube","origin_cells":[0,0,0],"size_cells":[4,4,4],"color_id":"stone.base"}`。

阵列：将 op 改 `place_array`、id 改 `id_prefix`，加 `count:[2,1,1]` 和 `spacing_cells:[4,4,4]`。实际ID为 `prefix.x.y.z`。

可选 `rotation:[0,0,90]`、`mirror:[true,false,false]`、`anchor:bottom|center|x+|x-|y+|y-|z+|z-|custom`；custom_anchor 以米指定局部锚点。旋转为轴对齐角度。

`base.panel` 默认4×4×1格；`base.plane` 厚度必须0。模板、尺寸、颜色从profile读取。palette color为sRGB RGBA。

修改：
- `{"op":"paint","id":"stone","color_id":"leaf.dry","faces":[0]}`；省略faces则全块。
- `{"op":"transform","id":"stone","position_cells":[8,0,0],"rotation":[0,0,90]}`。
- `{"op":"delete","id":"stone"}`。

新请求携带 inspect 的revision；旧request_id相同内容只返回不重复执行，不会把资产倒回旧版本。非法输入抛ValueError。CLI错误文件包含类型与原因。

其他接口：

```python
api.validate_asset(asset_id)
api.render_preview(asset_id, '/approved/path/preview.png', resolution=600)
api.export_asset(asset_id, '/approved/output', mode='material', format='GLB')
api.export_asset(asset_id, '/approved/output', mode='palette', format='FBX')
api.list_presets('/approved/library')
api.save_preset(asset_id, ['stone'], 'ruin.stone', 'Stone', '/approved/library')
```

预设放置：`from addon.presets import place_preset`，调用 `(asset_id, instance_id, library, preset_id, version, position_in_meters, rotation_in_radians=0)`。该接口尚未达到recipe的幂等与修订保护水平，当前仅供顺序、无并发的明确调用。

上限：单请求最多2000条操作、最多展开20000块。当前碰撞是轴对齐包围盒保守判断。API不是Python安全沙箱；输出路径由调用者明确传入，不能来自不可信recipe字段。
