# T-009 Blender 体块资产工作台

日期：2026-10-01。状态：实施中，尚未交付或安装。

## 授权与接手

- 来源：`自制工具/voxel_workbench/执行方案原件.md`；用户确认按推荐实施，源码目录将 tools 改为“自制工具”。
- 工具规范：米制、Z up、0.25m 吸附/尺寸步长、1m 默认方体、0.25m 薄板、零厚度面片、90°旋转、底部中心锚点。不修改游戏地格规则。
- 预设目录：`tool_data/voxel_workbench`，不放插件安装目录。
- Blender 5.1.2 / Python 3.13.9，GLB/FBX 本机接口存在。基准 main@79f09bf；T-008 未提交游戏修改保留。
- E盘此前满，2026-10-01复查恢复约6.9GiB可用。
- 不改游戏、原参考、开发细则、用户维护区；不安装到用户配置、不注册全局 Skill、不提交推送，除非得到相应明确授权。
- 已使用 writing-plans / test-driven-development；技能引用的 superpowers 执行辅助技能本机未发现，不声称已调用。按已批准任务在当前对话直接实施。

## 架构与执行计划

纯 Python 的格坐标、规范、recipe 校验与操作展开供 Blender API 和交互共用。Blender集合保存资产状态、修订与请求记录；实际网格指纹检测原生编辑。预设为版本化JSON静态几何快照。导出仅处理临时副本。

根目录：`自制工具/voxel_workbench`。下面文件均相对此目录。

- [x] P0：版本、目录、授权、现有实验、工作树和导出器检查。
- [ ] P1：`addon/model.py` / `addon/api.py` / `tests/test_model.py` / `tests/integration.py`。先测试负坐标、半格、锚点、严格schema、冲突、阵列上限；再实现 `Profile`、`snap`、`stroke_cells`、`expand_recipe`；Blender API创建/查询/持久化事务。
- [ ] P2：`addon/presets.py`，测试显式选择保存、固定版本实例、重开跨文件使用、原生静态网格；模板与色板持久化、缩略图及拆开编辑。
- [ ] P3：`addon/interaction.py`，点/连续/线/矩形/擦除、XY/YZ/XZ和轴向面、冻结笔划平面、预览、Esc回滚、整笔撤销、局部面写时复制。后台几何测试与实际界面验收分开记录。
- [ ] P4：`scripts/run_recipe.py` / `docs/API_CONTRACT.md` / `docs/AGENT_GUIDE.md`，预检、稳定ID编辑、幂等、修订冲突、限定输出目录、JSON错误报告及现有blend接力。
- [ ] P5：`addon/exporting.py`，材质GLB、色板GLB/FBX、原件不变测试、独立Three.js接收与Blender FBX往返；1000/10000体块和100组合测量，不宣称未经实测的帧率。
- [ ] P6：`recipes` / `docs/USER_GUIDE.md` / `docs/VALIDATION.md` / `agent-skill/SKILL.md` / `dist`，墙/台阶/柱/拱/树/面片样例、预览、中性渲染、ZIP及兼容边界。

每步：先运行缺失行为测试记录失败，再实现，再运行通过；实际命令及结果进入工具 `docs/VALIDATION.md`。验收按原件V01–V30逐项标记已测/待测，不能以脚本通过替代人工笔刷体验。

## 当前限制

无可调用的 Blender 实时连接；CLI可用。已探测实际window有event_simulate，是否能可靠用于界面测试仍待验证。未安装插件或注册Skill。功能尚未开始实现。
