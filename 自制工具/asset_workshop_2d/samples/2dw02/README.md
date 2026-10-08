# 2DW-02 审阅样包

这里是离线素材**任务说明 ZIP**，不是生成的美术 PNG。三包均由 `scripts/make-2dw02-samples.mjs` 使用可信组合预设和 `tests/fixtures/` 中的自制 PNG 生成；`validation/2dw02/samples/` 保留本地验证副本。逐包的规范、Prompt、manifest 散列见 `samples-report.json`，独立 Python 解压核验见 `independent-zip-check.json`。

| 文件 | 场景 | SHA256 |
| --- | --- | --- |
| `2dw02-A-square-zero-ref.zip` | 384×384、100 PPU、正方形、0 参考图 | `826969c53217906873ad32e5388591914832dfdbd581c4602e3eee668cd3b1fc` |
| `2dw02-B-rectangle-two-ref.zip` | 512×256、显式 200 PPU、2 张自制参考图 | `ab9cff68e1559c0c8c023b82ac3839439ff499986e7989a3970631bbceca1d24` |
| `2dw02-C-custom-one-ref.zip` | 640×480、100 PPU、1 张自制参考图及三层文字要求 | `900ef6c58b93b1e820387e849fababe2d2410781cc625f264cb48790e0e72006` |

使用说明与边界见 `../../docs/PRESETS.md` 和 `../../docs/VALIDATION-2DW02.md`。首轮黄金包 `../2dw-proof-codex.zip` 未修改。
