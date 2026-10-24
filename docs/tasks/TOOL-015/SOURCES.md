# TOOL-015 来源与核对边界

编制日期：2026-10-25。核对的main提交：`1d3b15eeb4e7f833895c168dff2329bc627b6f8b`。本次未运行仓库代码或用户本机EXE。

本次分支读取返回与上一轮相同SHA，因此复用本会话同版本代码正文，并对需要补齐的坐标/租约/规则读取。未以历史“测试通过”代替本轮执行结果。

## 仓库来源（固定提交，不跟随main漂移）

### S1 · `AGENTS.md`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/AGENTS.md)
本轮读取；根路径、授权与保护边界。

### S1 · `design/开发细则.md`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/design/%E5%BC%80%E5%8F%91%E7%BB%86%E5%88%99.md)
核对版本blob未变，复用本会话此前完整正文，并补读第5/6/7节；不改此文件。

### S1 · `docs/CurrentRules.md`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/docs/CurrentRules.md)
本轮读取相关工坊段落；显示、作者色、独立窗口、历史和画布列表现行约束。

### S2 · `自制工具/map_editor/desktop/paint-workspace.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/desktop/paint-workspace.ts)
同一SHA的上一轮完整读取＋本轮目录blob核对未变；颜色、busy和主会话命令行为。

### S2 · `自制工具/map_editor/desktop/surface-paint-tools.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/desktop/surface-paint-tools.ts)
同一SHA的上一轮分段完整读取＋本轮目录blob核对；单面足迹、插值、填充、异步commit。

### S3 · `自制工具/map_editor/core/surface-paint.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/core/surface-paint.ts)
同版本此前读取数据定义与校验；本轮目录blob一致。64px/m、不透明HEX和预算。

### S4 · `自制工具/map_editor/desktop/paint-session-contract.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/desktop/paint-session-contract.ts)
本轮完整读取；唯一权威、对象范围、revision、去重与单命令在途。

### S5 · `自制工具/map_editor/desktop/color-wheel.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/desktop/color-wheel.ts)
同一SHA此前完整读取＋本轮blob核对；可复用色环。

### S6 · `自制工具/map_editor/core/brush.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/core/brush.ts)
同版本此前完整读取＋本轮blob核对；建模候选与预算。

### S6 · `自制工具/map_editor/core/edit-operation.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/core/edit-operation.ts)
已确认实际文件存在；具体新接入和全部调用路径须在M0补读，未声称本轮全审。

### S6 · `自制工具/map_editor/core/pixel-perfect-stroke.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/core/pixel-perfect-stroke.ts)
目录中确认实际模块；首版仅借用思路，执行前读取完整实现与相关测试。

### S7 · `自制工具/map_editor/desktop/canvas-view.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/desktop/canvas-view.ts)
本轮读取1–160及240–360行相关内容；活动画布显示换算、拾取、owner和u/v。

### S8 · `自制工具/map_editor/core/appearance-color.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/core/appearance-color.ts)
此前完整内容与本轮blob核对一致；作者色与视口灯光分离。

### S8 · `自制工具/map_editor/core/painted-glb.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/core/painted-glb.ts)
确认现有导出接入路径和当前blob；实施阶段须补读现行完整合成算法。

### S8 · `自制工具/map_editor/core/glb.ts`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/core/glb.ts)
确认现有导出路径；当前行为结合CurrentRules和交接，不把旧版源码片段当本轮完整审计。

### S9 · `docs/tasks/TOOL-014/README.md`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/docs/tasks/TOOL-014/README.md)
同版本此前完整读取；窗口范围、已知限制和P1–P3状态。历史测试不算本轮验证。

### S9 · `自制工具/map_editor/tests/paint-window-ui.mjs`
[固定版本文件](https://github.com/huangjianhangxbx-star/-/blob/1d3b15eeb4e7f833895c168dff2329bc627b6f8b/%E8%87%AA%E5%88%B6%E5%B7%A5%E5%85%B7/map_editor/tests/paint-window-ui.mjs)
本轮读取开头实际夹具与启动部分；正式测试扩展时再读相关断言。

## 适用规范与缺失项

- 根AGENTS已核对。`自制工具/AGENTS.md`读取返回404；目标map_editor根目录、core与desktop目录元数据未列出额外AGENTS。执行前仍检查测试目录及本地新增指令，不能把远端结果当成本地完整配置。
- `docs/tasks/TOOL-015`返回404，所以编号只是拟用；未排除同号不同文件名或并行未推送任务。
- 本Chat技能发现没有取得writing-plans/前端技能的真实说明，未调用这些Skill。未为此安装任何软件。
- 原TOOL-014计划的P1/P2/P3从本对话已挂载MD相关段落核对；独立窗口等实际状态以仓库代码/CurrentRules/交接为准。

## 外部一手资料

- **E1** [Aseprite Context Bar](https://www.aseprite.org/docs/context-bar/)：工具上下文参数、像素完美开关和填充容差的交互参考。没有复制其算法或声称克隆全部功能。
- **E2** [Aseprite Selecting](https://www.aseprite.org/docs/selecting/)：选区替换、加减等基础操作参考。
- **E3** [Blender Texture Paint Symmetry](https://docs.blender.org/manual/en/latest/sculpt_paint/texture_paint/tool_settings/symmetry.html)：按模型空间轴镜像笔触的参考。工坊采用自身Z-up与画布网格，非照搬Blender变换状态。
- **E4** [Electron Security](https://electronjs.org/docs/latest/tutorial/security) 与 [IPC](https://electronjs.org/docs/latest/tutorial/ipc)：发送者身份校验和受限通信边界的依据。本轮不升级Electron。

## 附图

`references/当前贴图窗口.png`复制自用户本次上下文的实际窗口截图`image(20261024-210758).png`，原字节保留。它说明当前入口与工具简陋的情况，不是目标概念图、测试通过证据或可发行美术。

## 交付件检查

只检查Markdown编码、章节/终止标记、附件存在、ZIP CRC和SHA256，不声称通过任何项目功能测试。MANIFEST逐项列出实际打包字节；manifest不包含自身哈希，避免循环。
