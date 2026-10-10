import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftModel } from '../desktop/draft-model.ts';

test('material changes invalidate preview, copies preserve selection and ordinary new task clears it', () => {
  const model = new DraftModel() as any;
  assert.equal(typeof model.setEnvironmentStyle, 'function', 'scene selection entry is missing');
  const choice = { schemaVersion: '2dw-environment-style/1', domain: 'environment', materialFamily: 'stone', repeatable: false, connected: false };
  model.setEnvironmentStyle(choice);
  model.acceptPreview(model.revision);
  model.setEnvironmentStyle({ ...choice, materialFamily: 'wood' });
  assert.equal(model.exportRevision, null);
  choice.materialFamily = 'metal';
  assert.equal(model.valuesForBridge().environmentStyle.materialFamily, 'wood');
  model.copyTask('copy-env');
  assert.equal(model.valuesForBridge().environmentStyle.materialFamily, 'wood');
  model.newTask('new-generic');
  assert.ok(!Object.hasOwn(model.valuesForBridge(), 'environmentStyle'));
});
