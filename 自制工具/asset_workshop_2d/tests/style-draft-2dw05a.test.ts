import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftModel } from '../desktop/draft-model.ts';

const projectStyle = {
  schemaVersion: '2dw-project-style/1' as const,
  name: '星骸手绘块面', summary: '克制的块面表达',
  positiveRules: ['黑块概括闭塞区域'], negativeRules: ['不要写实抛光'],
  toneBudget: { darkMaxTiers: 3, lightMaxTiers: 3 },
  shapeLanguageRules: ['块面清楚'], textureRules: ['少噪点'], renderingWarnings: ['少渐变'],
};
const taskDelta = {
  schemaVersion: '2dw-task-style-delta/1' as const,
  focus: '只重绘中间砖', mustPreserve: ['周边关系'], mustChange: ['更概括'],
  localReferenceNote: '按图 1 中间砖', avoid: ['细碎裂纹'],
  toneBudget: { darkMaxTiers: 4 },
};

test('style values remain shared across modes and editing invalidates the preview', () => {
  const draft = new DraftModel();
  draft.setProjectStyleDefault(projectStyle);
  draft.setTaskStyleDelta(taskDelta);
  const revision = draft.revision;
  assert.equal(draft.acceptPreview(revision), true);
  draft.setMode('custom');
  assert.deepEqual(draft.valuesForBridge().projectStyleContract, projectStyle);
  assert.deepEqual(draft.valuesForBridge().taskStyleDelta, taskDelta);
  draft.setMode('preset');
  draft.setProjectStyleContract({ ...projectStyle, name: '任务专用块面' });
  assert.equal(draft.valuesForBridge().projectStyleContract?.name, '任务专用块面');
  assert.equal(draft.exportRevision, null);
  assert.equal(draft.acceptPreview(revision), false);
});

test('empty baseline is explicit and task delta survives a copy but resets on new task', () => {
  const draft = new DraftModel();
  draft.setTaskId('brick-01');
  draft.setProjectStyleDefault(projectStyle);
  draft.useEmptyProjectStyle();
  draft.setTaskStyleDelta(taskDelta);
  assert.equal(draft.valuesForBridge().projectStyleContract, null);
  draft.copyTask('brick-02');
  assert.equal(draft.valuesForBridge().projectStyleContract, null);
  assert.deepEqual(draft.valuesForBridge().taskStyleDelta, taskDelta);
  draft.newTask('brick-03');
  assert.deepEqual(draft.valuesForBridge().projectStyleContract, projectStyle);
  assert.equal(draft.valuesForBridge().taskStyleDelta, null);
});

test('bridge style values are detached from mutable editor state', () => {
  const draft = new DraftModel();
  draft.setProjectStyleDefault(projectStyle);
  draft.setTaskStyleDelta(taskDelta);
  const values = draft.valuesForBridge();
  values.projectStyleContract!.positiveRules.push('mutated');
  values.taskStyleDelta!.mustChange.push('mutated');
  assert.deepEqual(draft.valuesForBridge().projectStyleContract?.positiveRules, ['黑块概括闭塞区域']);
  assert.deepEqual(draft.valuesForBridge().taskStyleDelta?.mustChange, ['更概括']);
});
