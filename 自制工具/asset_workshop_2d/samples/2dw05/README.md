# 2DW-05 实际桌面导出审阅包

四包来自真实 Electron 流程，随包的 PNG 只是本工程小型自制测试参考图。ZIP 仅包含任务规范、真实参考图和**待执行**流程，不含生成素材或已完成的视觉分析。旁边同名 PNG 是桌面界面截图；`workflow-recipe-smoke.json` 是原始导出回执，里面的 `zipPath` 指向原始校验目录，复制到此处后四包 SHA256 已逐一复核相同。

| 场景 | ZIP | 条目 | SHA256 |
| --- | --- | ---: | --- |
| A 零参考、384×384 / 100 PPU | [A-no-reference.zip](A-no-reference.zip) | 11 | `1d6f8f717fc53a585217ca4b563eeb2fe2e37f3331bb2bfbd1b7da2c5a44b7b0` |
| B 内容＋风格、512×256 / 200 PPU | [B-content-and-style.zip](B-content-and-style.zip) | 13 | `043035cc6262c2e27cbba0f4f317f1c90a9ec62c6b5fb62e0df7d9498a8ddcac` |
| C 仅风格参考 | [C-style-only.zip](C-style-only.zip) | 12 | `fe6efe59b6e7180af538c84042a1defd8650b0a17c9adf265a5037939252ea82` |
| D 两张风格图、相冲突的人工备注 | [D-conflicting-style-notes.zip](D-conflicting-style-notes.zip) | 13 | `ca2204ba6d3c2a357b53e63ab2b5c0891b5a9fcad7e708b8d0e791cf3ff36041` |

审阅 D 时，双方 priority 都是 80，属于同级。配方不替用户自行决定暖亮柔边还是冷暗硬边，而要求外部执行者观察并提交争议。备注文字作为数据保存在 `spec/asset-spec.json`，不能改写 PNG 硬规格或执行边界。

每包均可先看 `README_开始阅读.md`，再核对 `manifest.json`、`spec/asset-spec.json` 与 `workflow/recipe.json`。旧样包仍在上级目录及 `2dw02/`、`2dw03/`，未覆盖。
