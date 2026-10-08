import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let runtime;
try { runtime = require('../desktop/runtime.cjs'); } catch { /* expected RED until implemented */ }

test('desktop output and profile remain under a distinct 2D root', () => {
  assert.equal(typeof runtime?.runtimePaths, 'function', 'independent runtime paths are not implemented');
  const roots = runtime.runtimePaths(path.resolve('scratch', 'asset_workshop_2d'));
  const old = path.resolve('scratch', 'map_editor', '.cache', 'desktop-profile');
  assert.notEqual(roots.userData, old);
  assert.equal(roots.userData, path.resolve('scratch', 'asset_workshop_2d', '.cache', 'asset-task-2d-profile'));
  assert.equal(roots.outputDirectory, path.resolve('scratch', 'asset_workshop_2d', 'validation', 'proof-output'));
});

test('renderer IPC accepts only its own top frame and exact local entry URL', () => {
  assert.equal(typeof runtime?.isTrustedSender, 'function', 'IPC trust check is not implemented');
  const frame = { url: 'file:///2d/index.html' };
  const own = { mainFrame: frame };
  assert.equal(runtime.isTrustedSender({ sender: own, senderFrame: frame }, own, frame.url), true);
  assert.equal(runtime.isTrustedSender({ sender: own, senderFrame: { url: frame.url } }, own, frame.url), false);
  assert.equal(runtime.isTrustedSender({ sender: { mainFrame: frame }, senderFrame: frame }, own, frame.url), false);
  assert.equal(runtime.isTrustedSender({ sender: own, senderFrame: frame }, own, 'file:///3d/index.html'), false);
});
