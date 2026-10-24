import assert from 'node:assert/strict';
import test from 'node:test';
import { stepFrame } from '../src/ui/time-controls.ts';

test('frame stepping uses the selected sample rate and clamps to the trim range', () => {
  assert.equal(stepFrame(0.5, 0.5, 1, 2, 30), 0.5 + 1 / 30);
  assert.equal(stepFrame(0, 0, 1, 2, 30), 1 / 30);
  assert.equal(stepFrame(0, 0, -1, 2, 30), 0);
  assert.equal(stepFrame(0, 1.99, 1, 2, 30), 2);
});

test('a dragged time snaps to the next or previous sample frame', () => {
  assert.equal(stepFrame(0.5, 0.53, 1, 2, 30), 0.5 + 1 / 30);
  assert.equal(stepFrame(0.5, 0.53, -1, 2, 30), 0.5);
});
