import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorDocument } from '../core/document.ts';
import { VoxelSelection, voxelKey } from '../core/voxel-selection.ts';
import { planStepScale } from '../core/voxel-step-scale.ts';
import { EditOperationSession } from '../core/edit-operation.ts';

const config = { mode: 'selection', action: 'add', color: 0, shape: 'square', size: 1, thickness: 1, level: 0, direction: 1, tag: '' } as const;
function fixture(points: [number, number, number?][]) {
  const doc = new EditorDocument();
  doc.begin();
  points.forEach(([x, y, color = 0]) => doc.volume(x, y, 0, color));
  doc.commit();
  const selection = new VoxelSelection();
  selection.replace(doc.cells.values());
  return { doc, selection };
}
const keys = (cells: Iterable<{ x: number; y: number; z: number }>) => [...cells].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z).map(voxelKey);

test('one X/Y/XY step grows a 3x3 block to 5x3, 3x5, and 5x5 without changing voxel size', () => {
  const { doc, selection } = fixture(Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3)] as [number, number]));
  for (const [axis, expected, xBounds, yBounds] of [
    ['x', 15, [-1, 3], [0, 2]],
    ['y', 15, [0, 2], [-1, 3]],
    ['xy', 25, [-1, 3], [-1, 3]],
  ] as const) {
    const plan = planStepScale(doc, selection, axis, 1);
    assert.equal(plan.destination.length, expected);
    assert.deepEqual([Math.min(...plan.destination.map(c => c.x)), Math.max(...plan.destination.map(c => c.x))], xBounds);
    assert.deepEqual([Math.min(...plan.destination.map(c => c.y)), Math.max(...plan.destination.map(c => c.y))], yBounds);
    assert.equal(plan.conflicts.length, 0);
    assert.equal(doc.doc.voxelSize, 0.25);
    assert.equal(doc.cells.size, 9);
  }
});

test('resampling preserves L shape, central hole, and nearest-source colors across negative coordinates', () => {
  const l = fixture([[-2, -2, 1], [-2, -1, 1], [-2, 0, 1], [-1, -2, 2], [0, -2, 2]]);
  const expanded = planStepScale(l.doc, l.selection, 'xy', 1);
  assert.equal(expanded.destination.length, 16);
  assert.equal(expanded.destination.some(c => c.x === 0 && c.y === 0), false);
  assert.equal(expanded.destination.find(c => c.x === 1 && c.y === -3)?.color, 2);
  const ring = fixture(Array.from({ length: 9 }, (_, i) => [i % 3, Math.floor(i / 3)] as [number, number]).filter(([x, y]) => x !== 1 || y !== 1));
  const ringPlan = planStepScale(ring.doc, ring.selection, 'xy', 1);
  assert.equal(ringPlan.destination.length, 24);
  assert.equal(ringPlan.destination.some(c => c.x === 1 && c.y === 1), false);
});

test('preflight blocks unselected overlap and leaves the model and history intact', () => {
  const { doc, selection } = fixture([[0, 0], [1, 0], [2, 0], [3, 0]]);
  selection.replace([...doc.cells.values()].filter(c => c.x < 3));
  const before = structuredClone(doc.doc), depth = doc.past.length;
  const plan = planStepScale(doc, selection, 'x', 1);
  assert.deepEqual(plan.conflicts, ['3,0,0']);
  assert.deepEqual(doc.doc, before);
  assert.equal(doc.past.length, depth);
  assert.throws(() => planStepScale(doc, selection, 'x', 0), /整数/);
  assert.throws(() => planStepScale(doc, selection, 'x', 0.37), /整数/);
});

test('commit is one undo transaction and selection can follow destination', () => {
  const { doc, selection } = fixture([[0, 0], [1, 0], [2, 0]]);
  const before = keys(doc.cells.values()), depth = doc.past.length;
  const op = new EditOperationSession(doc);
  const preview = planStepScale(doc, selection, 'x', 2);
  op.begin(config);
  const plan = op.stepScale(preview);
  assert.equal(plan.summary.estimatedAdds, 4);
  assert.equal(plan.summary.estimatedRemoves, 0);
  op.apply(plan);
  op.commit();
  assert.equal(doc.past.length, depth + 1);
  assert.deepEqual(keys(doc.cells.values()), ['-2,0,0', '-1,0,0', '0,0,0', '1,0,0', '2,0,0', '3,0,0', '4,0,0']);
  assert.equal(doc.protected.has('-2,0'), true, 'expanded volume columns retain volume protection immediately');
  doc.undo();
  assert.deepEqual(keys(doc.cells.values()), before);
  doc.redo();
  assert.deepEqual(keys(doc.cells.values()), keys(preview.destination));
});
