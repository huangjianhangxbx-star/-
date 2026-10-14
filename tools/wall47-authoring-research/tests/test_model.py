import unittest,sys,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
try:import model
except ImportError:model=None
class Contract(unittest.TestCase):
 def test_normalize_and_partition(self):
  self.assertIsNotNone(model,'pure model missing')
  self.assertEqual(model.normalize(1),0);self.assertEqual(model.normalize(255),255)
  legal=model.legal_masks();self.assertEqual(len(legal),47)
  self.assertEqual([sum(model.cardinal_count(m)==n for m in legal) for n in range(5)],[1,4,10,16,16])
 def test_identity_rejects_incomplete_mapping(self):
  self.assertIsNotNone(model,'pure model missing')
  with self.assertRaises(ValueError):model.validate_mapping({'0':0},48)
 def test_ppu_pivot_are_real_not_square(self):
  self.assertIsNotNone(model,'pure model missing')
  b=model.bounds(341,512,341,(.5,.34),(0,0));self.assertAlmostEqual(b[0],0);self.assertAlmostEqual(b[1],-.010498533724340176);self.assertAlmostEqual(b[3],1.4909677419354839)
 def test_rect_rejects_subpixel_and_outside(self):
  self.assertIsNotNone(model,'pure model missing')
  with self.assertRaises(ValueError):model.check_rect([0,0,1.5,4],(4,4))
  with self.assertRaises(ValueError):model.check_rect([0,0,5,4],(4,4))
 def test_path_cannot_escape(self):
  self.assertIsNotNone(model,'pure model missing')
  with tempfile.TemporaryDirectory() as d:
   with self.assertRaises(ValueError):model.safe_path(Path(d),'../wrong.png')
 def test_invalid_pivot_does_not_create_nan_placements(self):
  self.assertIsNotNone(model)
  with self.assertRaises(ValueError):model.bounds(341,512,341,(float('nan'),.34),(0,0))

if __name__=='__main__':unittest.main()
