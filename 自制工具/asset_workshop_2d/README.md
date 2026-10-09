# 星骸 2D 素材任务工坊

独立的离线 Electron 工坊，用来制作**交给 Codex 的静态 PNG 素材任务 ZIP**。它不生成目标图片、不调用 AI API，也不修改 Unity 工程。当前只支持「独立静态 PNG」与「自定义静态 PNG」两种种子，适配器只有 `codex@1`；五维身份显示在模式选择下方。

双击 [启动工坊.cmd](启动工坊.cmd)，或在本目录执行 `pnpm start`。本机已安装的依赖可离线运行；首次在新机器安装依赖可能需要网络。开发环境为 Node ≥24、pnpm 11.25.0、Electron 44.5.1。

## 桌面操作

1. 选择模式，填写任务 ID、标题、内容和人工风格描述。输入宽高、Alpha 策略及 Unity PPU；默认 PPU 为 100。勾选正方形时，未填写的高度由宽度推导；已明确填写且不等的高度会报冲突，须自行修改。
2. 可选「添加 PNG」，通过系统文件选择框选 0–8 张本地图片。每张图可设为内容或风格参考，填写说明、优先级，或移除。原图片保持原字节；主进程验证 PNG 并保存临时令牌，页面不取得绝对源路径。
3. 自定义模式另有三层有序要求：硬内容、偏好、创意空间。切回普通模式后，这些要求不会进入普通任务包。
4. 点击「生成预览」，核对完整规范 JSON、Codex 指令与预计 ZIP 条目。修改任何字段或参考图后须重新预览。
5. 点击「导出任务 ZIP」，用系统另存为窗口指定 `.zip` 文件名和位置。成功状态显示实际路径及 SHA256。同名文件**不会覆盖**；取消对话框保留当前草稿。

ZIP 采用 Schema `1.1.0`，含 7 个固定文本/manifest 条目，加上真实选中的参考 PNG；不含未来目标 `output/asset.png`。默认 PPU 100 时，384×384 px 对应 3.84×3.84 世界单位；显式 PPU 200 时，512×256 px 对应 2.56×1.28。

## 运行与验证

```text
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm test
pnpm start
```

本目录还提供 `pnpm run smoke:workflow`，以真实 Electron 窗口执行离线 A/B/C 表单流程；测试会模拟系统对话框的返回值，生成物写入忽略的 `validation/2dw03/`，不会改写样包。`pnpm run smoke` 验证首轮固定样例的兼容桥接，**只应在尚无同名 proof ZIP 的隔离副本运行**。`pnpm run proof` 也会写固定 proof ZIP，不要在已有原件上重复运行。

审阅入口：[2DW-03 验收记录](docs/VALIDATION-2DW03.md) · [2DW-02 预设规则](docs/PRESETS.md) · [首轮固定样例](samples/2dw-proof-codex.zip)。

当前没有外部可写预设库、其他 AI 适配器、AI 生图、拼接裁切、专业植物/农田规则、Unity 导入或便携发行版。首轮 `1.0.0` 黄金 ZIP、2DW-02 A/B/C 样包与旧 `checkProof` / `exportProof` 接口仍保留。
