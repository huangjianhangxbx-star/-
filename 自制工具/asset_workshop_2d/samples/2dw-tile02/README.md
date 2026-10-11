# 2DW-TILE-02 六个原创技术任务 ZIP

全部图片为自制技术夹具，未包含原作、真实 AI 返回或用户私人参考。样品/收口/人工版本用于测试步骤；synthetic/test-only 批准不代表真实美术定稿。包内唯一硬权威为 spec/asset-spec.json，发行指纹与 SHA 见各包 manifest。

| 候选 | 少量样品 | 指定原图收口 | 批准后正式制作 |
|---|---|---|---|
| 草地 | [sample-task](proof-1791723603696/grass-sample-task.zip) | [style-refine-task](proof-1791723603696/grass-style-refine-task.zip) | [formal-master-task](proof-1791723603696/grass-formal-master-task.zip) |
| 石质边界 | [sample-task](proof-1791723603696/stone-sample-task.zip) | [style-refine-task](proof-1791723603696/stone-style-refine-task.zip) | [formal-master-task](proof-1791723603696/stone-formal-master-task.zip) |

[六包 SHA256](proof-1791723603696/SHA256.json) · [生成与来源说明](proof-1791723603696/README.md)

逻辑格64px/100PPU，materials256×128、contour128×64。独立核验（工坊目录）：

```text
node -e "const fs=require('node:fs');require('./archive/export-zip.cjs').validateZip(fs.readFileSync(process.argv[1]));console.log('verified')" samples/2dw-tile02/proof-1791723603696/grass-sample-task.zip
```

可恢复工程、撤销/重新批准、经典/新方案地图与真实AI实验仅在本机验证区；使用 `node scripts/tile02-proof.mjs` 可重建原创技术工程，保留所有原包。
