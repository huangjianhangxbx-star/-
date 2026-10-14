import unittest,tempfile,sys
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from templates import build_templates,cut_tiles
try:from single_master import build_single,read_artwork
except ImportError:build_single=read_artwork=None

class SingleMaster(unittest.TestCase):
 def test_single_canvas_matches_layers_and_edit_changes_cut(self):
  self.assertIsNotNone(build_single,'linked single canvas missing')
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);build_templates(p/'source',32);meta=build_single(p/'source/A',p/'single')
   expected=cut_tiles(p/'source/A');actual=cut_tiles(p/'single')
   self.assertEqual(set(expected),set(actual));self.assertEqual(meta['stateCount'],47)
   self.assertEqual({cell['mask'] for scene in meta['scenes'] for cell in scene['cells']},set(expected))
   for m in expected:self.assertEqual(actual[m].tobytes(),expected[m].tobytes())
   row=next(s for s in meta['mapping']['states'] if s['mask']==24);x,y,w,h=row['layers'][0]['rect']
   with Image.open(p/'single/single-master.png') as source:im=source.convert('RGBA')
   im.putpixel((x+5,y+5),(255,0,255,255));im.save(p/'single/single-master.png')
   changed=cut_tiles(p/'single');self.assertEqual(changed[24].getpixel((5,5)),(255,0,255,255))
 def test_wrong_size_rejected(self):
  self.assertIsNotNone(read_artwork)
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'bad.png';Image.new('RGBA',(10,10)).save(p)
   with self.assertRaises(ValueError):read_artwork(p,(20,20))

if __name__=='__main__':unittest.main()
