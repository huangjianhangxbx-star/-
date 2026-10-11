# 2DW-TILE-02 原创技术夹具任务包

这六个 ZIP 由真实 workflow/session/store/package API 生成：草地、石材各包括 sample-task、style-refine-task、formal-master-task。所有 PNG 均为本工程原创程序诊断夹具，不含原作、AI 返回图或用户图片。

正式包使用 test-only V3 的真实生产门禁审批，approvedBy 为 synthetic/test-only。V2 仅模拟风格步骤的导入，不宣称实际调用 AI。程序检查通过不等于用户认可的美术；Unity 高度排序仍未验证。

固定测试规格：逻辑格 64px、PPU 100、seed 17；materials.png 精确 256×128、contour.png 精确 128×64；47 状态与每状态 4 个实际变体。包内 spec/asset-spec.json 是硬规格权威，输入图仅允许本包明确列出的来源。

校验：SHA256.json 给出六包 SHA256。使用 node -e "const fs=require('fs');require('./archive/export-zip.cjs').validateZip(fs.readFileSync(process.argv[1]));console.log('verified')" samples/2dw-tile02/proof-1791723603696/grass-sample-task.zip（从工坊目录运行；重复生成时使用本目录实际路径）。签名是技术发行完整性，不是权利或美术认证。

复现：node scripts/tile02-proof.mjs。新证据、可恢复工程与撤销/重新批准记录在 validation/2dw-tile02/proof-时间戳；后续任务 ZIP 写入新的子目录，绝不覆盖已有包。同机审批密钥只留本地 store，不进入这些公开任务包。
