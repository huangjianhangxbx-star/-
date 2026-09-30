import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'addon'))
from model import snap, stroke_cells, expand_recipe, Profile, anchor_offset, srgb_to_linear, boxes_overlap, spaced_cells


class GeometryTests(unittest.TestCase):
    def test_touching_boxes_are_legal_but_solids_cannot_overlap(self):
        self.assertFalse(boxes_overlap(((0,0,0),(1,1,1)),((1,0,0),(2,1,1))))
        self.assertTrue(boxes_overlap(((0,0,0),(1,1,1)),((.5,0,0),(1.5,1,1))))

    def test_brush_spacing_follows_footprint(self):
        self.assertEqual(spaced_cells([(i,0,0) for i in range(9)],(4,4,4),(0,0,0)),[(0,0,0),(4,0,0),(8,0,0)])

    def test_negative_half_grid_is_symmetric(self):
        self.assertEqual(snap(-0.125, .25), -1)
        self.assertEqual(snap(.125, .25), 1)

    def test_fast_stroke_fills_missing_cells(self):
        self.assertEqual(stroke_cells((0, 0, 0), (4, 0, 0)), [(0,0,0),(1,0,0),(2,0,0),(3,0,0),(4,0,0)])

    def test_bottom_and_face_anchors(self):
        self.assertEqual(anchor_offset((2,4,6), 'bottom'), (0,0,3))
        self.assertEqual(anchor_offset((2,4,6), 'x+'), (-1,0,0))

    def test_srgb_is_not_used_as_linear(self):
        self.assertAlmostEqual(srgb_to_linear(.5), .21404114, places=6)

    def test_array_and_strict_validation(self):
        request = {'schema_version':'0.1','request_id':'r1','asset_id':'wall','expected_revision':0,
                   'profile_id':'project.demo','profile_revision':1,'operations':[
                       {'op':'place_array','id_prefix':'b','template_id':'base.cube',
                        'origin_cells':[0,0,0],'size_cells':[4,4,4],'count':[2,1,1],
                        'spacing_cells':[4,4,4],'color_id':'stone.base'}]}
        ops = expand_recipe(request, Profile())
        self.assertEqual(len(ops), 2)
        self.assertEqual(ops[1]['position'], [1,0,0])
        request['operations'][0]['typo'] = 1
        with self.assertRaises(ValueError): expand_recipe(request, Profile())

    def test_massive_array_rejected_before_allocation(self):
        request = {'schema_version':'0.1','request_id':'r1','asset_id':'wall','expected_revision':0,
                   'profile_id':'project.demo','profile_revision':1,'operations':[
                       {'op':'place_array','id_prefix':'b','template_id':'base.cube',
                        'count':[100000,100000,100000],'color_id':'stone.base'}]}
        with self.assertRaises(ValueError): expand_recipe(request, Profile())


if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(GeometryTests))
    if not result.wasSuccessful(): raise RuntimeError('Unit tests failed')
