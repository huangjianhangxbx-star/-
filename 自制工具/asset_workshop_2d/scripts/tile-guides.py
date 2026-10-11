"""Generate original explanatory diagrams, not paintings or edits of AI images."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[1] / 'resources' / 'tile-templates'
root.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 22)
small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 17)
for kind, label in [('grass', '草地连续边缘'), ('stone', '石质边缘与厚度')]:
    for mode in ['paint', 'compile']:
        image = Image.new('RGB', (1000, 680), '#20282b')
        d = ImageDraw.Draw(image)
        d.text((32, 20), label + ('｜给画师的母版排布' if mode == 'paint' else '｜切割、轮廓与世界格'), font=font, fill='#e6e2d6')
        if mode == 'paint':
            colors = ['#bdcc94', '#92a862', '#736355', '#c1bf93'] if kind == 'grass' else ['#a5a39b', '#d1cab7', '#585e60', '#bbb6a6']
            roles = ['连续表面', '草叶边缘' if kind == 'grass' else '石沿材质', '土色底图' if kind == 'grass' else '暗面厚度', '少量叶片' if kind == 'grass' else '少量缺口石块']
            for i, (color, role) in enumerate(zip(colors, roles)):
                x, y = 34 + i % 2 * 270, 86 + i // 2 * 245
                d.rectangle((x, y, x + 250, y + 225), fill=color)
                d.text((x + 15, y + 15), role, font=font, fill='#20282b' if i != 2 else '#e6e2d6')
            for n, text in enumerate(['四个连续材质区', '每区统一绘制；不是47张小图', '画布边长 / 2 = 每区边长', '切割导引另存，不能画入成品', '尺寸和区域位置锁定', '结构通过后再细化风格', '1254示例：四区各627像素', '逻辑格128px / PPU100 = 1.28']):
                d.text((600, 100 + n * 54), text, font=small, fill='#e6e2d6')
        else:
            d.rectangle((36, 95, 326, 385), fill='#879467' if kind == 'grass' else '#aaa79c')
            d.rectangle((125, 184, 237, 296), outline='#f0a377', width=4)
            d.text((36, 410), '固定相位窗口：逐像素取样', font=small, fill='#e6e2d6')
            d.text((365, 223), '→', font=font, fill='#e6e2d6')
            for y in range(3):
                for x in range(3):
                    if (x, y) == (1, 1): continue
                    xx, yy = 440 + x * 100, 160 + y * 100
                    if kind == 'stone': d.rectangle((xx - 7, yy - 35, xx + 106, yy + 100), fill='#53595c')
                    d.rectangle((xx, yy, xx + 98, yy + 98), fill='#9dac79' if kind == 'grass' else '#c4c0af')
                    d.rectangle((xx, yy, xx + 98, yy + 98), outline='#20282b', width=2)
            d.text((440, 490), '真实47 PNG → 按逻辑格拼接', font=small, fill='#e6e2d6')
            d.text((36, 545), '草地：透明边缘 + 实际绘制底图' if kind == 'grass' else '石材：可视画布大于逻辑格；保留透明、厚度与pivot', font=font, fill='#e6e2d6')
            d.text((36, 590), '此图仅说明原创候选模板。没有找回原作PSD；排序/层级仍待核实。', font=small, fill='#b9c3b5')
        image.save(root / f'{kind}-{mode}-guide.png')
