import unittest,sys,tempfile
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
try:from templates import build_templates,cut_tiles
except ImportError:build_templates=cut_tiles=None
class Production(unittest.TestCase):
 def test_c_exports_every_declared_preview(self):
  with tempfile.TemporaryDirectory() as d:
   build_templates(Path(d),64)
   tiles=cut_tiles(Path(d)/'C')
   for mask,expected in tiles.items():
    with Image.open(Path(d)/'C/tiles'/f'mask-{mask:03}.png') as actual:
     self.assertEqual(actual.convert('RGBA').tobytes(),expected.tobytes())
 def test_two_plans_cut47_from_declared_real_pixels(self):
  self.assertIsNotNone(build_templates,'authoring templates missing')
  with tempfile.TemporaryDirectory() as d:
   report=build_templates(Path(d),64)
   for name in ['A','B']:
    tiles=cut_tiles(Path(d)/name);self.assertEqual(len(tiles),47);self.assertEqual(tiles[0].size,(64,96))
    self.assertGreater(tiles[0].getchannel('A').getbbox()[3],64)
    self.assertIsNone(tiles[255].getchannel('A').getbbox())
    self.assertEqual(tiles[24].getpixel((32,80))[3],255)
    self.assertEqual(tiles[66].getpixel((32,80))[3],0)
   self.assertGreater(report['A']['continuousRegions'],1)
 def test_bad_cut_does_not_export_fake_tile(self):
  self.assertIsNotNone(build_templates,'authoring templates missing')
  import json
  with tempfile.TemporaryDirectory() as d:
   build_templates(Path(d),64);p=Path(d)/'B/cut-map.json';m=json.loads(p.read_text(encoding='utf8'));m['states'][0]['layers'][0]['rect'][0]=-1;p.write_text(json.dumps(m),encoding='utf8')
   with self.assertRaises(ValueError):cut_tiles(p.parent)
 def test_facing_panel_starts_half_cell_and_continues_full_height(self):
  self.assertIsNotNone(build_templates,'authoring templates missing')
  with tempfile.TemporaryDirectory() as d:
   build_templates(Path(d),64);tile=cut_tiles(Path(d)/'B')[24]
   self.assertEqual(tile.getpixel((32,32))[3],255)
   self.assertEqual(tile.getpixel((32,48))[3],255)
   with Image.open(Path(d)/'B/front-strip.png') as image:self.assertEqual(image.size,(64,64))

if __name__=='__main__':unittest.main()
