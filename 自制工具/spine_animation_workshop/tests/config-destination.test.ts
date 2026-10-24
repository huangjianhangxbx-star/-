import assert from 'node:assert/strict';
import test from 'node:test';
import { assertConfigDestination } from '../desktop/config-destination.cjs';

test('configuration save refuses loaded source and target input paths', () => {
  const protectedPaths = ['C:\\assets\\CesiumMan.glb', 'C:\\assets\\rozeul.json', 'C:\\assets\\rozeul.spine'];
  assert.throws(() => assertConfigDestination('c:\\ASSETS\\ROZEUL.JSON', protectedPaths), /不能覆盖已载入的原素材/);
  assert.throws(() => assertConfigDestination('C:\\assets\\rozeul.spine', protectedPaths), /不能覆盖已载入的原素材/);
  assert.doesNotThrow(() => assertConfigDestination('C:\\output\\calibration.spw.json', protectedPaths));
});
