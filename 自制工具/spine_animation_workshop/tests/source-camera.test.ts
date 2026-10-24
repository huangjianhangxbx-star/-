import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceCameraBasis } from '../src/preview/source-camera.ts';

const near = (actual: readonly number[], expected: readonly number[]) => {
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9, `${index}: ${value}`));
};

test('source camera follows front/up axes and yaw without flattening the scene', () => {
  const front = sourceCameraBasis('+Z', '+Y', 0, 0);
  near(front.view, [0, 0, 1]);
  near(front.right, [1, 0, 0]);
  near(front.screenUp, [0, 1, 0]);
  const side = sourceCameraBasis('+Z', '+Y', 90, 0);
  near(side.view, [1, 0, 0]);
  near(side.right, [0, 0, -1]);
});

test('pitch rotates both view and camera up while preserving orthogonality', () => {
  const pose = sourceCameraBasis('+Z', '+Y', 0, 30);
  near(pose.view, [0, 0.5, Math.sqrt(3) / 2]);
  near(pose.screenUp, [0, Math.sqrt(3) / 2, -0.5]);
  assert.ok(Math.abs(pose.view.reduce((sum, value, index) => sum + value * pose.screenUp[index], 0)) < 1e-9);
});
