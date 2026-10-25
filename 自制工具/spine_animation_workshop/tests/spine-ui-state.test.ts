import assert from 'node:assert/strict';
import test from 'node:test';
import { SpineGenerationGate } from '../src/ui/spine-state.ts';

test('a source or target change invalidates both the preview and save payload', () => {
  const gate = new SpineGenerationGate();
  const first = gate.begin();
  assert.equal(gate.commit(first, { jsonText: '{}', name: 'take', sourceResourceId: 'source-A', targetResourceId: 'target-A' }), true);
  assert.equal(gate.output?.name, 'take');
  gate.invalidate();
  assert.equal(gate.output, null);
  assert.equal(gate.commit(first, { jsonText: '{}', name: 'stale', sourceResourceId: 'source-A', targetResourceId: 'target-A' }), false);
  assert.equal(gate.output, null);
});

test('an async result cannot commit after parameters changed while it was generated', () => {
  const gate = new SpineGenerationGate();
  const pending = gate.begin();
  gate.invalidate();
  const current = gate.begin();
  assert.equal(gate.commit(pending, { jsonText: '{}', name: 'old', sourceResourceId: 'source-A', targetResourceId: 'target-A' }), false);
  assert.equal(gate.commit(current, { jsonText: '{"animations":{}}', name: 'new', sourceResourceId: 'source-B', targetResourceId: 'target-A' }), true);
  assert.equal(gate.output?.sourceResourceId, 'source-B');
});
