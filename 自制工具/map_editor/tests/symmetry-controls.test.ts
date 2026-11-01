import test from 'node:test';
import assert from 'node:assert/strict';
import * as controls from '../desktop/symmetry-controls.ts';
import { EditorDocument, createMap } from '../core/document.ts';
import { EditOperationSession } from '../core/edit-operation.ts';
import type { SymmetrySpec } from '../core/symmetry-space.ts';

const target: controls.SymmetryTarget = {
  key: 'rock', origin: [-1, 2, -.5], step: .125,
  cells: [{ x: -2, y: 1, z: 0 }, { x: 3, y: 4, z: 5 }],
};
test('model and selection centers use actual voxel bounds in the native world frame', () => {
  const api = controls as any;
  assert.equal(typeof api.symmetryBoundsCenter, 'function');
  assert.deepEqual(api.symmetryBoundsCenter(target), [-.875, 2.375, -.125]);
  assert.deepEqual(api.symmetryBoundsCenter(target, [{ x: 3, y: 4, z: 5 }]), [-.5625, 2.5625, .1875]);
  assert.equal(api.symmetryBoundsCenter(target, []), null, 'an empty selection has no guessed center');
});
test('half and whole native-grid moves change real mirrored brush destinations and keep one stroke history', () => {
  const api = controls as any;
  assert.equal(typeof api.offsetSymmetryCenter, 'function');
  for (const step of [.25, .125, .0625]) {
    const frame = { ...target, step }, original: SymmetrySpec = { axes: [true, true, true], center: [...frame.origin] };
    const x = api.offsetSymmetryCenter(original, frame, 0, 1, .5);
    const xy = api.offsetSymmetryCenter(x, frame, 1, -1, 1);
    const xyz = api.offsetSymmetryCenter(xy, frame, 2, 1, .5);
    const e = new EditorDocument(createMap()), op = new EditOperationSession(e);
    op.begin({ mode: 'volume', action: 'add', shape: 'square', size: 1, thickness: 1, level: 0, direction: 1, color: 0, tag: '', symmetry: xyz, symmetryOrigin: frame.origin, symmetryStep: step });
    op.apply(op.brush({ x: 2, y: 0, z: 0 })); op.commit();
    assert.deepEqual([...e.cells.keys()].sort(), ['-2,-3,0', '-2,0,0', '2,-3,0', '2,0,0']);
    assert.deepEqual(original.center, frame.origin, 'moving the center does not mutate previous settings');
    e.undo(); assert.equal(e.cells.size, 0); e.redo(); assert.equal(e.cells.size, 4);
    assert.throws(() => api.offsetSymmetryCenter(original, frame, 0, 1, .25), /半格|步长/);
    assert.throws(() => api.offsetSymmetryCenter({ ...original, center: [NaN, 0, 0] }, frame, 0, 1, .5), /有效|有限/);
  }
});
