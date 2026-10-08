# 2DW-00/01 首轮规范契约

本轮只建立独立静态PNG任务的 Draft→Resolved Spec→Codex文本链，以及另一个模块的最小真实ZIP证明；不执行生图、不联网、不导入Unity、不实现完整预设表单。默认100 PPU是本任务决定，不来自原作资产研究。

## 公共 API 与唯一权威

从 `core/task.ts` 导入 `resolveSpec(draft, facts)`、`serializeSpec(spec)`、`compileTask(spec)`、`compileCodex(spec)` 和Schema类型。

- `resolveSpec` 返回递归冻结的 `ResolvedAssetSpec`，不修改Draft或facts。
- `serializeSpec` 对对象键作稳定排序，保留数组语义顺序，输出两空格缩进及末尾LF。自由文字统一NFC/LF；引用按role/refId排序。
- `compileTask` 返回 `{entries:Record<string,string>}`，使用同一个Resolved Spec，不从Prompt反解析规范。
- `compileCodex` 为固定Codex@1模板，仅消费权威规范，不能更改数值或源引用。

Schema版本 `1.0.0`，预设 `standalone-static-png@1`（或`custom@1`的占位身份），Adapter `codex@1`。本轮不支持任意版本/其他AI适配器。

## Draft 的字段

```ts
{
  schemaVersion?: '1.0.0',
  taskId: string, title: string, description: string, styleDescription?: string,
  presetId?: 'standalone-static-png' | 'custom', presetVersion?: '1',
  adapterId?: 'codex', adapterVersion?: '1',
  output: {
    format?: 'png', widthPx: number, heightPx: number, ppu?: number,
    alphaRequirement: 'transparent-required' | 'opaque-required' | 'alpha-allowed',
    relativePath?: string
  },
  presetDefaults?: Partial<OutputInput>,
  hardConstraints?: Partial<OutputInput>,
  requirements?: {hard?: string[], preferences?: string[], creativeFreedom?: string[]},
  references: [{refId, role:'content'|'style', sourcePath, note, priority?: number}]
}
```

`facts`由独立读图模块提供，逐个为 `{refId,sha256,byteLength,widthPx,heightPx,sourceName}`。两边refId集合必须完全一致；缺失、重复、孤立事实与非法身份均报错。resolver不以文件扩展名代替PNG检查；真实PNG解析、CRC和ZIP哈希由archive负责。

Resolved参考记录保留role/refId/note/priority及实际哈希/字节/尺寸/sourceName，新增 `references/{role}/{refId}.png` 包内路径。**不保留sourcePath**，sourceName不得含路径分隔符/盘符。内容参考与风格参考角色独立，未做图像风格识别。

## 默认、覆盖、硬约束与来源

PPU项目默认100 → `presetDefaults`有效值 → `output`本次有效显式值。默认format=png、relativePath=`output/asset.png`来自首轮预设。宽高与Alpha须显式输入或由有效预设提供，不能从自由文字猜出。

`hardConstraints`是解析后的验证锁，不是额外覆盖层；冲突抛 `SpecValidationError`，带字段路径与 `constraint-conflict` 代码，不能继续生成成功任务包。所有输出结构化字段均是有效硬规格；requirements的hard、preferences和creativeFreedom保持分离。

`fieldSources`标记 `project-default` / `preset-default` / `user-override` / `derived` / `reference-fact`。worldWidth/Height仅按width/height÷PPU派生，不转成格数，不隐藏舍入：384×384在100 PPU下3.84×3.84，在200 PPU下1.92×1.92，图片像素尺寸不变。

## 固定文本包与未来成果

核心编译固定六条文本，不生成manifest或图片：

1. `README_开始阅读.md`
2. `spec/asset-spec.json`
3. `spec/style-profile.md`
4. `plan/production-steps.md`
5. `prompts/codex.md`
6. `validation/checklist.md`

archive另外加入manifest和两张真实自制参考图，首轮proof共9条。`output/asset.png`是未来需要实际图像工具生成的成果，当前ZIP中不存在。

自由描述、人工风格与参考备注经JSON字符串转义，放在显著标注的低优先级数据区域；其中的Markdown、路径、工具命令和“忽略以上规范”不能覆盖硬规格或获得写权限。Style文档只复述人工输入，不伪造图像识别结果。Codex必须确认图像能力，工具不可用时报告阻塞并停止，不得用文字、空文件或改扩展名冒充PNG。

## 有限预算与安全路径

| 对象 | 首轮预算 |
| --- | --- |
| 未来目标画布（仅规范） | 正整数宽高，单边≤8192，总像素≤67,108,864 |
| PPU | 有限正数，≤1,000,000 |
| 实际参考图 | 1–8张；单边≤4096，总像素≤16,777,216；每图≤4MiB、合计≤32MiB |
| 自由文本 | 每字段UTF-8≤64KiB；标题≤240字节；备注/需求条目≤4096字节 |
| 需求列表 | 每级≤32条 |
| ID | ASCII字母/数字开头，后续字母/数字/下划线/短横线，总长≤64，拒绝Windows设备名 |
| 目标相对路径 | `output/安全文件名.png`，不得绝对路径、反斜线、`..`、其他目录或设备名 |

预算用于拒绝不受控输入，不承诺当前环境一定能生成最大画布。archive对参考图另做真实解码与文件读取验证，核心不会读取源文件或写ZIP。

## Task 1 状态与真实 TDD 证据

- [x] 两个测试文件先写，首跑因核心模块尚不存在而报import错误；该次只算接线缺口。
- [x] 补上无功能scaffold后观察RED：30项中29失败，默认PPU=0、无校验、空entries；其中空序列化让确定性比较错误通过，补上真实JSON/PPU断言后保留该检验。
- [x] 替换scaffold为resolver/compiler，30项GREEN；随后参考预算三项新增测试观察RED（Missing expected exception），统一预算后33项GREEN。
- [x] 最终核心33/33通过，TS7类型检查通过，无测试mock、未执行图像生成。

在本目录执行的实际命令（Node v24.19.0，2026-10-08）：

```text
node --test tests/spec.test.ts tests/codex.test.ts
node --test --test-name-pattern="reference .*budget" tests/spec.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

使用真实可用 `test-driven-development` Skill及其`writing-good-tests.md`。该记录仅证明核心契约和文本编译；ZIP/PNG、Electron与保护哈希的最终证据由整轮VALIDATION另行记录。不提交、不推送、不改旧工坊或人工原稿。

收尾补充：极小正PPU派生无限世界尺寸的回归先RED再GREEN，最终核心34/34，全工程51/51。派生世界尺寸必须为有限数，不能序列化成null。
