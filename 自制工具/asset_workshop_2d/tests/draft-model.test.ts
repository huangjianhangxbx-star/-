import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftModel } from '../desktop/draft-model.ts';

test('custom requirements stay in their draft and never enter the standalone payload', () => {
  const draft = new DraftModel();
  draft.setField('taskId', 'stone-01');
  draft.setField('title', '石块');
  draft.setMode('custom');
  draft.addRequirement('hard', '必须透明背景');
  draft.addRequirement('preferences', '边缘柔和');
  assert.deepEqual(draft.valuesForBridge().requirements, {
    hard: ['必须透明背景'], preferences: ['边缘柔和'], creativeFreedom: [],
  });

  draft.setMode('preset');
  assert.equal(draft.valuesForBridge().taskId, 'stone-01');
  assert.equal(Object.hasOwn(draft.valuesForBridge(), 'requirements'), false);
  draft.setMode('custom');
  assert.deepEqual(draft.valuesForBridge().requirements?.hard, ['必须透明背景']);
});

test('editing after a preview invalidates export and rejects a stale preview response', () => {
  const draft = new DraftModel();
  draft.setField('taskId', 'stone-01');
  const firstRevision = draft.revision;
  assert.equal(draft.acceptPreview(firstRevision), true);
  assert.equal(draft.exportRevision, firstRevision);

  draft.setField('title', '新标题');
  assert.equal(draft.exportRevision, null);
  assert.equal(draft.acceptPreview(firstRevision), false);
  assert.equal(draft.exportRevision, null);
  assert.equal(draft.acceptPreview(draft.revision), true);
  assert.equal(draft.exportRevision, draft.revision);
});

test('explicit height survives square locking so the engine can report a conflict', () => {
  const draft = new DraftModel();
  draft.setField('widthPx', 512);
  draft.setField('heightPx', 256);
  draft.setField('squareLocked', true);
  assert.equal(draft.valuesForBridge().heightPx, 256);
  assert.equal(draft.valuesForBridge().squareLocked, true);
});

test('requirement movement preserves visible order in the bridge payload', () => {
  const draft = new DraftModel();
  draft.setMode('custom');
  draft.addRequirement('hard', '先保持轮廓');
  draft.addRequirement('hard', '再处理阴影');
  draft.moveRequirement('hard', 1, -1);
  assert.deepEqual(draft.valuesForBridge().requirements?.hard, ['再处理阴影', '先保持轮廓']);
  draft.removeRequirement('hard', 1);
  assert.deepEqual(draft.valuesForBridge().requirements?.hard, ['再处理阴影']);
});
