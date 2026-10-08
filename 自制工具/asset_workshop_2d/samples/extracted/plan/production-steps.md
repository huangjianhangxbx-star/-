# 制作与检查步骤

1. 读取唯一权威规范 spec/asset-spec.json，核对manifest与全部真实参考。
2. 确认合法可用图像工具；缺失时报告阻塞并停止。
3. 区分内容参考和风格参考，只按结构化硬规格生成候选。
4. 验证真实PNG 384×384 px、Alpha transparent-required。Unity 100 PPU派生3.84×3.84世界单位。
5. 目标 output/asset.png 是未来结果，不在当前包内；真实生成后记录尺寸、透明检验与素材来源。
