import sys,unittest,tempfile,json
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from model import legal_masks
try:from fixed47 import contract_for,cut_fixed
except ImportError:contract_for=cut_fixed=None

class Fixed47(unittest.TestCase):
 def family(self):
  return {'id':'synthetic-only','label':'test','entries':[{'mask':m,'originalIndex':i+1,'width':341 if i!=45 else 384,'height':512 if i!=45 else 384,'ppu':341 if i!=45 else 384,'pivot':{'x':.5,'y':.34 if i!=45 else .5},'spriteKey':'fixture-'+str(i),'sourcePng':'fixture-'+str(i)+'.png','sourceSha256':'fixture'} for i,m in enumerate(legal_masks())]}
 def test_fixed_original_index_positions_and_native_dimensions(self):
  self.assertIsNotNone(contract_for)
  f=self.family();a=contract_for(f);f['entries'].reverse();self.assertEqual(a,contract_for(f))
  self.assertEqual(a['canvasSize'],[3072,3072]);self.assertEqual(len(a['slots']),47)
  for s in a['slots']:
   i=s['originalIndex']-1;self.assertEqual(s['rect'][:2],[i%8*384,i//8*512]);self.assertEqual(s['ppu'],s['source']['ppu'])
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'paint.png';im=Image.new('RGBA',a['canvasSize']);s=a['slots'][7];x,y,w,h=s['rect'];im.putpixel((x+5,y+6),(10,20,30,255));im.save(p);tiles=cut_fixed(p,a)
   self.assertEqual(tiles[8].size,(w,h));self.assertEqual(tiles[8].getpixel((5,6)),(10,20,30,255))
 def test_no_missing_duplicate_or_wrong_size(self):
  self.assertIsNotNone(contract_for)
  f=self.family();f['entries'].pop()
  with self.assertRaises(ValueError):contract_for(f)
  f=self.family();f['entries'][1]['originalIndex']=1
  with self.assertRaises(ValueError):contract_for(f)
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'small.png';Image.new('RGBA',(10,10)).save(p)
   with self.assertRaises(ValueError):cut_fixed(p,contract_for(self.family()))
